// Vite config: the defaults, plus (in `vite dev` only) the api/ functions served locally,
// so the agent, PayPal and hotel endpoints run without Vercel. Production uses Vercel functions.
import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
function localApi() {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      loadEnvLocal();
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://' + req.headers.host);
        if (!url.pathname.startsWith('/api/')) return next();
        const file = '/api/' + url.pathname.slice(5).replace(/\/$/, '') + '.js';
        let mod;
        try {
          mod = await server.ssrLoadModule(file);
        } catch {
          res.statusCode = 404;
          return res.end('not found');
        }
        const handler = mod[req.method];
        if (!handler) {
          res.statusCode = 405;
          return res.end();
        }
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const request = new Request(url, {
          method: req.method,
          headers: req.headers,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
        });
        const r = await handler(request);
        res.statusCode = r.status;
        r.headers.forEach((v, k) => res.setHeader(k, v));
        if (!r.body) return res.end();
        const reader = r.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      });
    },
  };
}
export default defineConfig({ plugins: [localApi()] });
