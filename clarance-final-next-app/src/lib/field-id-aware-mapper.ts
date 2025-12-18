/**
 * Field ID-Aware Mapper - Resolves field conflicts by using field ID + field name
 *
 * CRITICAL ISSUE RESOLVED:
 * Same field name "form1[0].Sections1-6[0].RadioButtonList[0]" is used by multiple sections
 * with different field IDs:
 * - Section 1: fieldId "9450" → Acknowledgement
 * - Section 4: fieldId "17237" → Acknowledgement (same physical field)
 * - Section 5: Uses RadioButtonList[1-4] with different field IDs
 */

// Field ID to section mapping from golden key analysis
const FIELD_ID_SECTIONS: Record<string, string> = {
  // Section 1 field IDs
  "9450": "section1",      // Acknowledgement field
  "9449": "section1",      // Last name
  "9448": "section1",      // First name
  "9447": "section1",      // Middle name
  "9435": "section1",      // Suffix

  // Section 4 field IDs
  "17237": "section4",     // Acknowledgement field (same as section 1)
  "9442": "section4",      // Not Applicable checkbox
  "9441": "section4",      // SSN input field

  // Section 5 field IDs (other names used)
  "9457": "section5",      // RadioButtonList[4]
  "9469": "section5",      // RadioButtonList[3]
  "9481": "section5",      // RadioButtonList[2]
  "9489": "section5",      // RadioButtonList[1]
  "9495": "section5",      // RadioButtonList[0]
};

// Section-specific field name mappings
const SECTION_FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  // Section 1 mappings - Personal Information
  section1: {
    // Core acknowledgement field - map directly
    "form1[0].Sections1-6[0].RadioButtonList[0]": "form1[0].Sections1-6[0].RadioButtonList[0]",
    "form1[0].Sections1-6[0].TextField11[0]": "form1[0].Sections1-6[0].TextField11[0]", // Full name
    "form1[0].Sections1-6[0].TextField11[1]": "form1[0].Sections1-6[0].TextField11[1]", // First name
    "form1[0].Sections1-6[0].TextField11[2]": "form1[0].Sections1-6[0].TextField11[2]", // Middle name
    "form1[0].Sections1-6[0].suffix[0]": "form1[0].Sections1-6[0].suffix[0]",
  },

  // Section 4 mappings - Social Security Number
  section4: {
    // Same acknowledgement field but ensure it maps correctly for section 4 context
    "form1[0].Sections1-6[0].RadioButtonList[0]": "form1[0].Sections1-6[0].RadioButtonList[0]",
    "form1[0].Sections1-6[0].CheckBox1[0]": "form1[0].Sections1-6[0].CheckBox1[0]",
    "form1[0].Sections1-6[0].SSN[1]": "form1[0].Sections1-6[0].SSN[1]",
  },

  // Section 5 mappings - Other Names Used (needs #subform mapping)
  section5: {
    "form1[0].Sections1-6[0].section5[0].RadioButtonList[0]": "form1[0].Sections1-6[0].section5[0].RadioButtonList[0]",
    "form1[0].Sections1-6[0].section5[0].RadioButtonList[1]": "form1[0].Sections1-6[0].section5[0].RadioButtonList[1]",
    "form1[0].Sections1-6[0].section5[0].RadioButtonList[2]": "form1[0].Sections1-6[0].section5[0].RadioButtonList[2]",
    "form1[0].Sections1-6[0].section5[0].RadioButtonList[3]": "form1[0].Sections1-6[0].section5[0].RadioButtonList[3]",
    "form1[0].Sections1-6[0].section5[0].RadioButtonList[4]": "form1[0].Sections1-6[0].section5[0].RadioButtonList[4]",

    // Text fields need #subform mapping for section 5
    "form1[0].Sections1-6[0].section5[0].TextField11[0]": "form1[0].#subform[68].TextField11[15]",
    "form1[0].Sections1-6[0].section5[0].TextField11[1]": "form1[0].#subform[68].TextField11[16]",
    "form1[0].Sections1-6[0].section5[0].TextField11[2]": "form1[0].#subform[68].TextField11[17]",
    "form1[0].Sections1-6[0].section5[0].TextField11[3]": "form1[0].#subform[68].TextField11[18]",
  },
};

export class FieldIdAwareMapper {
  /**
   * Maps field using field ID + field name combination for accurate section-aware mapping
   */
  static mapWithFieldId(
    goldenKeyFieldName: string,
    fieldId?: string,
    section?: string
  ): string {

    // Priority 1: Use section-specific mapping if section is known
    if (section && SECTION_FIELD_MAPPINGS[section]) {
      const sectionMapping = SECTION_FIELD_MAPPINGS[section];
      if (sectionMapping[goldenKeyFieldName]) {
        console.log(`🎯 Section-aware mapping: ${section} ${goldenKeyFieldName} → ${sectionMapping[goldenKeyFieldName]}`);
        return sectionMapping[goldenKeyFieldName];
      }
    }

    // Priority 2: Use field ID to determine section and apply section-specific mapping
    if (fieldId && FIELD_ID_SECTIONS[fieldId]) {
      const detectedSection = FIELD_ID_SECTIONS[fieldId];
      const sectionMapping = SECTION_FIELD_MAPPINGS[detectedSection];

      if (sectionMapping && sectionMapping[goldenKeyFieldName]) {
        console.log(`🔍 Field ID detection: ${fieldId} → ${detectedSection}`);
        console.log(`🎯 Applied mapping: ${goldenKeyFieldName} → ${sectionMapping[goldenKeyFieldName]}`);
        return sectionMapping[goldenKeyFieldName];
      }
    }

    // Priority 3: Fallback to field name patterns for unknown field IDs
    if (goldenKeyFieldName.includes('Sections1-6[0]')) {
      // Section 5 fields need special handling
      if (goldenKeyFieldName.includes('section5[0]')) {
        const textMatch = goldenKeyFieldName.match(/TextField11\[(\d+)\]/);
        if (textMatch) {
          const index = parseInt(textMatch[1]);
          const mappedIndex = index + 15; // Section 5 text fields start at index 15
          return `form1[0].#subform[68].TextField11[${mappedIndex}]`;
        }
      }

      // Radio buttons and other fields work as-is
      if (goldenKeyFieldName.includes('RadioButtonList') ||
          goldenKeyFieldName.includes('suffix') ||
          goldenKeyFieldName.includes('SSN')) {
        return goldenKeyFieldName;
      }
    }

    // Priority 4: Return original if no mapping needed
    return goldenKeyFieldName;
  }

  /**
   * Gets section information from golden key UI path
   */
  static extractSectionFromUiPath(uiPath: string): string | null {
    const sectionMatch = uiPath.match(/section(\d+)\./);
    return sectionMatch ? `section${sectionMatch[1]}` : null;
  }

  /**
   * Creates a comprehensive field mapping for a set of golden key fields
   */
  static createFieldMapping(fields: Array<{
    goldenKeyField: string;
    fieldId?: string;
    uiPath?: string;
  }>): Record<string, { mappedField: string; section: string; fieldId?: string }> {
    const mapping: Record<string, { mappedField: string; section: string; fieldId?: string }> = {};

    fields.forEach(field => {
      const section = field.uiPath ? this.extractSectionFromUiPath(field.uiPath) : null;
      const mappedField = this.mapWithFieldId(field.goldenKeyField, field.fieldId, section);

      mapping[field.goldenKeyField] = {
        mappedField,
        section: section || 'unknown',
        fieldId: field.fieldId
      };
    });

    return mapping;
  }

  /**
   * Debug helper to show field conflicts
   */
  static analyzeFieldConflicts(fields: Array<{ name: string; fieldId: string; uiPath: string }>) {
    const fieldGroups: Record<string, Array<{ fieldId: string; uiPath: string }>> = {};

    fields.forEach(field => {
      if (!fieldGroups[field.name]) {
        fieldGroups[field.name] = [];
      }
      fieldGroups[field.name].push({
        fieldId: field.fieldId,
        uiPath: field.uiPath
      });
    });

    console.log('🔍 FIELD CONFLICT ANALYSIS:');
    Object.entries(fieldGroups).forEach(([fieldName, occurrences]) => {
      if (occurrences.length > 1) {
        console.log(`⚠️  CONFLICT: ${fieldName}`);
        occurrences.forEach(occ => {
          const section = this.extractSectionFromUiPath(occ.uiPath);
          console.log(`   - Field ID: ${occ.fieldId} | Section: ${section} | UI: ${occ.uiPath}`);
        });
      }
    });
  }
}

export default FieldIdAwareMapper;