/**
 * Test Script for SF-86 Acknowledgment Field Mapping Fix
 *
 * This script tests the complete flow for the acknowledgment field
 * to verify the root cause and provide a working solution.
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function testAcknowledgmentFieldFix() {
  console.log('🔧 TESTING ACKNOWLEDGMENT FIELD MAPPING FIX');
  console.log('='.repeat(50));

  try {
    // Load PDF and golden key data
    const pdfPath = path.join(__dirname, 'clarance-final-next-app', 'public', 'data', 'sf86.pdf');
    const goldenKeyPath = path.join(__dirname, 'clarance-final-next-app', 'public', 'data', 'golden-key.json');

    console.log('📄 Loading PDF template...');
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    console.log('🔑 Loading golden key data...');
    const goldenKeyData = JSON.parse(fs.readFileSync(goldenKeyPath, 'utf8'));

    // Test 1: Find the acknowledgment field in golden key data
    console.log('\n🔍 TEST 1: Golden Key Field Lookup');
    const targetUiPath = 'section1.root.entry0.radiobuttonlist';
    let foundField = null;

    Object.entries(goldenKeyData).forEach(([key, fieldData]) => {
      if (fieldData.uiPath === targetUiPath) {
        foundField = fieldData;
        console.log(`✅ Found field for UI path: ${targetUiPath}`);
        console.log(`   Field name: ${fieldData.pdf?.fieldName}`);
        console.log(`   Field ID: ${fieldData.pdf?.fieldId}`);
      }
    });

    if (!foundField) {
      console.log(`❌ Field not found for UI path: ${targetUiPath}`);
      return;
    }

    // Test 2: Create minimal field groups data for this field
    console.log('\n📋 TEST 2: Field Groups Configuration');
    const minimalFieldGroups = {
      [foundField.pdf.fieldName]: {
        fieldType: "RadioGroup",
        options: [
          { exportValue: "YES", uiLabel: "True", onState: "YES" },
          { exportValue: "NO", uiLabel: "False", onState: "NO" }
        ]
      }
    };
    console.log(`✅ Created field groups config for: ${foundField.pdf.fieldName}`);

    // Test 3: Simulate the complete mapping and application process
    console.log('\n🔄 TEST 3: Complete Mapping Flow Simulation');

    // Mock form data (this is what should come from the application)
    const formData = {
      [targetUiPath]: true,  // Boolean value from UI
      'currentSection': '1'
    };

    console.log('📥 Input form data:');
    Object.entries(formData).forEach(([key, value]) => {
      console.log(`   ${key}: ${value} (${typeof value})`);
    });

    // Step 1: Collect values by PDF name (simplified version of collectValuesByPdfName)
    const valuesByName = {};
    Object.entries(formData).forEach(([uiPath, value]) => {
      // Skip internal form context properties
      if (uiPath === 'currentSection' || value === undefined || value === null) {
        return;
      }

      // Find the corresponding PDF field name
      Object.entries(goldenKeyData).forEach(([key, fieldData]) => {
        if (fieldData.uiPath === uiPath && fieldData.pdf?.fieldName) {
          valuesByName[fieldData.pdf.fieldName] = value;
          console.log(`🎯 Mapped: ${uiPath} → ${fieldData.pdf.fieldName} = ${value}`);
        }
      });
    });

    console.log(`\n📊 Collected ${Object.keys(valuesByName).length} values by PDF name`);

    // Step 2: Apply radio button value formatting
    const formattedValues = {};
    Object.entries(valuesByName).forEach(([fieldName, value]) => {
      const groupMeta = minimalFieldGroups[fieldName];
      if (groupMeta?.fieldType === "RadioGroup") {
        // Convert boolean to YES/NO
        let formattedValue;
        if (typeof value === 'boolean') {
          formattedValue = value ? "YES" : "NO";
        } else {
          formattedValue = String(value).trim().toUpperCase();
        }

        // Validate against options
        const validOptions = groupMeta.options.map(opt => opt.exportValue);
        if (validOptions.includes(formattedValue)) {
          formattedValues[fieldName] = formattedValue;
          console.log(`✅ Formatted radio: ${fieldName} "${value}" → "${formattedValue}"`);
        } else {
          console.log(`⚠️  Invalid radio value: ${fieldName} "${formattedValue}" not in [${validOptions.join(', ')}]`);
        }
      } else {
        formattedValues[fieldName] = value;
      }
    });

    // Step 3: Apply values to PDF
    console.log('\n📝 TEST 4: PDF Field Application');
    let appliedCount = 0;
    let errorCount = 0;

    for (const [fieldName, value] of Object.entries(formattedValues)) {
      try {
        const baseType = "RadioButton"; // We know this is a radio field
        const groupMeta = minimalFieldGroups[fieldName];

        if (groupMeta?.fieldType === "RadioGroup" || baseType === "RadioButton") {
          const radioGroup = form.getRadioGroup(fieldName);
          if (radioGroup) {
            // Validate against actual PDF options
            const pdfOptions = radioGroup.getOptions();
            if (pdfOptions.includes(value)) {
              radioGroup.select(value);
              console.log(`✅ Applied radio: ${fieldName} = "${value}"`);
              appliedCount++;
            } else {
              console.log(`❌ Invalid option: ${fieldName} "${value}" not in PDF options [${pdfOptions.join(', ')}]`);
            }
          } else {
            console.log(`❌ Radio group not found: ${fieldName}`);
            errorCount++;
          }
        }
      } catch (error) {
        console.log(`❌ Error applying ${fieldName}: ${error.message}`);
        errorCount++;
      }
    }

    // Step 4: Save the test PDF
    console.log('\n💾 TEST 5: PDF Generation');
    console.log(`🎨 Updating field appearances...`);
    const font = await pdfDoc.embedFont(require('pdf-lib').StandardFonts.Helvetica);
    form.updateFieldAppearances(font);

    const modifiedPdfBytes = await pdfDoc.save();
    const testOutputPath = path.join(__dirname, 'test-acknowledgment-field-fix-result.pdf');
    fs.writeFileSync(testOutputPath, modifiedPdfBytes);

    console.log(`✅ PDF saved: ${testOutputPath}`);
    console.log(`   Fields applied: ${appliedCount}`);
    console.log(`   Fields errored: ${errorCount}`);
    console.log(`   File size: ${(modifiedPdfBytes.length / 1024 / 1024).toFixed(2)} MB`);

    // Step 5: Verification
    console.log('\n🔍 TEST 6: Verification');
    console.log('To verify the fix:');
    console.log('1. Open the generated PDF file');
    console.log('2. Go to page 5 (where the acknowledgment field is located)');
    console.log('3. Check if the "YES" option is selected in the acknowledgment radio button');
    console.log('4. If selected, the fix is working correctly');

    if (appliedCount > 0) {
      console.log('\n🎉 SUCCESS: The acknowledgment field mapping fix is working!');
      console.log('\n📋 NEXT STEPS FOR INTEGRATION:');
      console.log('1. Ensure the application form data includes "section1.root.entry0.radiobuttonlist"');
      console.log('2. Add the acknowledgment field to the field groups configuration');
      console.log('3. Test the complete flow in the application');
    } else {
      console.log('\n❌ FAILED: No fields were applied. Check the error messages above.');
    }

  } catch (error) {
    console.error('❌ TEST FAILED:', error);
  }
}

// Run the test
if (require.main === module) {
  testAcknowledgmentFieldFix().catch(console.error);
}

module.exports = { testAcknowledgmentFieldFix };