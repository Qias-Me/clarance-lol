/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PDF Field Value Formatter
 *
 * Ensures field values are properly formatted for PDF application.
 * Radio buttons require specific value formats that match the PDF's exportValue expectations.
 */

export interface RadioFieldConfig {
  fieldName: string;
  exportValues: string[];
  preferredFormat: 'uppercase' | 'titlecase' | 'lowercase' | 'numeric';
  requiresTrailingSpace?: boolean;
}

// Known radio button field configurations based on field groups analysis
const RADIO_FIELD_CONFIGS: Record<string, RadioFieldConfig> = {
  // Most radio buttons use uppercase YES/NO
  'default': {
    fieldName: 'default',
    exportValues: ['YES', 'NO'],
    preferredFormat: 'uppercase',
    requiresTrailingSpace: false
  },

  // Some specific fields require trailing spaces
  'trailing-space': {
    fieldName: 'trailing-space',
    exportValues: ['YES ', 'NO '],
    preferredFormat: 'uppercase',
    requiresTrailingSpace: true
  },

  // Numeric radio buttons (like some employment fields)
  'numeric': {
    fieldName: 'numeric',
    exportValues: ['1', '0'],
    preferredFormat: 'numeric',
    requiresTrailingSpace: false
  }
};

/**
 * Determines the appropriate radio button configuration for a field
 */
function getRadioFieldConfig(fieldName: string): RadioFieldConfig {
  // Check for fields that require trailing spaces
  if (fieldName.includes('Section18_2') ||
      fieldName.includes('Section11_4') ||
      fieldName.includes('Section24_3') ||
      fieldName.includes('Section24_4')) {
    return RADIO_FIELD_CONFIGS['trailing-space'];
  }

  // Check for numeric fields
  if (fieldName.includes('Section11') ||
      fieldName.includes('Section16_1') ||
      fieldName.includes('Section19') ||
      fieldName.includes('employment')) {
    return RADIO_FIELD_CONFIGS['numeric'];
  }

  // Default to uppercase YES/NO
  return RADIO_FIELD_CONFIGS['default'];
}

/**
 * Formats a radio button value according to the field's requirements
 */
export function formatRadioValue(fieldName: string, value: string | boolean | number): string {
  const config = getRadioFieldConfig(fieldName);

  // Convert value to boolean first
  let isPositive: boolean;
  if (typeof value === 'boolean') {
    isPositive = value;
  } else if (typeof value === 'number') {
    isPositive = value === 1;
  } else if (typeof value === 'string') {
    // Handle various string representations
    const upperValue = value.toUpperCase().trim();
    isPositive = ['YES', 'Y', 'TRUE', '1', 'CHECKED', 'SELECTED'].includes(upperValue);
  } else {
    isPositive = false;
  }

  // Apply the appropriate format
  if (config.preferredFormat === 'numeric') {
    return isPositive ? '1' : '0';
  } else if (config.preferredFormat === 'uppercase') {
    const result = isPositive ? 'YES' : 'NO';
    return config.requiresTrailingSpace ? result + ' ' : result;
  } else if (config.preferredFormat === 'titlecase') {
    return isPositive ? 'Yes' : 'No';
  } else if (config.preferredFormat === 'lowercase') {
    return isPositive ? 'yes' : 'no';
  }

  // Default fallback
  return isPositive ? 'YES' : 'NO';
}

/**
 * Validates if a radio button value matches the expected format
 */
export function validateRadioValue(fieldName: string, value: string): boolean {
  const config = getRadioFieldConfig(fieldName);
  return config.exportValues.includes(value);
}

/**
 * Formats all radio button values in a form data object
 */
export function formatAllRadioValues(values: Record<string, any>): Record<string, any> {
  const formattedValues: Record<string, any> = { ...values };

  Object.keys(values).forEach(fieldName => {
    // Identify radio button fields by common patterns
    if (fieldName.includes('RadioButtonList') ||
        fieldName.includes('radiobuttonlist') ||
        fieldName.includes('RadioGroup')) {

      const originalValue = values[fieldName];
      const formattedValue = formatRadioValue(fieldName, originalValue);

      // Only update if the value would actually change
      if (originalValue !== formattedValue) {
        formattedValues[fieldName] = formattedValue;
        console.log(`📝 Radio field formatted: ${fieldName} "${originalValue}" → "${formattedValue}"`);
      }
    }
  });

  return formattedValues;
}

/**
 * Gets the expected export values for a radio field
 */
export function getExpectedRadioValues(fieldName: string): string[] {
  const config = getRadioFieldConfig(fieldName);
  return [...config.exportValues];
}

/**
 * Creates a radio button field validation report
 */
export function createRadioFieldValidationReport(values: Record<string, any>): {
  total: number;
  formatted: number;
  issues: Array<{ field: string; original: string; formatted: string; issue: string }>;
} {
  const report = {
    total: 0,
    formatted: 0,
    issues: [] as Array<{ field: string; original: string; formatted: string; issue: string }>
  };

  Object.entries(values).forEach(([fieldName, value]) => {
    if (fieldName.includes('RadioButtonList') ||
        fieldName.includes('radiobuttonlist') ||
        fieldName.includes('RadioGroup')) {

      report.total++;

      const expectedValues = getExpectedRadioValues(fieldName);
      const valueStr = String(value);

      if (!expectedValues.includes(valueStr)) {
        const formattedValue = formatRadioValue(fieldName, value);
        report.issues.push({
          field: fieldName,
          original: valueStr,
          formatted: formattedValue,
          issue: `Value "${valueStr}" doesn't match expected values: ${expectedValues.join(', ')}`
        });
      } else {
        report.formatted++;
      }
    }
  });

  return report;
}