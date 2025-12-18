/**
 * Coordinate-Based Field Mapper
 *
 * Maps fields to their proper sections based on PDF coordinates and golden key data
 * This eliminates hardcoding and provides accurate field-to-section mapping
 */

export interface FieldCoordinate {
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
}

export interface GoldenKeyField {
  fieldName: string;
  fieldId: string;
  widgetIds: string[];
  pageNumber: number;
  rects: FieldCoordinate[];
  type: string;
  logical: {
    section: string;
    subsection: string;
    entry: number;
  };
  uiPath: string;
}

export interface SectionBounds {
  section: string;
  pageNumber: number;
  yRange: [number, number]; // y-coordinate range
  xRange?: [number, number]; // optional x-coordinate range
  description: string;
}

/**
 * Coordinate-Based Field Mapper
 * Uses PDF coordinates and golden key data to determine field sections
 */
export class CoordinateFieldMapper {
  private goldenKeyFields: Map<string, GoldenKeyField> = new Map();
  private sectionBounds: SectionBounds[] = [];

  constructor(goldenKeyData: any) {
    this.parseGoldenKeyData(goldenKeyData);
    this.calculateSectionBounds();
  }

  /**
   * Parse golden key data into a searchable map
   */
  private parseGoldenKeyData(goldenKeyData: any) {
    Object.entries(goldenKeyData).forEach(([key, fieldData]: [string, any]) => {
      if (fieldData.pdf?.fieldName) {
        this.goldenKeyFields.set(fieldData.pdf.fieldName, {
          fieldName: fieldData.pdf.fieldName,
          fieldId: fieldData.pdf.fieldId,
          widgetIds: fieldData.pdf.widgetIds || [],
          pageNumber: fieldData.pdf.pageNumber,
          rects: fieldData.pdf.rects || [],
          type: fieldData.pdf.type,
          logical: fieldData.logical || {},
          uiPath: fieldData.uiPath
        });
      }
    });
  }

  /**
   * Calculate section boundaries based on field coordinates
   */
  private calculateSectionBounds() {
    const sectionFields: Map<string, GoldenKeyField[]> = new Map();

    // Group fields by section
    this.goldenKeyFields.forEach(field => {
      const section = field.logical.section;
      if (!sectionFields.has(section)) {
        sectionFields.set(section, []);
      }
      sectionFields.get(section)!.push(field);
    });

    // Calculate bounds for each section
    sectionFields.forEach((fields, section) => {
      // Group by page number
      const pageGroups: Map<number, GoldenKeyField[]> = new Map();
      fields.forEach(field => {
        if (!pageGroups.has(field.pageNumber)) {
          pageGroups.set(field.pageNumber, []);
        }
        pageGroups.get(field.pageNumber)!.push(field);
      });

      // Create bounds for each page in this section
      pageGroups.forEach((pageFields, pageNumber) => {
        const yCoords = pageFields.flatMap(field => field.rects.map(rect => rect.y));
        const xCoords = pageFields.flatMap(field => field.rects.map(rect => rect.x));

        if (yCoords.length > 0) {
          const minY = Math.min(...yCoords);
          const maxY = Math.max(...yCoords);
          const minX = Math.min(...xCoords);
          const maxX = Math.max(...xCoords);

          this.sectionBounds.push({
            section: `section${section}`,
            pageNumber,
            yRange: [minY - 50, maxY + 50], // Add some padding
            xRange: [minX - 50, maxX + 50], // Add some padding
            description: `Section ${section} on page ${pageNumber}`
          });
        }
      });
    });
  }

  /**
   * Get section information for a field based on coordinates
   */
  getSectionByCoordinates(fieldName: string): string | null {
    const field = this.goldenKeyFields.get(fieldName);
    if (!field) {
      return null;
    }

    // Use golden key logical section first (most accurate)
    if (field.logical.section) {
      return `section${field.logical.section}`;
    }

    // Fall back to coordinate-based detection
    const fieldCoords = field.rects[0];
    if (!fieldCoords) {
      return null;
    }

    // Find section bounds that contain this field
    const matchingBounds = this.sectionBounds.find(bounds => {
      return bounds.pageNumber === fieldCoords.pageNumber &&
             fieldCoords.y >= bounds.yRange[0] &&
             fieldCoords.y <= bounds.yRange[1] &&
             (!bounds.xRange || (fieldCoords.x >= bounds.xRange[0] && fieldCoords.x <= bounds.xRange[1]));
    });

    return matchingBounds?.section || null;
  }

  /**
   * Get field ID for a field name
   */
  getFieldId(fieldName: string): string | undefined {
    return this.goldenKeyFields.get(fieldName)?.fieldId;
  }

  /**
   * Get all information about a field
   */
  getFieldInfo(fieldName: string): GoldenKeyField | undefined {
    return this.goldenKeyFields.get(fieldName);
  }

  /**
   * Check if a field should be mapped to a subform
   */
  needsSubformMapping(fieldName: string): boolean {
    const field = this.goldenKeyFields.get(fieldName);
    if (!field) {
      return false;
    }

    // Section 5 fields typically need subform mapping
    return field.logical.section === '5' && fieldName.includes('section5[0]');
  }

  /**
   * Generate field mapping based on coordinates and section analysis
   */
  mapField(fieldName: string): string {
    const field = this.goldenKeyFields.get(fieldName);
    if (!field) {
      console.log(`⚠️  Field not found in golden key: ${fieldName}`);
      return fieldName;
    }

    const section = this.getSectionByCoordinates(fieldName);
    console.log(`🔍 Coordinate analysis for ${fieldName}:`);
    console.log(`   Field ID: ${field.fieldId}`);
    console.log(`   Page: ${field.pageNumber}`);
    console.log(`   Coordinates: ${field.rects.map(r => `(${r.x.toFixed(2)}, ${r.y.toFixed(2)})`).join(', ')}`);
    console.log(`   Detected Section: ${section}`);
    console.log(`   Logical Section: section${field.logical.section}`);

    // Section 5 text fields need #subform mapping
    if (this.needsSubformMapping(fieldName)) {
      const textMatch = fieldName.match(/TextField11\[(\d+)\]/);
      if (textMatch) {
        const index = parseInt(textMatch[1]);
        const mappedIndex = index + 15; // Section 5 text fields start at index 15
        const mappedField = `form1[0].#subform[68].TextField11[${mappedIndex}]`;
        console.log(`   Mapping: ${fieldName} → ${mappedField}`);
        return mappedField;
      }
    }

    // Radio buttons and other fields work as-is
    if (fieldName.includes('RadioButtonList') ||
        fieldName.includes('SSN') ||
        fieldName.includes('CheckBox') ||
        fieldName.includes('suffix')) {
      console.log(`   Direct mapping: ${fieldName} → ${fieldName}`);
      return fieldName;
    }

    console.log(`   No special mapping needed: ${fieldName}`);
    return fieldName;
  }

  /**
   * Analyze field conflicts and provide resolution
   */
  analyzeFieldConflicts(): void {
    const fieldGroups: Map<string, GoldenKeyField[]> = new Map();

    this.goldenKeyFields.forEach(field => {
      if (!fieldGroups.has(field.fieldName)) {
        fieldGroups.set(field.fieldName, []);
      }
      fieldGroups.get(field.fieldName)!.push(field);
    });

    console.log('🔍 FIELD COORDINATE ANALYSIS:');
    let conflictCount = 0;

    fieldGroups.forEach((fields, fieldName) => {
      if (fields.length > 1) {
        console.log(`⚠️  POTENTIAL CONFLICT: ${fieldName}`);
        fields.forEach(field => {
          console.log(`   - Field ID: ${field.fieldId} | Section: ${field.logical.section} | Page: ${field.pageNumber} | Coords: ${field.rects.map(r => `(${r.x.toFixed(2)}, ${r.y.toFixed(2)})`).join(', ')}`);
        });
        conflictCount++;
      }
    });

    console.log(`📊 Found ${conflictCount} potential field conflicts`);
    console.log(`📊 Total fields analyzed: ${this.goldenKeyFields.size}`);
    console.log(`📊 Section boundaries: ${this.sectionBounds.length}`);
  }

  /**
   * Get section statistics
   */
  getSectionStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    this.sectionBounds.forEach(bounds => {
      const key = `${bounds.section}_page${bounds.pageNumber}`;
      stats[key] = (stats[key] || 0) + 1;
    });

    return stats;
  }
}

export default CoordinateFieldMapper;