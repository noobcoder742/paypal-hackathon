import test from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV1 } from 'ai/test';
import { toMessages, runStudioTurn } from '../server/studioLlm.js';
test('AG Studio conversation items become AI SDK messages', () => {
  const m = toMessages([
    {
      id: '1',
      kind: 'input',
      type: 'message',
      role: 'user',
      content: [{ type: 'text', text: 'Who still owes deposits?' }],
      status: 'completed',
    },
    {
      id: '2',
      kind: 'output',
      type: 'function_call',
      callId: 'c1',
      name: 'unpaid_deposits',
      arguments: '{}',
    },
    { type: 'function_call_output', callId: 'c1', output: '2 couples', status: 'completed' },
    {
      id: '3',
      kind: 'output',
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'text', text: 'Two couples.', annotations: [] }],
    },
  ]);
  assert.deepEqual(
    m.map(x => x.role),
    ['user', 'assistant', 'tool', 'assistant']
  );
  assert.equal(m[1].content[0].toolName, 'unpaid_deposits');
  assert.equal(m[2].content[0].toolName, 'unpaid_deposits');
  assert.equal(m[2].content[0].result, '2 couples');
});
test('tool calls come back for Studio to run, not executed here', async () => {
  const model = new MockLanguageModelV1({
    modelId: 'm',
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'tool-calls',
      usage: { promptTokens: 1, completionTokens: 1 },
      toolCalls: [
        { toolCallType: 'function', toolCallId: 't1', toolName: 'addWidget', args: '{"type":"pie-chart"}' },
      ],
    }),
  });
  const r = await runStudioTurn(
    {
      input: [
        { kind: 'input', type: 'message', role: 'user', content: [{ type: 'text', text: 'add a pie' }] },
      ],
      tools: [
        {
          name: 'addWidget',
          description: 'add',
          parameters: { type: 'object', properties: { type: { type: 'string' } } },
        },
      ],
      responseFormat: { type: 'text' },
    },
    { models: [model] }
  );
  assert.deepEqual(r.toolCalls, [{ callId: 't1', name: 'addWidget', arguments: '{"type":"pie-chart"}' }]);
});
