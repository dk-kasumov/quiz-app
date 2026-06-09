# HistoQuiz

An Angular SPA for studying the Dnipro State Medical University histology / cytology /
embryology exam questions. Pick a quiz (one per topic section), step through its
questions with a progress bar, and get instant colour feedback on every answer.

## Quick start

```bash
npm install
npm run build:quizzes   # (re)generate public/quizs/ from tools/questions.json
npm start               # ng serve -> http://localhost:4200
```

## How it works

- **Quizzes = sections.** `tools/build-quizzes.mjs` packs the parser's
  `tools/questions.json` (1127 questions, 18 sections) into a single seed catalog
  `public/quizs/questions.json`, plus a tiny `public/quizs/version.json`.
- **IndexedDB-backed & offline.** On first load an app initializer
  (`QuizCatalogSeeder`) seeds the catalog into IndexedDB. Warm starts fetch only
  `version.json` and read everything from IndexedDB — the catalog is re-downloaded
  only when its `version` bumps (version-gated re-seed).
- **Answer feedback** (single source of truth in `src/app/domain/answer-evaluation.ts`),
  supporting **multiple correct answers** with single-pick play:
  - a correct pick → **green** (and every correct option is revealed green)
  - a wrong pick → **red**, with the correct option(s) shown **green**
  - a question with no correct answer → the pick is **blue**
- **Editable.** Each question has a ✎ button opening a modal to change its text, the
  option texts, and which option(s) are correct. Edits persist to IndexedDB.
- After answering, options lock and a **Далі / Завершити** (Next / Finish) button appears.
  **Назад** (Back) returns to the previous question with its locked colours intact.
- **Installable PWA** — responsive/mobile layout, web manifest, and a service worker
  (production builds) that caches the app shell and quiz data for offline use.

## Architecture (light DDD / layered)

```
src/app/
  domain/          pure models + answer-evaluation rules (no framework imports)
  application/     QuizSessionService, QuizCatalogService, QuizRepository port (signals)
  infrastructure/  QuizDb (idb) + QuizIndexedDbRepository + QuizCatalogSeeder
  presentation/    pages (quiz-list, quiz-player) + components
                   (progress-bar, question-card, question-edit-dialog)
```

Dependency direction: `presentation → application → domain`; `infrastructure` implements
the application's `QuizRepository` port, bound via DI in `app.config.ts`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Dev server (`ng serve`) |
| `npm run build` | Production build to `dist/` |
| `npm test` | Domain/unit tests via Karma |
| `npm run build:quizzes` | Regenerate `public/quizs/` from the source JSON |
| `npm run verify:ui` | Headless Playwright walk-through of the whole flow (server must be running) |

## Tooling

- `tools/` holds the original PDF→JSON parser (`parser.mjs`, `questions.json`, docs) and
  the data/UI helper scripts. Re-running the parser needs its own `npm install` there
  (it depends on `pdfjs-dist`).
- **Playwright MCP** is configured in `.mcp.json`; its interactive browser tools become
  available after restarting Claude Code.
