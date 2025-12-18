import { PDFDocument } from 'pdf-lib';

/**
 * Debug PDF field mapping to identify root cause of field application failures
 */
export class DebugPdfFieldMapping {
  /**
   * @param templatePdfBytes Uint8Array PDF template bytes
   * @param fieldName string Target field name to investigate
   * @description Analyzes PDF template to verify field existence and accessibility
   * @returns Promise<{exists: boolean, accessible: boolean, fieldType: string | null}>
   */
  static async analyzePdfField(templatePdfBytes: Uint8Array, fieldName: string): Promise<{
    exists: boolean,
    accessible: boolean,
    fieldType: string | null,
    error?: string
  }> {
    try {
      const pdfDoc = await PDFDocument.load(templatePdfBytes);
      const form = pdfDoc.getForm();

      // Get all field names in the PDF
      const allFields = form.getFields();
      const fieldNames = allFields.map(field => field.getName());

      console.log(`🔍 PDF contains ${fieldNames.length} fields`);
      console.log(`📋 First 20 field names:`, fieldNames.slice(0, 20));
      console.log(`🎯 Looking for field: "${fieldName}"`);

      // Check if field exists
      const fieldExists = fieldNames.includes(fieldName);

      if (!fieldExists) {
        // Find similar field names
        const similarFields = fieldNames.filter(name =>
          name.toLowerCase().includes('radiobuttonlist') ||
          name.toLowerCase().includes('acknowledg')
        );

        return {
          exists: false,
          accessible: false,
          fieldType: null,
          error: `Field "${fieldName}" not found. Similar fields: ${similarFields.slice(0, 10).join(', ')}`
        };
      }

      // Try to access the field
      try {
        const field = form.getField(fieldName);
        const fieldType = field.constructor.name;

        // Test field accessibility
        if (fieldType === 'PDFRadioGroup') {
          const radioGroup = form.getRadioGroup(fieldName);
          const options = radioGroup.getOptions();
          console.log(`📻 Radio group options: ${options.join(', ')}`);

          return {
            exists: true,
            accessible: true,
            fieldType
          };
        }

        return {
          exists: true,
          accessible: true,
          fieldType
        };

      } catch (accessError) {
        return {
          exists: true,
          accessible: false,
          fieldType: null,
          error: `Field exists but cannot access: ${accessError}`
        };
      }

    } catch (pdfError) {
      return {
        exists: false,
        accessible: false,
        fieldType: null,
        error: `Failed to load PDF: ${pdfError}`
      };
    }
  }

  /**
   * @param templatePdfBytes Uint8Array PDF template bytes
   * @param fieldName string Target field name
   * @param testValue string Test value to apply
   * @description Tests direct field application to PDF
   * @returns Promise<{success: boolean, error?: string, resultPdfSize?: number}>
   */
  static async testDirectFieldApplication(
    templatePdfBytes: Uint8Array,
    fieldName: string,
    testValue: string
  ): Promise<{
    success: boolean,
    error?: string,
    resultPdfSize?: number
  }> {
    try {
      console.log(`🧪 Testing direct field application: ${fieldName} = ${testValue}`);

      const pdfDoc = await PDFDocument.load(templatePdfBytes);
      const form = pdfDoc.getForm();

      // Try to get and modify the field directly
      if (fieldName.includes('RadioButtonList')) {
        const radioGroup = form.getRadioGroup(fieldName);
        const options = radioGroup.getOptions();

        console.log(`📻 Available options: ${options.join(', ')}`);

        // Try different value formats
        const testValues = ['YES', '0', '1', 'NO'];

        for (const testRadioValue of testValues) {
          if (options.includes(testRadioValue)) {
            console.log(`✅ Found matching option: ${testRadioValue}`);
            radioGroup.select(testRadioValue);

            const resultBytes = await pdfDoc.save();
            console.log(`💾 PDF saved successfully: ${resultBytes.length} bytes`);

            return {
              success: true,
              resultPdfSize: resultBytes.length
            };
          }
        }

        return {
          success: false,
          error: `No matching option found. Available: ${options.join(', ')}`
        };
      }

      return {
        success: false,
        error: 'Field type not supported for direct testing'
      };

    } catch (error) {
      return {
        success: false,
        error: `Direct field application failed: ${error}`
      };
    }
  }

  /**
   * @param templatePdfBytes Uint8Array PDF template bytes
   * @description Extracts all radio button fields from PDF
   * @returns Promise<{radioFields: Array<{name: string, options: string[]}>}>
   */
  static async extractAllRadioFields(templatePdfBytes: Uint8Array): Promise<{
    radioFields: Array<{name: string, options: string[]}>
  }> {
    try {
      const pdfDoc = await PDFDocument.load(templatePdfBytes);
      const form = pdfDoc.getForm();

      const allFields = form.getFields();
      const radioFields: Array<{name: string, options: string[]}> = [];

      for (const field of allFields) {
        const fieldName = field.getName();

        if (fieldName.includes('RadioButtonList')) {
          try {
            const radioGroup = form.getRadioGroup(fieldName);
            const options = radioGroup.getOptions();

            radioFields.push({
              name: fieldName,
              options
            });
          } catch (error) {
            console.log(`⚠️  Cannot access radio field: ${fieldName}`);
          }
        }
      }

      console.log(`📻 Found ${radioFields.length} radio button fields`);

      return { radioFields };

    } catch (error) {
      console.error(`Failed to extract radio fields: ${error}`);
      return { radioFields: [] };
    }
  }

  /**
   * @param fieldName string Field name to search for
   * @description Searches for field name variations and matches
   * @returns {exactMatches: string[], partialMatches: string[]}
   */
  static searchFieldVariations(fieldName: string): {
    exactMatches: string[],
    partialMatches: string[]
  } {
    const variations = [
      fieldName,
      fieldName.replace(/\[/g, '\\[').replace(/\]/g, '\\]'),
      fieldName.replace(/\./g, '\\.'),
      fieldName.toLowerCase(),
      fieldName.toUpperCase()
    ];

    const searchTerms = [
      'RadioButtonList',
      'Acknowledg',
      'Sections1-6',
      'form1'
    ];

    return {
      exactMatches: variations,
      partialMatches: searchTerms
    };
  }
}