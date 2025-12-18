/**
 * Simple test script to demonstrate the GLM vision fix
 */

const path = require('path');

// Mock TemplateField interface for testing
class TemplateField {
  constructor(fieldName, templateValue, fieldType, coordinates) {
    this.fieldName = fieldName;
    this.templateValue = templateValue;
    this.fieldType = fieldType;
    this.coordinates = coordinates;
  }
}

async function testGLMVisionFix() {
  console.log('🧪 Testing GLM Vision Integration Fix');
  console.log('='.repeat(50));

  try {
    // Set up environment for testing
    process.env.BMAD_MODULE_PATH = path.join(process.cwd(), '.bmad-user-memory/modules/interactive-pdf-mapper');

    // Import the fixed AI vision integrator
    const { AIVisionIntegrator } = require('./clarance-f/services/integrity-fixer/ai-vision-integrator');

    console.log('📡 Initializing AI Vision Integrator...');
    const integrator = new AIVisionIntegrator();

    // Check integration status
    console.log('\n🔍 Checking Integration Status...');
    const status = await integrator.checkIntegrationStatus();
    console.log(JSON.stringify(status, null, 2));

    // Create test template fields from Section 13
    const testFields = [
      new TemplateField(
        'form1[0].section_13_1-2[0].TextField11[0]',
        'sect13A.1Entry1SupervisorName',
        'text',
        { page: 17, x: 35.88, y: 306.94, width: 270, height: 13.91 }
      ),
      new TemplateField(
        'form1[0].section_13_1-2[0].TextField11[1]',
        'sect13A.1Entry1SupervisorRank',
        'text',
        { page: 17, x: 309.88, y: 306.94, width: 284, height: 14.92 }
      )
    ];

    console.log(`\n🎯 Processing ${testFields.length} test fields...`);

    // Process the fields
    const results = await integrator.processBatchTemplateFields(testFields);

    // Display results
    console.log('\n📊 Results:');
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.fieldName}`);
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   Field Type: ${result.fieldType}`);
      console.log(`   Extracted Text: "${result.extractedText || 'EMPTY'}"`);
      console.log(`   Suggestions: ${result.suggestions.slice(0, 3).join(', ') || 'None'}`);
      console.log(`   Position: (${result.boundingBox.x.toFixed(1)}, ${result.boundingBox.y.toFixed(1)})`);
    });

    // Generate comprehensive report
    const report = integrator.generateVisionReport(results);
    console.log('\n' + report);

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error('Error:', error.message);

    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure TypeScript files are compiled: npx tsc');
    console.log('2. Check if BMAD module exists: ls -la .bmad-user-memory/modules/interactive-pdf-mapper');
    console.log('3. Set GLM_API_KEY environment variable');
    console.log('4. Verify sections-references files exist: ls -la clarance-f/api/sections-references/');

    process.exit(1);
  }
}

// Run the test
testGLMVisionFix();