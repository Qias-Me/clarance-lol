import type { FieldIndex, SectionsSummary, PDFField } from "@/types/pdf-fields";

let fieldIndexCache: FieldIndex | null = null;
let sectionsSummaryCache: SectionsSummary | null = null;

export async function loadFieldIndex(): Promise<FieldIndex> {
  if (fieldIndexCache) {
    return fieldIndexCache;
  }

  const response = await fetch("/data/field-index.json");
  if (!response.ok) {
    throw new Error(`Failed to load field index: ${response.statusText}`);
  }

  fieldIndexCache = await response.json();
  return fieldIndexCache as FieldIndex;
}

export async function loadSectionsSummary(): Promise<SectionsSummary> {
  if (sectionsSummaryCache) {
    return sectionsSummaryCache;
  }

  const response = await fetch("/data/sections-summary.json");
  if (!response.ok) {
    throw new Error(`Failed to load sections summary: ${response.statusText}`);
  }

  sectionsSummaryCache = await response.json();
  return sectionsSummaryCache as SectionsSummary;
}

export function getFieldsBySection(
  fieldIndex: FieldIndex,
  sectionId: string
): PDFField[] {
  return Object.values(fieldIndex).filter(
    (field) => field.section === sectionId
  );
}

export function getFieldsByPage(
  fieldIndex: FieldIndex,
  pageNumber: number
): PDFField[] {
  return Object.values(fieldIndex)
    .filter((field) => field.page === pageNumber)
    .sort((a, b) => {
      if (a.rect.y !== b.rect.y) {
        return a.rect.y - b.rect.y;
      }
      return a.rect.x - b.rect.x;
    });
}

export function getFieldById(
  fieldIndex: FieldIndex,
  fieldId: string
): PDFField | undefined {
  return fieldIndex[fieldId];
}

export function getSectionNumbers(sectionsSummary: SectionsSummary): string[] {
  return Object.keys(sectionsSummary).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (isNaN(numA) && isNaN(numB)) return a.localeCompare(b);
    if (isNaN(numA)) return 1;
    if (isNaN(numB)) return -1;
    return numA - numB;
  });
}

export function getTotalFieldCount(sectionsSummary: SectionsSummary): number {
  return Object.values(sectionsSummary).reduce(
    (sum, section) => sum + section.fieldCount,
    0
  );
}

export function getPageRange(sectionsSummary: SectionsSummary): [number, number] {
  const allPages = Object.values(sectionsSummary).flatMap(
    (section) => section.pages
  );
  if (allPages.length === 0) return [1, 1];
  return [Math.min(...allPages), Math.max(...allPages)];
}

export function clearCache(): void {
  fieldIndexCache = null;
  sectionsSummaryCache = null;
}
