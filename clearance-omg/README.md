# clearance-omg

This folder contains **deterministic extraction + classification** of AcroForm widget fields from `clean.pdf`.

Outputs are organized as requested:

- **Section** (SF-86 section number)
- **Subsection** (detected by headings like `13A.1`, `20B`, etc. when present; otherwise `root`)
- **Entry** (detected by text like `Entry #1`, `Entry #2`, etc. when present; otherwise `0`)

## Key idea for 100% validation

Because the PDF is stable, we treat **(fieldName + page + rect + type + label)** as the immutable truth.
Tests can re-extract from the PDF and compare against these JSON snapshots. No human needs to open the PDF.

## Folder layout

- `meta/field-index.json`  
  Flat lookup table keyed by `id` (PDF widget xref). Contains `name`, `label`, `type`, `page`, `rect`, `section`, `subsection`, `entry`.

- `meta/sections-summary.json`  
  High-level tree: section -> subsection -> entry -> fieldIds.

- `sections/section-<N>/pages/page-<P>.json`  
  All fields for that section on that page (sorted top-to-bottom, left-to-right).

- `sections/section-<N>/subsections/<SUB>/entries/entry-<E>/fields.json`  
  All fields for a specific (section, subsection, entry).

## Notes

- `id` is the widget annotation xref from the PDF. This matches the style of IDs like `"9513"` used in your `Field<T>` docs.
- `type` is the raw widget field type integer from PyMuPDF; you can map it to your TypeScript `type` strings in a later pass.