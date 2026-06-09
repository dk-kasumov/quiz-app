// Verifies the production build is an installable PWA: manifest + ngsw assets
// are served and the service worker registers and activates.
//
//   BASE=http://localhost:4310 node tools/verify-pwa.mjs

import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4310';
const ok = (m) => console.log(`  ✓ ${m}`);
function assert(c, m) {
  if (!c) throw new Error(`ASSERTION FAILED: ${m}`);
  ok(m);
}

async function status(path) {
  const res = await fetch(`${BASE}${path}`);
  return res.status;
}

assert((await status('/manifest.webmanifest')) === 200, 'manifest.webmanifest is served');
assert((await status('/ngsw.json')) === 200, 'ngsw.json is served');
assert((await status('/ngsw-worker.js')) === 200, 'ngsw-worker.js is served');

const manifest = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
assert(manifest.name && manifest.icons?.length >= 2 && manifest.start_url, 'manifest has name, icons, start_url');
assert(manifest.icons.some((i) => i.sizes === '512x512'), 'manifest has a 512×512 icon (installable)');

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(BASE);
  await page.waitForSelector('.quiz-card');
  // registerWhenStable: the SW registers once the app is stable; wait for it.
  const active = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  assert(active, 'service worker registered and activated');
  console.log('\nPWA CHECKS PASSED');
} finally {
  await browser.close();
}
