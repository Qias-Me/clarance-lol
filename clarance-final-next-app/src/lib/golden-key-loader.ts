import type { SectionIndex, GoldenKeyInventory } from "@/types/golden-key";

interface FieldIndexEntry {
  id: string;
  name: string;
  label: string;
  type: number;
  page: number;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  section: string;
  subsection: string | null;
  entry: number | null;
}

export type FieldIndex = Record<string, FieldIndexEntry>;

export async function loadFieldIndex(path: string): Promise<FieldIndex> {
  /**
   * path: string - File path or URL to field-index.json
   * Returns complete field index mapping field IDs to metadata
   */
  if (typeof window === "undefined") {
    const { readFile } = eval("require")("fs/promises");
    const data = await readFile(path, "utf-8");
    return JSON.parse(data);
  }

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load field index: ${response.statusText}`);
  }
  return response.json();
}

export async function loadSectionIndex(path: string): Promise<SectionIndex> {
  /**
   * path: string - File path or URL to section index.json
   * Returns section index with subsection and entry mappings
   */
  if (typeof window === "undefined") {
    const { readFile } = eval("require")("fs/promises");
    const data = await readFile(path, "utf-8");
    return JSON.parse(data);
  }

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load section index: ${response.statusText}`);
  }
  return response.json();
}

export async function loadAllSectionIndexes(
  basePath: string,
  sectionNumbers: number[]
): Promise<Record<string, SectionIndex>> {
  /**
   * basePath: string - Base directory path for sections
   * sectionNumbers: number[] - Array of section numbers to load
   * Returns record mapping section numbers to their indexes
   */
  const indexes: Record<string, SectionIndex> = {};

  const promises = sectionNumbers.map(async (num) => {
    const path = `${basePath}/section-${num}/index.json`;
    try {
      const index = await loadSectionIndex(path);
      indexes[num.toString()] = index;
    } catch (error) {
      console.warn(`Failed to load section ${num}:`, error);
    }
  });

  await Promise.all(promises);
  return indexes;
}

export async function loadGoldenKeyInventory(): Promise<GoldenKeyInventory> {
  /**
   * Returns Golden Key inventory from default path
   */
  if (typeof window === "undefined") {
    const { readFile } = eval("require")("fs/promises");
    const data = await readFile("./public/data/golden-key.json", "utf-8");
    return JSON.parse(data);
  }

  const response = await fetch("/data/golden-key.json");
  if (!response.ok) {
    throw new Error(`Failed to load golden key inventory: ${response.statusText}`);
  }
  return response.json();
}

export function getFieldsForUiPath(
  uiPath: string,
  goldenKey: GoldenKeyInventory
): string[] {
  /**
   * Returns field IDs for a given UI path from golden key data
   */
  const results: string[] = [];

  Object.values(goldenKey.records).forEach(record => {
    if (record.uiPath === uiPath) {
      results.push(record.pdf.fieldId);
    }
  });

  return results;
}
