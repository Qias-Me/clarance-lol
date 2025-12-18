import type {
  GoldenKeyInventory,
  GoldenKeyRecord,
  SectionIndex,
} from "@/types/golden-key";
import {
  generateFingerprint,
} from "./golden-key-fingerprint";
import { generateUiPath } from "./ui-path-generator";
import {
  loadAllSectionIndexes,
  loadFieldIndex,
  type FieldIndex,
} from "./golden-key-loader";
import {
  findFieldLogicalLocation,
  groupWidgetsByField,
  PDF_TYPE_MAP,
} from "./golden-key-mapper";

export class GoldenKeyBuilder {
  private fieldIndex: FieldIndex = {};
  private sectionIndexes: Record<string, SectionIndex> = {};
  private records: Record<string, GoldenKeyRecord> = {};
  private bySection: Record<string, string[]> = {};
  private bySubsection: Record<string, string[]> = {};

  async loadData(
    fieldIndexPath: string,
    sectionsBasePath: string,
    sectionNumbers: number[]
  ): Promise<void> {
    /**
     * fieldIndexPath: string - Path to field-index.json
     * sectionsBasePath: string - Base path to sections directory
     * sectionNumbers: number[] - Array of section numbers to load
     * Loads all required data for building inventory
     */
    this.fieldIndex = await loadFieldIndex(fieldIndexPath);
    this.sectionIndexes = await loadAllSectionIndexes(
      sectionsBasePath,
      sectionNumbers
    );
  }

  build(): GoldenKeyInventory {
    /**
     * Returns complete Golden Key inventory with all records and indexes
     */
    const fieldGroups = groupWidgetsByField(this.fieldIndex);

    for (const [fieldName, group] of fieldGroups.entries()) {
      const primaryFieldId = group.widgetIds[0];
      const field = this.fieldIndex[primaryFieldId];

      const logical = findFieldLogicalLocation(
        primaryFieldId,
        this.fieldIndex,
        this.sectionIndexes
      );

      // Create a FieldRecord for the UI path generator
      const fieldRecord = {
        id: primaryFieldId,
        name: fieldName,
        label: field.label,
        type: field.type,
        section: logical.section,
        subsection: logical.subsection,
        entry: logical.entry
      };

      const uiPath = generateUiPath(fieldRecord);

      const fingerprint = generateFingerprint(
        field.page,
        field.rect,
        fieldName
      );

      const record: GoldenKeyRecord = {
        uiPath,
        pdf: {
          fieldName,
          fieldId: primaryFieldId,
          widgetIds: group.widgetIds,
          pageNumber: field.page,
          rects: group.rects,
          type: PDF_TYPE_MAP[field.type] || "Text",
          exportValues: undefined,
        },
        logical,
        label: field.label,
        fingerprint,
      };

      this.records[fingerprint] = record;

      if (!this.bySection[logical.section]) {
        this.bySection[logical.section] = [];
      }
      this.bySection[logical.section].push(fingerprint);

      if (logical.subsection) {
        const subsectionKey = `${logical.section}.${logical.subsection}`;
        if (!this.bySubsection[subsectionKey]) {
          this.bySubsection[subsectionKey] = [];
        }
        this.bySubsection[subsectionKey].push(fingerprint);
      }
    }

    return {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      totalFields: Object.keys(this.records).length,
      records: this.records,
      bySection: this.bySection,
      bySubsection: this.bySubsection,
    };
  }

  static async buildFromPaths(
    fieldIndexPath: string,
    sectionsBasePath: string,
    sectionNumbers: number[]
  ): Promise<GoldenKeyInventory> {
    /**
     * fieldIndexPath: string - Path to field-index.json
     * sectionsBasePath: string - Base path to sections directory
     * sectionNumbers: number[] - Array of section numbers to load
     * Returns complete Golden Key inventory
     */
    const builder = new GoldenKeyBuilder();
    await builder.loadData(fieldIndexPath, sectionsBasePath, sectionNumbers);
    return builder.build();
  }
}

export async function buildGoldenKeyInventory(): Promise<GoldenKeyInventory> {
  /**
   * Returns Golden Key inventory built from default paths
   */
  const sections = Array.from({ length: 30 }, (_, i) => i + 1);

  return GoldenKeyBuilder.buildFromPaths(
    "/data/field-index.json",
    "/data/sections",
    sections
  );
}
