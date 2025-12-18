#!/usr/bin/env python3
"""extract_pdf_inventory.py

Extracts a deterministic inventory of **AcroForm widgets** (fillable fields) from a PDF.

Why this exists:
- Your UI + TS interfaces need a stable, accurate mapping to PDF fields.
- Humans should NOT have to manually open the PDF during tests.
- For a mostly-static PDF, we can generate a golden snapshot ("key") of:
  - field name
  - field type
  - page number/index
  - widget rectangle (coordinates)
  - options / flags

This script uses **PyMuPDF** (fitz) because it can read widget annotations + their rects.

Output JSON schema (high level):
{
  "pdf": { "path": ..., "sha256": ..., "pageCount": ... },
  "pages": [
     { "pageIndex": 0, "width": ..., "height": ..., "widgets": [...] },
     ...
  ],
  "widgets": [ ... flattened list ... ]
}

Coordinates:
- PyMuPDF reports rectangles in a top-left origin coordinate system (y grows down).
- We store BOTH:
  - rectTopLeft: {x,y,width,height}
  - rectPdf:     {x,y,width,height}   (bottom-left origin, y grows up)

"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import fitz  # PyMuPDF


SECTION_RE = re.compile(r"(?i)(?:section|sections)_?(\d+)(?:-(\d+))?")


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def infer_section_from_field_name(field_name: str) -> Optional[str]:
    """Best-effort section inference from common SF-86-ish field naming patterns."""
    m = SECTION_RE.search(field_name or "")
    if not m:
        return None
    a = m.group(1)
    b = m.group(2)
    if b:
        return f"{a}-{b}"
    return a


def _normalize_text_block_text(text: str) -> str:
    # PDF text blocks often contain newlines and multiple spaces.
    return re.sub(r"\s+", " ", (text or "").strip())


def infer_nearby_label(
    widget_rect_tl: Tuple[float, float, float, float],
    text_blocks: List[Tuple[float, float, float, float, str, int, int]],
    *,
    max_candidates: int = 3,
) -> Dict[str, Any]:
    """Infer a human-ish label for a widget by looking for nearby page text.

    This is deterministic and works *without OCR* when the PDF has real text.

    Strategy:
    1) Prefer text blocks to the LEFT of the widget with good vertical overlap.
    2) Fallback to text blocks ABOVE the widget with good horizontal overlap.

    Returns:
      {
        "inferredLabel": str | None,
        "candidates": [ {text,bbox,score,kind}, ... ]
      }
    """

    x0, y0, x1, y1 = widget_rect_tl
    w_cx = (x0 + x1) / 2
    w_cy = (y0 + y1) / 2

    def vertical_overlap_ratio(by0: float, by1: float) -> float:
        inter = max(0.0, min(y1, by1) - max(y0, by0))
        denom = max(1e-6, min(y1 - y0, by1 - by0))
        return inter / denom

    def horizontal_overlap_ratio(bx0: float, bx1: float) -> float:
        inter = max(0.0, min(x1, bx1) - max(x0, bx0))
        denom = max(1e-6, min(x1 - x0, bx1 - bx0))
        return inter / denom

    candidates: List[Dict[str, Any]] = []

    for bx0, by0, bx1, by1, text, block_no, block_type in text_blocks:
        txt = _normalize_text_block_text(text)
        if not txt:
            continue

        # LEFT candidates
        if bx1 <= x0 + 2:  # small tolerance
            vo = vertical_overlap_ratio(by0, by1)
            if vo >= 0.25:
                # Score: smaller horizontal gap + closer vertical centers
                gap = x0 - bx1
                vdist = abs(((by0 + by1) / 2) - w_cy)
                score = gap + (vdist * 0.25)
                candidates.append(
                    {
                        "kind": "left",
                        "text": txt,
                        "bbox": [bx0, by0, bx1, by1],
                        "score": float(score),
                        "vo": float(vo),
                        "ho": float(horizontal_overlap_ratio(bx0, bx1)),
                    }
                )
                continue

        # ABOVE candidates
        if by1 <= y0 + 2:
            ho = horizontal_overlap_ratio(bx0, bx1)
            if ho >= 0.25:
                gap = y0 - by1
                hdist = abs(((bx0 + bx1) / 2) - w_cx)
                score = gap + (hdist * 0.25)
                candidates.append(
                    {
                        "kind": "above",
                        "text": txt,
                        "bbox": [bx0, by0, bx1, by1],
                        "score": float(score + 50.0),  # bias: prefer left
                        "vo": float(vertical_overlap_ratio(by0, by1)),
                        "ho": float(ho),
                    }
                )

    candidates.sort(key=lambda c: c["score"])
    top = candidates[:max_candidates]

    inferred = top[0]["text"] if top else None
    return {"inferredLabel": inferred, "candidates": top}


def widget_type_to_string(widget: Any) -> str:
    # PyMuPDF uses ints for widget.field_type. This helper returns a stable string.
    # If field_type_string exists, use it.
    s = getattr(widget, "field_type_string", None)
    if isinstance(s, str) and s.strip():
        return s.strip()

    # Fallback: map known numeric types if present.
    # 0=unknown, 1=button, 2=text, 3=choice, 4=signature (typical)
    t = getattr(widget, "field_type", None)
    mapping = {1: "button", 2: "text", 3: "choice", 4: "signature"}
    if isinstance(t, int) and t in mapping:
        return mapping[t]
    return str(t) if t is not None else "unknown"


def _maybe_call(v: Any) -> Any:
    """Return v() if v is callable, otherwise return v.

    PyMuPDF exposes some Widget attributes (e.g., `button_states`, `on_state`)
    as bound methods, which are not JSON-serializable if we store them directly.
    """
    try:
        if callable(v):
            return v()
    except Exception:
        return None
    return v


def make_widget_fingerprint(meta: Dict[str, Any]) -> str:
    """Stable fingerprint for detecting drift.

    - Rounds coordinates to 2 decimals to avoid float noise.
    """
    payload = {
        "name": meta.get("name"),
        "pageIndex": meta.get("pageIndex"),
        "type": meta.get("type"),
        "rectPdf": [round(x, 2) for x in meta.get("rectPdf", [])],
        "options": meta.get("options") or [],
        "flags": meta.get("flags"),
    }
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True, help="Path to the PDF")
    ap.add_argument("--out", required=True, help="Output JSON file")
    ap.add_argument(
        "--infer-labels",
        action="store_true",
        help="Infer nearby labels from page text (no OCR).",
    )
    ap.add_argument(
        "--max-label-candidates",
        type=int,
        default=3,
        help="How many nearby-label candidates to store per widget.",
    )

    args = ap.parse_args()

    pdf_path = Path(args.pdf).expanduser().resolve()
    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    pdf_hash = sha256_file(pdf_path)

    doc = fitz.open(str(pdf_path))

    flat_widgets: List[Dict[str, Any]] = []
    pages_out: List[Dict[str, Any]] = []

    for page_index in range(doc.page_count):
        page = doc.load_page(page_index)
        page_rect = page.rect
        page_w = float(page_rect.width)
        page_h = float(page_rect.height)
        rotation = int(getattr(page, "rotation", 0) or 0)

        widgets = list(page.widgets() or [])

        # Extract text blocks only if needed
        text_blocks = page.get_text("blocks") if args.infer_labels else []

        page_widgets_out: List[Dict[str, Any]] = []

        for w in widgets:
            r = getattr(w, "rect", None)
            if r is None:
                continue

            x0, y0, x1, y1 = float(r.x0), float(r.y0), float(r.x1), float(r.y1)
            width = float(x1 - x0)
            height = float(y1 - y0)

            rect_tl = [x0, y0, x1, y1]
            rect_pdf = [x0, page_h - y1, x1, page_h - y0]

            meta: Dict[str, Any] = {
                "name": getattr(w, "field_name", None),
                "label": getattr(w, "field_label", None),
                "type": widget_type_to_string(w),
                "pageIndex": page_index,
                "pageNumber": page_index + 1,
                "pageWidth": page_w,
                "pageHeight": page_h,
                "pageRotation": rotation,
                "rectTopLeft": {
                    "x": x0,
                    "y": y0,
                    "width": width,
                    "height": height,
                },
                "rectPdf": {
                    "x": rect_pdf[0],
                    "y": rect_pdf[1],
                    "width": rect_pdf[2] - rect_pdf[0],
                    "height": rect_pdf[3] - rect_pdf[1],
                },
                "rectTopLeftRaw": rect_tl,
                "rectPdfRaw": rect_pdf,
                "flags": getattr(w, "field_flags", None),
                "value": getattr(w, "field_value", None),
                "options": getattr(w, "choice_values", None),
                "buttonStates": _maybe_call(getattr(w, "button_states", None)),
                "onState": _maybe_call(getattr(w, "on_state", None)),
                "xref": getattr(w, "xref", None),
            }

            meta["sectionGuess"] = infer_section_from_field_name(meta.get("name") or "")

            if args.infer_labels:
                inferred = infer_nearby_label((x0, y0, x1, y1), text_blocks, max_candidates=args.max_label_candidates)
                meta["inferredLabel"] = inferred["inferredLabel"]
                meta["labelCandidates"] = inferred["candidates"]

            meta["fingerprint"] = make_widget_fingerprint(
                {
                    "name": meta["name"],
                    "pageIndex": meta["pageIndex"],
                    "type": meta["type"],
                    "rectPdf": rect_pdf,
                    "options": meta.get("options") or [],
                    "flags": meta.get("flags"),
                }
            )

            page_widgets_out.append(meta)
            flat_widgets.append(meta)

        pages_out.append(
            {
                "pageIndex": page_index,
                "pageNumber": page_index + 1,
                "width": page_w,
                "height": page_h,
                "rotation": rotation,
                "widgetCount": len(page_widgets_out),
                "widgets": page_widgets_out,
            }
        )

    # Deterministic ordering for stable IDs
    def sort_key(w: Dict[str, Any]):
        # Sort by page, then y (top-left origin: smaller y is higher on page)
        r = w.get("rectTopLeft") or {}
        return (
            int(w.get("pageIndex", 0)),
            round(float(r.get("y", 0.0)), 2),
            round(float(r.get("x", 0.0)), 2),
            w.get("name") or "",
        )

    flat_widgets.sort(key=sort_key)

    # Assign a stable sequential ID (4 digits) – you can replace this with your existing ID source.
    for idx, w in enumerate(flat_widgets, start=1):
        w["stableId"] = f"{idx:04d}"

    out = {
        "pdf": {
            "path": str(pdf_path),
            "sha256": pdf_hash,
            "pageCount": doc.page_count,
        },
        "widgets": flat_widgets,
        "pages": pages_out,
    }

    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"✅ Wrote inventory: {out_path} (widgets={len(flat_widgets)}, pages={doc.page_count})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
