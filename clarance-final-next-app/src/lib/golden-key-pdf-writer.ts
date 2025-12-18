/**
 * Golden-Key-Aware PDF Writer
 *
 * This writer properly handles SF-86 PDF field value application using golden key metadata.
 * Key fixes:
 * - Radio groups: maps UI values (YES/NO) to PDF on-state values (0/1)
 * - Dropdowns: ensures values match PDF dropdown options
 * - Appearance streams: calls form.updateFieldAppearances(font) for visibility
 * - Field type awareness: uses golden key metadata for proper field handling
 */

import { PDFDocument, StandardFonts, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from 'pdf-lib';
import { FieldGroups, RadioOption, DropdownOption } from './field-groups-loader';
import { formatAllRadioValues, createRadioFieldValidationReport } from './pdf-field-value-formatter';
import FieldIdAwareMapper from './field-id-aware-mapper';
import CoordinateFieldMapper from './coordinate-field-mapper';

// Types for golden key metadata
type RadioGroupMeta = {
  fieldType: "RadioGroup";
  options: RadioOption[];
};

type DropdownMeta = {
  fieldType: "Dropdown";
  options: DropdownOption[];
};

type FieldMeta = RadioGroupMeta | DropdownMeta;

// PDF field type mapping
type PdfTypeByName = Record<string, "Text" | "CheckBox" | "RadioButton" | "ComboBox">;

/**
 * Collects field values from form context by PDF field name
 * Updated to use coordinate-based mapping for accurate field detection
 */
export function collectValuesByPdfName(root: any, goldenKeyData?: any): Record<string, any> {
  const out: Record<string, any> = {};

  // Handle simple key-value object (form context structure)
  if (root && typeof root === 'object' && !Array.isArray(root)) {
    Object.entries(root).forEach(([key, value]) => {
      // Skip internal form context properties
      if (key === 'currentSection' || value === undefined || value === null) {
        return;
      }

      // Only include actual field values (not functions or complex objects)
      if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
        out[key] = value;
        console.log(`📋 Raw field value: ${key} = ${value}`);
      }
    });
  }

  // Apply coordinate-based field mapping
  const mappedValues: Record<string, any> = {};
  let coordinateMapper: CoordinateFieldMapper | null = null;

  if (goldenKeyData) {
    coordinateMapper = new CoordinateFieldMapper(goldenKeyData);
    console.log(`🗺️  Using coordinate-based field mapper with ${Object.keys(goldenKeyData).length} fields`);
  }

  Object.entries(out).forEach(([fieldName, value]) => {
    let mappedFieldName = fieldName;

    // Priority 1: Use coordinate-based mapping if available
    if (coordinateMapper) {
      mappedFieldName = coordinateMapper.mapField(fieldName);
    } else {
      // Priority 2: Fallback to field ID-aware mapping
      let fieldId: string | undefined;
      let section: string | undefined;

      Object.entries(goldenKeyData || {}).forEach(([key, fieldData]: [string, any]) => {
        if (fieldData.pdf?.fieldName === fieldName) {
          fieldId = fieldData.pdf?.fieldId;
          section = fieldData.logical?.section;
        }
      });

      mappedFieldName = FieldIdAwareMapper.mapWithFieldId(fieldName, fieldId, section);
    }

    mappedValues[mappedFieldName] = value;

    if (mappedFieldName !== fieldName) {
      console.log(`🎯 Field mapping applied: ${fieldName} → ${mappedFieldName}`);
    }
  });

  // Apply radio button value formatting to ensure proper PDF compatibility
  const formatted = formatAllRadioValues(mappedValues);

  // Create validation report for radio fields
  const radioReport = createRadioFieldValidationReport(formatted);
  if (radioReport.issues.length > 0) {
    console.log(`🔧 Radio field formatting applied: ${radioReport.formatted}/${radioReport.total} valid`);
    radioReport.issues.forEach(issue => {
      console.log(`   ✅ ${issue.field}: "${issue.original}" → "${issue.formatted}"`);
    });
  }

  console.log(`📊 Collected ${Object.keys(formatted).length} field values by PDF name (with coordinate mapping + radio formatting)`);
  return formatted;
}

/**
 * Maps UI radio value to PDF exportValue using golden key metadata
 *
 * 🔥 CRITICAL FIX: PDF radio groups use exportValue (YES/NO), NOT onState (0/1)
 * The PDF's getOptions() returns exportValues, so we must select by exportValue.
 *
 * Golden key metadata:
 * - exportValue: "YES" or "NO" (what PDF expects for selection)
 * - onState: "0" or "1" (internal widget state, NOT for selection)
 */
function mapUiToRadioExportValue(groupMeta: RadioGroupMeta, uiValue: any): string | undefined {
  const s = String(uiValue ?? '').trim();
  if (!s) return undefined;

  // Try to match by exportValue (YES/NO), uiLabel, or displayLabel
  const hit = groupMeta.options.find(o =>
    o.exportValue === s ||
    o.exportValue?.toUpperCase() === s.toUpperCase() ||
    o.uiLabel === s ||
    o.uiLabel?.toUpperCase() === s.toUpperCase() ||
    o.displayLabel === s ||
    o.displayLabel?.toUpperCase() === s.toUpperCase()
  );

  // Return the exact exportValue from metadata (preserves case and spacing)
  return hit?.exportValue;
}

/**
 * Maps UI dropdown value to PDF dropdown value using golden key metadata
 */
function mapUiToDropdownValue(groupMeta: DropdownMeta, uiValue: any): string | undefined {
  const s = String(uiValue ?? '').trim();
  if (!s) return undefined;

  // Find matching option in golden key metadata
  const hit = groupMeta.options.find(o =>
    o.exportValue === s ||
    o.uiLabel === s ||
    o.displayLabel === s
  );

  // Use the exact exportValue from metadata, or fallback to input
  return hit?.exportValue || s;
}

/**
 * Converts boolean/coercible values to proper boolean
 */
function coerceBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    return ["true", "1", "yes", "y", "checked"].includes(v.toLowerCase());
  }
  return Boolean(v);
}

/**
 * Validates that a value is allowed for a radio/dropdown field
 */
function validateFieldOption(fieldName: string, value: string, allowedOptions: string[]): boolean {
  if (!allowedOptions || allowedOptions.length === 0) {
    console.warn(`⚠️  No allowed options available for field ${fieldName}`);
    return false;
  }

  const isValid = allowedOptions.includes(value);
  if (!isValid) {
    console.warn(`⚠️  Field ${fieldName}: value "${value}" not in allowed options [${allowedOptions.join(', ')}]`);
  }

  return isValid;
}

/**
 * Main PDF filling function using golden key awareness
 */
export async function fillPdfClientSide(params: {
  templatePdfBytes: Uint8Array;
  valuesByName: Record<string, any>;
  fieldGroups: FieldGroups;
  pdfTypeByName: PdfTypeByName;
  flatten?: boolean;
  goldenKeyData?: any;
}): Promise<Uint8Array> {
  const { templatePdfBytes, valuesByName, fieldGroups, pdfTypeByName, goldenKeyData } = params;
  const flatten = Boolean(params.flatten);

  console.log(`🚀 Starting golden-key-aware PDF filling...`);
  console.log(`📊 Input values: ${Object.keys(valuesByName).length}`);
  console.log(`📊 Field groups: ${Object.keys(fieldGroups).length}`);
  console.log(`📊 PDF types: ${Object.keys(pdfTypeByName).length}`);
  console.log(`📄 Flatten: ${flatten}`);
  console.log(`🔑 Golden key data: ${goldenKeyData ? 'Available' : 'Not provided'}`);

  const pdfDoc = await PDFDocument.load(templatePdfBytes);
  const form = pdfDoc.getForm();

  // 🔥 CRITICAL FIX: SF-86 is XFA-enabled → remove XFA so AcroForm values actually display
  // Without this, values are written but viewers render the XFA layer showing blank fields
  try {
    form.deleteXFA();
    console.log("✅ XFA layer deleted - AcroForm values will now display correctly");
  } catch (xfaError) {
    console.warn("⚠️ Could not delete XFA (may not exist):", xfaError);
  }

  let appliedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const [name, uiValue] of Object.entries(valuesByName)) {
    if (uiValue === undefined || uiValue === null) {
      console.log(`⏭️  Skipping ${name}: value is undefined/null`);
      skippedCount++;
      continue;
    }

    const baseType = pdfTypeByName[name];
    const groupMeta = fieldGroups[name] as FieldMeta | undefined;

    try {
      // RADIO GROUPS - Use golden key exportValue mapping
      // 🔥 CRITICAL: PDF radio groups use exportValue (YES/NO), NOT onState (0/1)
      if (groupMeta?.fieldType === "RadioGroup" || baseType === "RadioButton") {
        const rg = form.getRadioGroup(name);
        const radioMeta = groupMeta as RadioGroupMeta;

        let exportValue: string | undefined;

        if (radioMeta?.fieldType === "RadioGroup") {
          exportValue = mapUiToRadioExportValue(radioMeta, uiValue);
        } else {
          // Fallback: treat UI value as direct exportValue (YES/NO)
          exportValue = String(uiValue).toUpperCase();
        }

        if (!exportValue) {
          console.log(`⏭️  Skipping radio ${name}: no exportValue mapping for "${uiValue}"`);
          skippedCount++;
          continue;
        }

        // Validate against actual PDF options (which are exportValues like YES/NO)
        const pdfOptions = rg.getOptions();
        if (!validateFieldOption(name, exportValue, pdfOptions)) {
          skippedCount++;
          continue;
        }

        rg.select(exportValue);
        console.log(`✅ Applied radio: ${name} "${uiValue}" → exportValue "${exportValue}"`);
        appliedCount++;
        continue;
      }

      // DROPDOWNS - Use golden key value mapping
      if (groupMeta?.fieldType === "Dropdown" || baseType === "ComboBox") {
        const dd = form.getDropdown(name);
        const dropdownMeta = groupMeta as DropdownMeta;

        let pdfValue: string | undefined;

        if (dropdownMeta?.fieldType === "Dropdown") {
          pdfValue = mapUiToDropdownValue(dropdownMeta, uiValue);
        } else {
          // Fallback: use UI value directly
          pdfValue = String(uiValue);
        }

        if (!pdfValue) {
          console.log(`⏭️  Skipping dropdown ${name}: no PDF value mapping for "${uiValue}"`);
          skippedCount++;
          continue;
        }

        // Validate against actual PDF options
        const pdfOptions = dd.getOptions();
        if (!validateFieldOption(name, pdfValue, pdfOptions)) {
          skippedCount++;
          continue;
        }

        dd.select(pdfValue);
        console.log(`✅ Applied dropdown: ${name} "${uiValue}" → PDF value "${pdfValue}"`);
        appliedCount++;
        continue;
      }

      // CHECKBOXES
      if (baseType === "CheckBox") {
        const cb = form.getCheckBox(name);
        if (coerceBool(uiValue)) {
          cb.check();
          console.log(`✅ Applied checkbox: ${name} = checked (${uiValue})`);
        } else {
          cb.uncheck();
          console.log(`✅ Applied checkbox: ${name} = unchecked (${uiValue})`);
        }
        appliedCount++;
        continue;
      }

      // TEXT FIELDS
      if (baseType === "Text") {
        const tf = form.getTextField(name);
        const textValue = uiValue === null || uiValue === undefined ? "" : String(uiValue);
        tf.setText(textValue);
        console.log(`✅ Applied text: ${name} = "${textValue}"`);
        appliedCount++;
        continue;
      }

      // UNKNOWN FIELD TYPE - Try generic approach
      console.warn(`⚠️  Unknown field type for ${name}: ${baseType}`);
      try {
        const field = form.getField(name);
        if (field) {
          const stringValue = String(uiValue || "");
          if ('setText' in field) {
            (field as any).setText(stringValue);
            console.log(`✅ Applied generic field: ${name} = "${stringValue}"`);
            appliedCount++;
          }
        }
      } catch (fallbackError) {
        console.warn(`❌ Failed to apply unknown field type ${name}:`, fallbackError);
        errorCount++;
      }

    } catch (error) {
      console.error(`❌ Error applying field ${name} (${baseType}):`, error);
      errorCount++;
    }
  }

  // CRITICAL FIX: Update field appearances so values are visible
  console.log(`🎨 Updating field appearances...`);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(font);

  // Only flatten if explicitly requested (for non-editable output)
  if (flatten) {
    console.log(`📄 Flattening form fields (read-only PDF)...`);
    form.flatten({ updateFieldAppearances: true });
  }

  const pdfBytes = await pdfDoc.save();

  console.log(`✅ PDF generation completed:`);
  console.log(`   📊 Fields applied: ${appliedCount}`);
  console.log(`   📊 Fields skipped: ${skippedCount}`);
  console.log(`   📊 Fields errored: ${errorCount}`);
  console.log(`   📄 PDF size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);

  return pdfBytes;
}

/**
 * Downloads a PDF blob with optional filename
 */
export function downloadPdfBytes(pdfBytes: Uint8Array, filename: string): void {
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