// Focused check: the new s02 (ЦИТОЛОГІЯ 2) quiz renders every question in the UI.
//   BASE=http://localhost:4288 node tools/verify-s02.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4288';
const browser = await chromium.launch();
let failed = false;
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Seed + list
  await page.goto(BASE);
  await page.waitForSelector('.quiz-card', { timeout: 30000 });
  const cards = await page.locator('.quiz-card').count();
  console.log(`quiz cards in list: ${cards}`);

  // Catalog truth
  const catalog = await (await fetch(`${BASE}/quizs/questions.json`)).json();
  const s02 = catalog.quizzes.find((q) => q.id === 's02');
  if (!s02) throw new Error('s02 not in catalog');
  console.log(`s02 title="${s02.title}" count=${s02.count} questions=${s02.questions.length}`);
  if (s02.count !== s02.questions.length) throw new Error('s02 count mismatch');

  // The s02 card is visible and labelled
  const card = page.locator('.quiz-card', { hasText: 'ЦИТОЛОГІЯ 2' });
  if ((await card.count()) !== 1) throw new Error('ЦИТОЛОГІЯ 2 card not found exactly once');
  console.log('✓ ЦИТОЛОГІЯ 2 card present in list');

  // Open it and step through ALL questions
  await page.goto(`${BASE}/quiz/s02`);
  await page.waitForSelector('.card', { timeout: 15000 });
  const total = s02.questions.length;
  let rendered = 0, emptyText = 0, badOptions = 0;
  for (let i = 1; i <= total; i++) {
    await page.waitForSelector('.card');
    const qtext = (await page.locator('.card__question').innerText()).trim();
    const nOpts = await page.locator('.option').count();
    if (qtext.length > 0) rendered++; else { emptyText++; console.log(`  ! Q#${i} empty text`); }
    if (nOpts < 3) { badOptions++; console.log(`  ! step ${i} has ${nOpts} options`); }
    // progress label sanity
    const label = await page.locator('.progress__label').innerText();
    if (!label.includes(`/ ${total}`)) {
      console.log(`  ! progress label "${label}" does not show / ${total}`);
    }
    // answer to reveal Next, then advance
    await page.locator('.option').first().click();
    await page.waitForSelector('.option--correct, .option--wrong, .option--no-answer');
    const btn = page.locator('.player__nav .btn--primary');
    await btn.click();
    if (i < total) await page.waitForSelector('.card');
  }
  await page.waitForSelector('.result', { timeout: 15000 });
  console.log(`✓ reached results after ${total} questions`);
  console.log(`rendered with text: ${rendered}/${total}; empty: ${emptyText}; <3 options: ${badOptions}`);
  if (rendered !== total || emptyText || badOptions) { failed = true; }
  if (!failed) console.log('\nALL S02 QUESTIONS RENDER ✓');
} catch (e) {
  failed = true;
  console.error('VERIFY FAILED:', e.message);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
