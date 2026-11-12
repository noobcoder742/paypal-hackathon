// Which services are configured (yes/no only; never a key or value). Served by GET /api/paypal/config?health=1
// (Vercel's Hobby plan allows 12 functions, so this shares an endpoint).
import { storageKind } from './store.js';
export function health() {
  const has = k => !!(process.env[k] && String(process.env[k]).trim());
  return {
    storage: {
      redis: 'shared (Upstash Redis)',
      supabase: 'shared (Supabase)',
      memory: 'memory only: each function has its own data, so sign-ins and bookings do not carry over',
    }[storageKind()],
    ai: { claude: has('ANTHROPIC_API_KEY'), gemini: has('GOOGLE_GENERATIVE_AI_API_KEY') },
    paypal: {
      clientId: has('PAYPAL_CLIENT_ID'),
      secret: has('PAYPAL_CLIENT_SECRET'),
      browserClientId: has('VITE_PAYPAL_CLIENT_ID'),
      sandbox: (process.env.PAYPAL_ENV || 'sandbox') === 'sandbox',
    },
    demoPassword: has('DEMO_PASSWORD') || has('HOTEL_DEMO_PASSWORD'),
  };
}

/** One tiny call per configured model. Reports ok or the error's type, status and message (no keys). */
export async function aiCheck() {
  const { generateText } = await import('ai');
  const { defaultModels } = await import('./models.js');
  const out = {};
  // all models at once, each with its own time limit, so one slow model can't time out the whole check
  const check = async model => {
    try {
      const r = await generateText({
        model,
        prompt: 'Reply with the word ok.',
        maxTokens: 5,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(15000),
      });
      out[model.modelId] = { ok: true, reply: r.text.slice(0, 20) };
    } catch (e) {
      const inner = e?.lastError || e;
      out[model.modelId] = {
        ok: false,
        error: inner?.name || 'Error',
        status: inner?.statusCode || null,
        message: String(inner?.message || '')
          .replace(/sk-[\w-]+/g, '[key]')
          .slice(0, 200),
      };
    }
  };
  await Promise.all((await defaultModels()).map(check));
  return out;
}
