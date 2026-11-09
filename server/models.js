// Claude Haiku first, Gemini's free tier if Claude fails before it has sent anything.
// Returns an AI SDK LanguageModelV1, so streamText/generateText use it like any model.
let modelFactory = null;
/** Tests replace the default models. */
export function setModelFactory(fn) {
  modelFactory = fn;
}
export async function defaultModels() {
  if (modelFactory) return modelFactory();
  if (process.env.AGENT_FAKE === '1' && !process.env.VERCEL) {
    const { fakeModel } = await import('./devFakeModel.js');
    return [fakeModel()];
  }
  const out = [];
  if (process.env.ANTHROPIC_API_KEY) {
    const { anthropic } = await import('@ai-sdk/anthropic');
    out.push(anthropic('claude-haiku-5-5'));
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const { google } = await import('@ai-sdk/google');
    const claude = out.length > 0;
    out.push(quickGemini(google(process.env.GEMINI_MODEL || 'gemini-flash-latest'), claude ? 25000 : 30000));
    // the free tier's main model is often busy (503); the lighter model usually still answers
    out.push(
      quickGemini(
        google(process.env.GEMINI_BACKUP_MODEL || 'gemini-flash-lite-latest'),
        claude ? 15000 : 25000
      )
    );
  }
  return out;
}
/**
 * Newer Gemini Flash models "think" before answering, which can take longer than our time limit
 * before the first word arrives. Ask for no thinking (thinkingBudget 0); if a model refuses that
 * setting, send the request again without it. Gemini also gets a little longer to start.
 */
export function quickGemini(model, startMs = 30000) {
  const fast = o => ({
    ...o,
    providerMetadata: {
      ...o.providerMetadata,
      google: { ...(o.providerMetadata?.google || {}), thinkingConfig: { thinkingBudget: 0 } },
    },
  });
  // any 400 (bad request): the thinking setting is the only thing we add, so try once without it
  const refusedSetting = e => e?.statusCode === 400 || e?.status === 400;
  const call = (fn, o) =>
    fn(fast(o)).catch(e => {
      if (refusedSetting(e)) return fn(o);
      throw e;
    });
  const m = Object.create(model);
  m.doStream = o => call(x => model.doStream(x), o);
  m.doGenerate = o => call(x => model.doGenerate(x), o);
  m.firstChunkMs = startMs;
  return m;
}
// A model that has not started answering by then is abandoned (the next model tries,
// or the chat gets an error) instead of running into Vercel's 60 s function limit.
let firstChunkMs = 20000;
export function setFirstChunkTimeout(ms) {
  firstChunkMs = ms;
}
/** Start a stream; if it fails before its first chunk, report failure so the next model can try. */
async function startStream(model, options) {
  const ac = new AbortController();
  const outer = options.abortSignal;
  if (outer) {
    if (outer.aborted) ac.abort(outer.reason);
    else outer.addEventListener('abort', () => ac.abort(outer.reason), { once: true });
  }
  const ms = model.firstChunkMs || firstChunkMs;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = Object.assign(new Error(`${model.modelId} sent nothing for ${ms} ms`), {
        name: 'FirstChunkTimeout',
      });
      ac.abort(e);
      reject(e);
    }, ms);
  });
  let reader, first;
  try {
    const res = await Promise.race([model.doStream({ ...options, abortSignal: ac.signal }), timeout]);
    reader = res.stream.getReader();
    first = await Promise.race([reader.read(), timeout]);
    if (first.done) throw new Error('empty response from ' + model.modelId);
    if (first.value?.type === 'error')
      throw first.value.error instanceof Error ? first.value.error : new Error(String(first.value.error));
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(first.value);
      },
      async pull(c) {
        const { done, value } = await reader.read();
        if (done) c.close();
        else c.enqueue(value);
      },
      cancel(r) {
        reader.cancel(r);
      },
    });
    return { ...res, stream };
  } catch (e) {
    reader?.cancel(e).catch(() => {});
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
/** doGenerate with the same time limit (the whole answer, since it is not streamed). */
async function generateWithin(model, options, ms) {
  const ac = new AbortController();
  const outer = options.abortSignal;
  if (outer) {
    if (outer.aborted) ac.abort(outer.reason);
    else outer.addEventListener('abort', () => ac.abort(outer.reason), { once: true });
  }
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = Object.assign(new Error(`${model.modelId} did not answer within ${ms} ms`), {
        name: 'FirstChunkTimeout',
      });
      ac.abort(e);
      reject(e);
    }, ms);
  });
  try {
    return await Promise.race([model.doGenerate({ ...options, abortSignal: ac.signal }), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
export function fallbackModel(models) {
  if (!models.length)
    throw new Error('no AI model is configured (set ANTHROPIC_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY)');
  let used = null;
  const tryEach = async fn => {
    let err;
    for (const m of models) {
      try {
        const r = await fn(m);
        used = m.modelId;
        return r;
      } catch (e) {
        err = e;
      }
    }
    throw err;
  };
  return {
    specificationVersion: 'v1',
    provider: 'fallback',
    modelId: models.map(m => m.modelId).join('>'),
    defaultObjectGenerationMode: models[0].defaultObjectGenerationMode || 'tool',
    supportsImageUrls: false,
    doGenerate: options => tryEach(m => generateWithin(m, options, (m.firstChunkMs || firstChunkMs) * 1.5)),
    doStream: options => tryEach(m => startStream(m, options)),
    lastModelUsed: () => used,
  };
}
