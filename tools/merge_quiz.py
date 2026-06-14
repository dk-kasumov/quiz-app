#!/usr/bin/env python3
"""Merge per-page extraction JSONs into one validated quiz.

- Reads tools/output/pages/page_*.json (each a list of question objects).
- Dedupes by question id across overlapping pages, keeping the "best" copy and
  recording any disagreement on the marked answer.
- Validates: contiguous ids, option count, exactly one correct answer.
- Writes the merged questions + a human-readable report.
"""
import json, glob, os, sys
from collections import defaultdict

PAGES_DIR = "tools/output/pages"
OUT_QUESTIONS = "tools/output/s02_questions.json"
OUT_REPORT = "tools/output/merge_report.txt"

CONF_RANK = {"high": 2, "medium": 1, "low": 0, "": 0, None: 0}

def correct_letters(q):
    return sorted(o["label"] for o in q.get("options", []) if o.get("correct"))

def score(q):
    """Higher = better candidate to keep when ids collide."""
    s = CONF_RANK.get(q.get("confidence"), 0) * 10
    s += len(q.get("options", []))           # more complete options
    s += 5 if correct_letters(q) else 0       # has a marked answer
    s += min(len(q.get("question", "")), 400) / 100.0  # longer/complete stem
    return s

def main():
    files = sorted(glob.glob(os.path.join(PAGES_DIR, "page_*.json")))
    if not files:
        print("No page files found in", PAGES_DIR); sys.exit(1)

    by_id = {}                 # id -> best question
    variants = defaultdict(list)  # id -> list of (page, correct_letters, score)
    parse_errors = []

    for f in files:
        page = os.path.basename(f)
        try:
            data = json.load(open(f, encoding="utf-8"))
        except Exception as e:
            parse_errors.append(f"{page}: JSON error {e}")
            continue
        for q in data:
            qid = q.get("id")
            if qid is None:
                parse_errors.append(f"{page}: question with no id")
                continue
            variants[qid].append((page, "".join(correct_letters(q)) or "-", round(score(q), 1)))
            if qid not in by_id or score(q) > score(by_id[qid]):
                by_id[qid] = q

    ids = sorted(by_id)
    report = []
    report.append(f"Files merged: {len(files)}")
    report.append(f"Unique questions: {len(ids)}")
    if ids:
        report.append(f"Id range: {ids[0]}..{ids[-1]}")

    # gaps
    gaps = [i for i in range(ids[0], ids[-1] + 1) if i not in by_id] if ids else []
    report.append(f"\nMISSING ids ({len(gaps)}): {gaps}")

    # answer conflicts across overlapping page reads
    conflicts = []
    for qid in ids:
        letters = {v[1] for v in variants[qid] if v[1] != "-"}
        if len(letters) > 1:
            conflicts.append((qid, variants[qid]))
    report.append(f"\nANSWER CONFLICTS across page reads ({len(conflicts)}):")
    for qid, vs in conflicts:
        report.append(f"  Q{qid}: " + "; ".join(f"{p}->{c}(s{s})" for p, c, s in vs))

    # no answer / multi answer / few options / low confidence
    no_answer, multi_answer, few_opts, low_conf = [], [], [], []
    for qid in ids:
        q = by_id[qid]
        cl = correct_letters(q)
        if len(cl) == 0: no_answer.append(qid)
        elif len(cl) > 1: multi_answer.append((qid, cl))
        if len(q.get("options", [])) < 4: few_opts.append((qid, len(q.get("options", []))))
        if CONF_RANK.get(q.get("confidence"), 0) < 2:
            low_conf.append((qid, q.get("confidence"), q.get("notes", "")))

    report.append(f"\nNO marked answer ({len(no_answer)}): {no_answer}")
    report.append(f"MULTI marked answer ({len(multi_answer)}): {multi_answer}")
    report.append(f"FEWER than 4 options ({len(few_opts)}): {few_opts}")
    report.append(f"\nLOW/MEDIUM confidence ({len(low_conf)}):")
    for qid, c, n in low_conf:
        report.append(f"  Q{qid} [{c}]: {n}")

    if parse_errors:
        report.append("\nPARSE ERRORS:")
        report.extend("  " + e for e in parse_errors)

    # write clean questions (strip confidence/notes), normalized
    clean = []
    for qid in ids:
        q = by_id[qid]
        clean.append({
            "id": qid,
            "section": q.get("section", "Цитологія"),
            "question": q.get("question", "").strip(),
            "options": [{"label": o["label"], "text": o["text"].strip(), "correct": bool(o.get("correct"))}
                        for o in q.get("options", [])],
        })
    json.dump(clean, open(OUT_QUESTIONS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # full version retaining confidence/notes for downstream review
    full = []
    for qid in ids:
        q = by_id[qid]
        full.append({
            "id": qid,
            "section": q.get("section", "Цитологія"),
            "question": q.get("question", "").strip(),
            "options": [{"label": o["label"], "text": o["text"].strip(), "correct": bool(o.get("correct"))}
                        for o in q.get("options", [])],
            "confidence": q.get("confidence", ""),
            "notes": q.get("notes", ""),
        })
    json.dump(full, open("tools/output/s02_questions_full.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    text = "\n".join(report)
    open(OUT_REPORT, "w", encoding="utf-8").write(text)
    print(text)
    print(f"\nWrote {len(clean)} questions -> {OUT_QUESTIONS}")
    print(f"Report -> {OUT_REPORT}")

if __name__ == "__main__":
    main()
