/**
 * Comprehensive PDF Field Mapping Debug Test
 *
 * This test will:
 * 1. Load the SF86 PDF and analyze its actual field structure
 * 2. Load golden key data and examine field mappings
 * 3. Test direct field access with pdf-lib
 * 4. Trace the complete flow from form data to PDF modification
 * 5. Identify exactly where and why the mapping fails
 */

const fs = require('fs');
const path = require('path');

// Mock pdf-lib import for Node.js environment
const { PDFDocument } = require('pdf-lib');

async function main() {
  console.log('🔍 COMPREHENSIVE PDF FIELD MAPPING DEBUG TEST');
  console.log('='.repeat(60));

  try {
    // Step 1: Load and analyze the SF86 PDF template
    console.log('\n📄 STEP 1: Analyzing SF86 PDF Template...');
    await analyzePdfStructure();

    // Step 2: Load and analyze golden key data
    console.log('\n🔑 STEP 2: Analyzing Golden Key Data...');
    await analyzeGoldenKeyData();

    // Step 3: Test field access and mapping
    console.log('\n🗺️  STEP 3: Testing Field Access and Mapping...');
    await testFieldAccess();

    // Step 4: Simulate the complete mapping flow
    console.log('\n🔄 STEP 4: Simulating Complete Mapping Flow...');
    await simulateMappingFlow();

    // Step 5: Generate detailed findings
    console.log('\n📊 STEP 5: Generating Detailed Findings...');
    await generateFindings();

  } catch (error) {
    console.error('❌ DEBUG TEST FAILED:', error);
  }
}

async function analyzePdfStructure() {
  try {
    const pdfPath = path.join(__dirname, 'clarance-final-next-app', 'public', 'data', 'sf86.pdf');

    if (!fs.existsSync(pdfPath)) {
      console.log(`❌ PDF not found at: ${pdfPath}`);
      return;
    }

    console.log(`✅ Found PDF at: ${pdfPath}`);

    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    console.log(`📄 PDF loaded successfully`);
    console.log(`   Pages: ${pdfDoc.getPageCount()}`);

    // Get all fields from the form
    const fields = form.getFields();
    console.log(`   Total form fields found: ${fields.length}`);

    // Look specifically for the acknowledgment field
    const targetFieldName = 'form1[0].Sections1-6[0].RadioButtonList[0]';
    const acknowledgmentFields = fields.filter(field =>
      field.getName() && field.getName().includes('RadioButtonList')
    );

    console.log(`\n🎯 ACKNOWLEDGMENT FIELD ANALYSIS:`);
    console.log(`   Target field: ${targetFieldName}`);
    console.log(`   Radio button fields found: ${acknowledgmentFields.length}`);

    acknowledgmentFields.forEach(field => {
      const name = field.getName();
      console.log(`   - Field: ${name}`);
      console.log(`     Type: ${field.constructor.name}`);

      if (name === targetFieldName) {
        console.log(`     ✅ FOUND TARGET FIELD!`);

        // Test if we can access it
        try {
          const radioGroup = form.getRadioGroup(name);
          if (radioGroup) {
            const options = radioGroup.getOptions();
            console.log(`     ✅ Radio group accessible`);
            console.log(`     Options: [${options.join(', ')}]`);

            // Test selecting a value
            if (options.length > 0) {
              radioGroup.select(options[0]);
              console.log(`     ✅ Successfully selected: ${options[0]}`);
              radioGroup.unselect(); // Clean up
              console.log(`     ✅ Successfully unselected`);
            }
          } else {
            console.log(`     ❌ Could not get radio group`);
          }
        } catch (error) {
          console.log(`     ❌ Error accessing radio group: ${error.message}`);
        }
      }
    });

    // Analyze all field names in the form
    console.log(`\n📋 ALL FORM FIELDS (first 20):`);
    fields.slice(0, 20).forEach((field, index) => {
      console.log(`   ${index + 1}. ${field.getName()} (${field.constructor.name})`);
    });

    if (fields.length > 20) {
      console.log(`   ... and ${fields.length - 20} more fields`);
    }

    // Save the modified PDF to test if changes persist
    const modifiedPdfBytes = await pdfDoc.save();
    const testOutputPath = path.join(__dirname, 'debug-pdf-field-test.pdf');
    fs.writeFileSync(testOutputPath, modifiedPdfBytes);
    console.log(`   💾 Test PDF saved to: ${testOutputPath}`);

  } catch (error) {
    console.error(`❌ Error analyzing PDF structure: ${error.message}`);
  }
}

async function analyzeGoldenKeyData() {
  try {
    const goldenKeyPath = path.join(__dirname, 'clarance-final-next-app', 'public', 'data', 'golden-key.json');

    if (!fs.existsSync(goldenKeyPath)) {
      console.log(`❌ Golden key data not found at: ${goldenKeyPath}`);
      return;
    }

    console.log(`✅ Found golden key data at: ${goldenKeyPath}`);

    const goldenKeyData = JSON.parse(fs.readFileSync(goldenKeyPath, 'utf8'));
    console.log(`   Total entries: ${Object.keys(goldenKeyData).length}`);

    // Find the acknowledgment field in golden key data
    const targetFieldName = 'form1[0].Sections1-6[0].RadioButtonList[0]';
    let acknowledgmentField = null;

    Object.entries(goldenKeyData).forEach(([key, fieldData]) => {
      if (fieldData.pdf?.fieldName === targetFieldName) {
        acknowledgmentField = fieldData;
        console.log(`\n🎯 ACKNOWLEDGMENT FIELD IN GOLDEN KEY:`);
        console.log(`   Key: ${key}`);
        console.log(`   Field Name: ${fieldData.pdf?.fieldName}`);
        console.log(`   Field ID: ${fieldData.pdf?.fieldId}`);
        console.log(`   Widget IDs: [${(fieldData.pdf?.widgetIds || []).join(', ')}]`);
        console.log(`   Page Number: ${fieldData.pdf?.pageNumber}`);
        console.log(`   Type: ${fieldData.pdf?.type}`);
        console.log(`   UI Path: ${fieldData.uiPath}`);
        console.log(`   Logical Section: ${fieldData.logical?.section}`);
        console.log(`   Coordinates:`, fieldData.pdf?.rects);
      }
    });

    if (!acknowledgmentField) {
      console.log(`\n❌ ACKNOWLEDGMENT FIELD NOT FOUND IN GOLDEN KEY DATA`);

      // Search for similar field names
      const radioFields = Object.entries(goldenKeyData).filter(([key, fieldData]) =>
        fieldData.pdf?.fieldName?.includes('RadioButtonList') ||
        fieldData.uiPath?.includes('radiobuttonlist')
      );

      console.log(`\n📋 RADIO BUTTON FIELDS IN GOLDEN KEY (${radioFields.length}):`);
      radioFields.forEach(([key, fieldData]) => {
        console.log(`   - ${fieldData.pdf?.fieldName || 'NO_NAME'} (${fieldData.uiPath})`);
      });
    }

    // Analyze field distribution by section
    console.log(`\n📊 FIELD DISTRIBUTION BY SECTION:`);
    const sectionCounts = {};
    Object.values(goldenKeyData).forEach(fieldData => {
      const section = fieldData.logical?.section || 'unknown';
      sectionCounts[section] = (sectionCounts[section] || 0) + 1;
    });

    Object.entries(sectionCounts)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([section, count]) => {
        console.log(`   Section ${section}: ${count} fields`);
      });

  } catch (error) {
    console.error(`❌ Error analyzing golden key data: ${error.message}`);
  }
}

async function testFieldAccess() {
  try {
    const pdfPath = path.join(__dirname, 'clarance-final-next-app', 'public', 'data', 'sf86.pdf');
    const goldenKeyPath = path.join(__dirname, 'clarance-final-next-app', 'public', 'data', 'golden-key.json');

    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    const goldenKeyData = JSON.parse(fs.readFileSync(goldenKeyPath, 'utf8'));

    console.log(`\n🧪 TESTING DIRECT FIELD ACCESS:`);

    // Test the specific acknowledgment field
    const targetFieldName = 'form1[0].Sections1-6[0].RadioButtonList[0]';

    try {
      const radioGroup = form.getRadioGroup(targetFieldName);
      if (radioGroup) {
        console.log(`✅ Direct access successful for: ${targetFieldName}`);
        console.log(`   Field type: ${radioGroup.constructor.name}`);

        const options = radioGroup.getOptions();
        console.log(`   Available options: [${options.join(', ')}]`);

        // Test setting different values
        console.log(`\n🔬 TESTING VALUE ASSIGNMENT:`);
        options.forEach(option => {
          try {
            radioGroup.select(option);
            console.log(`   ✅ Successfully selected: "${option}"`);
          } catch (error) {
            console.log(`   ❌ Failed to select "${option}": ${error.message}`);
          }
        });

        // Test invalid value
        try {
          radioGroup.select('INVALID_VALUE');
          console.log(`   ❌ Unexpected success with invalid value`);
        } catch (error) {
          console.log(`   ✅ Correctly rejected invalid value: ${error.message}`);
        }

      } else {
        console.log(`❌ Could not access field: ${targetFieldName}`);

        // Try to find what radio button fields do exist
        const allFields = form.getFields();
        const radioFields = allFields.filter(field => field.constructor.name === 'PDFRadioGroup');
        console.log(`\n📋 AVAILABLE RADIO GROUP FIELDS (${radioFields.length}):`);
        radioFields.slice(0, 10).forEach(field => {
          console.log(`   - ${field.getName()}`);
        });
        if (radioFields.length > 10) {
          console.log(`   ... and ${radioFields.length - 10} more`);
        }
      }
    } catch (error) {
      console.log(`❌ Error accessing field: ${error.message}`);
    }

    // Test field name variations
    console.log(`\n🔍 TESTING FIELD NAME VARIATIONS:`);
    const variations = [
      targetFieldName,
      'form1[0].Sections1-6[0].RadioButtonList[1]',
      'form1[0].Sections1-6[0].RadioButtonList',
      'Sections1-6[0].RadioButtonList[0]',
      'RadioButtonList[0]',
    ];

    variations.forEach(variation => {
      try {
        const field = form.getField(variation);
        if (field) {
          console.log(`   ✅ Found: ${variation}`);
        } else {
          console.log(`   ❌ Not found: ${variation}`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${variation} - ${error.message}`);
      }
    });

  } catch (error) {
    console.error(`❌ Error testing field access: ${error.message}`);
  }
}

async function simulateMappingFlow() {
  try {
    console.log(`\n🔄 SIMULATING COMPLETE FIELD MAPPING FLOW:`);

    // Mock form data that would come from the application
    const mockFormData = {
      'section1.root.entry0.radiobuttonlist': 'true', // or 'YES', or 1, etc.
      'currentSection': '1',
    };

    console.log(`📥 INPUT FORM DATA:`);
    Object.entries(mockFormData).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });

    // Load golden key data
    const goldenKeyPath = path.join(__dirname, 'clarance-final-next-app', 'public', 'data', 'golden-key.json');
    const goldenKeyData = JSON.parse(fs.readFileSync(goldenKeyPath, 'utf8'));

    // Step 1: Find the field in golden key data
    console.log(`\n🔍 STEP 1: Field Lookup in Golden Key...`);
    const uiPath = 'section1.root.entry0.radiobuttonlist';
    let foundField = null;

    Object.entries(goldenKeyData).forEach(([key, fieldData]) => {
      if (fieldData.uiPath === uiPath) {
        foundField = fieldData;
        console.log(`   ✅ Found field for UI path: ${uiPath}`);
        console.log(`   Field name: ${fieldData.pdf?.fieldName}`);
        console.log(`   Field ID: ${fieldData.pdf?.fieldId}`);
      }
    });

    if (!foundField) {
      console.log(`   ❌ No field found for UI path: ${uiPath}`);
      return;
    }

    // Step 2: Apply coordinate mapping
    console.log(`\n🗺️  STEP 2: Coordinate Mapping...`);
    const CoordinateFieldMapper = require('./clarance-final-next-app/src/lib/coordinate-field-mapper.js').default;
    const mapper = new CoordinateFieldMapper(goldenKeyData);

    const originalFieldName = foundField.pdf?.fieldName;
    const mappedFieldName = mapper.mapField(originalFieldName);

    console.log(`   Original field name: ${originalFieldName}`);
    console.log(`   Mapped field name: ${mappedFieldName}`);
    console.log(`   Mapping applied: ${originalFieldName !== mappedFieldName}`);

    // Step 3: Test PDF field access with mapped name
    console.log(`\n📄 STEP 3: PDF Field Access Test...`);
    const pdfPath = path.join(__dirname, 'clarance-final-next-app', 'public', 'data', 'sf86.pdf');
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    try {
      const radioGroup = form.getRadioGroup(mappedFieldName);
      if (radioGroup) {
        console.log(`   ✅ Successfully accessed field: ${mappedFieldName}`);

        const options = radioGroup.getOptions();
        console.log(`   Available options: [${options.join(', ')}]`);

        // Test applying the form value
        const formValue = mockFormData[uiPath];
        console.log(`\n🔧 STEP 4: Value Application Test...`);
        console.log(`   Form value: ${formValue}`);
        console.log(`   Type: ${typeof formValue}`);

        // Try different value conversions
        const testValues = [
          formValue,                    // Original value
          String(formValue),           // As string
          formValue === 'true' ? '1' : '0',  // Boolean to radio index
          formValue === 'true' ? 'YES' : 'NO', // Boolean to YES/NO
        ];

        testValues.forEach((testValue, index) => {
          try {
            if (options.includes(testValue)) {
              radioGroup.select(testValue);
              console.log(`   ✅ Test ${index + 1}: Successfully applied "${testValue}"`);
            } else {
              console.log(`   ⚠️  Test ${index + 1}: Value "${testValue}" not in options`);
            }
          } catch (error) {
            console.log(`   ❌ Test ${index + 1}: Failed to apply "${testValue}" - ${error.message}`);
          }
        });

      } else {
        console.log(`   ❌ Could not access mapped field: ${mappedFieldName}`);
      }
    } catch (error) {
      console.log(`   ❌ Error accessing mapped field: ${error.message}`);
    }

    // Step 4: Test PDF generation
    console.log(`\n💾 STEP 5: PDF Generation Test...`);
    try {
      const modifiedPdfBytes = await pdfDoc.save();
      const testOutputPath = path.join(__dirname, 'debug-mapping-flow-test.pdf');
      fs.writeFileSync(testOutputPath, modifiedPdfBytes);
      console.log(`   ✅ PDF saved successfully: ${testOutputPath}`);
      console.log(`   File size: ${(modifiedPdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
    } catch (error) {
      console.log(`   ❌ Error saving PDF: ${error.message}`);
    }

  } catch (error) {
    console.error(`❌ Error simulating mapping flow: ${error.message}`);
  }
}

async function generateFindings() {
  console.log(`\n📊 DETAILED FINDINGS AND ANALYSIS:`);
  console.log('='.repeat(60));

  // This section will contain the root cause analysis
  const findings = {
    pdfStructure: {
      loaded: false,
      fieldCount: 0,
      hasAcknowledgmentField: false,
      acknowledgmentFieldType: null,
    },
    goldenKeyData: {
      loaded: false,
      totalFields: 0,
      hasAcknowledgmentMapping: false,
      acknowledgmentFieldDetails: null,
    },
    fieldAccess: {
      directAccessSuccessful: false,
      coordinateMappingApplied: false,
      valueApplicationSuccessful: false,
      errors: [],
    },
    mappingFlow: {
      uiPathFound: false,
      fieldNameMapped: false,
      pdfFieldAccessible: false,
      valueApplied: false,
    }
  };

  // Generate recommendations based on findings
  console.log(`\n🎯 RECOMMENDATIONS:`);
  console.log(`1. Verify the exact field name structure in the PDF`);
  console.log(`2. Ensure golden key data matches actual PDF field names`);
  console.log(`3. Test value format compatibility (YES/NO vs 0/1 vs true/false)`);
  console.log(`4. Verify pdf-lib field access patterns`);
  console.log(`5. Check if coordinate mapping is modifying field names correctly`);

  console.log(`\n🔧 NEXT STEPS:`);
  console.log(`1. Run this debug script to identify the specific failure point`);
  console.log(`2. Compare actual PDF field names with golden key field names`);
  console.log(`3. Test different value formats for radio button selection`);
  console.log(`4. Verify the coordinate mapping logic`);
  console.log(`5. Create a minimal test case for the specific acknowledgment field`);

  console.log(`\n📋 DEBUG OUTPUT FILES:`);
  console.log(`- debug-pdf-field-test.pdf: Direct field access test`);
  console.log(`- debug-mapping-flow-test.pdf: Complete mapping flow test`);

  console.log(`\n✅ DEBUG TEST COMPLETE`);
}

// Run the debug test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };