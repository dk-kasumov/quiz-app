#!/usr/bin/env node
// Builds the seed catalog the app loads once into IndexedDB.
//
//   node tools/build-quizzes.mjs
//
// Reads : tools/questions.json   (output of parser.mjs)
// Writes: public/quizs/questions.json -> { version, quizzes: [{ id, title, count, questions[] }] }
//         public/quizs/version.json   -> { version }   (tiny; the only warm-start fetch)
//
// One quiz == one section. `id` is a zero-padded ordinal slug (s01..sNN) in the
// order sections first appear in the source. Correctness lives on each option's
// `correct` flag (the single `answer` field is dropped — it is derived).

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Bump when the question data changes to trigger a version-gated re-seed.
const VERSION = 1;

const rel = (p) => fileURLToPath(new URL(p, import.meta.url));
const SRC = rel('./questions.json');
const OUT_DIR = rel('../public/quizs');

const raw = JSON.parse(await readFile(SRC, 'utf8'));

// Group questions by section, preserving first-seen order.
const order = [];
const bySection = new Map();
for (const q of raw.questions) {
  if (!bySection.has(q.section)) {
    bySection.set(q.section, []);
    order.push(q.section);
  }
  bySection.get(q.section).push(q);
}

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const quizzes = [];
let total = 0;
for (let i = 0; i < order.length; i++) {
  const title = order[i];
  const id = `s${String(i + 1).padStart(2, '0')}`;
  const questions = bySection.get(title).map((q) => ({
    id: q.id,
    section: q.section,
    question: q.question,
    options: q.options.map((o) => ({ label: o.label, text: o.text, correct: Boolean(o.correct) })),
  }));
  total += questions.length;
  quizzes.push({ id, title, count: questions.length, questions });
}

await writeFile(`${OUT_DIR}/questions.json`, JSON.stringify({ version: VERSION, quizzes }));
await writeFile(`${OUT_DIR}/version.json`, JSON.stringify({ version: VERSION }));

console.log(`Wrote catalog v${VERSION}: ${quizzes.length} quizzes (${total} questions) -> public/quizs/`);
for (const q of quizzes) console.log(`  ${q.id}  ${String(q.count).padStart(3)}  ${q.title}`);
if (total !== raw.count) console.log(`  ! total ${total} != source count ${raw.count}`);
