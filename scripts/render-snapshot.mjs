#!/usr/bin/env node
// Renders the instant picture of the venue map's opening view (spec B2):
// opens the production build at 1600x900 in ?snapshot=1 mode (no search box,
// pins or card), waits for full detail around the start view, and writes
// public/map-snapshot.webp at the best WebP quality that stays within 120 KB.
// Usage: BASE_URL=http://localhost:4173 node scripts/render-snapshot.mjs
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:4173',
  OUT = 'public/map-snapshot.webp',
  LIMIT = 120e3;
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultTimeout(300000);
await page.route(
  u => !u.href.startsWith(BASE),
  r => r.abort()
);
await page.goto(BASE + '/?snapshot=1');
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('wedding-session-v1', JSON.stringify({ email: 'snapshot@local', name: 'Snapshot' }));
});
await page.goto(BASE + '/?snapshot=1&perf', { waitUntil: 'load' });
await page.click('.nav-pill button:has-text("Design")');
await page.waitForFunction(() => window.__cityMetrics?.baseLoadedMs != null && window.__mapRig);
// settle at the start view with full detail around it and nothing fading
await page.waitForFunction(
  () => {
    const s = window.__cityStream,
      { cur, goal } = window.__mapRig;
    window.__mapWake?.();
    return s && Math.abs(cur.r - goal.r) < 1 && s.readyAround(cur.tx, cur.tz, 1500) && !s.fading;
  },
  null,
  { polling: 500 }
);
await page.waitForTimeout(8000);
await page.evaluate(() => window.__mapWake?.());
await page.waitForTimeout(2000);
const png = await page.locator('.map-slot canvas').screenshot({ type: 'png' });
// encode with the browser's WebP encoder, best quality that fits
const enc = await browser.newPage();
let shot, q;
for (q = 0.86; q >= 0.3; q -= 0.08) {
  const b64 = await enc.evaluate(
    async ([src, q]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/webp', q).split(',')[1];
    },
    [png.toString('base64'), q]
  );
  shot = Buffer.from(b64, 'base64');
  if (shot.length <= LIMIT) break;
}
q = Math.round(q * 100);
await browser.close();
if (shot.length > LIMIT) {
  console.error(`snapshot is ${(shot.length / 1e3).toFixed(0)} KB even at quality ${q}`);
  process.exit(1);
}
await writeFile(OUT, shot);
console.log(`wrote ${OUT}: ${(shot.length / 1e3).toFixed(0)} KB at quality ${q}`);
