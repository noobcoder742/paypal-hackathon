import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as login, GET as list } from '../api/hotel/enquiries.js';
import { POST as agent } from '../api/hotel/agent.js';
import { POST as nudge } from '../api/hotel/nudge.js';
import { resetMemoryStore, getStore } from '../server/store.js';
const o = 'https://demo.example',
  req = (path, body, token, method = 'POST') =>
    new Request(o + path, {
      method,
      headers: {
        origin: o,
        'content-type': 'application/json',
        ...(token ? { authorization: 'Bearer ' + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
test('hotel flow: login, list, quote draft streams; nudge needs an invoice; long reminders refused', async () => {
  process.env.AGENT_FAKE = '1';
  process.env.HOTEL_DEMO_PASSWORD = 'orchard-demo';
  resetMemoryStore();
  await getStore().set('enquiry:enq-test1', {
    id: 'enq-test1',
    venueId: 'orchard-grand',
    tables: 20,
    date: '2027-06-12',
    coupleName: 'Mei Tan',
    email: 'b@example.com',
    status: 'new',
    createdAt: 1,
  });
  assert.equal((await login(req('/api/hotel/enquiries', { password: 'nope' }))).status, 401);
  const { token } = await (await login(req('/api/hotel/enquiries', { password: 'orchard-demo' }))).json();
  assert.equal((await list(req('/api/hotel/enquiries', null, null, 'GET'))).status, 401);
  const l = await (await list(req('/api/hotel/enquiries', null, token, 'GET'))).json();
  assert.equal(l.enquiries.length, 1);
  const a = await agent(req('/api/hotel/agent', { enquiryId: 'enq-test1' }, token));
  const t = await a.text();
  assert.match(t, /draft_quote/);
  assert.match(t, /16,459\.87/);
  assert.equal(
    (await nudge(req('/api/hotel/nudge', { enquiryId: 'enq-test1', action: 'draft' }, token))).status,
    404
  );
  assert.equal(
    (
      await nudge(
        req('/api/hotel/nudge', { enquiryId: 'enq-test1', action: 'send', text: 'x'.repeat(401) }, token)
      )
    ).status,
    400
  );
  delete process.env.AGENT_FAKE;
});
