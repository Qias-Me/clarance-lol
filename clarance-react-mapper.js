/**
 * SF-86 to React Component Mapper
 * Maps clarance-f field definitions to React components
 */

class SF86ReactMapper {
    constructor() {
        this.componentMap = {
            'PDFTextField': 'TextInput',
            'PDFDropdown': 'Select',
            'PDFCheckBox': 'Checkbox',
            'PDFRadioButton': 'RadioGroup',
            'PDFSignature': 'SignatureField'
        };

        // Coordinate transformation from PDF to React
        this.pdfScale = 1.0; // Adjust based on PDF rendering scale
        this.offsetX = 0;
        this.offsetY = 0;
    }

    /**
     * Convert clarance-f field to React component props
     */
    fieldToComponent(field) {
        const component = {
            id: this.sanitizeFieldId(field.name),
            type: this.componentMap[field.type] || 'TextInput',
            name: field.name,
            label: this.extractLabel(field),
            value: field.value || '',
            style: {
                position: 'absolute',
                left: `${field.rect.x * this.pdfScale + this.offsetX}px`,
                top: `${field.rect.y * this.pdfScale + this.offsetY}px`,
                width: `${field.rect.width * this.pdfScale}px`,
                height: `${field.rect.height * this.pdfScale}px`,
                fontSize: this.calculateFontSize(field.rect.height)
            },
            section: field.section,
            page: field.page,
            entry: field.entry,
            validation: this.getValidationRules(field),
            metadata: {
                originalId: field.id,
                uniqueId: field.uniqueId,
                confidence: field.confidence
            }
        };

        // Add type-specific properties
        if (field.type === 'PDFDropdown' && field.options) {
            component.options = field.options;
        }

        return component;
    }

    /**
     * Sanitize field name for React compatibility
     */
    sanitizeFieldId(fieldName) {
        return fieldName
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/^[^a-zA-Z_]/, 'field_')
            .replace(/_+/g, '_')
            .toLowerCase();
    }

    /**
     * Extract clean label from field description
     */
    extractLabel(field) {
        if (field.label) {
            // Remove section numbers and long descriptions
            const label = field.label
                .replace(/^Section \d+\.\s*/, '')
                .replace(/\..*$/, '')
                .replace(/\r/g, '')
                .trim();

            return label || field.name;
        }
        return field.name;
    }

    /**
     * Calculate appropriate font size based on field height
     */
    calculateFontSize(height) {
        if (height < 15) return '12px';
        if (height < 20) return '14px';
        if (height < 25) return '16px';
        return '18px';
    }

    /**
     * Get validation rules for field
     */
    getValidationRules(field) {
        const rules = {
            required: true,
            maxLength: field.maxLength > 0 ? field.maxLength : undefined
        };

        // Section-specific validations
        if (field.section === 1) {
            // Name fields validation
            if (field.name.includes('FirstName')) {
                rules.pattern = /^[a-zA-Z\s\-']+$/;
            }
        }

        return rules;
    }

    /**
     * Process a complete section and generate React components
     */
    processSection(sectionData, filterInvalid = true) {
        const components = [];
        const invalidFields = [];

        sectionData.fields.forEach((field, index) => {
            // Check for field validity
            if (this.isValidField(field)) {
                components.push(this.fieldToComponent(field));
            } else {
                invalidFields.push({
                    index,
                    name: field.name,
                    issues: this.getFieldIssues(field)
                });
            }
        });

        return {
            sectionId: sectionData.metadata.sectionId,
            sectionName: sectionData.metadata.sectionName,
            components,
            invalidFields,
            statistics: {
                totalFields: sectionData.fields.length,
                validFields: components.length,
                invalidFields: invalidFields.length,
                integrityScore: (components.length / sectionData.fields.length * 100).toFixed(2)
            }
        };
    }

    /**
     * Validate field integrity
     */
    isValidField(field) {
        const issues = this.getFieldIssues(field);

        // Critical issues that make field unusable
        const criticalIssues = [
            'missing_rect',
            'invalid_coordinates',
            'missing_type'
        ];

        return !criticalIssues.some(issue => issues.includes(issue));
    }

    /**
     * Get all field issues
     */
    getFieldIssues(field) {
        const issues = [];

        // Check required properties
        if (!field.rect) issues.push('missing_rect');
        if (!field.type) issues.push('missing_type');
        if (!field.name) issues.push('missing_name');

        // Check coordinates
        if (field.rect) {
            if (field.rect.x < 0 || field.rect.y < 0) {
                issues.push('invalid_coordinates');
            }
            if (field.rect.width <= 0 || field.rect.height <= 0) {
                issues.push('invalid_dimensions');
            }
        }

        // Section 13 specific checks
        if (field.section === 13) {
            if (!field.name || !field.name.includes('form1[0]')) {
                issues.push('invalid_section_13_pattern');
            }
        }

        return issues;
    }

    /**
     * Generate React component code for a section
     */
    generateReactSection(sectionData) {
        const processed = this.processSection(sectionData);

        const imports = `import React, { useState } from 'react';
import { TextInput, Select, Checkbox } from '../components';`;

        const component = `
const ${this.toComponentName(sectionData.metadata.sectionName)} = ({ formData, onChange }) => {
    return (
        <div className="section-${sectionData.metadata.sectionId}">
            <h2>${sectionData.metadata.sectionName}</h2>
            ${processed.components.map(comp => this.renderComponent(comp)).join('\n            ')}
        </div>
    );
};

export default ${this.toComponentName(sectionData.metadata.sectionName)};`;

        return {
            imports,
            component,
            metadata: processed
        };
    }

    /**
     * Render individual component
     */
    renderComponent(component) {
        switch (component.type) {
            case 'TextInput':
                return `<TextInput
                    id="${component.id}"
                    name="${component.name}"
                    label="${component.label}"
                    value={formData["${component.id}"] || ''}
                    onChange={onChange}
                    style={${JSON.stringify(component.style, null, 2)}}
                />`;

            case 'Select':
                return `<Select
                    id="${component.id}"
                    name="${component.name}"
                    label="${component.label}"
                    value={formData["${component.id}"] || ''}
                    options={${JSON.stringify(component.options)}}
                    onChange={onChange}
                    style={${JSON.stringify(component.style, null, 2)}}
                />`;

            default:
                return `<${component.type}
                    id="${component.id}"
                    name="${component.name}"
                    {...props}
                />`;
        }
    }

    /**
     * Convert section name to component name
     */
    toComponentName(sectionName) {
        return sectionName
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .replace(/\s+/g, '')
            + 'Section';
    }
}

// Export the mapper
module.exports = SF86ReactMapper;