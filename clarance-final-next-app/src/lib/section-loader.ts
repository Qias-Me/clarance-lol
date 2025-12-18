/**
 * Section Index Loader
 *
 * Loads section index files that contain subsection/entry structure
 * for the Golden Key mapping system.
 */

import type { SectionIndex } from "@/types/golden-key";

const sectionIndexCache: Map<string, SectionIndex> = new Map();

/**
 * Loads a section index from the public data folder.
 *
 * @param sectionNumber - string - The section number (1-30)
 * @returns Promise<SectionIndex> - The section index data
 */
export async function loadSectionIndex(
  sectionNumber: string
): Promise<SectionIndex> {
  const cacheKey = `section-${sectionNumber}`;

  if (sectionIndexCache.has(cacheKey)) {
    return sectionIndexCache.get(cacheKey)!;
  }

  const response = await fetch(`/data/sections/section-${sectionNumber}/index.json`);

  if (!response.ok) {
    throw new Error(`Failed to load section ${sectionNumber} index: ${response.status}`);
  }

  const data: SectionIndex = await response.json();
  sectionIndexCache.set(cacheKey, data);

  return data;
}

/**
 * Loads all section indexes (1-30).
 *
 * @returns Promise<Map<string, SectionIndex>> - Map of section number to index
 */
export async function loadAllSectionIndexes(): Promise<Map<string, SectionIndex>> {
  const sections = new Map<string, SectionIndex>();
  const sectionNumbers = Array.from({ length: 30 }, (_, i) => (i + 1).toString());

  const results = await Promise.allSettled(
    sectionNumbers.map(async (num) => {
      const index = await loadSectionIndex(num);
      return { num, index };
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      sections.set(result.value.num, result.value.index);
    }
  }

  return sections;
}

/**
 * Finds the subsection and entry for a field ID within a section.
 *
 * @param sectionIndex - SectionIndex - The section index to search
 * @param fieldId - string - The field ID to find
 * @returns { subsection: string | null; entry: number | null } - The location
 */
export function findFieldLocation(
  sectionIndex: SectionIndex,
  fieldId: string
): { subsection: string | null; entry: number | null } {
  for (const [subsectionKey, subsection] of Object.entries(sectionIndex.subsections)) {
    for (const [entryKey, entry] of Object.entries(subsection.entries)) {
      if (entry.fieldIds.includes(fieldId)) {
        const entryNum = entryKey === "0" ? null : parseInt(entryKey, 10);
        return { subsection: subsectionKey, entry: entryNum };
      }
    }
  }

  return { subsection: null, entry: null };
}

/**
 * Gets all field IDs for a specific subsection and entry.
 *
 * @param sectionIndex - SectionIndex - The section index
 * @param subsection - string - The subsection key (e.g., "13A.1")
 * @param entry - number | null - The entry number or null for entry 0
 * @returns string[] - Array of field IDs
 */
export function getFieldIdsForEntry(
  sectionIndex: SectionIndex,
  subsection: string,
  entry: number | null
): string[] {
  const subsectionData = sectionIndex.subsections[subsection];
  if (!subsectionData) {
    return [];
  }

  const entryKey = entry === null ? "0" : entry.toString();
  const entryData = subsectionData.entries[entryKey];

  return entryData?.fieldIds || [];
}

/**
 * Gets the structure summary for a section.
 *
 * @param sectionIndex - SectionIndex - The section index
 * @returns Array<{ subsection: string; entries: number[]; fieldCount: number }> - Structure summary
 */
export function getSectionStructure(
  sectionIndex: SectionIndex
): Array<{ subsection: string; entries: number[]; fieldCount: number }> {
  const structure: Array<{
    subsection: string;
    entries: number[];
    fieldCount: number;
  }> = [];

  for (const [subsectionKey, subsection] of Object.entries(sectionIndex.subsections)) {
    const entries = Object.keys(subsection.entries)
      .map((k) => (k === "0" ? 0 : parseInt(k, 10)))
      .sort((a, b) => a - b);

    structure.push({
      subsection: subsectionKey,
      entries,
      fieldCount: subsection.fieldCount,
    });
  }

  return structure;
}

/**
 * Clears the section index cache.
 */
export function clearSectionCache(): void {
  sectionIndexCache.clear();
}
