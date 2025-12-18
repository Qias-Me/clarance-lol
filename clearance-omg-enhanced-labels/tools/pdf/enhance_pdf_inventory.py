#!/usr/bin/env python3
"""
enhance_pdf_inventory.py

Post-processes the base `references/pdf-inventory.json` (widget-level export produced by
`extract_pdf_inventory.py`) to add missing UX-critical metadata, especially for:

- Radio groups: export options (/Opt), on-state mapping, per-option display labels
- Better labels for radio groups and checkboxes using nearby text (line/word geometry)

Outputs:
- references/field-groups.json               (grouped by PDF field name; UI-ready)
- references/pdf-inventory.enhanced.json     (widget-level; adds displayLabel, optionLabel, etc.)

Why:
PyMuPDF exposes widget geometry + onState, but not the radio group /Opt export labels.
pdf-lib / PDFlib need these values to correctly render & set selection client-side.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import fitz  # PyMuPDF
from pypdf import PdfReader


GENERIC_LABELS = {
    "RadioButtonList",
    "p3-rb3b",
    "p4-rb3b",
    "p5-rb3b",
}

GENERIC_CHECKBOX_LABELS = {
    "Estimate",
    "Present",
    "DSN",
    "Day",
    "Night",
    "Unknown",
    "Other",
    "Other (explain)",
}


def is_generic_label(label: Optional[str]) -> bool:
    if not label:
        return True
    l = label.strip()
    if l in GENERIC_LABELS:
        return True
    if re.fullmatch(r"(TextField|RadioButtonList|CheckBox)\d*", l):
        return True
    if re.fullmatch(r"p\d+-.*", l):
        return True
    if l.lower() in ("", "checkbox", "radiobuttonlist", "radiobutton"):
        return True
    return False


def overlap_ratio(a0: float, a1: float, b0: float, b1: float) -> float:
    inter = max(0.0, min(a1, b1) - max(a0, b0))
    denom = min(a1 - a0, b1 - b0)
    if denom <= 0:
        return 0.0
    return inter / denom


def extract_lines(page: fitz.Page) -> List[Dict[str, Any]]:
    d = page.get_text("dict")
    lines: List[Dict[str, Any]] = []
    for b in d.get("blocks", []):
        if b.get("type") != 0:
            continue
        for line in b.get("lines", []):
            text = "".join(span.get("text", "") for span in line.get("spans", [])).strip()
            if not text:
                continue
            bbox = tuple(float(x) for x in line.get("bbox", (0, 0, 0, 0)))
            lines.append({"text": text, "bbox": bbox})
    return lines


def join_multiline(best_line: Dict[str, Any], lines: List[Dict[str, Any]], max_lines: int = 3) -> str:
    # Join subsequent lines that look like they belong to the same paragraph.
    x0, y0, x1, y1 = best_line["bbox"]
    collected = [best_line]
    cur_y1 = y1
    cur_x0 = x0
    for _ in range(max_lines - 1):
        next_candidates = []
        for ln in lines:
            lx0, ly0, lx1, ly1 = ln["bbox"]
            if abs(lx0 - cur_x0) <= 5 and ly0 >= cur_y1 - 5 and (ly0 - cur_y1) <= 3:
                next_candidates.append((abs(ly0 - cur_y1), ln))
        if not next_candidates:
            break
        next_line = min(next_candidates, key=lambda t: t[0])[1]
        if next_line in collected:
            break
        collected.append(next_line)
        cur_y1 = next_line["bbox"][3]
    return " ".join(ln["text"].strip() for ln in collected).strip()


def infer_label_for_bbox(
    bbox: Tuple[float, float, float, float],
    lines: List[Dict[str, Any]],
    *,
    exclude_texts: Optional[List[str]] = None,
    prefer_question_mark: bool = False,
) -> Optional[str]:
    x0, y0, x1, y1 = bbox
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    exclude = set(t.strip() for t in (exclude_texts or []) if t)

    left_candidates: List[Tuple[float, Dict[str, Any]]] = []
    above_candidates: List[Tuple[float, Dict[str, Any]]] = []

    for ln in lines:
        txt = ln["text"].strip()
        if not txt or txt in exclude:
            continue
        lx0, ly0, lx1, ly1 = ln["bbox"]

        # LEFT candidates
        vo = overlap_ratio(y0, y1, ly0, ly1)
        if lx1 <= x0 + 2 and vo >= 0.5:
            gap = x0 - lx1
            if gap <= 500:
                vdist = abs(((ly0 + ly1) / 2) - cy)
                score = gap + vdist * 0.25
                if prefer_question_mark and "?" in txt:
                    score -= 50
                left_candidates.append((score, ln))

        # ABOVE candidates – only if close (prevents grabbing unrelated column headers)
        ho = overlap_ratio(x0, x1, lx0, lx1)
        if ly1 <= y0 + 2 and ho >= 0.5:
            gap = y0 - ly1
            if gap <= 40:
                hdist = abs(((lx0 + lx1) / 2) - cx)
                score = gap + hdist * 0.25 + 100  # penalize above vs left
                if prefer_question_mark and "?" in txt:
                    score -= 50
                above_candidates.append((score, ln))

    candidates = left_candidates + above_candidates
    if not candidates:
        # fallback: allow further above search
        for ln in lines:
            txt = ln["text"].strip()
            if not txt or txt in exclude:
                continue
            lx0, ly0, lx1, ly1 = ln["bbox"]
            ho = overlap_ratio(x0, x1, lx0, lx1)
            if ly1 <= y0 + 2 and ho >= 0.5:
                gap = y0 - ly1
                if gap <= 200:
                    hdist = abs(((lx0 + lx1) / 2) - cx)
                    score = gap + hdist * 0.25 + 200
                    if prefer_question_mark and "?" in txt:
                        score -= 50
                    candidates.append((score, ln))

    if not candidates:
        return None

    best_line = min(candidates, key=lambda t: t[0])[1]
    return join_multiline(best_line, lines, max_lines=3)


def is_numeric_like_label(s: Optional[str]) -> bool:
    if s is None:
        return True
    ss = str(s).strip()
    return ss == "" or bool(re.fullmatch(r"\d+", ss)) or bool(re.fullmatch(r"[A-Z]", ss))


def cluster_rows(widget_records: List[Dict[str, Any]], y_tol: float = 10.0) -> List[List[Dict[str, Any]]]:
    sorted_ws = sorted(widget_records, key=lambda w: float(w["rectTopLeft"]["y"]))
    rows: List[Dict[str, Any]] = []
    for w in sorted_ws:
        y = float(w["rectTopLeft"]["y"])
        placed = False
        for row in rows:
            if abs(y - float(row["y_mean"])) <= y_tol:
                row["widgets"].append(w)
                row["y_mean"] = statistics.mean([float(ww["rectTopLeft"]["y"]) for ww in row["widgets"]])
                placed = True
                break
        if not placed:
            rows.append({"y_mean": y, "widgets": [w]})
    for row in rows:
        row["widgets"] = sorted(row["widgets"], key=lambda w: float(w["rectTopLeft"]["x"]))
    return [row["widgets"] for row in sorted(rows, key=lambda r: float(r["y_mean"]))]


def infer_option_labels_for_group(
    page_words: List[Tuple[float, float, float, float, str, int, int, int]],
    widget_records: List[Dict[str, Any]],
    max_width: float = 300.0,
) -> Dict[str, Optional[str]]:
    # Returns stableId -> uiLabel
    rows = cluster_rows(widget_records, y_tol=10.0)
    out: Dict[str, Optional[str]] = {}

    def word_overlaps(widget_bbox, word_bbox) -> bool:
        x0, y0, x1, y1 = widget_bbox
        wx0, wy0, wx1, wy1 = word_bbox
        return overlap_ratio(y0, y1, wy0, wy1) >= 0.5

    for row in rows:
        bboxes: List[Tuple[str, Tuple[float, float, float, float]]] = []
        for w in row:
            r = w["rectTopLeft"]
            bbox = (float(r["x"]), float(r["y"]), float(r["x"]) + float(r["width"]), float(r["y"]) + float(r["height"]))
            bboxes.append((w["stableId"], bbox))

        for idx, (sid, b) in enumerate(bboxes):
            x0, y0, x1, y1 = b
            if idx + 1 < len(bboxes):
                region_end = bboxes[idx + 1][1][0] - 2
            else:
                region_end = x1 + max_width
            region_start = x1 + 1

            collected = []
            for wx0, wy0, wx1, wy1, word, *_ in page_words:
                if not word_overlaps(b, (wx0, wy0, wx1, wy1)):
                    continue
                if wx0 >= region_start and wx0 <= region_end and wx1 <= region_end + 1:
                    collected.append((wx0, word))
            if not collected and idx > 0:
                # fallback: look left between previous widget and this widget
                prev_x1 = bboxes[idx - 1][1][2]
                region_start2 = prev_x1 + 2
                region_end2 = x0 - 2
                for wx0, wy0, wx1, wy1, word, *_ in page_words:
                    if not word_overlaps(b, (wx0, wy0, wx1, wy1)):
                        continue
                    if wx0 >= region_start2 and wx0 <= region_end2 and wx1 <= region_end2 + 1:
                        collected.append((wx0, word))

            if not collected:
                out[sid] = None
            else:
                out[sid] = " ".join(w for _, w in sorted(collected, key=lambda t: t[0])).strip() or None

    return out


def extract_radio_meta(pdf_path: Path) -> Dict[str, Dict[str, Any]]:
    reader = PdfReader(str(pdf_path))
    acro = reader.trailer["/Root"].get("/AcroForm")
    if not acro:
        return {}

    fields = acro.get("/Fields", [])
    if not fields:
        return {}

    # Map page indirect refs to index
    page_ref_to_index = {p.indirect_reference: i for i, p in enumerate(reader.pages)}

    def iter_fields(obj, prefix=""):
        from pypdf.generic import ArrayObject, DictionaryObject

        if isinstance(obj, DictionaryObject):
            t = obj.get("/T")
            full = f"{prefix}.{t}" if (prefix and t is not None) else (str(t) if t is not None else prefix)
            yield full, obj
            kids = obj.get("/Kids")
            if kids:
                for kid in kids:
                    yield from iter_fields(kid.get_object(), full)
        elif isinstance(obj, ArrayObject):
            for item in obj:
                yield from iter_fields(item.get_object(), prefix)

    top = fields[0].get_object()
    all_fields = list(iter_fields(top, ""))

    def extract_on_state(widget_dict) -> Optional[str]:
        ap = widget_dict.get("/AP")
        if not ap:
            return None
        n = ap.get("/N")
        if not n:
            return None
        keys = list(n.keys())
        non_off = [k for k in keys if str(k) != "/Off"]
        if not non_off:
            return None
        return str(non_off[0])[1:]  # strip "/"

    radio_meta: Dict[str, Dict[str, Any]] = {}
    for full_name, f in all_fields:
        if f.get("/Subtype") == "/Widget":
            continue
        if f.get("/FT") != "/Btn":
            continue
        opt = f.get("/Opt")
        kids = f.get("/Kids") or []
        if not opt or not kids or not isinstance(opt, list) or len(opt) <= 1:
            continue

        opt_labels = []
        for o in opt:
            if isinstance(o, bytes):
                opt_labels.append(o.decode())
            else:
                opt_labels.append(str(o))

        kid_metas = []
        for kid_ref in kids:
            kd = kid_ref.get_object()
            rect = kd.get("/Rect")
            p_ref = kd.get("/P")
            page_idx = page_ref_to_index.get(p_ref)
            on = extract_on_state(kd)
            kid_metas.append({"pageIndex": page_idx, "rectPdfRaw": [float(x) for x in rect], "onState": on})

        if len(kid_metas) == len(opt_labels) and all(k["onState"] for k in kid_metas):
            radio_meta[full_name] = {"options": opt_labels, "kids": kid_metas}

    return radio_meta


def union_bbox(widget_records: List[Dict[str, Any]]) -> Tuple[float, float, float, float]:
    x0 = min(float(w["rectTopLeft"]["x"]) for w in widget_records)
    y0 = min(float(w["rectTopLeft"]["y"]) for w in widget_records)
    x1 = max(float(w["rectTopLeft"]["x"]) + float(w["rectTopLeft"]["width"]) for w in widget_records)
    y1 = max(float(w["rectTopLeft"]["y"]) + float(w["rectTopLeft"]["height"]) for w in widget_records)
    return (x0, y0, x1, y1)


def find_left_context_field(
    chk_bbox: Tuple[float, float, float, float],
    base_fields: List[Dict[str, Any]],
    max_gap: float = 150.0,
) -> Optional[Dict[str, Any]]:
    x0, y0, x1, y1 = chk_bbox
    cy = (y0 + y1) / 2
    best: Optional[Tuple[float, Dict[str, Any]]] = None
    for b in base_fields:
        br = b["rectTopLeft"]
        bx0 = float(br["x"])
        by0 = float(br["y"])
        bx1 = bx0 + float(br["width"])
        by1 = by0 + float(br["height"])
        if bx1 > x0 + 2:
            continue
        vo = overlap_ratio(y0, y1, by0, by1)
        if vo < 0.3:
            continue
        gap = x0 - bx1
        if gap > max_gap:
            continue
        vdist = abs(((by0 + by1) / 2) - cy)
        score = gap + vdist * 0.25
        if best is None or score < best[0]:
            best = (score, b)
    return best[1] if best else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True, help="Path to the PDF (stable)")
    ap.add_argument(
        "--inventory",
        default=str(Path("references") / "pdf-inventory.json"),
        help="Base widget inventory JSON (from extract_pdf_inventory.py)",
    )
    ap.add_argument(
        "--out-groups",
        default=str(Path("references") / "field-groups.json"),
        help="Output grouped field metadata JSON (UI-ready)",
    )
    ap.add_argument(
        "--out-inventory",
        default=str(Path("references") / "pdf-inventory.enhanced.json"),
        help="Output enhanced widget inventory JSON",
    )
    args = ap.parse_args()

    pdf_path = Path(args.pdf)
    inv_path = Path(args.inventory)
    out_groups = Path(args.out_groups)
    out_inv = Path(args.out_inventory)

    base = json.loads(inv_path.read_text(encoding="utf-8"))
    widgets: List[Dict[str, Any]] = base["widgets"]

    # Build quick groupings
    widgets_by_name: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for w in widgets:
        widgets_by_name[w["name"]].append(w)

    # Load PDF for text geometry (lines + words)
    doc = fitz.open(str(pdf_path))
    lines_by_page = {i: extract_lines(doc.load_page(i)) for i in range(doc.page_count)}
    words_by_page = {i: doc.load_page(i).get_text("words") for i in range(doc.page_count)}

    # Extract /Opt radio export labels via pypdf
    radio_meta = extract_radio_meta(pdf_path)

    # Base fields for checkbox context (avoid selecting other checkboxes/radios as context anchors)
    base_fields_by_page: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for w in widgets:
        if w.get("type") in ("Text", "ComboBox", "ListBox", "Signature"):
            base_fields_by_page[int(w["pageIndex"])].append(w)

    enhanced_widgets = [dict(w) for w in widgets]  # shallow copy
    by_stable = {w["stableId"]: w for w in enhanced_widgets}

    field_groups: Dict[str, Dict[str, Any]] = {}

    # Build radio groups
    radio_field_names = {w["name"] for w in widgets if w.get("type") == "RadioButton"}

    for fname in sorted(radio_field_names):
        wrecs = widgets_by_name[fname]
        page_idx = int(wrecs[0]["pageIndex"])
        bbox = union_bbox(wrecs)
        opt_labels = (radio_meta.get(fname, {}) or {}).get("options") or []

        group_label = infer_label_for_bbox(
            bbox,
            lines_by_page[page_idx],
            exclude_texts=opt_labels,
            prefer_question_mark=True,
        )

        if not group_label:
            # fallback: pick the longest inferredLabel from base inventory
            inferred = [w.get("inferredLabel") for w in wrecs if w.get("inferredLabel")]
            group_label = max(inferred, key=lambda t: len(t)) if inferred else None

        if not group_label or is_generic_label(group_label):
            group_label = wrecs[0].get("label")

        # per-option UI label inference (word-level)
        ui_labels = infer_option_labels_for_group(words_by_page[page_idx], wrecs, max_width=300.0)

        # Build options list in the /Opt order so values match the PDF definition
        options = []
        meta = radio_meta.get(fname)
        if meta:
            for export_value, kid in zip(meta["options"], meta["kids"]):
                on_state = kid["onState"]
                match = next((w for w in wrecs if w.get("onState") == on_state), None)
                sid = match["stableId"] if match else None
                ui = ui_labels.get(sid) if sid else None

                display = export_value.strip() if isinstance(export_value, str) else str(export_value)
                if is_numeric_like_label(display) and ui:
                    display = ui

                options.append(
                    {
                        "exportValue": export_value,
                        "onState": on_state,
                        "stableId": sid,
                        "pageIndex": kid["pageIndex"],
                        "uiLabel": ui,
                        "displayLabel": display,
                    }
                )

        # Annotate widget-level
        for w in wrecs:
            ew = by_stable[w["stableId"]]
            ew["displayLabel"] = group_label
            # find matching option
            opt = next((o for o in options if o.get("stableId") == w["stableId"]), None)
            if opt:
                ew["optionLabel"] = opt.get("exportValue")
                ew["optionUiLabel"] = opt.get("uiLabel")
                ew["optionDisplayLabel"] = opt.get("displayLabel")

        field_groups[fname] = {
            "fieldName": fname,
            "fieldType": "RadioGroup",
            "displayLabel": group_label,
            "section": wrecs[0].get("section"),
            "sectionPart": wrecs[0].get("sectionPart"),
            "subsection": wrecs[0].get("subsection"),
            "entry": wrecs[0].get("entry"),
            "pageIndex": page_idx,
            "options": options,
            "widgets": [
                {"stableId": w["stableId"], "onState": w.get("onState"), "rectTopLeft": w.get("rectTopLeft")}
                for w in wrecs
            ],
        }

    # Enhance checkboxes
    for w in enhanced_widgets:
        if w.get("type") != "CheckBox":
            continue

        label = w.get("label") or w.get("inferredLabel")
        if is_generic_label(label):
            r = w["rectTopLeft"]
            bbox = (
                float(r["x"]),
                float(r["y"]),
                float(r["x"]) + float(r["width"]),
                float(r["y"]) + float(r["height"]),
            )
            inferred = infer_label_for_bbox(bbox, lines_by_page[int(w["pageIndex"])], prefer_question_mark=False)
            if inferred:
                label = inferred

        if label in GENERIC_CHECKBOX_LABELS:
            r = w["rectTopLeft"]
            chk_bbox = (
                float(r["x"]),
                float(r["y"]),
                float(r["x"]) + float(r["width"]),
                float(r["y"]) + float(r["height"]),
            )
            ctx = find_left_context_field(chk_bbox, base_fields_by_page[int(w["pageIndex"])], max_gap=150.0)
            if ctx:
                base_label = ctx.get("label") or ctx.get("inferredLabel")
                if base_label and not is_generic_label(base_label):
                    label = f"{base_label} — {label}"

        w["displayLabel"] = label

    out_groups.write_text(json.dumps(field_groups, indent=2, ensure_ascii=False), encoding="utf-8")
    out_inv.write_text(json.dumps({**base, "widgets": enhanced_widgets}, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"✅ wrote {out_groups} (radio groups={len(field_groups)})")
    print(f"✅ wrote {out_inv} (widgets={len(enhanced_widgets)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
