/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Entry Management System
 *
 * Handles "Add/Remove Entry" functionality while maintaining PDF field mapping correctness.
 * Dynamically detects multi-entry sections from golden-key data structure.
 * 
 * @module entry-manager
 */

import type { PDFField, FormValues } from "@/types/pdf-fields";
import type { GoldenKeyInventory, GoldenKeyRecord } from "@/types/golden-key";

/**
 * Represents a single entry slot within a multi-entry section.
 * 
 * @property entryNumber - number - The 0-based entry index from golden-key data.
 * @property isExpanded - boolean - Whether this entry's fields are visible in the UI.
 * @property fieldIds - string[] - List of field IDs belonging to this entry.
 */
export interface EntrySlot {
  entryNumber: number;
  isExpanded: boolean;
  fieldIds: string[];
}

/**
 * Configuration for a section that supports multiple entries.
 * 
 * @property sectionId - string - The section identifier (e.g., "10", "11").
 * @property sectionName - string - Human-readable section name.
 * @property maxEntries - number - Maximum entries detected in golden-key.
 * @property entries - Map<number, EntrySlot> - Entry slots indexed by entry number.
 */
export interface SectionEntryConfig {
  sectionId: string;
  sectionName: string;
  maxEntries: number;
  entries: Map<number, EntrySlot>;
}

/**
 * State for managing which entries are currently active/expanded.
 * 
 * @property activeEntries - Set<number> - Entry numbers currently shown.
 * @property expandedEntries - Set<number> - Entry numbers currently expanded.
 */
export interface EntryState {
  activeEntries: Set<number>;
  expandedEntries: Set<number>;
}

/**
 * Section names for human-readable display.
 */
const SECTION_NAMES: Record<string, string> = {
  "5": "Other Names Used",
  "9": "Residence History",
  "10": "Education",
  "11": "Employment Activities",
  "12": "People Who Know You",
  "13": "Foreign Contacts",
  "14": "Foreign Activities",
  "15": "Military History",
  "17": "Financial Record",
  "18": "Gambling",
  "19": "Mental Health",
  "20": "Police Record",
  "21": "Illegal Drugs",
  "22": "Alcohol Use",
  "26": "Civil Court Actions",
};

/**
 * Analyzes golden-key data to detect all multi-entry sections.
 * 
 * @param goldenKey - GoldenKeyInventory - The loaded golden-key inventory.
 * @returns Record<string, SectionEntryConfig> - Map of section ID to entry configuration.
 * 
 * Bug-relevant: This function replaces hardcoded ENTRY_CONFIGURATIONS.
 * It dynamically builds configurations from actual PDF field structure.
 */
export function detectMultiEntrySections(
  goldenKey: GoldenKeyInventory
): Record<string, SectionEntryConfig> {
  const sectionEntries: Record<string, Map<number, string[]>> = {};

  Object.values(goldenKey.records).forEach((record: GoldenKeyRecord) => {
    const { section, entry } = record.logical;
    if (section === null || entry === null) return;

    const sectionId = section;
    const entryNum = typeof entry === "number" ? entry : parseInt(String(entry), 10);

    if (!sectionEntries[sectionId]) {
      sectionEntries[sectionId] = new Map();
    }

    if (!sectionEntries[sectionId].has(entryNum)) {
      sectionEntries[sectionId].set(entryNum, []);
    }

    sectionEntries[sectionId].get(entryNum)!.push(record.pdf.fieldId);
  });

  const configs: Record<string, SectionEntryConfig> = {};

  Object.entries(sectionEntries).forEach(([sectionId, entryMap]) => {
    const maxEntry = Math.max(...Array.from(entryMap.keys()));
    
    if (maxEntry > 0) {
      const entries = new Map<number, EntrySlot>();
      
      entryMap.forEach((fieldIds, entryNum) => {
        entries.set(entryNum, {
          entryNumber: entryNum,
          isExpanded: entryNum === 0,
          fieldIds: fieldIds,
        });
      });

      configs[sectionId] = {
        sectionId,
        sectionName: SECTION_NAMES[sectionId] || `Section ${sectionId}`,
        maxEntries: maxEntry + 1,
        entries,
      };
    }
  });

  return configs;
}

/**
 * Creates initial entry state for a section.
 * By default, only entry 0 is active and expanded.
 * 
 * @param config - SectionEntryConfig - The section's entry configuration.
 * @returns EntryState - Initial state with entry 0 active.
 */
export function createInitialEntryState(config: SectionEntryConfig): EntryState {
  return {
    activeEntries: new Set([0]),
    expandedEntries: new Set([0]),
  };
}

/**
 * Adds the next available entry to the active set.
 * 
 * @param state - EntryState - Current entry state.
 * @param config - SectionEntryConfig - Section configuration.
 * @returns EntryState - Updated state with new entry added.
 * 
 * Bug-relevant: Ensures entries are added in order (0, 1, 2...).
 */
export function addNextEntry(
  state: EntryState,
  config: SectionEntryConfig
): EntryState {
  const allEntries = Array.from(config.entries.keys()).sort((a, b) => a - b);
  const nextEntry = allEntries.find((e) => !state.activeEntries.has(e));

  if (nextEntry === undefined) {
    return state;
  }

  const newActive = new Set(state.activeEntries);
  const newExpanded = new Set(state.expandedEntries);
  newActive.add(nextEntry);
  newExpanded.add(nextEntry);

  return {
    activeEntries: newActive,
    expandedEntries: newExpanded,
  };
}

/**
 * Removes an entry from the active set.
 * 
 * @param state - EntryState - Current entry state.
 * @param entryNumber - number - The entry to remove.
 * @returns EntryState - Updated state with entry removed.
 * 
 * Bug-relevant: Entry 0 cannot be removed (always required).
 */
export function removeEntry(
  state: EntryState,
  entryNumber: number
): EntryState {
  if (entryNumber === 0) {
    return state;
  }

  const newActive = new Set(state.activeEntries);
  const newExpanded = new Set(state.expandedEntries);
  newActive.delete(entryNumber);
  newExpanded.delete(entryNumber);

  return {
    activeEntries: newActive,
    expandedEntries: newExpanded,
  };
}

/**
 * Toggles the expanded state of an entry.
 * 
 * @param state - EntryState - Current entry state.
 * @param entryNumber - number - The entry to toggle.
 * @returns EntryState - Updated state with toggled expansion.
 */
export function toggleEntryExpanded(
  state: EntryState,
  entryNumber: number
): EntryState {
  const newExpanded = new Set(state.expandedEntries);
  
  if (newExpanded.has(entryNumber)) {
    newExpanded.delete(entryNumber);
  } else {
    newExpanded.add(entryNumber);
  }

  return {
    activeEntries: state.activeEntries,
    expandedEntries: newExpanded,
  };
}

/**
 * Clears all form values for a specific entry.
 * 
 * @param entrySlot - EntrySlot - The entry slot to clear.
 * @param setValue - Function - Callback to set individual field values.
 * 
 * Bug-relevant: Uses fieldIds from golden-key, not heuristic matching.
 */
export function clearEntryValues(
  entrySlot: EntrySlot,
  setValue: (fieldId: string, value: string | boolean) => void
): void {
  entrySlot.fieldIds.forEach((fieldId) => {
    setValue(fieldId, "");
  });
}

/**
 * Checks if an entry has any filled values.
 * 
 * @param entrySlot - EntrySlot - The entry slot to check.
 * @param formValues - FormValues - Current form values.
 * @returns boolean - True if entry has no values, false if any field is filled.
 */
export function isEntryEmpty(
  entrySlot: EntrySlot,
  formValues: FormValues
): boolean {
  return entrySlot.fieldIds.every((fieldId) => {
    const value = formValues[fieldId];
    return value === undefined || value === "" || value === false;
  });
}

/**
 * Gets the count of filled fields in an entry.
 * 
 * @param entrySlot - EntrySlot - The entry slot to check.
 * @param formValues - FormValues - Current form values.
 * @returns number - Count of filled fields.
 */
export function getEntryFilledCount(
  entrySlot: EntrySlot,
  formValues: FormValues
): number {
  return entrySlot.fieldIds.filter((fieldId) => {
    const value = formValues[fieldId];
    return value !== undefined && value !== "" && value !== false;
  }).length;
}

/**
 * Filters fields by entry number.
 * 
 * @param fields - PDFField[] - All fields for a section.
 * @param entryNumber - number - The entry to filter for.
 * @returns PDFField[] - Fields belonging to the specified entry.
 */
export function filterFieldsByEntry(
  fields: PDFField[],
  entryNumber: number
): PDFField[] {
  return fields.filter((field) => field.entry === entryNumber);
}

/**
 * Groups fields by their entry number.
 * 
 * @param fields - PDFField[] - All fields to group.
 * @returns Map<number, PDFField[]> - Fields grouped by entry number.
 */
export function groupFieldsByEntry(
  fields: PDFField[]
): Map<number, PDFField[]> {
  const groups = new Map<number, PDFField[]>();

  fields.forEach((field) => {
    const entry = field.entry ?? 0;
    if (!groups.has(entry)) {
      groups.set(entry, []);
    }
    groups.get(entry)!.push(field);
  });

  return groups;
}

/**
 * Checks if a section supports multiple entries.
 * 
 * @param sectionId - string - The section to check.
 * @param configs - Record<string, SectionEntryConfig> - All entry configurations.
 * @returns boolean - True if section has multiple entry slots.
 */
export function isMultiEntrySection(
  sectionId: string,
  configs: Record<string, SectionEntryConfig>
): boolean {
  return sectionId in configs && configs[sectionId].maxEntries > 1;
}

/**
 * Gets display label for an entry.
 * 
 * @param sectionId - string - The section identifier.
 * @param entryNumber - number - The entry number.
 * @returns string - Human-readable entry label.
 */
export function getEntryLabel(sectionId: string, entryNumber: number): string {
  const sectionName = SECTION_NAMES[sectionId] || `Section ${sectionId}`;
  
  if (entryNumber === 0) {
    return `${sectionName} - Entry 1`;
  }
  
  return `Entry ${entryNumber + 1}`;
}
