#!/usr/bin/env node
// Records the "recorded example run" the panel plays when the AI is unavailable.
// Uses the scripted dev model (no keys); the tools, prices and plan are the real ones.
process.env.AGENT_FAKE = '1';
const { writeFile } = await import('node:fs/promises');
const { POST } = await import('../api/agent.js');
const prompt = '30 tables, S$95,000 all-in, garden style, near Orchard';
const r = await POST(
  new Request('https://demo.local/api/agent', {
    method: 'POST',
    headers: {
      origin: 'https://demo.local',
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
    },
    body: JSON.stringify({ planId: 'plan-recorded-example', messages: [{ role: 'user', content: prompt }] }),
  })
);
const body = await r.text();
if (!/place_in_ballroom/.test(body)) throw new Error('recording did not place a plan');
await writeFile('src/explorer/agent/replay.json', JSON.stringify({ prompt, body }));
console.log('recorded', body.length, 'bytes');
