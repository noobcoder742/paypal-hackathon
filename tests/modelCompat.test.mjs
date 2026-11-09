import test from 'node:test';
import assert from 'node:assert/strict';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { coupleTools } from '../server/agent/coupleTools.js';
import { hotelTools } from '../server/agent/hotelAgent.js';
import { getStore } from '../server/store.js';
import { agentErrorMessage } from '../server/agentError.js';

// Gemini rejects a function declaration whose OBJECT parameters have no properties.
test('every agent tool has at least one parameter (Gemini fallback accepts it)', () => {
  const all = {
    ...coupleTools({ store: getStore(), planId: 'plan-a1b2c3d4' }),
    ...hotelTools({ store: getStore(), enquiry: { id: 'e1', venueId: 'orchard-grand', tables: 30 } }),
  };
  for (const [name, t] of Object.entries(all)) {
    const schema = zodToJsonSchema(t.parameters);
    assert.ok(Object.keys(schema.properties || {}).length > 0, `${name} has no parameters`);
  }
});
test('model errors reach the user as a short code, never the raw message', () => {
  const err = Object.assign(new Error('secret upstream detail sk-xyz'), {
    name: 'AI_APICallError',
    statusCode: 400,
  });
  const orig = console.error;
  console.error = () => {};
  try {
    const msg = agentErrorMessage(err);
    assert.match(msg, /unavailable/);
    assert.match(msg, /AI_APICallError 400/);
    assert.doesNotMatch(msg, /secret|sk-/);
  } finally {
    console.error = orig;
  }
});
