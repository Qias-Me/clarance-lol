import type { GoldenKeyInventory, GoldenKeyRecord } from "@/types/golden-key";

export interface RadioOption {
  fieldId: string;
  value: string;
  label: string;
  selected: boolean;
}

export interface RadioGroup {
  groupFieldId: string;
  groupLabel: string;
  options: RadioOption[];
  widgetIds: string[];
}

/**
 * Analyzes radio button groups from golden key data
 * to extract individual options and their labels
 */
export class RadioGroupAnalyzer {
  private goldenKey: GoldenKeyInventory;

  constructor(goldenKey: GoldenKeyInventory) {
    this.goldenKey = goldenKey;
  }

  /**
   * Finds all radio groups and their options in a section
   */
  public findRadioGroups(sectionNumber: string): RadioGroup[] {
    const sectionRecords = Object.values(this.goldenKey.records).filter(
      record => record.logical.section === sectionNumber && record.pdf.type === "Radio"
    );

    const radioGroups: RadioGroup[] = [];
    const processedGroups = new Set<string>();

    for (const record of sectionRecords) {
      // Check if this record is part of a radio group
      if (record.pdf.widgetIds && record.pdf.widgetIds.length > 1) {
        const groupKey = record.pdf.widgetIds.sort().join('-');

        if (!processedGroups.has(groupKey)) {
          processedGroups.add(groupKey);

          // Build the radio group with all its options
          const radioGroup = this.buildRadioGroup(record);
          if (radioGroup) {
            radioGroups.push(radioGroup);
          }
        }
      } else {
        // Single radio field, treat as individual group
        const individualGroup: RadioGroup = {
          groupFieldId: record.pdf.fieldId,
          groupLabel: this.extractGroupLabel(record),
          widgetIds: [record.pdf.fieldId],
          options: [this.createSingleRadioOption(record)]
        };
        radioGroups.push(individualGroup);
      }
    }

    return radioGroups;
  }

  /**
   * Builds a complete radio group from a representative record
   */
  private buildRadioGroup(record: GoldenKeyRecord): RadioGroup | null {
    if (!record.pdf.widgetIds || record.pdf.widgetIds.length === 0) {
      return null;
    }

    const groupFieldId = record.pdf.fieldId;
    const widgetIds = record.pdf.widgetIds;
    const options: RadioOption[] = [];

    // Create options from the widgetIds and rects in the current record
    const rects = record.pdf.rects || [];
    const sortedWidgetIds = widgetIds.map((widgetId, index) => ({
      widgetId,
      rect: rects[index] || { x: 0 },
      originalIndex: index
    }));

    // Sort by x-coordinate (left to right)
    sortedWidgetIds.sort((a, b) => a.rect.x - b.rect.x);

    // Create options with sorted indices
    sortedWidgetIds.forEach(({ widgetId }, sortedIndex) => {
      const option: RadioOption = {
        fieldId: widgetId,
        value: this.extractOptionValue(record, sortedIndex, sortedWidgetIds.length),
        label: this.extractOptionLabel(record, this.extractOptionValue(record, sortedIndex, sortedWidgetIds.length)),
        selected: false
      };
      options.push(option);
    });

    return {
      groupFieldId,
      groupLabel: this.extractGroupLabel(record),
      widgetIds,
      options
    };
  }

  /**
   * Creates a radio option from a record
   */
  private createRadioOption(record: GoldenKeyRecord, index: number, totalOptions: number): RadioOption {
    // Try to extract the option value from the field name or metadata
    const optionValue = this.extractOptionValue(record, index, totalOptions);
    const optionLabel = this.extractOptionLabel(record, optionValue);

    return {
      fieldId: record.pdf.fieldId,
      value: optionValue,
      label: optionLabel,
      selected: false // This would be determined by form state
    };
  }

  /**
   * Creates a single radio option for individual radio fields
   */
  private createSingleRadioOption(record: GoldenKeyRecord): RadioOption {
    const optionValue = this.extractOptionValue(record, 0, 1);
    const optionLabel = this.extractOptionLabel(record, optionValue);

    return {
      fieldId: record.pdf.fieldId,
      value: optionValue,
      label: optionLabel,
      selected: false
    };
  }

  /**
   * Extracts the option value from the field data
   */
  private extractOptionValue(record: GoldenKeyRecord, index: number, totalOptions: number): string {
    const { pdf, label } = record;

    // Try to extract from exportValues first
    if (pdf.exportValues && Array.isArray(pdf.exportValues)) {
      const firstValue = pdf.exportValues[0];
      if (firstValue) {
        return String(firstValue).toUpperCase();
      }
    }

    // Try to extract from the field name
    if (pdf.fieldName.includes('YES')) return 'YES';
    if (pdf.fieldName.includes('NO')) return 'NO';
    if (pdf.fieldName.includes('Yes')) return 'Yes';
    if (pdf.fieldName.includes('No')) return 'No';

    // Try to extract from the label
    if (label) {
      const upperLabel = label.toUpperCase();
      if (upperLabel.includes('YES')) return 'YES';
      if (upperLabel.includes('NO')) return 'NO';
    }

    // For standard binary radio buttons, assume YES/NO based on position
    if (totalOptions === 2) {
      // Leftmost option is typically YES, rightmost is NO
      return index === 0 ? 'YES' : 'NO';
    }

    // Default fallback
    return `OPTION ${index + 1}`;
  }

  /**
   * Extracts the option label from the record
   */
  private extractOptionLabel(record: GoldenKeyRecord, optionValue: string): string {
    const { label, pdf } = record;

    // Use the enhanced label system for individual options
    // For radio options, often the label contains the option value
    if (label && !label.includes('RadioButtonList')) {
      const cleanedLabel = label
        .replace(/\r\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // If the label contains the option value, use it
      if (cleanedLabel.toUpperCase().includes(optionValue)) {
        return optionValue;
      }

      // Otherwise use the cleaned label
      return cleanedLabel;
    }

    // Default to option value
    return optionValue;
  }

  /**
   * Extracts a descriptive label for the radio group
   */
  private extractGroupLabel(record: GoldenKeyRecord): string {
    const { label, uiPath, logical } = record;

    // Try to extract from the descriptive label first
    if (label && !this.isGenericLabel(label)) {
      return this.cleanGroupLabel(label);
    }

    // Extract from UI path with context awareness
    if (uiPath) {
      const parts = uiPath.split('.');
      const descriptivePart = parts[parts.length - 1];
      const sectionNumber = logical.section;

      // Provide contextual labels based on section and UI path
      if (sectionNumber === "1" && descriptivePart === "radiobuttonlist") {
        return "U.S. Citizenship Status";
      }

      // Format the UI path part as a readable label
      const formattedLabel = this.formatGroupLabel(descriptivePart);
      if (formattedLabel !== descriptivePart) {
        return formattedLabel;
      }
    }

    return 'Selection Required';
  }

  /**
   * Finds a record by field ID
   */
  private findRecordByFieldId(fieldId: string): GoldenKeyRecord | null {
    for (const record of Object.values(this.goldenKey.records)) {
      if (record.pdf.fieldId === fieldId) {
        return record;
      }
    }
    return null;
  }

  /**
   * Checks if a label is generic
   */
  private isGenericLabel(label: string): boolean {
    const lowerLabel = label.toLowerCase();
    return lowerLabel.includes('radiobuttonlist') ||
           lowerLabel.includes('selection required') ||
           lowerLabel.length < 4;
  }

  /**
   * Cleans up a group label
   */
  private cleanGroupLabel(label: string): string {
    return label
      .replace(/\r/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^\.\s*/, '')
      .replace(/\.\s*$/, '')
      .trim();
  }

  /**
   * Formats a UI path part into a readable label
   */
  private formatGroupLabel(text: string): string {
    return text
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\s+/g, ' ')
      .trim();
  }
}