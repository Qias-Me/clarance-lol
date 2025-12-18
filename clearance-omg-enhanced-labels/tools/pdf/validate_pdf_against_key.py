#!/usr/bin/env python3
"""validate_pdf_against_key.py

For a stable, rarely-changing PDF, you can treat an inventory JSON as a golden
"key" and enforce that the PDF has not drifted.

This script compares two inventory JSON files:
- --key: the committed / blessed inventory
- --current: a freshly extracted inventory

It checks:
- same field-name set
- same type
- same pageIndex
- same rectangle (within a small epsilon)

Exit code:
- 0 if OK
- 2 if differences found
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Tuple


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def rect_close(a: Dict[str, float], b: Dict[str, float], eps: float = 0.25) -> bool:
    # eps in points; 0.25pt is sub-pixel for typical renderers.
    for k in ("x", "y", "width", "height"):
        if abs(float(a.get(k, 0.0)) - float(b.get(k, 0.0))) > eps:
            return False
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", required=True, help="Golden inventory JSON")
    ap.add_argument("--current", required=True, help="Current inventory JSON")
    ap.add_argument("--eps", type=float, default=0.25, help="Rectangle tolerance in PDF points")
    args = ap.parse_args()

    key = load_json(Path(args.key).expanduser().resolve())
    cur = load_json(Path(args.current).expanduser().resolve())

    key_widgets = {w["name"]: w for w in (key.get("widgets") or []) if w.get("name")}
    cur_widgets = {w["name"]: w for w in (cur.get("widgets") or []) if w.get("name")}

    missing = sorted(set(key_widgets) - set(cur_widgets))
    extra = sorted(set(cur_widgets) - set(key_widgets))

    changed = []
    for name, kw in key_widgets.items():
        cw = cur_widgets.get(name)
        if not cw:
            continue
        if str(kw.get("type")) != str(cw.get("type")):
            changed.append({"name": name, "reason": "type", "key": kw.get("type"), "current": cw.get("type")})
            continue
        if int(kw.get("pageIndex", -1)) != int(cw.get("pageIndex", -1)):
            changed.append({"name": name, "reason": "pageIndex", "key": kw.get("pageIndex"), "current": cw.get("pageIndex")})
            continue
        if not rect_close(kw.get("rectPdf", {}) or {}, cw.get("rectPdf", {}) or {}, eps=args.eps):
            changed.append({"name": name, "reason": "rectPdf", "key": kw.get("rectPdf"), "current": cw.get("rectPdf")})
            continue

    ok = (not missing and not extra and not changed)

    print("\n=== PDF KEY VALIDATION ===")
    print(f"Missing in current: {len(missing)}")
    print(f"Extra in current: {len(extra)}")
    print(f"Changed: {len(changed)}")
    print(f"OK: {ok}\n")

    if not ok:
        # Print a small sample for quick debugging
        if missing:
            print("Missing sample:", missing[:10])
        if extra:
            print("Extra sample:", extra[:10])
        if changed:
            print("Changed sample:", changed[:5])

    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
