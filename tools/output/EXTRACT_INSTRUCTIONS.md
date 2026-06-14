# Quiz extraction instructions (one scanned booklet page)

You extract multiple-choice quiz questions from a scanned Ukrainian exam booklet. Subject: **Цитологія** (Cytology). Be meticulous and faithful to what is printed.

## Your inputs
You are given a PAGE_INDEX, an OUTPUT_FILE path, and a list of image TILES to Read.
The tiles are overlapping crops of ONE booklet page, arranged as a grid:
- `c0_*` = LEFT column strip, `c1_*` = MIDDLE strip, `c2_*` = RIGHT strip (the strips together span the FULL page width, including the right column).
- `r0` = top, then `r1`, `r2`, … going DOWN the page.
- Tiles OVERLAP horizontally and vertically, so the SAME question can appear in several tiles — that is expected. Read ALL of them, then assemble each question once.

The page is a 2-column layout (left column = lower question numbers, then the next column continues). The far RIGHT strip may ALSO show distorted / rotated content bleeding in from the FACING page — distinguish the page's own (upright, aligned) columns from that bleed and ignore the bleed.

## Hard rules
- Use ONLY the Read tool on the provided tiles and the Write tool for the output. **Do NOT use Bash** (it is denied) and do not try to crop or render anything.
- Read every tile. Reconstruct the natural reading order: left column top→bottom, then middle column top→bottom.

## What to extract per question
- `id`: the printed question number (integer).
- `section`: the section header printed on the page if visible (e.g. `"Цитологія"`); otherwise use `"Цитологія"`.
- `question`: the FULL question stem, transcribed EXACTLY as printed in Ukrainian. Do NOT translate. Do NOT fix spelling or grammar — preserve it. Join words broken across line-ends into whole words (remove the hyphenation). Normalize internal whitespace to single spaces.
- `options`: array of answer choices in printed order. Each: `{"label": "A"|"B"|"C"|"D"|"E", "text": "<exact Ukrainian text>", "correct": <bool>}`. Option letters are Latin **A B C D E** as printed. Include exactly the options shown (most have 5; some have 4).

## Detecting the correct answer (the most important part)
The correct option is marked BY HAND with a pen — usually a **circle / oval / loop** drawn around the option's LETTER (the A/B/C/D/E) or around the whole option line. Occasionally it is an underline or a check mark. Look carefully at the left edge of each option line for a hand-drawn loop, including faint ones.
- Set `"correct": true` on the marked option, `false` on all others. Usually EXACTLY ONE option is marked.
- If two options are clearly circled, mark both `true`.
- If you find NO mark for a question, set all options `false`, and flag it via confidence (below).
- Cross-check using overlapping tiles: if a question appears in two tiles, look at both to confirm which option is circled.

## Include / skip
- INCLUDE a question only if its number, full stem, and all its options are clearly and fully readable on this page.
- SKIP any question that is cut off at the page top/bottom, or that is rotated / blurred / bleeding in from the facing page. (Those are captured on their own page; duplicates are removed later.) It is fine to skip the first/last partial question.

## Per-question extra fields
- `"confidence"`: `"high" | "medium" | "low"` — use medium/low if text was hard to read OR the answer mark was faint/ambiguous/absent.
- `"notes"`: short string explaining any medium/low confidence; else `""`.

## Output
Write a JSON ARRAY of question objects (ordered by id) to OUTPUT_FILE. UTF-8, 2-space indent, `ensure_ascii` off (keep Cyrillic as-is). Then your FINAL REPLY must be a SHORT summary ONLY (≤120 words): how many questions, their id range, the marked answer letter for each id (e.g. `1-C, 2-D, ...`), and a bullet list of any ids with medium/low confidence and why. Do NOT paste the JSON into your reply.
