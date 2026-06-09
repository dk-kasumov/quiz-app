# Results — Histology PDF → JSON parser

## Goal

Take `гиста сессия.pdf` (Dnipro State Medical University exam prep for histology,
cytology & embryology) and produce a Node.js parser that emits a JSON file of
questions with their answer options.

## Outcome

A working parser that extracted **1127 questions** from the 104-page PDF into
structured JSON.

| Metric | Result |
| --- | --- |
| Questions extracted | **1127** |
| Exactly 5 options (A–E) | **1127 / 1127** (100%) |
| Non-empty question text | **1127 / 1127** (100%) |
| Exactly one correct answer marked | **1126 / 1127** (99.9%) |
| Sections detected | **18** |
| Output size | ~1.2 MB |

The single question without a marked answer (id 170) is faithful to the source —
that question has no `*` marker in the PDF itself.

## Deliverables

| File | Purpose |
| --- | --- |
| `parser.mjs` | The parser (reads PDF with `pdfjs-dist`, writes `questions.json`) |
| `questions.json` | Extracted data — 1127 questions |
| `package.json` | Run with `npm install && npm run parse` |
| `README.md` | Usage + output-format documentation |
| `RESULTS.md` | This report |

## Output format

```jsonc
{
  "source": "гиста сессия.pdf",
  "count": 1127,
  "questions": [
    {
      "id": 1,
      "section": "ЦИТОЛОГІЯ",
      "question": "На електронномікроскопічній фотографії шкіри ... контакту?",
      "options": [
        { "label": "A", "correct": false, "text": "Простий" },
        { "label": "B", "correct": false, "text": "Щілинний" },
        { "label": "C", "correct": false, "text": "Синапс" },
        { "label": "D", "correct": false, "text": "Зубчастий" },
        { "label": "E", "correct": true,  "text": "Десмосома" }
      ],
      "answer": "E"
    }
  ]
}
```

## How it was built

1. **Inspected the PDF first.** No CLI PDF tools were available, so I used
   `pdfjs-dist` to dump text and study the layout before writing any parser.
2. **Analyzed the whole document** to measure structure: the letter `D` appears
   exactly 1127 times and has no Cyrillic look-alike, which confirmed the question
   count and validated the approach.
3. **Wrote a state-machine parser** that walks the text line by line, tracking the
   current section, question text, and option sequence.
4. **Iterated against a validation report** (printed on every run) until the
   anomaly count reached zero / source-only.

## Parsing challenges solved

These are why the document was harder than it looked:

- **Mixed Latin + Cyrillic letters.** Options use both `A B C D E` and their
  Cyrillic look-alikes `А В С Е`. Normalised everything to Latin labels.
- **`*` correct-marker in three layouts** — `* A. text`, `A. * text`, and
  `A * text` (dot dropped). All three are detected.
- **Hyphenated line wraps** — `між-` + `клітинна` is rejoined to `міжклітинна`.
- **Off-by-one alignment bug** — caught by checking that each question's text
  actually matched its options (id 1's text belonged to the next question). Fixed
  so scenario text aligns with the right options.
- **Source defects tolerated** — questions whose options skip a label (e.g. jump
  A, B, D, E) get a placeholder so labels stay A–E; dot-less options
  (`B Осьового скелету`) are still recognised.
- **Section headers vs. abbreviations** — ALL-CAPS topic headers (`ЦИТОЛОГІЯ`,
  `КРОВ ТА ЛІМФА`, …) are detected while short chemical abbreviations like `АДФ`
  are ignored.

## Known source-PDF quirks (preserved faithfully, not parser bugs)

- **1 question** (id 170) has no `*` in the PDF → `answer: null`.
- A few options are a literal `-` or empty where the source skipped a label —
  kept as `"-"` / `""` so the A–E structure stays intact.
- **~4 question texts** begin mid-word because the source dropped a leading word
  (e.g. "На") or wrapped an option oddly. The options and answers for those are
  still correct; only the opening word of the text is affected.

## Reproducing

```bash
npm install      # installs pdfjs-dist
npm run parse    # гиста сессия.pdf -> questions.json
```

The run prints a validation summary so any future change to the PDF can be
re-checked instantly.
