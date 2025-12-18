#!/usr/bin/env python3
"""validate_ts_vs_pdf.py

Compares:
- PDF inventory (extract_pdf_inventory.py)
vs
- TS mapping manifest (extract_ts_mappings.py)

Goal: fail fast *without a human opening the PDF*.

Checks (strict by default):
- Every field name used in `createFieldFromReference(...)` exists in the PDF
- The expected runtime value type (inferred from the default value) is compatible with the PDF widget type
- Duplicates: the same PDF field name used multiple times (often an error)

This produces a machine-readable JSON report suitable for CI.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Tuple


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_pdf_widget_type(t: str) -> str:
    """Normalize various library strings into: text | button | choice | signature | unknown"""
    s = (t or "").strip().lower()
    if not s:
        return "unknown"

    # Common synonyms
    if s in {"text", "tx", "textfield"}:
        return "text"
    if s in {"button", "btn", "checkbox", "radiobutton"}:
        return "button"
    if s in {"choice", "ch", "dropdown", "combobox", "listbox"}:
        return "choice"
    if s in {"signature", "sig"}:
        return "signature"

    # PyMuPDF sometimes returns numeric types as strings
    if s in {"1", "2", "3", "4"}:
        return {"1": "button", "2": "text", "3": "choice", "4": "signature"}[s]

    return "unknown"


def compatible(default_type: str, pdf_type: str) -> Tuple[bool, str]:
    """Return (ok, reason)."""
    dt = default_type
    pt = pdf_type

    if dt == "boolean":
        if pt != "button":
            return False, f"boolean default but PDF widget type is {pt}"
        return True, ""

    if dt == "number":
        # Most PDFs store numbers in text fields.
        if pt != "text":
            return False, f"number default but PDF widget type is {pt}"
        return True, ""

    if dt == "string":
        # Strings can map to text or choice. For radio button groups, values are strings too.
        if pt in {"text", "choice", "button"}:
            return True, ""
        return False, f"string default but PDF widget type is {pt}"

    # unknown defaults: don't block CI, but report.
    return True, "unknown-default"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inventory", required=True, help="PDF inventory JSON")
    ap.add_argument("--tsmap", required=True, help="TS mapping manifest JSON")
    ap.add_argument("--out", required=True, help="Output JSON report")
    ap.add_argument(
        "--section",
        type=str,
        default=None,
        help="Optional: restrict validation to a single sectionGuess (e.g., '13').",
    )

    args = ap.parse_args()

    inv_path = Path(args.inventory).expanduser().resolve()
    ts_path = Path(args.tsmap).expanduser().resolve()
    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    inv = load_json(inv_path)
    ts = load_json(ts_path)

    widgets = inv.get("widgets") or []
    widget_by_name: Dict[str, Dict[str, Any]] = {}

    for w in widgets:
        name = w.get("name")
        if not name:
            continue
        if args.section and str(w.get("sectionGuess")) != str(args.section):
            continue
        widget_by_name[name] = w

    # Collect createFieldFromReference calls across files
    calls: List[Dict[str, Any]] = []
    for f in ts.get("files") or []:
        calls.extend(f.get("createFieldFromReferenceCalls") or [])

    missing = []
    type_mismatches = []
    unknown_defaults = []

    usage_count = defaultdict(int)

    for c in calls:
        name = c.get("name")
        if not name:
            continue
        usage_count[name] += 1

        w = widget_by_name.get(name)
        if not w:
            missing.append(c)
            continue

        pdf_type = normalize_pdf_widget_type(w.get("type"))
        ok, reason = compatible(c.get("defaultType"), pdf_type)
        if not ok:
            type_mismatches.append({"call": c, "pdf": {"type": w.get("type"), "page": w.get("pageNumber"), "rect": w.get("rectTopLeft")}, "reason": reason})
        elif reason == "unknown-default":
            unknown_defaults.append({"call": c, "pdf": {"type": w.get("type"), "page": w.get("pageNumber"), "rect": w.get("rectTopLeft")}})

    duplicates = [name for name, cnt in usage_count.items() if cnt > 1]

    report = {
        "inventory": {
            "pdfSha256": inv.get("pdf", {}).get("sha256"),
            "pageCount": inv.get("pdf", {}).get("pageCount"),
            "widgetCount": len(widget_by_name),
            "sectionFilter": args.section,
        },
        "tsMapping": {
            "createFieldCallCount": len(calls),
            "uniqueFieldNames": len(usage_count),
        },
        "results": {
            "missingInPdf": missing,
            "typeMismatches": type_mismatches,
            "unknownDefaultType": unknown_defaults,
            "duplicateFieldNames": duplicates,
        },
        "ok": (len(missing) == 0 and len(type_mismatches) == 0),
    }

    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    # CLI friendly summary
    print("\n=== VALIDATION SUMMARY ===")
    print(f"Missing fields: {len(missing)}")
    print(f"Type mismatches: {len(type_mismatches)}")
    print(f"Duplicate field names: {len(duplicates)}")
    print(f"Unknown default types: {len(unknown_defaults)}")
    print(f"OK: {report['ok']}")
    print(f"Report: {out_path}\n")

    # Exit non-zero for CI if failing
    return 0 if report["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
