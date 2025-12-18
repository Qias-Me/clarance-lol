/**
 * Hybrid Workflow: clarance-f + AI Vision
 * Combines reliable reference data with AI vision enhancement
 */

const SF86Integration = require('./sf86-integration-example');
const AIGapFiller = require('./ai-gap-filler');

class HybridWorkflow {
    constructor() {
        this.integration = new SF86Integration();
        this.aiFiller = new AIGapFiller();
        this.pdfPath = 'C:/Users/TJ/Desktop/clarance-lol/samples/test-pdfs/clean.pdf';
    }

    async processSectionWithAI(sectionId) {
        console.log(`\n🚀 Hybrid Processing for Section ${sectionId}`);
        console.log('===========================================');

        // Step 1: Initial validation
        console.log('\n📋 Step 1: Initial Data Validation');
        const validation = this.integration.validator.validate_section(sectionId);

        console.log(`Section ${sectionId} integrity: ${validation.integrity_score.toFixed(2)}%`);
        console.log(`Issues detected: ${validation.fields_with_issues}`);

        let enhancedData;

        // Step 2: Decide if AI enhancement is needed
        if (validation.integrity_score < 80 || sectionId === 13) {
            console.log('\n🤖 Step 2: AI Enhancement Required');
            console.log('-' .repeat(50));

            try {
                // Use AI to fill gaps and verify data
                enhancedData = await this.aiFiller.enhanceSection(sectionId, this.pdfPath);

                console.log('\n✅ AI enhancement completed');
            } catch (error) {
                console.error('\n⚠️ AI enhancement failed, using original data');
                const sectionPath = `C:/Users/TJ/Desktop/clarance-lol/clarance-f/api/sections-references/section-${sectionId}.json`;
                enhancedData = JSON.parse(require('fs').readFileSync(sectionPath, 'utf8'));
            }
        } else {
            console.log('\n✓ High integrity detected, skipping AI enhancement');
            const sectionPath = `C:/Users/TJ/Desktop/clarance-lol/clarance-f/api/sections-references/section-${sectionId}.json`;
            enhancedData = JSON.parse(require('fs').readFileSync(sectionPath, 'utf8'));
        }

        // Step 3: Process with React mapper
        console.log('\n⚛️  Step 3: React Component Generation');
        const reactSection = this.integration.mapper.processSection(enhancedData);

        // Step 4: Generate complete output
        console.log('\n📦 Step 4: Final Output Generation');
        const output = {
            sectionId,
            sectionName: enhancedData.metadata.sectionName,
            processing: {
                originalIntegrity: validation.integrity_score,
                aiEnhanced: !!enhancedData.metadata.aiEnhanced,
                aiVerified: enhancedData.metadata.fieldsVerified || 0,
                aiDiscovered: enhancedData.metadata.fieldsDiscovered || 0,
                finalIntegrity: enhancedData.metadata.aiIntegrityScore || validation.integrity_score
            },
            components: reactSection.components,
            statistics: {
                originalFields: enhancedData.metadata.originalFieldCount || enhancedData.fields.length,
                finalFields: enhancedData.fields.length,
                improvement: enhancedData.fields.length - (enhancedData.metadata.originalFieldCount || enhancedData.fields.length)
            }
        };

        // Save output
        this.saveHybridOutput(sectionId, output, enhancedData);

        return output;
    }

    saveHybridOutput(sectionId, output, enhancedData) {
        const outputDir = `C:/Users/TJ/Desktop/clarance-lol/hybrid-output/section-${sectionId}`;

        if (!require('fs').existsSync(outputDir)) {
            require('fs').mkdirSync(outputDir, { recursive: true });
        }

        // Save processing report
        require('fs').writeFileSync(
            `${outputDir}/processing-report.json`,
            JSON.stringify(output, null, 2)
        );

        // Save enhanced field data
        require('fs').writeFileSync(
            `${outputDir}/enhanced-fields.json`,
            JSON.stringify(enhancedData, null, 2)
        );

        // Save React components
        const reactCode = this.integration.mapper.generateReactSection(enhancedData);
        require('fs').writeFileSync(
            `${outputDir}/components.jsx`,
            `${reactCode.imports}\n\n${reactCode.component}`
        );

        console.log(`\n💾 Output saved to: ${outputDir}`);
    }

    async runCompleteAnalysis() {
        console.log('\n🎯 Complete SF-86 Hybrid Analysis');
        console.log('================================');

        const results = [];

        // Focus on problematic sections first
        const prioritySections = [13, 4, 5, 10, 11, 18]; // Known to have issues

        for (const sectionId of prioritySections) {
            try {
                const result = await this.processSectionWithAI(sectionId);
                results.push(result);

                // Show summary
                console.log(`\n📊 Section ${sectionId} Summary:`);
                console.log(`  - Original integrity: ${result.processing.originalIntegrity.toFixed(2)}%`);
                console.log(`  - AI enhanced: ${result.processing.aiEnhanced}`);
                if (result.processing.aiEnhanced) {
                    console.log(`  - Fields verified: ${result.processing.aiVerified}`);
                    console.log(`  - Fields discovered: ${result.processing.aiDiscovered}`);
                }
                console.log(`  - Final integrity: ${result.processing.finalIntegrity.toFixed(2)}%`);
                console.log(`  - Net improvement: +${result.statistics.improvement} fields`);

            } catch (error) {
                console.error(`❌ Failed to process Section ${sectionId}:`, error.message);
            }
        }

        // Generate final report
        this.generateFinalReport(results);
    }

    generateFinalReport(results) {
        const report = {
            date: new Date().toISOString(),
            totalSections: results.length,
            summary: {
                sectionsEnhanced: results.filter(r => r.processing.aiEnhanced).length,
                averageIntegrityImprovement: results.reduce((sum, r) =>
                    sum + (r.processing.finalIntegrity - r.processing.originalIntegrity), 0) / results.length,
                totalFieldsAdded: results.reduce((sum, r) => sum + r.statistics.improvement, 0)
            },
            details: results
        };

        const reportPath = 'C:/Users/TJ/Desktop/clarance-lol/hybrid-analysis-report.json';
        require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log('\n📈 Analysis Complete!');
        console.log('======================');
        console.log(`Sections processed: ${report.totalSections}`);
        console.log(`Sections enhanced with AI: ${report.summary.sectionsEnhanced}`);
        console.log(`Average integrity improvement: ${report.summary.averageIntegrityImprovement.toFixed(2)}%`);
        console.log(`Total fields added: ${report.summary.totalFieldsAdded}`);
        console.log(`\n📄 Full report saved to: ${reportPath}`);
    }
}

// Run the complete analysis
if (require.main === module) {
    const workflow = new HybridWorkflow();
    workflow.runCompleteAnalysis().catch(console.error);
}

module.exports = HybridWorkflow;