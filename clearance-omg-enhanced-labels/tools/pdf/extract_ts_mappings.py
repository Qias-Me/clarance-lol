#!/usr/bin/env python3
"""extract_ts_mappings.py

Extracts PDF field-name usage from TypeScript mapping sources.

This is intentionally lightweight (regex-based) so it can run without pulling
in the TypeScript compiler API.

It supports two main extraction modes:
1) `createFieldFromReference(section, 'fieldName', defaultValue)` calls
2) Any string literal that looks like a PDF field path starting with `form1[`

Why?
- You want to validate mapping code in CI *without a human opening the PDF*.
- This produces a machine-readable manifest that can be compared to the PDF inventory.

Output JSON includes occurrences with line numbers + snippets for fast debugging.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple


# Match createFieldFromReference(13, 'form1[0]....', <default>)
# Note: this is best-effort; it assumes the default value does not contain an unmatched ')'.
CREATE_CALL_RE = re.compile(
    r"createFieldFromReference\s*\(\s*(?P<section>\d+)\s*,\s*(?P<q>['\"])(?P<name>form1\[[^'\"]+\])(?P=q)\s*,\s*(?P<default>[^\)]*?)\)" ,
    re.DOTALL,
)

# Match any string literal that starts with form1[...] (used in constants)
ANY_FIELD_STRING_RE = re.compile(r"(?P<q>['\"])(?P<name>form1\[[^'\"]+\])(?P=q)")


def guess_default_type(default_raw: str) -> str:
    d = (default_raw or "").strip()
    # Strip TS casts like: "NO" as "YES" | "NO"
    d = re.sub(r"\s+as\s+.*$", "", d)
    if d in ("true", "false"):
        return "boolean"
    if re.match(r"^-?\d+(?:\.\d+)?$", d):
        return "number"
    if (d.startswith("'") and d.endswith("'")) or (d.startswith('"') and d.endswith('"')):
        return "string"
    if d == "''" or d == '""':
        return "string"
    return "unknown"


def line_number_at(text: str, index: int) -> int:
    # 1-based line numbers
    return text.count("\n", 0, index) + 1


def snippet_around(text: str, start: int, end: int, radius: int = 80) -> str:
    a = max(0, start - radius)
    b = min(len(text), end + radius)
    snippet = text[a:b]
    return re.sub(r"\s+", " ", snippet).strip()


def extract_from_file(path: Path) -> Dict[str, object]:
    raw = path.read_text(encoding="utf-8", errors="replace")

    create_calls = []
    for m in CREATE_CALL_RE.finditer(raw):
        name = m.group("name")
        default_raw = m.group("default")
        create_calls.append(
            {
                "section": int(m.group("section")),
                "name": name,
                "defaultRaw": default_raw.strip(),
                "defaultType": guess_default_type(default_raw),
                "line": line_number_at(raw, m.start()),
                "snippet": snippet_around(raw, m.start(), m.end()),
            }
        )

    # Grab other occurrences (constants, etc.)
    string_occurrences = []
    for m in ANY_FIELD_STRING_RE.finditer(raw):
        name = m.group("name")
        string_occurrences.append(
            {
                "name": name,
                "line": line_number_at(raw, m.start()),
                "snippet": snippet_around(raw, m.start(), m.end()),
            }
        )

    return {
        "file": str(path),
        "createFieldFromReferenceCalls": create_calls,
        "stringLiterals": string_occurrences,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ts", nargs="+", required=True, help="TypeScript file(s) to scan")
    ap.add_argument("--out", required=True, help="Output JSON manifest")

    args = ap.parse_args()

    files = [Path(p).expanduser().resolve() for p in args.ts]
    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    per_file = [extract_from_file(p) for p in files]

    # Build rollups
    call_counts = defaultdict(int)
    literal_counts = defaultdict(int)

    for f in per_file:
        for c in f["createFieldFromReferenceCalls"]:
            call_counts[c["name"]] += 1
        for s in f["stringLiterals"]:
            literal_counts[s["name"]] += 1

    out = {
        "files": per_file,
        "summary": {
            "uniqueCreateFieldNames": len(call_counts),
            "uniqueStringLiteralFieldNames": len(literal_counts),
            "duplicateCreateFieldNames": sorted([n for n, c in call_counts.items() if c > 1]),
            "duplicateStringLiteralFieldNames": sorted([n for n, c in literal_counts.items() if c > 1]),
        },
    }

    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"✅ Wrote TS mapping manifest: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
