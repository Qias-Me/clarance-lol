#!/usr/bin/env python3
"""
Extract + classify AcroForm widget fields from a static SF-86 PDF.

Outputs:
- meta/field-index.json
- meta/sections-summary.json
- sections/section-*/...

Classification levels:
- section: from "Section <N>" headings (with multi-section pages supported)
- subsection: from headings like "13A.1", "20B", etc. when present; else "root"
- entry: from "Entry #<n>" text when present; else 0

This script is intentionally deterministic so it can be used for snapshot-style tests.
"""

import json, os, re, shutil, zipfile
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict
import fitz  # PyMuPDF

SEC_RE = re.compile(r"^\s*Section\s+(\d{1,2})([A-Z])?\b", re.IGNORECASE)
ENTRY_RE = re.compile(r"^\s*Entry\s*#?\s*(\d+)\b", re.IGNORECASE)

@dataclass
class TextItem:
    text: str
    bbox: Tuple[float,float,float,float]  # x0,y0,x1,y1

@dataclass
class Region:
    key: str
    bbox: Tuple[float,float,float,float]
    y0: float

def extract_lines(page) -> List[TextItem]:
    d = page.get_text("dict")
    items: List[TextItem] = []
    for b in d.get("blocks", []):
        if b.get("type", 0) != 0:
            continue
        for l in b.get("lines", []):
            spans = l.get("spans", [])
            if not spans:
                continue
            text = "".join(s.get("text", "") for s in spans).strip()
            if not text:
                continue
            x0 = min(s["bbox"][0] for s in spans)
            y0 = min(s["bbox"][1] for s in spans)
            x1 = max(s["bbox"][2] for s in spans)
            y1 = max(s["bbox"][3] for s in spans)
            items.append(TextItem(text=text, bbox=(x0,y0,x1,y1)))
    return items

def cluster_by_y(items: List[TextItem], tol: float=3.0):
    sorted_items = sorted(items, key=lambda it: it.bbox[1])
    clusters = []  # [y_rep, [items]]
    for it in sorted_items:
        y0 = it.bbox[1]
        placed = False
        for cl in clusters:
            if abs(cl[0] - y0) <= tol:
                cl[1].append(it)
                cl[0] = (cl[0] * (len(cl[1]) - 1) + y0) / len(cl[1])
                placed = True
                break
        if not placed:
            clusters.append([y0, [it]])
    clusters.sort(key=lambda c: c[0])
    return clusters

def build_regions(page_width: float, page_height: float, headings: List[Tuple[str, TextItem]], y_tol: float=3.0, top_to_zero: bool=True) -> List[Region]:
    if not headings:
        return []
    items = [h[1] for h in headings]
    clusters = cluster_by_y(items, tol=y_tol)
    info_lookup = {(h[1].text, h[1].bbox): h[0] for h in headings}
    regions: List[Region] = []
    for idx, (_y_rep, cluster_items) in enumerate(clusters):
        if idx == 0 and top_to_zero:
            y_start = 0.0
        else:
            y_start = min(it.bbox[1] for it in cluster_items) - 0.5

        if idx < len(clusters) - 1:
            y_end = min(it.bbox[1] for it in clusters[idx+1][1]) - 0.5
        else:
            y_end = page_height + 0.5

        cluster_items_sorted = sorted(cluster_items, key=lambda it: (it.bbox[0] + it.bbox[2]) / 2)
        centers = [ (it.bbox[0] + it.bbox[2]) / 2 for it in cluster_items_sorted ]

        bounds = [0.0]
        for j in range(len(centers) - 1):
            bounds.append((centers[j] + centers[j+1]) / 2)
        bounds.append(page_width)

        for j, it in enumerate(cluster_items_sorted):
            x_start = bounds[j]
            x_end = bounds[j+1]
            key = info_lookup.get((it.text, it.bbox))
            regions.append(Region(key=key, bbox=(x_start, y_start, x_end, y_end), y0=y_start))

    regions.sort(key=lambda r: (r.bbox[1], r.bbox[0]))
    return regions

def point_in_bbox(x: float, y: float, bbox: Tuple[float,float,float,float]) -> bool:
    x0,y0,x1,y1 = bbox
    return x0 <= x <= x1 and y0 <= y <= y1

def assign_region(x: float, y: float, regions: List[Region]) -> Optional[Region]:
    matches = [r for r in regions if point_in_bbox(x,y,r.bbox)]
    if not matches:
        return None
    if len(matches) == 1:
        return matches[0]
    matches.sort(key=lambda r: (r.bbox[2]-r.bbox[0])*(r.bbox[3]-r.bbox[1]))
    return matches[0]

def detect_section_headings(lines: List[TextItem]):
    out=[]
    for it in lines:
        m = SEC_RE.match(it.text)
        if m:
            num = int(m.group(1))
            letter = (m.group(2) or "").upper()
            section_num_str = str(num)
            base_sub_key = f"{num}{letter}" if letter else str(num)
            out.append((section_num_str, it, base_sub_key))
    out.sort(key=lambda h: (h[1].bbox[1], h[1].bbox[0]))
    return out

def filter_lines_in_region(lines: List[TextItem], bbox: Tuple[float,float,float,float]) -> List[TextItem]:
    x0,y0,x1,y1=bbox
    res=[]
    for it in lines:
        ix0,iy0,ix1,iy1=it.bbox
        cx=(ix0+ix1)/2; cy=(iy0+iy1)/2
        if x0 <= cx <= x1 and y0 <= cy <= y1:
            res.append(it)
    return res

def detect_subsection_headings(lines: List[TextItem], section_num: int, x0_max: float=80.0):
    pat = re.compile(rf"^\s*{section_num}([A-Z])(?:\.(\d+))?\b", re.IGNORECASE)
    candidates=[]
    for it in lines:
        if it.text.lower().startswith("section"):
            continue
        m = pat.match(it.text)
        if not m:
            continue
        code = f"{section_num}{m.group(1).upper()}"
        if m.group(2):
            code += f".{m.group(2)}"
        if it.bbox[0] <= x0_max:
            candidates.append((code, it))

    # group by code; keep only likely headings
    from collections import defaultdict
    groups=defaultdict(list)
    for code,it in candidates:
        groups[code].append(it)

    headings=[]
    for code, items in groups.items():
        # exact match (after stripping punctuation)
        exact=[it for it in items if re.sub(r"[^0-9A-Z\.]", "", it.text.upper()) == code]
        if exact:
            headings.append((code, min(exact, key=lambda it: it.bbox[1])))
        elif len(items) == 1:
            headings.append((code, items[0]))
        else:
            # multiple occurrences -> likely cross refs (e.g., lists like "13A.5 and 13A.6")
            pass

    headings.sort(key=lambda h: (h[1].bbox[1], h[1].bbox[0]))
    return headings

def detect_entry_markers_in_region(lines: List[TextItem], region_bbox: Tuple[float,float,float,float], x0_max: float=100.0):
    reg_lines = filter_lines_in_region(lines, region_bbox)
    out=[]
    for it in reg_lines:
        m = ENTRY_RE.match(it.text)
        if m and it.bbox[0] <= x0_max:
            out.append((int(m.group(1)), it))
    out.sort(key=lambda m: (m[1].bbox[1], m[1].bbox[0]))
    return out

def build_subsection_regions(section_region: Region, page_width: float, page_height: float, section_num: int, base_sub_key: str, lines: List[TextItem]) -> List[Region]:
    lines_in_sec = filter_lines_in_region(lines, section_region.bbox)
    subs = detect_subsection_headings(lines_in_sec, section_num)
    if not subs:
        return [Region(key=base_sub_key, bbox=section_region.bbox, y0=section_region.bbox[1])]

    headings=[(code,it) for code,it in subs]
    regions = build_regions(page_width, page_height, headings, y_tol=1.0, top_to_zero=False)

    # clip to the section bbox
    clipped=[]
    for r in regions:
        x0=max(section_region.bbox[0], r.bbox[0])
        x1=min(section_region.bbox[2], r.bbox[2])
        y0=max(section_region.bbox[1], r.bbox[1])
        y1=min(section_region.bbox[3], r.bbox[3])
        clipped.append(Region(key=r.key, bbox=(x0,y0,x1,y1), y0=y0))
    clipped.sort(key=lambda r:(r.bbox[1], r.bbox[0]))

    first_y=min(r.bbox[1] for r in clipped)
    root_key = base_sub_key if base_sub_key not in [r.key for r in clipped] else f"{base_sub_key}_root"
    root_bbox=(section_region.bbox[0], section_region.bbox[1], section_region.bbox[2], first_y)
    return [Region(key=root_key, bbox=root_bbox, y0=section_region.bbox[1])] + clipped

def widget_record(w, page_num: int):
    rect = w.rect
    return {
        "id": str(w._annot.xref),
        "page": page_num,
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

def extract_section_number_fallback(name: str) -> Optional[int]:
    m_all = list(re.finditer(r"section_?(\d{1,2})", name, flags=re.IGNORECASE))
    if m_all:
        return int(m_all[-1].group(1))
    m = re.search(r"Sections(\d{1,2})-(\d{1,2})", name, flags=re.IGNORECASE)
    if m:
        return int(m.group(1))
    return None

def run(pdf_path: str, out_root: str):
    doc = fitz.open(pdf_path)

    # Clean output
    if os.path.exists(out_root):
        shutil.rmtree(out_root)
    os.makedirs(out_root, exist_ok=True)
    os.makedirs(os.path.join(out_root, "meta"), exist_ok=True)
    os.makedirs(os.path.join(out_root, "sections"), exist_ok=True)

    all_records=[]
    page_summaries=[]

    for page_index in range(doc.page_count):
        page = doc[page_index]
        widgets = list(page.widgets() or [])
        if not widgets:
            continue

        lines = extract_lines(page)
        sec_headings = detect_section_headings(lines)
        base_map = {sec_num: base_sub_key for sec_num, _it, base_sub_key in sec_headings}

        sec_regions = build_regions(page.rect.width, page.rect.height,
                                   [(sec_num, it) for sec_num, it, _ in sec_headings],
                                   y_tol=1.0, top_to_zero=True) if sec_headings else []

        sub_regions_by_section={}
        for sreg in sec_regions:
            if not sreg.key or not sreg.key.isdigit():
                continue
            sec_num = int(sreg.key)
            base_sub = base_map.get(sreg.key, sreg.key)
            sub_regions_by_section[sreg.key] = build_subsection_regions(sreg, page.rect.width, page.rect.height, sec_num, base_sub, lines)

        for w in widgets:
            rec = widget_record(w, page_index+1)
            cx = w.rect.x0 + (w.rect.x1 - w.rect.x0)/2
            cy = w.rect.y0 + (w.rect.y1 - w.rect.y0)/2

            sec=None
            sub=None
            ent=None

            if sec_regions:
                sreg = assign_region(cx, cy, sec_regions)
                if sreg:
                    sec = sreg.key
                    ssub_regions = sub_regions_by_section.get(sec, [])
                    ssub = assign_region(cx, cy, ssub_regions) if ssub_regions else None
                    sub = ssub.key if ssub else base_map.get(sec, sec)

                    if ssub:
                        markers = detect_entry_markers_in_region(lines, ssub.bbox)
                        if markers:
                            chosen=None
                            for num,it in markers:
                                if it.bbox[1] <= cy:
                                    chosen=num
                                else:
                                    break
                            if chosen is not None:
                                ent=chosen

            if sec is None:
                # fallback: parse from name
                sec_f = extract_section_number_fallback(rec["name"])
                if sec_f is not None:
                    sec=str(sec_f)

            # continuation pages -> treat as Section 30 (common SF-86 convention)
            if sec is None and "continuation" in rec["name"].lower():
                sec="30"
                m=re.search(r"\.(continuation\d+)\[", rec["name"], re.IGNORECASE)
                sub=m.group(1) if m else "continuation"

            rec.update({"section": sec, "subsection": sub, "entry": ent})
            all_records.append(rec)

        page_summaries.append({
            "page": page_index+1,
            "widgetCount": len(widgets),
            "sectionsOnPage": sorted(set(r.key for r in sec_regions)),
        })

    # field-index.json
    field_index = {rec["id"]: rec for rec in all_records}
    with open(os.path.join(out_root, "meta", "field-index.json"), "w") as f:
        json.dump(field_index, f, indent=2)

    with open(os.path.join(out_root, "meta", "page-summaries.json"), "w") as f:
        json.dump(page_summaries, f, indent=2)

    # sections-summary.json
    from collections import defaultdict
    sections_summary={}
    for sec in sorted(set(r["section"] for r in all_records), key=lambda s:int(s) if s and s.isdigit() else 999):
        sec_recs=[r for r in all_records if r["section"]==sec]
        pages=sorted(set(r["page"] for r in sec_recs))
        subsections=defaultdict(list)
        for r in sec_recs:
            subsections[r.get("subsection") or "root"].append(r)

        sub_summary={}
        for sub_key, sub_recs in subsections.items():
            sub_pages=sorted(set(r["page"] for r in sub_recs))
            entries=defaultdict(list)
            for r in sub_recs:
                ent=r.get("entry")
                ent_key=str(ent if ent is not None else 0)
                entries[ent_key].append(r)
            entry_summary={}
            for ent_key, ent_recs in entries.items():
                entry_pages=sorted(set(r["page"] for r in ent_recs))
                entry_summary[ent_key]={
                    "pages": entry_pages,
                    "fieldIds": sorted(set(r["id"] for r in ent_recs), key=lambda x:int(x))
                }
            sub_summary[sub_key]={"pages": sub_pages, "entries": entry_summary, "fieldCount": len(sub_recs)}

        sections_summary[sec]={"pages": pages,
                              "pageRange": [min(pages), max(pages)] if pages else None,
                              "fieldCount": len(sec_recs),
                              "subsections": sub_summary}

    with open(os.path.join(out_root, "meta", "sections-summary.json"), "w") as f:
        json.dump(sections_summary, f, indent=2)

    # materialize folder structure
    def safe_name(s: str) -> str:
        return re.sub(r"[^A-Za-z0-9\-]+", "_", s)

    sections_dir=os.path.join(out_root, "sections")
    for sec, sec_info in sections_summary.items():
        sec_folder=os.path.join(sections_dir, f"section-{sec}")
        os.makedirs(sec_folder, exist_ok=True)
        with open(os.path.join(sec_folder,"index.json"),"w") as f:
            json.dump(sec_info,f,indent=2)

        pages_folder=os.path.join(sec_folder,"pages")
        os.makedirs(pages_folder, exist_ok=True)
        for p in sec_info["pages"]:
            page_recs=[r for r in all_records if r["section"]==sec and r["page"]==p]
            page_recs_sorted=sorted(page_recs, key=lambda r:(r["rect"]["y"], r["rect"]["x"], r["name"]))
            with open(os.path.join(pages_folder,f"page-{p}.json"),"w") as f:
                json.dump(page_recs_sorted,f,indent=2)

        subsecs_folder=os.path.join(sec_folder,"subsections")
        os.makedirs(subsecs_folder, exist_ok=True)
        for sub_key, sub_info in sec_info["subsections"].items():
            sub_folder=os.path.join(subsecs_folder, safe_name(sub_key))
            os.makedirs(sub_folder, exist_ok=True)
            with open(os.path.join(sub_folder,"index.json"),"w") as f:
                json.dump(sub_info,f,indent=2)
            entries_folder=os.path.join(sub_folder,"entries")
            os.makedirs(entries_folder, exist_ok=True)
            for ent_key, ent_info in sub_info["entries"].items():
                ent_folder=os.path.join(entries_folder,f"entry-{ent_key}")
                os.makedirs(ent_folder, exist_ok=True)
                ent_field_recs=[field_index[fid] for fid in ent_info["fieldIds"]]
                ent_field_recs_sorted=sorted(ent_field_recs, key=lambda r:(r["page"], r["rect"]["y"], r["rect"]["x"], r["name"]))
                with open(os.path.join(ent_folder,"fields.json"),"w") as f:
                    json.dump(ent_field_recs_sorted,f,indent=2)

if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True, help="Path to clean.pdf")
    ap.add_argument("--out", required=True, help="Output folder")
    args = ap.parse_args()
    run(args.pdf, args.out)