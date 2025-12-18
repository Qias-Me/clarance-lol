#!/usr/bin/env python3
"""chunk_by_section.py

Creates a deterministic section/page chunk layout from a PDF inventory.

Input:
- a PDF
- an inventory JSON produced by extract_pdf_inventory.py

Output:
- per-section and per-page JSON metadata slices
- optional per-page PDFs and per-section PDFs (handy for inspection and rendering)

This is especially useful for complex sections (like Section 13) because you can
work with tiny JSON + small PDFs instead of the whole document.

"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Tuple

import fitz  # PyMuPDF


def load_inventory(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_pdf_pages(doc: fitz.Document, page_indices: List[int], out_pdf: Path) -> None:
    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    new_doc = fitz.open()
    # Insert pages individually so non-contiguous section pages don't accidentally
    # include unrelated pages in-between.
    for pi in page_indices:
        new_doc.insert_pdf(doc, from_page=pi, to_page=pi)
    new_doc.save(str(out_pdf))


def save_single_page(doc: fitz.Document, page_index: int, out_pdf: Path) -> None:
    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    new_doc = fitz.open()
    new_doc.insert_pdf(doc, from_page=page_index, to_page=page_index)
    new_doc.save(str(out_pdf))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True, help="Path to the PDF")
    ap.add_argument("--inventory", required=True, help="Inventory JSON from extract_pdf_inventory.py")
    ap.add_argument("--out", required=True, help="Output folder")
    ap.add_argument(
        "--write-pdfs",
        action="store_true",
        help="Also write per-section and per-page PDFs (bigger output).",
    )

    args = ap.parse_args()

    pdf_path = Path(args.pdf).expanduser().resolve()
    inv_path = Path(args.inventory).expanduser().resolve()
    out_root = Path(args.out).expanduser().resolve()
    out_root.mkdir(parents=True, exist_ok=True)

    inv = load_inventory(inv_path)
    widgets: List[Dict[str, Any]] = inv.get("widgets") or []

    # section -> pageIndex -> [widgets]
    by_section_page: Dict[str, Dict[int, List[Dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))

    for w in widgets:
        sec = w.get("sectionGuess")
        if not sec:
            continue
        page_index = int(w.get("pageIndex", -1))
        if page_index < 0:
            continue
        by_section_page[str(sec)][page_index].append(w)

    doc = fitz.open(str(pdf_path)) if args.write_pdfs else None

    for sec, page_map in sorted(by_section_page.items(), key=lambda kv: kv[0]):
        sec_dir = out_root / "sections" / f"{sec}"
        pages_dir = sec_dir / "pages"
        pages_dir.mkdir(parents=True, exist_ok=True)

        page_indices = sorted(page_map.keys())

        # Write per-page JSON
        for pi in page_indices:
            page_widgets = sorted(page_map[pi], key=lambda w: (w.get("rectTopLeft", {}).get("y", 0), w.get("rectTopLeft", {}).get("x", 0), w.get("name", "")))
            payload = {
                "section": sec,
                "pageIndex": pi,
                "pageNumber": pi + 1,
                "widgetCount": len(page_widgets),
                "widgets": page_widgets,
            }
            (pages_dir / f"page_{pi+1:03d}.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

            if args.write_pdfs and doc is not None:
                save_single_page(doc, pi, pages_dir / f"page_{pi+1:03d}.pdf")

        # Write section summary JSON
        section_summary = {
            "section": sec,
            "pageCount": len(page_indices),
            "pageNumbers": [pi + 1 for pi in page_indices],
            "pageIndices": page_indices,
            "totalWidgets": sum(len(v) for v in page_map.values()),
        }
        (sec_dir / f"section_{sec}.pages.json").write_text(json.dumps(section_summary, indent=2), encoding="utf-8")

        if args.write_pdfs and doc is not None and page_indices:
            save_pdf_pages(doc, page_indices, sec_dir / f"section_{sec}.pdf")

    print(f"✅ Wrote chunks under: {out_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
