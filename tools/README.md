# Histology quiz PDF parser

Extracts the questions from **`гиста сессия.pdf`** (Dnipro State Medical University
histology / cytology / embryology exam prep) into a structured **`questions.json`**.

## Usage

```bash
npm install          # installs pdfjs-dist
npm run parse        # гиста сессия.pdf -> questions.json

# or with explicit paths:
node parser.mjs <input.pdf> <output.json>
```

## Output format

```jsonc
{
  "source": "гиста сессия.pdf",
  "count": 1127,
  "questions": [
    {
      "id": 1,
      "section": "ЦИТОЛОГІЯ",                      // current topic header
      "question": "На електронномікроскопічній...?",
      "options": [
        { "label": "A", "text": "Простий",   "correct": false },
        { "label": "B", "text": "Щілинний",  "correct": false },
        { "label": "C", "text": "Синапс",    "correct": false },
        { "label": "D", "text": "Зубчастий", "correct": false },
        { "label": "E", "text": "Десмосома", "correct": true }
      ],
      "answer": "E"                                  // null if the PDF marks none
    }
  ]
}
```

Every question has five options labelled `A`–`E` and (almost always) one `correct`
option, marked in the source with `*`.

## How it works

`parser.mjs` reads the PDF text with `pdfjs-dist`, groups it into visual lines, then
runs a small state machine that:

- detects ALL-CAPS section headers (e.g. `ЦИТОЛОГІЯ`) and skips page numbers / title page;
- normalises the mixed Latin / Cyrillic option letters (`А В С Е` → `A B C E`);
- recognises the correct-answer `*` in all three layouts found in the document
  (`* A. text`, `A. * text`, `A * text`);
- de-hyphenates words split across line wraps (`між-` + `клітинна` → `міжклітинна`);
- tolerates source defects — missing option labels (fills a placeholder so labels stay
  `A`–`E`) and dot-less options (`B Осьового скелету`).

The parser prints a validation report (option counts, answers, empty fields).

## Known source-PDF quirks (faithfully preserved, not parser bugs)

- **1 question** has no `*` in the PDF, so its `answer` is `null` (id 170).
- A few options are a literal `-` placeholder, or empty where the source skipped a
  label entirely — kept as `""`/`"-"` so the A–E structure stays intact.
- ~4 question texts begin mid-word because the source dropped a leading word
  (e.g. "На") or wrapped an option oddly; the options/answers are still correct.
