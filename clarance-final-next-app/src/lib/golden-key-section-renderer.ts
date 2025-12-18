/* eslint-disable prefer-const */
import type { GoldenKeyInventory } from "@/types/golden-key";
import { FieldType, type PDFField } from "@/types/pdf-fields";
import { FieldNameMapper } from "./field-name-mapper";
import { type FieldGroups, isDropdownGroup, hasDropdownOptions, getDropdownOptions as getFieldGroupDropdownOptions } from "./field-groups-loader";
import { getDropdownOptions as getPdfDropdownOptions } from "./dropdown-options-service";

/**
 * Deterministic section field renderer that uses golden key as the source of truth
 * This prevents section bleed issues by filtering strictly on golden key logical.section
 */
export class GoldenKeySectionRenderer {
  private goldenKey: GoldenKeyInventory;
  private fieldGroups: FieldGroups;

  constructor(goldenKey: GoldenKeyInventory, fieldGroups: FieldGroups) {
    this.goldenKey = goldenKey;
    this.fieldGroups = fieldGroups;
  }

  /**
   * Pending dropdown options to be resolved asynchronously.
   */
  private pendingDropdownOptions: Map<string, Promise<string[]>> = new Map();

/**
 * Robust field group lookup with multiple fallback patterns.
 * Handles various PDF field naming conventions and key mismatches.
 *
 * @param fieldName - string - The raw field name from golden-key.
 * @returns FieldGroup | undefined - The found field group or undefined.
 *
 * Bug-fix: Replaces hardcoded single fallback with comprehensive pattern matching.
 */
private findFieldGroup(fieldName: string): any {
  const patterns = [
    fieldName,
    `form1[0].Sections1-6[0].${fieldName}[0]`,
    `form1[0].Sections1-6[0].${fieldName}`,
    `form1[0].#subform[0].${fieldName}[0]`,
    `form1[0].${fieldName}[0]`,
    `form1[0].${fieldName}`,
    fieldName.replace(/\[0\]$/, ''),
    fieldName.replace(/^form1\[0\]\./, ''),
  ];

  for (const pattern of patterns) {
    if (this.fieldGroups[pattern]) {
      return this.fieldGroups[pattern];
    }
  }

  return undefined;
}

  /**
   * Gets fields for a specific section, strictly filtered by golden key logical.section.
   * This ensures no cross-section contamination.
   * 
   * @param sectionId - string - The section ID to get fields for.
   * @returns PDFField[] - Array of fields for the section.
   * 
   * Bug-fix: Now properly handles dropdown options from field-groups or PDF fallback.
   */
  getFieldsForSection(sectionId: string): PDFField[] {
    const sectionRecords = Object.values(this.goldenKey.records).filter(
      record => record.logical.section === sectionId
    );

    console.log(`🔍 Section ${sectionId}: Found ${sectionRecords.length} records in golden key`);

    const processedRadioGroups = new Set<string>();
    const processedDropdowns = new Set<string>();
    const fields: PDFField[] = [];

    sectionRecords.forEach(record => {
      const fieldGroup = this.findFieldGroup(record.pdf.fieldName);

      // DEBUG: Log field group lookup for debugging
      console.log(`🔍 Processing field: ${record.pdf.fieldName}`);
      console.log(`  fieldGroup lookup:`, fieldGroup ? {
        fieldName: fieldGroup.fieldName,
        fieldType: fieldGroup.fieldType,
        hasOptions: !!fieldGroup.options,
        optionsCount: fieldGroup.options?.length || 0
      } : 'NOT FOUND');

      if (fieldGroup && fieldGroup.fieldType === "RadioGroup") {
        if (!processedRadioGroups.has(fieldGroup.fieldName)) {
          processedRadioGroups.add(fieldGroup.fieldName);

          // Normalize fieldGroup coordinates to match PDF coordinate system
          const originalRect = fieldGroup.widgets?.[0]?.rectTopLeft || { x: 0, y: 0, width: 0, height: 0 };
          const normalizedRect = {
            ...originalRect,
            y: originalRect.y
            // Note: fieldGroup coordinates appear to already be in PDF coordinate system
            // keeping them as-is since they seem to work correctly with the sorting
          };

          fields.push({
            id: fieldGroup.fieldName,
            name: fieldGroup.fieldName,
            page: fieldGroup.pageIndex + 1,
            rect: normalizedRect,
            label: fieldGroup.displayLabel,
            type: FieldType.RADIO,
            section: record.logical.section,
            subsection: record.logical.subsection,
            entry: record.logical.entry,
            radioOptions: [],
            groupFieldId: fieldGroup.fieldName
          });
        }
      } else if (fieldGroup && isDropdownGroup(fieldGroup)) {
        if (!processedDropdowns.has(fieldGroup.fieldName)) {
          processedDropdowns.add(fieldGroup.fieldName);

          console.log(`📋 CREATING DROPDOWN: ${fieldGroup.fieldName}`);

          if (hasDropdownOptions(fieldGroup)) {
            const dropdownOptions = getFieldGroupDropdownOptions(fieldGroup);
            console.log(`  Options from field-groups: ${dropdownOptions.length}`);
            if (dropdownOptions.length > 0) {
              console.log(`  First option:`, dropdownOptions[0]);
            }

            // Normalize fieldGroup coordinates to match PDF coordinate system
            const originalRect = fieldGroup.widgets?.[0]?.rectTopLeft || { x: 0, y: 0, width: 0, height: 0 };
            const normalizedRect = {
              ...originalRect,
              y: originalRect.y
              // Note: fieldGroup coordinates appear to already be in PDF coordinate system
              // keeping them as-is since they seem to work correctly with the sorting
            };

            fields.push({
              id: fieldGroup.fieldName,
              name: fieldGroup.fieldName,
              page: fieldGroup.pageIndex + 1,
              rect: normalizedRect,
              label: fieldGroup.displayLabel,
              type: FieldType.DROPDOWN,
              section: record.logical.section,
              subsection: record.logical.subsection,
              entry: record.logical.entry,
              options: dropdownOptions.map(opt => ({
                value: opt.exportValue,
                label: opt.displayLabel,
                uiLabel: opt.uiLabel
              }))
            });
          } else {
            console.log(`  ⚠️ No options in field-groups, will load from PDF async`);

            // Normalize fieldGroup coordinates to match PDF coordinate system
            const originalRect = fieldGroup.widgets?.[0]?.rectTopLeft || { x: 0, y: 0, width: 0, height: 0 };
            const normalizedRect = {
              ...originalRect,
              y: originalRect.y
              // Note: fieldGroup coordinates appear to already be in PDF coordinate system
              // keeping them as-is since they seem to work correctly with the sorting
            };

            fields.push({
              id: fieldGroup.fieldName,
              name: fieldGroup.fieldName,
              page: fieldGroup.pageIndex + 1,
              rect: normalizedRect,
              label: fieldGroup.displayLabel,
              type: FieldType.DROPDOWN,
              section: record.logical.section,
              subsection: record.logical.subsection,
              entry: record.logical.entry,
              options: []
            });

            this.loadDropdownOptionsAsync(fieldGroup.fieldName, record.pdf.fieldName);
          }
        }
      } else if (record.pdf.type === "Dropdown") {
        const pdfFieldId = FieldNameMapper.mapToPDFField(record.pdf.fieldName);
        if (!processedDropdowns.has(pdfFieldId)) {
          processedDropdowns.add(pdfFieldId);

          console.log(`⚠️ FALLBACK DROPDOWN: ${record.pdf.fieldName} -> ${pdfFieldId}`);
          console.log(`  fieldGroup was null or not a dropdown group`);
          console.log(`  Will load options async from PDF`);

          fields.push({
            id: pdfFieldId,
            name: pdfFieldId,
            page: record.pdf.pageNumber,
            rect: record.pdf.rects[0] || { x: 0, y: 0, width: 0, height: 0 },
            label: record.label,
            type: FieldType.DROPDOWN,
            section: record.logical.section,
            subsection: record.logical.subsection,
            entry: record.logical.entry,
            options: []
          });

          this.loadDropdownOptionsAsync(pdfFieldId, record.pdf.fieldName);
        }
      } else {
        let fieldLabel = fieldGroup ? fieldGroup.displayLabel : record.label;
        const pdfFieldId = FieldNameMapper.mapToPDFField(record.pdf.fieldName);

        fields.push({
          id: pdfFieldId,
          name: pdfFieldId,
          page: record.pdf.pageNumber,
          rect: record.pdf.rects[0] || { x: 0, y: 0, width: 0, height: 0 },
          label: fieldLabel,
          type: this.mapFieldType(record.pdf.type),
          section: record.logical.section,
          subsection: record.logical.subsection,
          entry: record.logical.entry
        });
      }
    });

    /**
     * Simplified and deterministic coordinate-based sorting for PDF visual layout.
     *
     * PDF coordinate system: Y=0 at BOTTOM, larger Y = LOWER on page.
     * For top-to-bottom rendering: sort Y ASCENDING (smaller Y = higher on page = appears first).
     * For left-to-right rendering: sort X ASCENDING.
     *
     * Fixed: Corrected PDF coordinate system understanding based on golden-key data analysis.
     * Golden-key shows: "I have read the instructions" at y:756.16 (bottom), "Last name" at y:662.64 (above)
     * Therefore: SMALLER Y = HIGHER on page (appears first in top-to-bottom layout)
     */
    fields.sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;

      // Primary sort: Y coordinate ASCENDING (smaller Y = higher on page = appears first)
      const yComparison = a.rect.y - b.rect.y;
      if (Math.abs(yComparison) > 1) {
        return yComparison;
      }

      // Secondary sort: X coordinate ASCENDING for fields on same line
      return a.rect.x - b.rect.x;
    });

    console.log(`✅ Section ${sectionId}: Processed ${fields.length} fields`);

    if (fields.length > 0) {
      const firstFew = fields.slice(0, 5).map(f =>
        `${f.label?.substring(0, 20)}... (pg${f.page}, y:${Math.round(f.rect.y)})`
      );
      console.log(`📐 First 5 fields (should be top of page first):`, firstFew);

      // DEBUG: Log coordinate ranges to identify coordinate system issues
      const yCoords = fields.map(f => f.rect.y);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);
      console.log(`📊 Y-coordinate range: ${Math.round(minY)} to ${Math.round(maxY)} (spread: ${Math.round(maxY - minY)})`);

      // DEBUG: Check for coordinate system inconsistencies
      const coordinateSources = fields.map(f => {
        if (f.type === FieldType.RADIO || f.type === FieldType.DROPDOWN) {
          return "fieldGroup.widgets[0].rectTopLeft";
        } else {
          return "record.pdf.rects[0]";
        }
      });
      const uniqueSources = [...new Set(coordinateSources)];
      if (uniqueSources.length > 1) {
        console.warn(`⚠️ Mixed coordinate sources detected:`, uniqueSources);
        console.log(`📋 Field coordinate sources:`, fields.map(f => ({ label: f.label, type: f.type, source: coordinateSources[fields.indexOf(f)], y: f.rect.y })));
      }
    }
    
    return fields;
  }

  /**
   * Groups fields by entry within a section
   */
  getFieldsByEntry(sectionId: string): Map<number, PDFField[]> {
    const sectionFields = this.getFieldsForSection(sectionId);
    const entryGroups = new Map<number, PDFField[]>();

    sectionFields.forEach(field => {
      const entry = field.entry ?? 0;
      if (!entryGroups.has(entry)) {
        entryGroups.set(entry, []);
      }
      entryGroups.get(entry)!.push(field);
    });

    return entryGroups;
  }

  /**
   * Gets subsections within a section
   */
  getSubsections(sectionId: string): Set<string> {
    const sectionRecords = Object.values(this.goldenKey.records).filter(
      record => record.logical.section === sectionId
    );

    const subsections = new Set<string>();
    sectionRecords.forEach(record => {
      if (record.logical.subsection) {
        subsections.add(record.logical.subsection);
      }
    });

    return subsections;
  }

  /**
   * Gets max entry count for a section
   */
  getMaxEntryCount(sectionId: string): number {
    const sectionRecords = Object.values(this.goldenKey.records).filter(
      record => record.logical.section === sectionId
    );

    const entries = new Set<number>();
    sectionRecords.forEach(record => {
      if (record.logical.entry !== null) {
        entries.add(record.logical.entry);
      }
    });

    return Math.max(...Array.from(entries), 0) + 1;
  }

  /**
   * Validates section integrity - logs any potential issues
   */
  validateSectionIntegrity(): void {
    const sectionCounts = new Map<string, number>();
    const orphanedFields: string[] = [];

    Object.values(this.goldenKey.records).forEach(record => {
      const section = record.logical.section;
      if (!section) {
        orphanedFields.push(record.pdf.fieldName);
        return;
      }

      sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1);
    });

    console.log("📊 Golden Key Section Integrity Report:");
    sectionCounts.forEach((count, section) => {
      console.log(`  Section ${section}: ${count} fields`);
    });

    if (orphanedFields.length > 0) {
      console.warn(`⚠️ Found ${orphanedFields.length} fields without section assignment:`, orphanedFields);
    }

    // Check for suspiciously high field counts that might indicate bleed
    sectionCounts.forEach((count, section) => {
      if (count > 500) {
        console.warn(`⚠️ Section ${section} has unusually high field count (${count}) - check for potential bleed`);
      }
    });
  }

  /**
   * Loads dropdown options asynchronously from PDF and caches them.
   * 
   * @param fieldId - string - The field ID used in the UI.
   * @param pdfFieldName - string - The original PDF field name.
   * 
   * Bug-fix: Fallback extraction when field-groups.json missing dropdown options.
   */
  private loadDropdownOptionsAsync(fieldId: string, pdfFieldName: string): void {
    if (this.pendingDropdownOptions.has(fieldId)) {
      return;
    }

    const loadPromise = getPdfDropdownOptions(pdfFieldName).then(options => {
      if (options.length > 0) {
        console.log(`📋 Loaded ${options.length} options for dropdown: ${fieldId}`);
      }
      return options;
    }).catch(error => {
      console.warn(`⚠️ Failed to load dropdown options for ${fieldId}:`, error);
      return [];
    });

    this.pendingDropdownOptions.set(fieldId, loadPromise);
  }

  /**
   * Gets cached dropdown options for a field.
   * 
   * @param fieldId - string - The field ID.
   * @returns Promise<string[]> - The dropdown options.
   */
  async getDropdownOptions(fieldId: string): Promise<string[]> {
    const pending = this.pendingDropdownOptions.get(fieldId);
    if (pending) {
      return pending;
    }
    return [];
  }

  /**
   * Checks if dropdown options are being loaded for a field.
   * 
   * @param fieldId - string - The field ID.
   * @returns boolean - True if options are pending.
   */
  hasDropdownOptionsPending(fieldId: string): boolean {
    return this.pendingDropdownOptions.has(fieldId);
  }

  private mapFieldType(pdfType: string): FieldType {
    switch (pdfType) {
      case "Checkbox":
        return FieldType.CHECKBOX;
      case "Dropdown":
        return FieldType.DROPDOWN;
      case "Radio":
        return FieldType.RADIO;
      default:
        return FieldType.TEXT;
    }
  }
}