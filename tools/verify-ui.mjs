// Headless end-to-end check of the quiz UI (fallback for the Playwright MCP,
// which loads as interactive tools only after a Claude Code restart).
//
//   node tools/verify-ui.mjs            # against http://localhost:4288
//
// Covers: IndexedDB seed-once (catalog fetched first load, only version.json on
// reload), core play (green / red+green / Back), question editing + persistence,
// multiple correct answers, the blue no-answer state, the results screen, and a
// mobile-viewport pass.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE ?? 'http://localhost:4288';
const SHOTS = '/tmp/quiz-shots';
const LABELS = ['A', 'B', 'C', 'D', 'E'];

const ok = (msg) => console.log(`  ✓ ${msg}`);
function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  ok(msg);
}
const classOf = (page, i) => page.locator('.option').nth(i).getAttribute('class');
const idx = (label) => LABELS.indexOf(label);

// A small deterministic catalog used (via request interception) to exercise the
// finish/results flow and the no-answer path without stepping through 121 real
// questions.
const TINY = {
  version: 999,
  quizzes: [
    {
      id: 't01',
      title: 'ТЕСТ',
      count: 3,
      questions: [
        opt(1, ['C']), // single correct
        opt(2, ['B', 'D']), // multiple correct
        opt(3, []), // no correct → blue
      ],
    },
  ],
};
function opt(id, correct) {
  return {
    id,
    section: 'ТЕСТ',
    question: `Питання ${id}?`,
    options: LABELS.map((label) => ({ label, text: `Варіант ${label}`, correct: correct.includes(label) })),
  };
}

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch();

try {
  // ---- Context A: real data — seed-once + core play -----------------------
  const ctxA = await browser.newContext();
  const page = await ctxA.newPage();
  let catalogHits = 0;
  let versionHits = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/quizs/questions.json')) catalogHits++;
    if (r.url().endsWith('/quizs/version.json')) versionHits++;
  });

  console.log('• First load seeds IndexedDB');
  await page.goto(BASE);
  await page.waitForSelector('.quiz-card');
  assert(catalogHits === 1, `catalog fetched once on first load (got ${catalogHits})`);
  assert(versionHits === 1, `version.json fetched once on first load (got ${versionHits})`);
  const cards = await page.locator('.quiz-card').count();
  assert(cards === 18, `list shows 18 quizzes (got ${cards})`);
  await page.screenshot({ path: `${SHOTS}/01-list.png`, fullPage: true });

  console.log('• Reload reads from IndexedDB (no catalog re-fetch)');
  catalogHits = 0;
  versionHits = 0;
  await page.reload();
  await page.waitForSelector('.quiz-card');
  assert(catalogHits === 0, `catalog NOT re-fetched on reload (got ${catalogHits})`);
  assert(versionHits === 1, `only version.json checked on reload (got ${versionHits})`);

  console.log('• Open first quiz → green, then wrong → red+green, then Back');
  const catalog = await (await fetch(`${BASE}/quizs/questions.json`)).json();
  const s01 = catalog.quizzes.find((q) => q.id === 's01');
  const correct1 = s01.questions[0].options.find((o) => o.correct).label;
  const correct2 = s01.questions[1].options.find((o) => o.correct).label;
  await page.locator('.quiz-card').first().click();
  await page.waitForSelector('.card');
  assert((await page.locator('.progress').count()) === 1, 'progress bar rendered');

  await page.locator('.option').nth(idx(correct1)).click();
  await page.waitForSelector('.option--correct');
  assert((await classOf(page, idx(correct1))).includes('option--correct'), `correct ${correct1} green`);
  assert(await page.locator('.player__nav .btn--primary').isVisible(), 'Next button appeared');
  await page.screenshot({ path: `${SHOTS}/02-correct.png`, fullPage: true });

  await page.locator('.player__nav .btn--primary').click();
  await page.waitForSelector('.card');
  const wrong2 = LABELS.find((l) => l !== correct2);
  await page.locator('.option').nth(idx(wrong2)).click();
  await page.waitForSelector('.option--wrong');
  assert((await classOf(page, idx(wrong2))).includes('option--wrong'), `wrong ${wrong2} red`);
  assert((await classOf(page, idx(correct2))).includes('option--correct'), `correct ${correct2} green`);
  await page.screenshot({ path: `${SHOTS}/03-wrong.png`, fullPage: true });

  await page.locator('.player__nav .btn', { hasText: 'Назад' }).click();
  await page.locator('.progress__label', { hasText: 'Питання 1 /' }).waitFor();
  assert((await classOf(page, idx(correct1))).includes('option--correct'), 'Back keeps locked answer');
  await ctxA.close();

  // ---- Context D: controlled catalog — edit, multi-correct, blue, results --
  const ctxD = await browser.newContext();
  const p = await ctxD.newPage();
  await p.route('**/quizs/version.json', (r) => r.fulfill({ json: { version: TINY.version } }));
  await p.route('**/quizs/questions.json', (r) => r.fulfill({ json: TINY }));

  console.log('• Edit a question (text + correct answers) and persist it');
  await p.goto(`${BASE}/quiz/t01`);
  await p.waitForSelector('.card');
  await p.locator('.card__edit').click();
  await p.waitForSelector('dialog[open]');
  await p.screenshot({ path: `${SHOTS}/06-edit-modal.png`, fullPage: true });
  const checkbox = (label) =>
    p.locator('.edit__option').nth(idx(label)).locator('input[type="checkbox"]');
  await p.locator('textarea[name="question"]').fill('РЕДАГОВАНО ✎');
  await checkbox('C').uncheck();
  await checkbox('A').check();
  await p.locator('.edit .btn--primary').click();
  await p.waitForSelector('dialog[open]', { state: 'detached' });
  await p.locator('.card__question', { hasText: 'РЕДАГОВАНО' }).waitFor({ timeout: 5000 });
  ok('card shows the edited question text');
  await p.locator('.option').nth(idx('A')).click();
  await p.waitForSelector('.option--correct');
  assert((await classOf(p, idx('A'))).includes('option--correct'), 'edited correct answer A is green');
  await p.screenshot({ path: `${SHOTS}/07-edit-applied.png`, fullPage: true });

  console.log('• Reload → edit persisted from IndexedDB');
  await p.reload();
  await p.waitForSelector('.card');
  await p.locator('.card__question', { hasText: 'РЕДАГОВАНО' }).waitFor({ timeout: 5000 });
  ok('edit survived reload (read from IndexedDB)');

  console.log('• Multiple correct answers reveal together');
  await p.locator('.option').nth(idx('A')).click(); // q1 (edited correct = A)
  await p.locator('.player__nav .btn--primary').click(); // -> q2
  await p.waitForSelector('.card');
  await p.locator('.option').nth(idx('B')).click(); // pick one of {B,D}
  await p.waitForSelector('.option--correct');
  assert((await classOf(p, idx('B'))).includes('option--correct'), 'B green (one correct)');
  assert((await classOf(p, idx('D'))).includes('option--correct'), 'D also green (other correct)');
  await p.screenshot({ path: `${SHOTS}/08-multi-correct.png`, fullPage: true });

  console.log('• No-answer question → blue, then results');
  await p.locator('.player__nav .btn--primary').click(); // -> q3
  await p.waitForSelector('.card');
  await p.locator('.option').nth(idx('A')).click();
  await p.waitForSelector('.option--no-answer');
  assert((await classOf(p, idx('A'))).includes('option--no-answer'), 'pick is blue (no correct answer)');
  await p.screenshot({ path: `${SHOTS}/09-blue.png`, fullPage: true });

  const finishBtn = p.locator('.player__nav .btn--primary');
  assert((await finishBtn.innerText()).includes('Завершити'), 'last question shows "Завершити"');
  await finishBtn.click();
  await p.waitForSelector('.result');
  assert(await p.locator('.result__heading').isVisible(), 'results screen shown');
  assert((await p.locator('.result__score').innerText()).includes('2'), 'score counts the 2 correct picks');
  await p.screenshot({ path: `${SHOTS}/10-results.png`, fullPage: true });
  await ctxD.close();

  // ---- Context M: mobile viewport ----------------------------------------
  console.log('• Mobile viewport (390×844)');
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const m = await ctxM.newPage();
  await m.goto(BASE);
  await m.waitForSelector('.quiz-card');
  await m.screenshot({ path: `${SHOTS}/11-mobile-list.png`, fullPage: true });
  await m.locator('.quiz-card').first().click();
  await m.waitForSelector('.card');
  await m.screenshot({ path: `${SHOTS}/12-mobile-player.png`, fullPage: true });
  await m.locator('.card__edit').click();
  await m.waitForSelector('dialog[open]');
  await m.screenshot({ path: `${SHOTS}/13-mobile-modal.png` });
  await ctxM.close();

  console.log('\nALL CHECKS PASSED — screenshots in ' + SHOTS);
} finally {
  await browser.close();
}
