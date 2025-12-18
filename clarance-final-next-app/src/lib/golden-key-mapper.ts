import type { SectionIndex } from "@/types/golden-key";
import type { FieldIndex } from "./golden-key-loader";

export function findFieldLogicalLocation(
  fieldId: string,
  fieldIndex: FieldIndex,
  sectionIndexes: Record<string, SectionIndex>
): {
  section: string;
  subsection: string | null;
  entry: number | null;
} {
  /**
   * fieldId: string - PDF field ID to locate
   * fieldIndex: FieldIndex - Complete field index
   * sectionIndexes: Record<string, SectionIndex> - All section indexes
   * Returns logical location with section, subsection, and entry
   */
  const field = fieldIndex[fieldId];
  if (!field) {
    return { section: "unknown", subsection: null, entry: null };
  }

  const section = field.section;
  const sectionIndex = sectionIndexes[section];

  if (!sectionIndex) {
    return { section, subsection: null, entry: null };
  }

  for (const [subsectionKey, subsection] of Object.entries(
    sectionIndex.subsections
  )) {
    for (const [entryKey, entryData] of Object.entries(subsection.entries)) {
      if (entryData.fieldIds.includes(fieldId)) {
        return {
          section,
          subsection: subsectionKey,
          entry: parseInt(entryKey, 10),
        };
      }
    }
  }

  return { section, subsection: null, entry: null };
}

export function groupWidgetsByField(fieldIndex: FieldIndex): Map<
  string,
  {
    fieldName: string;
    widgetIds: string[];
    rects: { x: number; y: number; width: number; height: number }[];
    page: number;
    type: number;
    label: string;
  }
> {
  /**
   * fieldIndex: FieldIndex - Complete field index
   * Returns map of field names to grouped widget data
   */
  const fieldGroups = new Map<
    string,
    {
      fieldName: string;
      widgetIds: string[];
      rects: { x: number; y: number; width: number; height: number }[];
      page: number;
      type: number;
      label: string;
    }
  >();

  for (const [fieldId, field] of Object.entries(fieldIndex)) {
    const fieldName = field.name;

    if (!fieldGroups.has(fieldName)) {
      fieldGroups.set(fieldName, {
        fieldName,
        widgetIds: [],
        rects: [],
        page: field.page,
        type: field.type,
        label: field.label,
      });
    }

    const group = fieldGroups.get(fieldName)!;
    group.widgetIds.push(fieldId);
    group.rects.push(field.rect);
  }

  return fieldGroups;
}

export const PDF_TYPE_MAP: Record<
  number,
  "Text" | "Checkbox" | "Radio" | "Dropdown"
> = {
  2: "Checkbox",
  3: "Dropdown",
  5: "Radio",
  7: "Text",
};
