/**
 * Section Reconciliation System
 * 
 * Validates and corrects section assignments in golden-key data based on page ranges.
 * This fixes the "Section 13 appearing in Section 14" problem caused by incorrect
 * logical.section values inferred from PDF field name patterns.
 * 
 * @module section-reconciliation
 */

import type { GoldenKeyInventory, GoldenKeyRecord } from "@/types/golden-key";

/**
 * Known page ranges for each SF-86 section.
 * Based on the official SF-86 form structure.
 * 
 * @property start - number - First page of the section (1-indexed).
 * @property end - number - Last page of the section (1-indexed).
 */
export const SECTION_PAGE_RANGES: Record<string, { start: number; end: number }> = {
  "1": { start: 5, end: 5 },
  "2": { start: 5, end: 5 },
  "3": { start: 5, end: 5 },
  "4": { start: 5, end: 5 },
  "5": { start: 5, end: 6 },
  "6": { start: 5, end: 5 },
  "7": { start: 6, end: 6 },
  "8": { start: 6, end: 6 },
  "9": { start: 6, end: 7 },
  "10": { start: 8, end: 10 },
  "11": { start: 10, end: 14 },
  "12": { start: 14, end: 16 },
  "13": { start: 16, end: 23 },
  "14": { start: 23, end: 28 },
  "15": { start: 28, end: 30 },
  "16": { start: 30, end: 32 },
  "17": { start: 32, end: 40 },
  "18": { start: 40, end: 42 },
  "19": { start: 42, end: 46 },
  "20": { start: 46, end: 56 },
  "21": { start: 56, end: 64 },
  "22": { start: 64, end: 70 },
  "23": { start: 70, end: 72 },
  "24": { start: 72, end: 74 },
  "25": { start: 74, end: 76 },
  "26": { start: 76, end: 80 },
  "27": { start: 80, end: 84 },
  "28": { start: 84, end: 84 },
  "29": { start: 85, end: 88 },
  "30": { start: 88, end: 127 },
};

/**
 * Result of section reconciliation.
 * 
 * @property totalRecords - number - Total records processed.
 * @property correctedRecords - number - Records with corrected sections.
 * @property corrections - Array - Details of each correction made.
 */
export interface ReconciliationResult {
  totalRecords: number;
  correctedRecords: number;
  corrections: Array<{
    fieldId: string;
    fieldName: string;
    originalSection: string;
    correctedSection: string;
    pageNumber: number;
    reason: string;
  }>;
}

/**
 * Determines the correct section for a field based on its page number.
 *
 * @param pageNumber - number - The PDF page number (1-indexed).
 * @returns string | null - The section ID, or null if no match found.
 *
 * Bug-fix: When multiple sections share a page, returns the section with
 * the lowest numeric ID (earliest section that includes this page).
 * This is only used for fields WITHOUT an existing section assignment.
 * Fields WITH assignments are validated by isValidSectionAssignment instead.
 */
export function getSectionForPage(pageNumber: number): string | null {
  const matchingSections: string[] = [];

  for (const [sectionId, range] of Object.entries(SECTION_PAGE_RANGES)) {
    if (pageNumber >= range.start && pageNumber <= range.end) {
      matchingSections.push(sectionId);
    }
  }

  if (matchingSections.length === 0) {
    return null;
  }

  matchingSections.sort((a, b) => parseInt(a) - parseInt(b));
  return matchingSections[0];
}

/**
 * Gets all possible sections for a page (when page spans multiple sections).
 * 
 * @param pageNumber - number - The PDF page number.
 * @returns string[] - Array of possible section IDs.
 */
export function getPossibleSectionsForPage(pageNumber: number): string[] {
  const sections: string[] = [];
  for (const [sectionId, range] of Object.entries(SECTION_PAGE_RANGES)) {
    if (pageNumber >= range.start && pageNumber <= range.end) {
      sections.push(sectionId);
    }
  }
  return sections;
}

/**
 * Validates if a section assignment is correct based on page number.
 * 
 * @param assignedSection - string - The currently assigned section.
 * @param pageNumber - number - The field's page number.
 * @returns boolean - True if assignment is valid.
 */
export function isValidSectionAssignment(assignedSection: string, pageNumber: number): boolean {
  const range = SECTION_PAGE_RANGES[assignedSection];
  if (!range) return false;
  return pageNumber >= range.start && pageNumber <= range.end;
}

/**
 * Reconciles section assignments in golden-key data.
 * Corrects any misassigned sections based on page ranges.
 * 
 * @param goldenKey - GoldenKeyInventory - The golden-key data to reconcile.
 * @returns ReconciliationResult - Summary of corrections made.
 * 
 * Bug-fix: This is the primary fix for section bleed issues.
 * Call this after loading golden-key data to ensure correct section assignments.
 */
export function reconcileSections(goldenKey: GoldenKeyInventory): ReconciliationResult {
  const result: ReconciliationResult = {
    totalRecords: 0,
    correctedRecords: 0,
    corrections: [],
  };

  Object.values(goldenKey.records).forEach((record: GoldenKeyRecord) => {
    result.totalRecords++;

    const pageNumber = record.pdf.pageNumber;
    const currentSection = record.logical.section;

    if (!currentSection) {
      // No section assigned - try to assign one
      const correctSection = getSectionForPage(pageNumber);
      if (correctSection) {
        record.logical.section = correctSection;
        result.correctedRecords++;
        result.corrections.push({
          fieldId: record.pdf.fieldId,
          fieldName: record.pdf.fieldName,
          originalSection: "(none)",
          correctedSection: correctSection,
          pageNumber,
          reason: "Missing section assignment",
        });
      }
      return;
    }

    // Validate current assignment
    if (!isValidSectionAssignment(currentSection, pageNumber)) {
      const possibleSections = getPossibleSectionsForPage(pageNumber);
      
      if (possibleSections.length > 0) {
        // Use the first matching section (typically the correct one)
        const correctSection = possibleSections[0];
        
        result.corrections.push({
          fieldId: record.pdf.fieldId,
          fieldName: record.pdf.fieldName,
          originalSection: currentSection,
          correctedSection: correctSection,
          pageNumber,
          reason: `Page ${pageNumber} is not in section ${currentSection} range`,
        });

        record.logical.section = correctSection;
        result.correctedRecords++;
      }
    }
  });

  if (result.correctedRecords > 0) {
    console.log(`🔧 Section Reconciliation: Corrected ${result.correctedRecords}/${result.totalRecords} records`);
    result.corrections.forEach((c) => {
      console.log(`  - ${c.fieldName}: ${c.originalSection} → ${c.correctedSection} (${c.reason})`);
    });
  } else {
    console.log(`✅ Section Reconciliation: All ${result.totalRecords} records are correctly assigned`);
  }

  return result;
}

/**
 * Validates golden-key data and returns a report of potential issues.
 * Does not modify the data.
 * 
 * @param goldenKey - GoldenKeyInventory - The golden-key data to validate.
 * @returns Object - Validation report with issues found.
 */
export function validateSectionAssignments(goldenKey: GoldenKeyInventory): {
  valid: boolean;
  issues: Array<{
    fieldId: string;
    fieldName: string;
    currentSection: string;
    expectedSections: string[];
    pageNumber: number;
  }>;
} {
  const issues: Array<{
    fieldId: string;
    fieldName: string;
    currentSection: string;
    expectedSections: string[];
    pageNumber: number;
  }> = [];

  Object.values(goldenKey.records).forEach((record: GoldenKeyRecord) => {
    const pageNumber = record.pdf.pageNumber;
    const currentSection = record.logical.section;

    if (currentSection && !isValidSectionAssignment(currentSection, pageNumber)) {
      issues.push({
        fieldId: record.pdf.fieldId,
        fieldName: record.pdf.fieldName,
        currentSection,
        expectedSections: getPossibleSectionsForPage(pageNumber),
        pageNumber,
      });
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Gets section statistics from golden-key data.
 * 
 * @param goldenKey - GoldenKeyInventory - The golden-key data.
 * @returns Record<string, number> - Field count per section.
 */
export function getSectionFieldCounts(goldenKey: GoldenKeyInventory): Record<string, number> {
  const counts: Record<string, number> = {};

  Object.values(goldenKey.records).forEach((record: GoldenKeyRecord) => {
    const section = record.logical.section || "unknown";
    counts[section] = (counts[section] || 0) + 1;
  });

  return counts;
}
