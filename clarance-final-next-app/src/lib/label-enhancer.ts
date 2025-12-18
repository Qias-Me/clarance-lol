import type { GoldenKeyInventory, GoldenKeyRecord } from "@/types/golden-key";

interface LabelPattern {
  pattern: RegExp;
  enhancedLabel: string;
  context?: string[];
}

interface SectionLabelPatterns {
  [sectionNumber: string]: LabelPattern[];
}

/**
 * LabelEnhancer - Improves field labels by generating descriptive names
 * based on field patterns, section context, and field characteristics
 */
export class LabelEnhancer {
  private static instance: LabelEnhancer;
  private sectionPatterns: SectionLabelPatterns;

  private constructor() {
    this.sectionPatterns = this.initializeSectionPatterns();
  }

  public static getInstance(): LabelEnhancer {
    if (!LabelEnhancer.instance) {
      LabelEnhancer.instance = new LabelEnhancer();
    }
    return LabelEnhancer.instance;
  }

  private initializeSectionPatterns(): SectionLabelPatterns {
    return {
      // Section 1 - Personal Information
      "1": [
        {
          pattern: /RadioButtonList/i,
          enhancedLabel: "U.S. Citizenship Status",
          context: ["citizenship", "status"]
        },
        {
          pattern: /suffix/i,
          enhancedLabel: "Name Suffix (Jr., Sr., II, III, etc.)"
        },
        {
          pattern: /middle.?name/i,
          enhancedLabel: "Middle Name"
        },
        {
          pattern: /first.?name/i,
          enhancedLabel: "First Name"
        },
        {
          pattern: /full.?name/i,
          enhancedLabel: "Last Name"
        }
      ],

      // Section 2 - Date of Birth
      "2": [
        {
          pattern: /RadioButtonList/i,
          enhancedLabel: "Date Format Preference"
        },
        {
          pattern: /date/i,
          enhancedLabel: "Date of Birth"
        }
      ],

      // Section 3 - Place of Birth
      "3": [
        {
          pattern: /city/i,
          enhancedLabel: "City of Birth"
        },
        {
          pattern: /state/i,
          enhancedLabel: "State of Birth"
        },
        {
          pattern: /country/i,
          enhancedLabel: "Country of Birth"
        },
        {
          pattern: /county/i,
          enhancedLabel: "County of Birth"
        }
      ],

      // Section 4 - Social Security Number
      "4": [
        {
          pattern: /ssn|social.?security/i,
          enhancedLabel: "Social Security Number"
        },
        {
          pattern: /RadioButtonList/i,
          enhancedLabel: "SSN Availability Status"
        }
      ],

      // Section 6 - Identifying Information (was Citizenship)
      "6": [
        {
          pattern: /height/i,
          enhancedLabel: "Height"
        },
        {
          pattern: /weight/i,
          enhancedLabel: "Weight"
        },
        {
          pattern: /hair/i,
          enhancedLabel: "Hair Color"
        },
        {
          pattern: /eyes?/i,
          enhancedLabel: "Eye Color"
        },
        {
          pattern: /RadioButtonList/i,
          enhancedLabel: "Physical Information Confirmation"
        }
      ],

      // Common patterns across all sections
      common: [
        {
          pattern: /RadioButtonList/i,
          enhancedLabel: "Selection Required"
        },
        {
          pattern: /yes/i,
          enhancedLabel: "Yes"
        },
        {
          pattern: /no/i,
          enhancedLabel: "No"
        },
        {
          pattern: /explain|explanation|comments/i,
          enhancedLabel: "Additional Information/Explanation"
        },
        {
          pattern: /reason/i,
          enhancedLabel: "Reason"
        },
        {
          pattern: /date/i,
          enhancedLabel: "Date"
        },
        {
          pattern: /name/i,
          enhancedLabel: "Name"
        },
        {
          pattern: /address/i,
          enhancedLabel: "Address"
        },
        {
          pattern: /phone|telephone/i,
          enhancedLabel: "Phone Number"
        },
        {
          pattern: /email/i,
          enhancedLabel: "Email Address"
        }
      ]
    };
  }

  /**
   * Enhances a field label based on its context, section, and characteristics
   * Uses rich metadata from golden-key.json to provide descriptive labels
   */
  public enhanceLabel(
    record: GoldenKeyRecord,
    sectionNumber: string
  ): string {
    const { label, pdf, logical } = record;
    const fieldName = pdf.fieldName.toLowerCase();
    const uiPath = record.uiPath.toLowerCase();

    // Priority 1: Extract descriptive label from the rich metadata
    const metadataLabel = this.extractMetadataLabel(record);
    if (metadataLabel && this.isDescriptive(metadataLabel)) {
      return metadataLabel;
    }

    // Priority 2: Extract descriptive label from UI path
    const uiPathLabel = this.extractUiPathLabel(record);
    if (uiPathLabel && this.isDescriptive(uiPathLabel)) {
      return uiPathLabel;
    }

    // Priority 3: Check section-specific patterns
    const sectionPatterns = this.sectionPatterns[sectionNumber];
    if (sectionPatterns) {
      for (const patternData of sectionPatterns) {
        if (this.matchesPattern(patternData, label, fieldName, uiPath)) {
          return patternData.enhancedLabel;
        }
      }
    }

    // Priority 4: Generate contextual labels based on field characteristics
    const contextualLabel = this.generateContextualLabel(record, sectionNumber);
    if (contextualLabel) {
      return contextualLabel;
    }

    // Priority 5: Check common patterns
    const commonPatterns = this.sectionPatterns.common;
    if (commonPatterns) {
      for (const patternData of commonPatterns) {
        if (this.matchesPattern(patternData, label, fieldName, uiPath)) {
          return patternData.enhancedLabel;
        }
      }
    }

    // If no enhancement found, return the cleaned original label
    return this.cleanLabel(label);
  }

  /**
   * Extracts descriptive label from the rich metadata label field
   */
  private extractMetadataLabel(record: GoldenKeyRecord): string | null {
    const { label, pdf, logical } = record;

    // If label is generic (RadioButtonList, Selection Required), skip it
    if (this.isGenericLabel(label)) {
      return null;
    }

    // Clean and return the metadata label
    const cleanedLabel = this.cleanMetadataLabel(label);

    // If the cleaned label is still too generic or contains section headers, try UI path
    if (this.isGenericLabel(cleanedLabel) || cleanedLabel.startsWith("Section")) {
      return null;
    }

    return cleanedLabel;
  }

  /**
   * Extracts descriptive label from the UI path when metadata label is insufficient
   */
  private extractUiPathLabel(record: GoldenKeyRecord): string | null {
    const uiPath = record.uiPath;

    // Extract the descriptive part after the section and entry information
    const parts = uiPath.split('.');
    if (parts.length < 2) {
      return null;
    }

    // Get the last part which usually contains the descriptive field name
    const descriptivePart = parts[parts.length - 1];

    // If the UI path contains instructional text, extract it
    if (descriptivePart.includes('provide_') || descriptivePart.includes('your_') ||
        descriptivePart.includes('did_you') || descriptivePart.includes('have_you')) {
      return this.formatInstructionalText(descriptivePart);
    }

    // Convert camelCase/snakeCase to readable text
    return this.formatFieldFromUiPath(descriptivePart);
  }

  /**
   * Formats instructional text from UI paths
   */
  private formatInstructionalText(text: string): string {
    return text
      .replace(/_/g, ' ')
      .replace(/provide your/gi, 'Your')
      .replace(/did you/gi, 'Did you')
      .replace(/have you/gi, 'Have you')
      .replace(/\b\w/g, (char, index) => index === 0 ? char.toUpperCase() : char.toLowerCase())
      .trim();
  }

  /**
   * Formats field names from UI paths
   */
  private formatFieldFromUiPath(text: string): string {
    return text
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Checks if a label is truly descriptive and not generic
   */
  private isDescriptive(label: string): boolean {
    const lowerLabel = label.toLowerCase();

    // Generic patterns to avoid
    const genericPatterns = [
      'radiobuttonlist',
      'selection required',
      'confirmation required',
      'please select',
      'choose one',
      'make a selection',
      'field required',
      'answer required'
    ];

    return !genericPatterns.some(pattern => lowerLabel.includes(pattern)) &&
           label.length > 3 &&
           !label.match(/^(section|field|entry)\s*\d*$/i);
  }

  /**
   * Checks if a label is generic and should be enhanced
   */
  private isGenericLabel(label: string): boolean {
    const lowerLabel = label.toLowerCase();
    const genericPatterns = [
      'radiobuttonlist',
      'selection required',
      'confirmation required',
      'please select',
      'choose one',
      'make a selection',
      'field required',
      'answer required',
      'checkbox',
      'radio',
      'textfield',
      'combobox'
    ];

    return genericPatterns.some(pattern => lowerLabel.includes(pattern)) ||
           label.length < 4 ||
           label.match(/^(section|field|entry)\s*\d*$/i);
  }

  /**
   * Enhanced metadata label cleaning that preserves descriptive information
   */
  private cleanMetadataLabel(label: string): string {
    let cleaned = label
      .replace(/\r/g, ' ') // Replace carriage returns with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^\.\s*/, '') // Remove leading periods and spaces
      .replace(/\.\s*$/, '') // Remove trailing periods and spaces
      .trim();

    // Handle quoted text
    if (cleaned.includes('"')) {
      const quotes = cleaned.match(/"([^"]+)"/g);
      if (quotes && quotes.length > 0) {
        // Keep quoted text and surrounding context
        cleaned = cleaned.replace(/"([^"]+)"/g, '$1');
      }
    }

    return cleaned;
  }

  private matchesPattern(
    patternData: LabelPattern,
    label: string,
    fieldName: string,
    uiPath: string
  ): boolean {
    const { pattern, context } = patternData;

    // Check if pattern matches any of the label sources
    const labelMatch = pattern.test(label);
    const fieldNameMatch = pattern.test(fieldName);
    const uiPathMatch = pattern.test(uiPath);

    if (!labelMatch && !fieldNameMatch && !uiPathMatch) {
      return false;
    }

    // If context is specified, check if it matches
    if (context && context.length > 0) {
      const combinedText = `${label} ${fieldName} ${uiPath}`.toLowerCase();
      return context.some(ctx => combinedText.includes(ctx.toLowerCase()));
    }

    return true;
  }

  private generateContextualLabel(
    record: GoldenKeyRecord,
    sectionNumber: string
  ): string | null {
    const { label, pdf, logical } = record;
    const fieldName = pdf.fieldName;
    const entryNumber = logical.entry;

    // Generate labels based on field type and position
    if (pdf.type === "Checkbox") {
      if (fieldName.includes("agree") || fieldName.includes("consent")) {
        return "I agree to the terms";
      }
      if (fieldName.includes("certify") || fieldName.includes("certification")) {
        return "I certify this information is true";
      }
      return "Confirmation required";
    }

    if (pdf.type === "Radio") {
      // Create unique labels for radio buttons based on context and position
      if (fieldName.includes("citizenship") || sectionNumber === "1") {
        return "U.S. Citizenship Status";
      }
      if (fieldName.includes("physical") || sectionNumber === "6") {
        return "Physical Characteristics Confirmation";
      }

      // Use entry number to distinguish multiple radio buttons
      if (entryNumber !== null && entryNumber > 0) {
        return `Choice ${entryNumber + 1}`;
      }
      return "Selection required";
    }

    // Generate labels based on PDF field name patterns
    if (fieldName.includes("_")) {
      const parts = fieldName.split("_");
      const meaningfulParts = parts.filter(part =>
        part.length > 2 &&
        !["entry", "field", "input", "text", "radiobuttonlist"].includes(part.toLowerCase())
      );

      if (meaningfulParts.length > 0) {
        return meaningfulParts
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
      }
    }

    return null;
  }

  private cleanLabel(label: string): string {
    // Remove common prefixes and clean up the label
    let cleaned = label
      .replace(/^section\s*\d+\.\s*/i, "") // Remove section headers
      .replace(/^section\s*\d+[^.]*\.\s*/i, "") // Remove verbose section descriptions
      .replace(/\.\s*provide\s+.+$/i, "") // Remove instructional text
      .replace(/\.\s*if\s+you\s+.+$/i, "") // Remove conditional instructions
      .replace(/\.\s*enter\s+.+$/i, "") // Remove field entry instructions
      .replace(/\.\s*for\s+.+$/i, "") // Remove purpose descriptions
      .replace(/your\s+social\s+security\s+number\s+will\s+auto-fill.+/i, "") // Remove SSN auto-fill text
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    // If the label is still very long (over 60 chars), truncate it intelligently
    if (cleaned.length > 60) {
      const sentences = cleaned.split(/\.\s*/);
      if (sentences.length > 1) {
        cleaned = sentences[0]; // Take just the first sentence
      } else {
        // Truncate at word boundary
        const words = cleaned.split(/\s+/);
        cleaned = words.slice(0, 8).join(" ") + "...";
      }
    }

    return cleaned;
  }

  /**
   * Batch enhance labels for all records in a section
   */
  public enhanceSectionLabels(
    records: GoldenKeyRecord[],
    sectionNumber: string
  ): Map<string, string> {
    const enhancedLabels = new Map<string, string>();

    records.forEach(record => {
      const enhancedLabel = this.enhanceLabel(record, sectionNumber);
      enhancedLabels.set(record.pdf.fieldId, enhancedLabel);
    });

    return enhancedLabels;
  }

  /**
   * Get all enhanced labels for the entire golden key inventory
   */
  public enhanceAllLabels(goldenKey: GoldenKeyInventory): Map<string, string> {
    const allEnhancedLabels = new Map<string, string>();

    Object.values(goldenKey.records).forEach(record => {
      const enhancedLabel = this.enhanceLabel(record, record.logical.section);
      allEnhancedLabels.set(record.pdf.fieldId, enhancedLabel);
    });

    return allEnhancedLabels;
  }
}

// Singleton instance for easy access
export const labelEnhancer = LabelEnhancer.getInstance();