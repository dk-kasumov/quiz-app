#!/usr/bin/env node
// Parses the histology exam PDF into structured JSON.
//
//   node parser.mjs [input.pdf] [output.json]
//
// Defaults: ./гиста сессия.pdf  ->  ./questions.json
//
// Document structure (observed):
//   - Section headers are standalone ALL-CAPS Ukrainian lines (e.g. "ЦИТОЛОГІЯ").
//   - Each question is a scenario paragraph ending in "?", wrapped across lines
//     with hyphenation (e.g. "між-\nклітинна").
//   - Five answer options follow, labelled A B C D E. Letters are a MIX of Latin
//     (A B C D E) and Cyrillic look-alikes (А В С Е) — we normalise to Latin.
//   - The single correct option is prefixed with "*".

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const rel = (name) => fileURLToPath(new URL(name, import.meta.url));
const INPUT = process.argv[2] ?? rel('./гиста сессия.pdf');
const OUTPUT = process.argv[3] ?? rel('./questions.json');

// --- option line: optional leading "*", a Latin/Cyrillic A-E letter, a
// separator, then the answer text. The separator is "." / ")" or a bare "*"
// (some options drop the dot, e.g. "D * Селезінка"). Requiring a separator
// keeps words that merely start with А/В/С/Е (e.g. "Епітеліальна") from matching.
//   groups: 1=leading star  2=letter  3=separator  4=text
const OPTION_RE = /^\s*(\*)?\s*([ABCDEАВСЕ])\s*([.)]|\*)\s*(.*)$/u;
// Fallback for options that drop the separator entirely ("B Осьового скелету").
// Used only mid-sequence for the exact next expected letter (see below).
const BARE_OPTION_RE = /^\s*([ABCDEАВСЕ])\s+(\*\s*)?(\S.*?)\s*$/u;
// Cyrillic look-alike -> Latin, so output labels are consistent.
const TO_LATIN = { А: 'A', В: 'B', С: 'C', Е: 'E' };
const NEXT = { A: 'B', B: 'C', C: 'D', D: 'E', E: 'A' };
const ORDER = 'ABCDE';

/** Pull every PDF page into an array of visual text lines (grouped by Y). */
async function extractLines(pdfPath) {
  const data = new Uint8Array(await readFile(pdfPath));
  const doc = await getDocument({ data }).promise;
  const lines = [];
  for (let p = 2; p <= doc.numPages; p++) {
    // Page 1 is the title page — skip it.
    const content = await (await doc.getPage(p)).getTextContent();
    let lastY = null, buf = '';
    for (const item of content.items) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(buf); buf = ''; }
      buf += item.str;
      lastY = y;
    }
    if (buf) lines.push(buf);
  }
  // Normalise odd spaces and trim; drop blank and page-number-only lines.
  return lines
    .map((l) => l.replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((l) => l && !/^\d{1,3}$/.test(l));
}

/** Join wrapped line fragments: de-hyphenate "foo-" + "bar" -> "foobar". */
function joinFragments(fragments) {
  let out = '';
  for (const raw of fragments) {
    const frag = raw.trim();
    if (!frag) continue;
    if (!out) out = frag;
    else if (out.endsWith('-')) out = out.slice(0, -1) + frag;
    else out += ' ' + frag;
  }
  return out.replace(/\s+/g, ' ').trim();
}

const isSectionHeader = (line) =>
  line.length >= 5 && line.length <= 45 &&
  /^[А-ЯЇІЄҐ’'\-\s]+$/u.test(line) &&
  line === line.toUpperCase() &&
  /[А-ЯЇІЄҐ]{4}/u.test(line);

function parse(lines) {
  const questions = [];
  let section = null;
  let current = null;            // question being built
  let qFragments = [];           // accumulating question-scenario text
  let expect = 'A';              // next option letter we expect to see
  let mode = 'question';         // 'question' | 'options'

  // Close out the just-completed question. Its scenario text was assigned when
  // this question's "A" option appeared; here we only finalise its option text.
  const finalize = () => {
    if (!current) return;
    for (const o of current.options) { o.text = joinFragments(o.fragments); delete o.fragments; }
    questions.push(current);
  };

  for (const line of lines) {
    const m = line.match(OPTION_RE);
    const letter = m ? (TO_LATIN[m[2]] ?? m[2]) : null;

    // Accept an option line when its letter is the one we expect, OR — while
    // already inside an option block — a letter further along the A→E sequence.
    // The latter handles source defects where a label is missing (e.g. options
    // jump A, B, D, E with no C); skipped letters get empty placeholders.
    // Strict ordering still filters stray "X." fragments inside answer text.
    const ahead = mode === 'options' && expect !== 'A' && ORDER.indexOf(letter) > ORDER.indexOf(expect);
    if (m && (letter === expect || ahead)) {
      if (letter === 'A') {
        finalize();                              // push the previous, completed question
        // The text gathered since the previous question's options is THIS
        // question's scenario (text precedes its options in the document).
        current = { section, question: joinFragments(qFragments), options: [], answer: null };
        qFragments = [];
        mode = 'options';
      }
      // Fill any labels the source skipped over with empty placeholders.
      while (expect !== letter) {
        current.options.push({ label: expect, fragments: [''], correct: false });
        expect = NEXT[expect];
      }
      // The "*" correct-marker appears in three layouts across the document:
      //   "* A. text" (before letter), "A. * text" (after dot), "A * text" (as separator).
      const correct = Boolean(m[1]) || m[3] === '*' || /^\*/.test(m[4]);
      const text = m[4].replace(/^\*\s*/, '');
      current.options.push({ label: letter, fragments: [text], correct });
      if (correct) current.answer = letter;
      expect = NEXT[letter];
      continue;
    }

    // Fallback for dot-less options ("B Осьового скелету"): accept only while
    // already inside an option block and only for the exact next expected
    // letter (B–E). This never fires for "A" or in scenario text, so a line
    // beginning with А/В/С/Е inside a question is never mistaken for an option.
    if (mode === 'options' && expect !== 'A') {
      const bm = line.match(BARE_OPTION_RE);
      if (bm && (TO_LATIN[bm[1]] ?? bm[1]) === expect) {
        const correct = Boolean(bm[2]);
        current.options.push({ label: expect, fragments: [bm[3]], correct });
        if (correct) current.answer = expect;
        expect = NEXT[expect];
        continue;
      }
    }

    // Non-option line.
    if (mode === 'options') {
      const last = current.options[current.options.length - 1];
      if (last.label === 'E') {
        // After E, the next scenario begins. A following line only belongs to
        // option E if E actually wrapped: its tail ends with a hyphen, or the
        // tail is long enough to have filled the column AND the new line starts
        // lower-case (mid-sentence). A short E option (e.g. "Нейрофібрили")
        // never wraps, so such a line starts the next question instead.
        const tail = last.fragments.at(-1) ?? '';
        // A trailing hyphen counts as a wrap only after a real word (e.g.
        // "плазмо-"), never a lone "-" placeholder option ("E. -").
        const cont = /\p{L}-$/u.test(tail) || (tail.length >= 38 && /^[a-zа-яїієґ]/u.test(line));
        if (cont) { last.fragments.push(line); continue; }
        mode = 'question';
        // fall through to question handling below
      } else {
        last.fragments.push(line);      // wrap of options A–D
        continue;
      }
    }

    // Question / between-questions text.
    if (isSectionHeader(line)) { section = line; continue; }
    qFragments.push(line);
  }
  finalize();
  return questions;
}

// --- run -------------------------------------------------------------------
const lines = await extractLines(INPUT);
const questions = parse(lines).map((q, i) => ({ id: i + 1, ...q }));

// Validation report.
const noFive = questions.filter((q) => q.options.length !== 5);
const noAnswer = questions.filter((q) => !q.answer);
const multiAnswer = questions.filter((q) => q.options.filter((o) => o.correct).length > 1);
const noText = questions.filter((q) => !q.question);

await writeFile(
  OUTPUT,
  JSON.stringify({ source: INPUT.split('/').pop(), count: questions.length, questions }, null, 2),
);

console.log(`Parsed ${questions.length} questions -> ${OUTPUT}`);
console.log(`  exactly 5 options:   ${questions.length - noFive.length}/${questions.length}`);
console.log(`  one correct answer:  ${questions.length - noAnswer.length - multiAnswer.length}/${questions.length}`);
console.log(`  non-empty question:  ${questions.length - noText.length}/${questions.length}`);
if (noFive.length) console.log(`  ! wrong option count: ids ${noFive.slice(0, 15).map((q) => q.id).join(', ')}${noFive.length > 15 ? ' …' : ''}`);
if (noAnswer.length) console.log(`  ! no marked answer:   ids ${noAnswer.slice(0, 15).map((q) => q.id).join(', ')}${noAnswer.length > 15 ? ' …' : ''}`);
if (multiAnswer.length) console.log(`  ! multiple answers:   ids ${multiAnswer.slice(0, 15).map((q) => q.id).join(', ')}`);
if (noText.length) console.log(`  ! empty question text: ids ${noText.slice(0, 15).map((q) => q.id).join(', ')}`);
