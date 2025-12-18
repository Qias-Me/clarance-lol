/**
 * AI Vision Gap Filler for SF-86 Field Data
 * Uses GLM-4.6v vision to validate and supplement unreliable field data
 */

const fs = require('fs');
const http = require('http');
const https = require('https');

class AIGapFiller {
    constructor() {
        this.apiConfig = {
            endpoint: 'https://api.z.ai/api/anthropic/v1/messages',
            apiKey: 'fe59fe5386d54d0d91a39965a81a8020.3qxmmEHbNt4g1igU',
            model: 'glm-4.6v',
            timeout: 120000 // 2 minutes
        };

        // Field patterns expected in SF-86
        this.expectedPatterns = {
            section13: {
                // Employment field patterns
                employer: /Employer.*?Name/i,
                position: /Position.*?Title/i,
                address: /Street.*?Address/i,
                city: /City/i,
                state: /State/i,
                zip: /Zip.*?Code/i,
                country: /Country/i,
                phone: /Phone.*?Number/i,
                salary: /Salary/i,
                reason: /Reason.*?Leaving/i,
                dates: /From.*?Date|To.*?Date/i
            }
        };

        // PDF rendering settings
        this.renderSettings = {
            dpi: 300,
            format: 'png',
            quality: 'high'
        };
    }

    /**
     * Analyze PDF page with AI vision to identify fields
     */
    async analyzePageWithAI(pdfPath, pageNumber, knownFields = []) {
        console.log(`🔍 Analyzing page ${pageNumber} with AI vision...`);

        // Convert PDF page to image
        const imageBase64 = await this.pdfPageToBase64(pdfPath, pageNumber);

        // Build prompt based on what we already know
        const prompt = this.buildAnalysisPrompt(pageNumber, knownFields);

        // Call AI vision API
        const response = await this.callAIVision(imageBase64, prompt);

        // Parse and enhance field data
        return this.parseAIResponse(response, knownFields);
    }

    /**
     * Build context-aware prompt for AI analysis
     */
    buildAnalysisPrompt(pageNumber, knownFields) {
        const sectionNumber = this.guessSectionFromPage(pageNumber);

        let prompt = `Analyze this PDF page (${pageNumber}) for form fields`;

        // Add section-specific context
        if (sectionNumber === 13) {
            prompt += `. This is Section 13 - Employment Activities. Look for:
- Employer names
- Position titles
- Work addresses (street, city, state, zip)
- Employment dates (from/to)
- Phone numbers
- Salary information
- Reasons for leaving

The current field data has integrity issues, so please identify ALL visible form fields even if they're not clearly marked.`;
        }

        // Add known fields as reference
        if (knownFields.length > 0) {
            prompt += `\n\nKnown fields (may have coordinate issues):
${knownFields.map(f => `- ${f.name}: (${f.rect.x}, ${f.rect.y}) w:${f.rect.width} h:${f.rect.height}`).join('\n')}

Please verify these coordinates and identify any missing fields.`;
        }

        prompt += `\n\nReturn JSON with ALL fields found:
{
  "fields": [
    {
      "name": "descriptive_field_name",
      "type": "text|dropdown|checkbox",
      "coordinates": {"x": 0, "y": 0, "width": 0, "height": 0},
      "label": "field_label",
      "required": true|false
    }
  ]
}`;

        return prompt;
    }

    /**
     * Call GLM-4.6v vision API
     */
    async callAIVision(imageBase64, prompt) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                model: this.apiConfig.model,
                max_tokens: 4096,
                messages: [{
                    role: 'user',
                    content: [{
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: 'image/png',
                            data: imageBase64
                        }
                    }, {
                        type: 'text',
                        text: prompt
                    }]
                }]
            });

            const options = {
                hostname: 'api.z.ai',
                port: 443,
                path: '/api/anthropic/v1/messages',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiConfig.api_key,
                    'anthropic-version': '2023-06-01'
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(responseData);
                        resolve(response);
                    } catch (error) {
                        reject(new Error(`Failed to parse AI response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`API request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.setTimeout(this.apiConfig.timeout);
            req.write(data);
            req.end();
        });
    }

    /**
     * Parse AI response and merge with known fields
     */
    parseAIResponse(aiResponse, knownFields) {
        try {
            // Extract JSON from AI response
            const content = aiResponse.content[0].text;
            const jsonMatch = content.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }

            const aiFields = JSON.parse(jsonMatch[0]).fields;

            // Create enhanced field data
            const enhancedFields = [];
            const usedAIFields = new Set();

            // Process known fields first
            knownFields.forEach(knownField => {
                // Try to find matching AI field for verification
                const aiField = aiFields.find(af =>
                    this.isSimilarField(af, knownField) && !usedAIFields.has(af)
                );

                if (aiField) {
                    // Enhance known field with AI data
                    enhancedFields.push({
                        ...knownField,
                        aiVerified: true,
                        correctedCoordinates: aiField.coordinates,
                        aiConfidence: 'high',
                        label: aiField.label || knownField.label
                    });
                    usedAIFields.add(aiField);
                } else {
                    // Keep known field but mark as unverified
                    enhancedFields.push({
                        ...knownField,
                        aiVerified: false,
                        aiConfidence: 'unknown'
                    });
                }
            });

            // Add AI-only fields (new discoveries)
            aiFields.forEach(aiField => {
                if (!usedAIFields.has(aiField)) {
                    enhancedFields.push({
                        id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        name: aiField.name,
                        type: this.mapAITypeToPDFType(aiField.type),
                        rect: aiField.coordinates,
                        label: aiField.label,
                        page: knownFields[0]?.page || 1,
                        value: '',
                        section: 13,
                        aiDiscovered: true,
                        aiVerified: true,
                        confidence: 1.0,
                        required: aiField.required || false
                    });
                }
            });

            return enhancedFields;

        } catch (error) {
            console.error('Failed to parse AI response:', error);
            return knownFields; // Fallback to original data
        }
    }

    /**
     * Check if AI field matches known field
     */
    isSimilarField(aiField, knownField) {
        const distance = Math.sqrt(
            Math.pow(aiField.coordinates.x - knownField.rect.x, 2) +
            Math.pow(aiField.coordinates.y - knownField.rect.y, 2)
        );

        // Consider fields similar if they're close (within 50 pixels)
        return distance < 50 &&
               aiField.coordinates.width > 0 &&
               aiField.coordinates.height > 0;
    }

    /**
     * Map AI field type to PDF field type
     */
    mapAITypeToPDFType(aiType) {
        const typeMap = {
            'text': 'PDFTextField',
            'dropdown': 'PDFDropdown',
            'select': 'PDFDropdown',
            'checkbox': 'PDFCheckBox',
            'radio': 'PDFRadioButton',
            'signature': 'PDFSignature'
        };

        return typeMap[aiType.toLowerCase()] || 'PDFTextField';
    }

    /**
     * Guess section from page number (SF-86 specific)
     */
    guessSectionFromPage(pageNumber) {
        // Approximate section boundaries in SF-86
        if (pageNumber <= 1) return 1; // Cover
        if (pageNumber <= 2) return 2; // Personal Information
        if (pageNumber <= 3) return 3; // Residence
        if (pageNumber <= 4) return 4; // Employment
        // ... add more mappings
        return 13; // Default to Employment for unknown pages
    }

    /**
     * Enhance problematic sections with AI
     */
    async enhanceSection(sectionId, pdfPath) {
        console.log(`\n🤖 AI Enhancement for Section ${sectionId}`);
        console.log('=====================================');

        // Load existing section data
        const sectionData = JSON.parse(
            fs.readFileSync(
                `C:/Users/TJ/Desktop/clarance-lol/clarance-f/api/sections-references/section-${sectionId}.json`,
                'utf8'
            )
        );

        // Group fields by page
        const fieldsByPage = this.groupFieldsByPage(sectionData.fields);

        let totalEnhanced = 0;
        let totalNew = 0;

        // Process each page
        for (const [pageNumber, fields] of Object.entries(fieldsByPage)) {
            if (fields.length === 0) continue;

            console.log(`\n📄 Page ${pageNumber}: ${fields.length} fields to analyze`);

            try {
                // Analyze page with AI
                const enhancedFields = await this.analyzePageWithAI(
                    pdfPath,
                    parseInt(pageNumber),
                    fields
                );

                // Count improvements
                const verified = enhancedFields.filter(f => f.aiVerified).length;
                const newFields = enhancedFields.filter(f => f.aiDiscovered).length;

                totalEnhanced += verified;
                totalNew += newFields;

                console.log(`  ✓ Verified: ${verified} fields`);
                console.log(`  ➕ Discovered: ${newFields} new fields`);

                // Update fields in place
                fieldsByPage[pageNumber] = enhancedFields;

            } catch (error) {
                console.error(`  ❌ Error processing page ${pageNumber}:`, error.message);
            }
        }

        // Reconstruct section data
        sectionData.fields = Object.values(fieldsByPage).flat();

        // Update metadata
        sectionData.metadata.aiEnhanced = true;
        sectionData.metadata.aiEnhancementDate = new Date().toISOString();
        sectionData.metadata.originalFieldCount = sectionData.fields.length;
        sectionData.metadata.fieldsVerified = totalEnhanced;
        sectionData.metadata.fieldsDiscovered = totalNew;

        // Calculate new integrity score
        const verifiedPercent = (totalEnhanced / sectionData.fields.length * 100).toFixed(2);
        sectionData.metadata.aiIntegrityScore = verifiedPercent;

        console.log(`\n📊 Section ${sectionId} Enhancement Summary:`);
        console.log(`  - Total fields: ${sectionData.fields.length}`);
        console.log(`  - Fields verified by AI: ${totalEnhanced}`);
        console.log(`  - New fields discovered: ${totalNew}`);
        console.log(`  - Integrity score: ${verifiedPercent}%`);

        return sectionData;
    }

    /**
     * Group fields by page number
     */
    groupFieldsByPage(fields) {
        const grouped = {};

        fields.forEach(field => {
            const page = field.page || 1;
            if (!grouped[page]) {
                grouped[page] = [];
            }
            grouped[page].push(field);
        });

        return grouped;
    }

    /**
     * Convert PDF page to base64 image
     * (This would integrate with your existing PDF renderer)
     */
    async pdfPageToBase64(pdfPath, pageNumber) {
        // For now, return a placeholder
        // In practice, you'd use your PDFLoader and PDFRenderer

        // Integration point with your existing system:
        /*
        const loader = new PDFLoader(pdfPath);
        const renderer = new PDFRenderer(loader.getDocument());

        const renderOptions = new RenderOptions(
            zoomLevel: 2.0,
            contrast_enhancement: true
        );

        const [imageData, _] = renderer.render_page(pageNumber - 1, renderOptions);
        return imageData.toString('base64');
        */

        throw new Error('PDF rendering integration needed');
    }
}

// Example usage
async function demonstrateAIGapFilling() {
    const filler = new AIGapFiller();

    try {
        // Enhance Section 13 with AI vision
        const enhancedSection13 = await filler.enhanceSection(
            13,
            'C:/Users/TJ/Desktop/clarance-lol/samples/test-pdfs/clean.pdf'
        );

        // Save enhanced data
        const outputPath = 'C:/Users/TJ/Desktop/clarance-lol/enhanced-section-13.json';
        fs.writeFileSync(outputPath, JSON.stringify(enhancedSection13, null, 2));

        console.log(`\n✅ Enhanced Section 13 saved to: ${outputPath}`);

    } catch (error) {
        console.error('❌ AI enhancement failed:', error);
    }
}

module.exports = AIGapFiller;