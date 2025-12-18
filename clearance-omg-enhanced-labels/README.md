# clearance-omg – PDF→UI field mapping & validation toolkit

This folder contains a **repeatable, programmatic** workflow to:

1. **Extract** every AcroForm field (widget) from a large, mostly-static PDF.
2. **Persist a “key”** (a golden snapshot) with strong identifiers: `fieldName + pageIndex + rect + fieldType (+ options/flags)`.
3. **Chunk** the PDF by section → page for manageable review/debugging.
4. **Validate** that your TypeScript mappings (e.g., `createFieldFromReference(13, 'form1[0]....')`) are correct *without requiring a human to open the PDF*.

> The core idea: treat the PDF itself as the source-of-truth once, then enforce correctness by comparing against a deterministic snapshot (“key”).

---

## Quick start (Python – zero external deps beyond PyMuPDF)

Place your stable PDF into this repo (example):

```
clearance-omg/
  pdf/
    sf86.pdf
```

Then run:

```bash
python tools/pdf/extract_pdf_inventory.py --pdf pdf/sf86.pdf --out references/pdf-inventory.json
python tools/pdf/chunk_by_section.py --pdf pdf/sf86.pdf --inventory references/pdf-inventory.json --out references/chunks
python tools/pdf/extract_ts_mappings.py --ts ../section13.ts --out references/ts-mapping.section13.json
python tools/pdf/validate_ts_vs_pdf.py --inventory references/pdf-inventory.json --tsmap references/ts-mapping.section13.json --out reports/section13.validation.json
```

Outputs:

- `references/pdf-inventory.json` – full field list with page + rect.
- `references/chunks/section13/pages/page_XX.json` – per-page metadata slices.
- `references/ts-mapping.section13.json` – extracted PDF field names (and default types) from your TS mapping file.
- `reports/section13.validation.json` – machine-readable validation report.

---

## What “100% validation” means here

Because your PDF “shouldn’t be changing anytime soon”, you can be strict:

- **Existence**: every mapped field name exists in the PDF.
- **Uniqueness**: no accidental duplicates (same PDF field mapped to multiple logical fields).
- **Type compatibility**: boolean defaults must map to button/checkbox widgets, etc.
- **Geometry**: page number + rectangle match the golden key.

If any of those drift, CI fails.

---

## Notes

- Coordinates in the inventory are stored both in **PDF coordinates** (origin bottom-left) and **top-left coordinates** (handy for HTML overlay).
- For production UI, a common pairing is:
  - **PDF.js** (render pages + read annotations)
  - **pdf-lib** (write/flatten and download client-side)


---

---

## Radio options & better labels (UI-ready)

`extract_pdf_inventory.py` captures widget geometry and (sometimes) a tooltip label, but **radio groups** in this PDF store their human-facing option labels in the AcroForm `/Opt` array (e.g., `YES/NO`), which PyMuPDF does not reliably surface.

Run the enhancer to generate a UI-ready grouped index:

```bash
python tools/pdf/enhance_pdf_inventory.py --pdf clean.pdf \
  --inventory references/pdf-inventory.json \
  --out-groups references/field-groups.json \
  --out-inventory references/pdf-inventory.enhanced.json
```

This produces:
- `references/field-groups.json` – one record per PDF field name.
  - Radio groups include `options[]` with `exportValue`, `onState`, and `displayLabel`.
  - If `/Opt` is numeric (e.g., `1..5`), `displayLabel` is inferred from nearby page text.
- `references/pdf-inventory.enhanced.json` – widget-level inventory enriched with `displayLabel`
  and per-radio-widget `optionDisplayLabel` (what you should render on the UI).

Your Next.js UI can now render **all radio options** deterministically without hard-coding them.

