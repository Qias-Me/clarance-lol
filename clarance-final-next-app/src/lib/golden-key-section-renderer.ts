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
      const fieldGroup = this.fieldGroups[record.pdf.fieldName] ||
                       this.fieldGroups[`form1[0].Sections1-6[0].${record.pdf.fieldName}[0]`];

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

          fields.push({
            id: fieldGroup.fieldName,
            name: fieldGroup.fieldName,
            page: fieldGroup.pageIndex + 1,
            rect: fieldGroup.widgets?.[0]?.rectTopLeft || { x: 0, y: 0, width: 0, height: 0 },
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

            fields.push({
              id: fieldGroup.fieldName,
              name: fieldGroup.fieldName,
              page: fieldGroup.pageIndex + 1,
              rect: fieldGroup.widgets?.[0]?.rectTopLeft || { x: 0, y: 0, width: 0, height: 0 },
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

            fields.push({
              id: fieldGroup.fieldName,
              name: fieldGroup.fieldName,
              page: fieldGroup.pageIndex + 1,
              rect: fieldGroup.widgets?.[0]?.rectTopLeft || { x: 0, y: 0, width: 0, height: 0 },
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
     * Y proximity threshold for grouping fields into the same row.
     * SF-86 PDF has fields within ~10-20 Y units that belong together.
     * Increased from 15 to 20 to better capture related fields like
     * "Estimate" checkboxes with their associated date fields.
     */
    const Y_PROXIMITY_THRESHOLD = 20;

    /**
     * Coordinate-based sorting to match PDF visual layout.
     *
     * PDF coordinate system: Y=0 at BOTTOM, larger Y = higher on page.
     * For top-to-bottom rendering: sort Y DESCENDING (larger Y first).
     * For left-to-right rendering: sort X ASCENDING.
     *
     * Bug-fix: Changed Y sort from ascending to descending for correct PDF layout.
     * Bug-fix: Increased Y threshold from 15 to 20 for better field grouping.
     */
    fields.sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;

      const yProximity = Math.abs(a.rect.y - b.rect.y);
      if (yProximity > Y_PROXIMITY_THRESHOLD) {
        return b.rect.y - a.rect.y;
      }

      return a.rect.x - b.rect.x;
    });

    console.log(`✅ Section ${sectionId}: Processed ${fields.length} fields`);
    
    if (fields.length > 0) {
      const firstFew = fields.slice(0, 5).map(f => 
        `${f.label?.substring(0, 20)}... (pg${f.page}, y:${Math.round(f.rect.y)})`
      );
      console.log(`📐 First 5 fields (should be top of page first):`, firstFew);
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