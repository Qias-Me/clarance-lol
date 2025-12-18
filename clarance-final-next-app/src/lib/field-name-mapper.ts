/**
 * Field Name Mapper - Translates golden key field names to actual PDF field names
 *
 * The golden key data uses field names like "form1[0].Sections1-6[0].suffix[0]"
 * but the actual PDF has fields like "form1[0].#subform[68].suffix[0]"
 * This service provides the translation mapping.
 */

// Field name translation patterns
const FIELD_PATTERNS = {
  // Radio buttons - these already use the correct format
  radio: /^form1\[0\]\.Sections?\d+-\d+\[\d+\]\.RadioButtonList\[\d+\]$/,

  // Fields that follow the #subform pattern
  subform: /^form1\[0\]\.Sections?\d+-\d+\[\d+\]\.(.+)$/,

  // Fields that use #area pattern
  area: /^form1\[0\]\.Sections?\d+-\d+\[\d+\]\.#area\[\d+\]\.(.+)$/,

  // Special field patterns
  special: {
    'form1[0].Sections1-6[0].#field[18]': 'form1[0].Sections1-6[0].#field[18]', // This one already works
  } as Record<string, string>
};

// Mapping for specific known field translations based on actual PDF structure
const KNOWN_MAPPINGS: Record<string, string> = {
  // Section 1 fields - Personal Information (page 5) - use direct field names
  'form1[0].Sections1-6[0].TextField11[0]': 'form1[0].Sections1-6[0].TextField11[0]', // Full name
  'form1[0].Sections1-6[0].TextField11[1]': 'form1[0].Sections1-6[0].TextField11[1]', // First name
  'form1[0].Sections1-6[0].TextField11[2]': 'form1[0].Sections1-6[0].TextField11[2]', // Middle name
  'form1[0].Sections1-6[0].suffix[0]': 'form1[0].Sections1-6[0].suffix[0]',
  'form1[0].Sections1-6[0].RadioButtonList[0]': 'form1[0].Sections1-6[0].RadioButtonList[0]',

  // Section 2 fields - Date of Birth (page 5) - use direct field names
  'form1[0].Sections1-6[0].From_Datefield_Name_2[0]': 'form1[0].Sections1-6[0].From_Datefield_Name_2[0]',

  // Section 5 fields - Other Names Used
  'form1[0].Sections1-6[0].section5[0].TextField11[0]': 'form1[0].#subform[68].TextField11[15]', // Full name
  'form1[0].Sections1-6[0].section5[0].TextField11[1]': 'form1[0].#subform[68].TextField11[16]', // First name
  'form1[0].Sections1-6[0].section5[0].TextField11[2]': 'form1[0].#subform[68].TextField11[17]', // Middle name
  'form1[0].Sections1-6[0].section5[0].TextField11[3]': 'form1[0].#subform[68].TextField11[18]', // Last name
  'form1[0].Sections1-6[0].section5[0].TextField11[4]': 'form1[0].#subform[68].TextField11[19]', // First name (entry 2)
  'form1[0].Sections1-6[0].section5[0].TextField11[5]': 'form1[0].#subform[68].TextField11[20]', // Middle name (entry 2)
  'form1[0].Sections1-6[0].section5[0].TextField11[6]': 'form1[0].#subform[68].TextField11[21]', // Last name (entry 2)
  'form1[0].Sections1-6[0].section5[0].TextField11[7]': 'form1[0].#subform[68].TextField11[22]', // First name (entry 3)
  'form1[0].Sections1-6[0].section5[0].TextField11[8]': 'form1[0].#subform[68].TextField11[23]', // Middle name (entry 3)
  'form1[0].Sections1-6[0].section5[0].TextField11[9]': 'form1[0].#subform[68].TextField11[24]', // Last name (entry 3)
  'form1[0].Sections1-6[0].section5[0].TextField11[10]': 'form1[0].#subform[68].TextField11[25]', // First name (entry 4)
  'form1[0].Sections1-6[0].section5[0].TextField11[11]': 'form1[0].#subform[68].TextField11[26]', // Middle name (entry 4)
  'form1[0].Sections1-6[0].section5[0].TextField11[12]': 'form1[0].#subform[68].TextField11[27]', // Last name (entry 4)
  'form1[0].Sections1-6[0].section5[0].TextField11[13]': 'form1[0].#subform[68].TextField11[28]', // First name (entry 5)
  'form1[0].Sections1-6[0].section5[0].TextField11[14]': 'form1[0].subform[68].TextField11[29]', // Middle name (entry 5)
  'form1[0].Sections1-6[0].section5[0].TextField11[15]': 'form1[0].#subform[68].TextField11[30]', // Last name (entry 5)
  'form1[0].Sections1-6[0].section5[0].suffix[1]': 'form1[0].#subform[69].suffix[0]',

  // Common radio button mappings - these often use #subform pattern
  'form1[0].Sections1-6[0].#field[18]': 'form1[0].#subform[68].#field[18]',
  'form1[0].Sections1-6[0].#field[17]': 'form1[0].#subform[68].#field[17]',
  'form1[0].Sections1-6[0].#field[19]': 'form1[0].#subform[68].#field[19]',

  // Add more mappings as needed based on testing
};

export class FieldNameMapper {
  /**
   * Maps a golden key field name to the actual PDF field name
   */
  static mapToPDFField(goldenKeyFieldName: string): string {
    // First check if we have a known mapping
    if (KNOWN_MAPPINGS[goldenKeyFieldName]) {
      return KNOWN_MAPPINGS[goldenKeyFieldName];
    }

    // Check special field patterns
    if (FIELD_PATTERNS.special[goldenKeyFieldName]) {
      return FIELD_PATTERNS.special[goldenKeyFieldName];
    }

    // Radio buttons usually work as-is
    if (FIELD_PATTERNS.radio.test(goldenKeyFieldName)) {
      return goldenKeyFieldName;
    }

    // For Sections1-6 fields, first try the original field name (many work without mapping)
    if (goldenKeyFieldName.includes('Sections1-6[0]')) {
      // Only apply #subform mapping for section5 fields which we know need it
      if (goldenKeyFieldName.includes('section5[0]')) {
        const subformMatch = goldenKeyFieldName.match(FIELD_PATTERNS.subform);
        if (subformMatch) {
          const fieldName = subformMatch[1];
          // Use known subform mappings for section5
          return `form1[0].#subform[68].${fieldName}`;
        }
      }
      // For other sections, return the original name
      return goldenKeyFieldName;
    }

    // If no mapping found, return the original name
    // This will result in the field not being filled, but won't crash
    return goldenKeyFieldName;
  }

  /**
   * Checks if a field name might be valid based on known patterns
   */
  static isValidFieldName(fieldName: string): boolean {
    // Basic validation - check if it looks like a valid PDF field name
    return fieldName.includes('form1[0]') &&
           (fieldName.includes('#subform') ||
            fieldName.includes('#area') ||
            fieldName.includes('RadioButtonList') ||
            fieldName.includes('#field'));
  }

  /**
   * Creates a mapping table for all fields in a section by testing actual PDF fields
   */
  static async createSectionMapping(sectionFields: Array<{pdfField: string; pdfFieldId: string}>): Promise<Record<string, string>> {
    const mapping: Record<string, string> = {};

    // This would be populated by testing each golden key field against the PDF
    // For now, use known patterns and mappings
    sectionFields.forEach(field => {
      const mappedName = this.mapToPDFField(field.pdfField);
      if (mappedName !== field.pdfField) {
        mapping[field.pdfField] = mappedName;
      }
    });

    return mapping;
  }
}

export default FieldNameMapper;