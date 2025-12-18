/**
 * SF-86 Integration Example
 * Shows how to use clarance-f field data with the Interactive PDF Mapper
 */

const fs = require('fs');
const SF86ReactMapper = require('./clarance-react-mapper');
const FieldIntegrityValidator = require('./integrity-validator');

class SF86Integration {
    constructor() {
        this.mapper = new SF86ReactMapper();
        this.validator = new FieldIntegrityValidator('C:/Users/TJ/Desktop/clarance-lol/clarance-f/api/sections-references');

        // PDF coordinate system to React coordinate system transformation
        this.pdfToReactTransform = {
            scale: 1.5, // Scale factor for React rendering
            offsetX: 0,  // Adjust if needed
            offsetY: 0   // Adjust if needed
        };
    }

    async processSection(sectionId) {
        console.log(`\n=== Processing Section ${sectionId} ===`);

        // 1. Load section data from clarance-f
        const sectionPath = `C:/Users/TJ/Desktop/clarance-lol/clarance-f/api/sections-references/section-${sectionId}.json`;

        if (!fs.existsSync(sectionPath)) {
            throw new Error(`Section ${sectionId} file not found`);
        }

        const sectionData = JSON.parse(fs.readFileSync(sectionPath, 'utf8'));

        // 2. Validate integrity (especially important for Section 13)
        const validation = this.validator.validate_section(sectionId);

        console.log(`Section ${sectionId} (${sectionData.metadata.sectionName}):`);
        console.log(`  - Total fields: ${sectionData.metadata.totalFields}`);
        console.log(`  - Integrity score: ${validation.integrity_score.toFixed(2)}%`);
        console.log(`  - Issues found: ${validation.fields_with_issues}`);

        if (validation.integrity_score < 70) {
            console.warn(`  ⚠️  WARNING: Low integrity score detected!`);

            // Option 1: Use cleaned data
            if (sectionId === 13) {
                console.log('  📋 Using cleaned data for Section 13');
                sectionData.fields = this.filterSection13Fields(sectionData.fields);
            }
        }

        // 3. Map to React components
        const reactSection = this.mapper.processSection(sectionData);

        // 4. Generate React code
        const reactCode = this.mapper.generateReactSection(sectionData);

        // 5. Save results
        this.saveSectionOutput(sectionId, {
            section: sectionData,
            validation: validation,
            react: reactSection,
            code: reactCode
        });

        return {
            sectionId,
            sectionName: sectionData.metadata.sectionName,
            fieldsProcessed: reactSection.components.length,
            issuesFound: validation.fields_with_issues,
            integrityScore: validation.integrity_score
        };
    }

    /**
     * Special filtering for Section 13 employment fields
     */
    filterSection13Fields(fields) {
        console.log('  🔍 Filtering Section 13 fields for employment data...');

        const validFields = [];
        let filtered = 0;

        fields.forEach(field => {
            // Check for valid employment field patterns
            if (this.isValidEmploymentField(field)) {
                // Clean up field data
                field.name = field.name.replace(/[\[\]]/g, '');
                if (field.rect && field.rect.x >= 0 && field.rect.y >= 0) {
                    validFields.push(field);
                } else {
                    filtered++;
                }
            } else {
                filtered++;
            }
        });

        console.log(`  📊 Filtered ${filtered} invalid fields, kept ${validFields.length}`);
        return validFields;
    }

    /**
     * Validate Section 13 employment fields
     */
    isValidEmploymentField(field) {
        // Must have proper field ID pattern
        if (!field.name || typeof field.name !== 'string') return false;

        // Check for employment-related field patterns
        const employmentPatterns = [
            /form1\[0\]/,
            /Employment/i,
            /TextField\d+/,
            /Dropdown/
        ];

        const hasValidPattern = employmentPatterns.some(pattern =>
            pattern.test(field.name) ||
            pattern.test(field.type || '')
        );

        // Must have valid coordinates
        const hasValidCoords = field.rect &&
            field.rect.x >= 0 &&
            field.rect.y >= 0 &&
            field.rect.width > 0 &&
            field.rect.height > 0;

        // Must have valid type
        const validTypes = ['PDFTextField', 'PDFDropdown', 'PDFCheckBox'];
        const hasValidType = validTypes.includes(field.type);

        return hasValidPattern && hasValidCoords && hasValidType;
    }

    /**
     * Save processed section data
     */
    saveSectionOutput(sectionId, data) {
        const outputDir = `C:/Users/TJ/Desktop/clarance-lol/processed-sections/section-${sectionId}`;

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save React components
        fs.writeFileSync(
            `${outputDir}/components.jsx`,
            `${data.code.imports}\n\n${data.code.component}`
        );

        // Save validation report
        fs.writeFileSync(
            `${outputDir}/validation-report.json`,
            JSON.stringify(data.validation, null, 2)
        );

        // Save field mapping
        fs.writeFileSync(
            `${outputDir}/field-mapping.json`,
            JSON.stringify({
                section: data.section.metadata,
                components: data.react.components,
                statistics: data.react.statistics
            }, null, 2)
        );

        console.log(`  ✅ Output saved to: ${outputDir}`);
    }

    /**
     * Generate coordinate transformation utilities
     */
    generateCoordinateUtils() {
        return `
// Coordinate transformation utilities for SF-86 PDF to React
export const pdfToReact = {
    // Convert PDF coordinates to React positioning
    transform: (pdfX, pdfY, pdfWidth, pdfHeight) => {
        return {
            left: \`\${pdfX * ${this.pdfToReactTransform.scale}}px\`,
            top: \`\${pdfY * ${this.pdfToReactTransform.scale}}px\`,
            width: \`\${pdfWidth * ${this.pdfToReactTransform.scale}}px\`,
            height: \`\${pdfHeight * ${this.pdfToReactTransform.scale}}px\`
        };
    },

    // Get page-specific transformations
    getPageTransform: (pageNumber) => {
        // Add page-specific offsets if needed
        const pageOffsets = {
            1: { x: 0, y: 0 },
            2: { x: 0, y: 842 }, // Standard PDF page height
            // ... add more pages as needed
        };

        return pageOffsets[pageNumber] || { x: 0, y: 0 };
    }
};
        `;
    }
}

// Example usage
async function demonstrateIntegration() {
    const integration = new SF86Integration();

    console.log('🚀 SF-86 Integration Example');
    console.log('============================\n');

    try {
        // Process Section 1 (Full Name) - Should have high integrity
        const section1 = await integration.processSection(1);
        console.log(`✅ Section 1 processed: ${section1.fieldsProcessed} fields`);

        // Process Section 2 (Date of Birth) - Simple section
        const section2 = await integration.processSection(2);
        console.log(`✅ Section 2 processed: ${section2.fieldsProcessed} fields`);

        // Process Section 13 (Employment Activities) - Known issues
        const section13 = await integration.processSection(13);
        console.log(`⚠️  Section 13 processed: ${section13.fieldsProcessed} fields (${section13.issuesFound} issues filtered)`);

        // Generate coordinate utilities
        const utils = integration.generateCoordinateUtils();
        fs.writeFileSync('C:/Users/TJ/Desktop/clarance-lol/coordinate-utils.js', utils);
        console.log('\n📋 Coordinate utilities saved to: coordinate-utils.js');

    } catch (error) {
        console.error('❌ Integration failed:', error.message);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    demonstrateIntegration();
}

module.exports = SF86Integration;