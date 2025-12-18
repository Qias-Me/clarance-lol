/**
 * Client-side PDF Service for SF-86 Form
 *
 * This service provides client-side PDF generation using the proven
 * approach from the working reference application.
 */

import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts
} from 'pdf-lib';

// Interface for PDF generation result
export interface ClientPdfResult {
  success: boolean;
  pdfBytes?: Uint8Array;
  fieldsMapped: number;
  fieldsApplied: number;
  errors: string[];
  warnings: string[];
}

export class ClientPdfService {
  private pdfDoc: PDFDocument | null = null;
  private fieldIdMap = new Map<string, any>();
  private fieldNameToIdMap = new Map<string, string>();

  /**
   * Load PDF template and initialize field mappings
   */
  async loadPdfTemplate(): Promise<void> {
    try {
      console.log("📄 Loading PDF template...");

      // Fetch the blank PDF template directly
      const response = await fetch('/data/sf86.pdf');

      if (!response.ok) {
        throw new Error(`Failed to fetch PDF template: ${response.status}`);
      }

      const pdfBytes = await response.arrayBuffer();
      this.pdfDoc = await PDFDocument.load(pdfBytes);

      // Build field mappings
      const form = this.pdfDoc.getForm();

      // 🔥 CRITICAL FIX: SF-86 is XFA-enabled → remove XFA so AcroForm values actually display
      // Without this, values are written but viewers render the XFA layer showing blank fields
      try {
        form.deleteXFA();
        console.log("✅ XFA layer deleted - AcroForm values will now display correctly");
      } catch (xfaError) {
        console.warn("⚠️ Could not delete XFA (may not exist):", xfaError);
      }
      const allFields = form.getFields();

      console.log(`📄 Building field mappings for ${allFields.length} fields...`);

      allFields.forEach((field, index) => {
        const fieldName = field.getName();

        // Store field by name
        this.fieldIdMap.set(fieldName, field);

        // Also create numeric ID mapping (many PDFs use numeric IDs)
        const numericId = index.toString();
        this.fieldIdMap.set(numericId, field);
        this.fieldNameToIdMap.set(fieldName, numericId);

        // Store alternative name patterns
        const cleanName = fieldName.replace(/ 0 R$/, '').trim();
        if (cleanName !== fieldName) {
          this.fieldIdMap.set(cleanName, field);
        }
      });

      console.log(`✅ Field mappings built: ${this.fieldIdMap.size} total mappings`);

    } catch (error) {
      console.error("❌ Failed to load PDF template:", error);
      throw error;
    }
  }

  /**
   * Generate PDF with form values
   */
  async generatePdf(formValues: Record<string, any>): Promise<ClientPdfResult> {
    const result: ClientPdfResult = {
      success: false,
      fieldsMapped: 0,
      fieldsApplied: 0,
      errors: [],
      warnings: []
    };

    try {
      console.log("🚀 Starting client-side PDF generation...");

      // Load template if not already loaded
      if (!this.pdfDoc) {
        await this.loadPdfTemplate();
      }

      const form = this.pdfDoc!.getForm();
      let processedCount = 0;
      let appliedCount = 0;

      // Use the working application's data extraction approach
      const extractedValues = this.extractFormValues(formValues);
      console.log(`📊 Extracted ${extractedValues.size} field values using working app logic`);

      // Process each extracted form value
      for (const [fieldId, value] of extractedValues.entries()) {
        processedCount++;
        console.log(`🔧 Processing field ${processedCount}: "${fieldId}" = "${value}"`);

        // Try to find the PDF field
        const pdfField = this.findPdfField(fieldId);

        if (pdfField) {
          try {
            await this.applyFieldValue(pdfField, value);
            appliedCount++;
            console.log(`✅ Applied value to field: ${fieldId}`);
          } catch (error) {
            const errorMsg = `Failed to apply value to field ${fieldId}: ${error}`;
            console.error(errorMsg);
            result.errors.push(errorMsg);
          }
        } else {
          const warningMsg = `PDF field not found: ${fieldId}`;
          console.warn(warningMsg);
          result.warnings.push(warningMsg);
        }
      }

      // 🔥 CRITICAL FIX: Update field appearances with embedded font
      // This ensures values are visible even if the PDF is opened in different viewers
      console.log("🔧 Updating field appearances...");
      try {
        const font = await this.pdfDoc!.embedFont(StandardFonts.Helvetica);
        form.updateFieldAppearances(font);
        console.log("✅ Field appearances updated with embedded font");
      } catch (appearanceError) {
        console.warn("⚠️ Could not update field appearances:", appearanceError);
      }

      // Flatten the form to make values permanent
      console.log("🔧 Flattening form fields...");
      form.flatten();

      // Generate the final PDF
      console.log("📄 Generating final PDF...");
      const pdfBytes = await this.pdfDoc!.save();

      result.success = true;
      result.pdfBytes = new Uint8Array(pdfBytes);
      result.fieldsMapped = processedCount;
      result.fieldsApplied = appliedCount;

      console.log(`✅ PDF generation completed:`);
      console.log(`   📊 Fields processed: ${processedCount}`);
      console.log(`   ✅ Fields applied: ${appliedCount}`);
      console.log(`   📄 PDF size: ${pdfBytes.length} bytes`);

    } catch (error) {
      console.error("❌ PDF generation failed:", error);
      result.errors.push(`PDF generation failed: ${error}`);
    }

    return result;
  }

  /**
   * Find PDF field by ID with multiple lookup strategies (based on working reference)
   */
  private findPdfField(fieldId: string): any {
    // CRITICAL FIX: Implement field ID normalization like the working app
    const normalizeFieldId = (id: string): string => {
      return id.replace(/ 0 R$/, '').trim();
    };

    // Strategy 1: Direct field name lookup
    if (this.fieldIdMap.has(fieldId)) {
      return this.fieldIdMap.get(fieldId);
    }

    // Strategy 2: Normalize field ID and lookup (critical from working app)
    const normalizedId = normalizeFieldId(fieldId);
    if (this.fieldIdMap.has(normalizedId)) {
      return this.fieldIdMap.get(normalizedId);
    }

    // Strategy 3: Try numeric ID extraction
    const numericMatch = fieldId.match(/^(\d+)/);
    if (numericMatch) {
      const numericId = numericMatch[1];
      if (this.fieldIdMap.has(numericId)) {
        return this.fieldIdMap.get(numericId);
      }
    }

    // Strategy 4: Try golden key field name patterns
    const goldenKeyPatterns = [
      fieldId,
      normalizedId,
      `form1[0].Sections1-6[0].${fieldId}[0]`,
      `form1[0].#subform[${this.extractSubformNumber(fieldId)}].${fieldId}[0]`,
      `form1[0].#subform[${this.extractSubformNumber(fieldId)}].${normalizedId}[0]`
    ];

    for (const pattern of goldenKeyPatterns) {
      if (this.fieldIdMap.has(pattern)) {
        return this.fieldIdMap.get(pattern);
      }
    }

    // Strategy 5: Try common field ID variations
    const variations = [
      `${fieldId} 0 R`,
      `${fieldId}[0]`,
      `${normalizedId} 0 R`,
      `${normalizedId}[0]`
    ];

    for (const variation of variations) {
      if (this.fieldIdMap.has(variation)) {
        return this.fieldIdMap.get(variation);
      }
    }

    return null;
  }

  /**
   * Extract form values using the working application's approach
   *
   * 🔥 CRITICAL FIX: Use fully qualified field names directly - NO heuristic translation
   * The golden key inventory contains the exact PDF field names. Any "normalization"
   * or translation (e.g., Sections1-6 → #subform) causes fields to write to wrong locations.
   *
   * Example of the bug this fixes:
   * - Section 1 "First name": form1[0].Sections1-6[0].TextField11[1]
   * - Section 20 "First name": form1[0].#subform[68].TextField11[1]
   * If we translate, Section 1's value ends up in Section 20's field!
   */
  private extractFormValues(formData: Record<string, any>): Map<string, any> {
    console.log("🔍 Extracting form values using fully qualified field names (no translation)...");

    const formValues = new Map<string, any>();

    Object.entries(formData).forEach(([fieldId, value]) => {
      if (value !== undefined) {
        // 🔥 CRITICAL: Use the field ID directly - it IS the fully qualified PDF field name
        // Do NOT use FieldNameMapper.mapToPDFField() - that causes cross-section mapping bugs
        formValues.set(fieldId, value);
        console.log(`🔍 Extracted field (direct): ${fieldId} = ${value}`);
      }
    });

    console.log(`📊 Extracted ${formValues.size} form values`);
    return formValues;
  }

  /**
   * Apply value to PDF field based on field type (based on working reference)
   */
  private async applyFieldValue(field: any, value: any): Promise<void> {
    const fieldType = field.constructor.name;

    try {
      switch (fieldType) {
        case 'PDFTextField':
          const textField = field as PDFTextField;
          // CRITICAL FIX: Handle null/empty values like the working app
          const textValue = value === null || value === undefined ? '' : String(value);
          textField.setText(textValue);
          break;

        case 'PDFCheckBox':
          const checkBox = field as PDFCheckBox;
          const strValue = String(value).toLowerCase();
          if (strValue === "yes" || strValue === "true" || strValue === "1" || value === true) {
            checkBox.check();
          } else {
            checkBox.uncheck();
          }
          break;

        case 'PDFRadioGroup':
          const radioGroup = field as PDFRadioGroup;
          const radioOptions = radioGroup.getOptions();
          let selectedValue = String(value);

          // 🔥 CRITICAL FIX: Use exact exportValue from PDF metadata
          // Radio groups have varying onState mappings - YES might be "0" in one group, "1" in another
          // The PDF's actual options array contains the exact exportValues we must use
          console.log(`📻 Radio group options: [${radioOptions.join(', ')}], trying to select: "${selectedValue}"`);

          // Strategy 1: Exact match (preferred - use exportValue from golden key metadata)
          if (radioOptions.includes(selectedValue)) {
            radioGroup.select(selectedValue);
            console.log(`✅ Radio: exact match for "${selectedValue}"`);
          } else {
            // Strategy 2: Case-insensitive match against actual PDF options
            const normalizedValue = selectedValue.toLowerCase().trim();
            const matchedOption = radioOptions.find(opt => {
              const normalizedOpt = opt.toLowerCase().trim();
              return normalizedOpt === normalizedValue ||
                     normalizedOpt.startsWith(normalizedValue) ||
                     normalizedValue.startsWith(normalizedOpt);
            });

            if (matchedOption) {
              radioGroup.select(matchedOption);
              console.log(`✅ Radio: fuzzy match "${selectedValue}" → "${matchedOption}"`);
            } else {
              console.warn(`⚠️ Radio: no match for "${selectedValue}" in options [${radioOptions.join(', ')}]`);
              // Don't select anything if no match - prevents wrong value
            }
          }
          break;

        case 'PDFDropdown':
          const dropdown = field as PDFDropdown;
          const dropdownOptions = dropdown.getOptions();
          let dropdownValue = String(value);

          // 🔥 CRITICAL FIX: Only select values that exist in the PDF's /Opt list
          // Selecting non-existent values can corrupt the PDF or cause silent failures
          console.log(`📋 Dropdown options: [${dropdownOptions.slice(0, 5).join(', ')}${dropdownOptions.length > 5 ? '...' : ''}], trying to select: "${dropdownValue}"`);

          // Strategy 1: Exact match (preferred)
          if (dropdownOptions.includes(dropdownValue)) {
            dropdown.select(dropdownValue);
            console.log(`✅ Dropdown: exact match for "${dropdownValue}"`);
          } else {
            // Strategy 2: Case-insensitive match
            const normalizedDropdownValue = dropdownValue.toLowerCase().trim();
            const matchedDropdownOption = dropdownOptions.find(opt =>
              opt.toLowerCase().trim() === normalizedDropdownValue
            );

            if (matchedDropdownOption) {
              dropdown.select(matchedDropdownOption);
              console.log(`✅ Dropdown: fuzzy match "${dropdownValue}" → "${matchedDropdownOption}"`);
            } else {
              console.warn(`⚠️ Dropdown: no match for "${dropdownValue}" in ${dropdownOptions.length} options`);
              // Don't select anything if no match
            }
          }
          break;

        default:
          console.warn(`Unknown field type: ${fieldType}, attempting generic string conversion`);
          // Fallback: try to set as string if possible
          if (field.setText) {
            field.setText(String(value || ''));
          }
          break;
      }
    } catch (error) {
      console.error(`Error applying value to ${fieldType}:`, error);
      throw error;
    }
  }

  /**
   * Extract subform number from field ID (for golden key patterns)
   */
  private extractSubformNumber(fieldId: string): number {
    // This is a simplified extraction - you may need to adjust based on your field naming
    const match = fieldId.match(/subform\[(\d+)\]/);
    return match ? parseInt(match[1]) : 68; // Default to 68 as seen in examples
  }

  /**
   * Download PDF bytes as a file
   */
  static downloadPdf(pdfBytes: Uint8Array, filename: string): void {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    console.log(`📄 PDF downloaded: ${filename}`);
  }
}

export const clientPdfService = new ClientPdfService();