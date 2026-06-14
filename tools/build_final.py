#!/usr/bin/env python3
"""Apply manual seam recoveries, then split into a playable quiz + review lists."""
import json

full = {q["id"]: q for q in json.load(open("tools/output/s02_questions_full.json", encoding="utf-8"))}
for q in json.load(open("tools/output/manual_recovered.json", encoding="utf-8")):
    full[q["id"]] = q  # override

ids = sorted(full)
def n_correct(q):
    return sum(1 for o in q.get("options", []) if o.get("correct"))

playable, review, verify = [], [], []
for qid in ids:
    q = full[qid]
    clean = {
        "id": qid,
        "section": q.get("section", "Цитологія"),
        "question": q.get("question", "").strip(),
        "options": [{"label": o["label"], "text": o["text"].strip(), "correct": bool(o.get("correct"))}
                    for o in q.get("options", [])],
    }
    nc = n_correct(q)
    if nc == 1 and len(clean["options"]) >= 3:
        playable.append(clean)
        if q.get("confidence", "high") not in ("high", ""):
            verify.append({"id": qid, "confidence": q.get("confidence"), "notes": q.get("notes", ""),
                           "answer": next(o["label"] for o in clean["options"] if o["correct"])})
    else:
        reason = ("no marked answer" if nc == 0 and clean["options"]
                  else "options cut off / missing" if not clean["options"]
                  else f"{nc} answers marked")
        review.append({**clean, "reason": reason, "notes": q.get("notes", "")})

json.dump(playable, open("tools/output/s02_playable.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
json.dump(review, open("tools/output/review_needed.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
json.dump(verify, open("tools/output/verify_answers.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"TOTAL questions:   {len(ids)} (ids {ids[0]}..{ids[-1]})")
print(f"PLAYABLE (1 answer, complete): {len(playable)}")
print(f"REVIEW (excluded): {len(review)}  -> ids {[q['id'] for q in review]}")
print(f"  reasons:")
from collections import Counter
for r, c in Counter(q["reason"] for q in review).items():
    print(f"    {c:>3}  {r}")
print(f"VERIFY (answered but low/med confidence): {len(verify)} -> ids {[v['id'] for v in verify]}")
