#!/usr/bin/env python3
"""
Snapshot validator.

Usage:
  python scripts/validate_snapshot.py --pdf clean.pdf --snapshot meta/field-index.json

- Re-extracts widgets from the PDF
- Compares exact metadata for every widget (id/name/page/rect/type/label)

This is what removes the need for humans to open the PDF during testing.
"""

import json, re, sys
import fitz  # PyMuPDF

def load_snapshot(path: str):
    with open(path, "r") as f:
        return json.load(f)

def key_from_widget(page_num: int, w):
    rect=w.rect
    return str(w._annot.xref)

def extract(pdf_path: str):
    doc=fitz.open(pdf_path)
    out={}
    for i in range(doc.page_count):
        page=doc[i]
        for w in (page.widgets() or []):
            rect=w.rect
            out[str(w._annot.xref)] = {
                "id": str(w._annot.xref),
                "page": i+1,
                "name": w.field_name,
                "label": w.field_label or "",
                "type": int(w.field_type),
                "rect": {
                    "x": float(rect.x0),
                    "y": float(rect.y0),
                    "width": float(rect.x1-rect.x0),
                    "height": float(rect.y1-rect.y0),
                }
            }
    return out

def main(pdf_path: str, snapshot_path: str):
    snap=load_snapshot(snapshot_path)
    cur=extract(pdf_path)

    if set(snap.keys()) != set(cur.keys()):
        missing = set(snap.keys()) - set(cur.keys())
        extra = set(cur.keys()) - set(snap.keys())
        print(f"ID set mismatch: missing={len(missing)} extra={len(extra)}")
        if missing:
            print("Missing IDs (first 20):", sorted(list(missing))[:20])
        if extra:
            print("Extra IDs (first 20):", sorted(list(extra))[:20])
        return 1

    diffs=[]
    for k in snap.keys():
        if snap[k] != cur[k]:
            diffs.append(k)

    if diffs:
        print(f"Metadata mismatch for {len(diffs)} fields. Example ID: {diffs[0]}")
        print("SNAP:", json.dumps(snap[diffs[0]], indent=2)[:1000])
        print("CUR :", json.dumps(cur[diffs[0]], indent=2)[:1000])
        return 2

    print(f"OK: {len(cur)} widgets match snapshot exactly.")
    return 0

if __name__ == "__main__":
    import argparse
    ap=argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--snapshot", required=True)
    args=ap.parse_args()
    raise SystemExit(main(args.pdf, args.snapshot))