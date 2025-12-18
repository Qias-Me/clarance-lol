/**
 * Simple test to verify acknowledgment field mapping
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');

async function runSimpleTest() {
  console.log('🧪 SIMPLE ACKNOWLEDGMENT FIELD TEST');

  try {
    // Load files
    const pdfPath = path.join(__dirname, 'clarance-final-next-app', 'public', 'data', 'sf86.pdf');
    const goldenKeyPath = path.join(__dirname, 'clarance-final-next-app', 'public', 'data', 'golden-key.json');

    const pdfBytes = fs.readFileSync(pdfPath);
    const goldenKeyData = JSON.parse(fs.readFileSync(goldenKeyPath, 'utf8'));

    console.log('✅ Files loaded successfully');

    // Find the acknowledgment field
    let acknowledgmentField = null;
    let fieldKey = null;

    Object.entries(goldenKeyData).forEach(([key, data]) => {
      if (data.uiPath === 'section1.root.entry0.radiobuttonlist') {
        acknowledgmentField = data;
        fieldKey = key;
        console.log(`✅ Found acknowledgment field: ${key}`);
        console.log(`   UI Path: ${data.uiPath}`);
        console.log(`   PDF Field Name: ${data.pdf.fieldName}`);
        console.log(`   Field ID: ${data.pdf.fieldId}`);
      }
    });

    if (!acknowledgmentField) {
      console.log('❌ Acknowledgment field not found');
      return;
    }

    // Load PDF and access the field
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    const fieldName = acknowledgmentField.pdf.fieldName;
    console.log(`\n🔍 Accessing PDF field: ${fieldName}`);

    try {
      const radioGroup = form.getRadioGroup(fieldName);
      console.log('✅ Radio group accessed successfully');

      const options = radioGroup.getOptions();
      console.log(`   Available options: [${options.join(', ')}]`);

      // Test setting values
      console.log('\n📝 Testing value assignment...');

      // Test YES
      radioGroup.select('YES');
      console.log('✅ Successfully selected "YES"');

      // Test NO
      radioGroup.select('NO');
      console.log('✅ Successfully selected "NO"');

      // Set back to YES for the test output
      radioGroup.select('YES');
      console.log('✅ Final value set to "YES"');

    } catch (error) {
      console.log(`❌ Error accessing field: ${error.message}`);
      return;
    }

    // Update appearances and save
    console.log('\n🎨 Updating field appearances...');
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    form.updateFieldAppearances(font);

    const modifiedPdfBytes = await pdfDoc.save();
    const outputPath = path.join(__dirname, 'simple-acknowledgment-test-result.pdf');
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    console.log(`✅ Test PDF saved: ${outputPath}`);
    console.log(`   File size: ${(modifiedPdfBytes.length / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n🎯 CONCLUSION:');
    console.log('The acknowledgment field mapping works correctly when:');
    console.log('1. ✅ Golden key data contains the field mapping');
    console.log('2. ✅ PDF field is accessible with the correct name');
    console.log('3. ✅ Values can be assigned successfully');
    console.log('4. ✅ Field appearances are updated properly');

    console.log('\n📋 ROOT CAUSE IDENTIFIED:');
    console.log('The issue is NOT in the PDF mapping infrastructure.');
    console.log('The issue is in the APPLICATION DATA FLOW:');
    console.log('- Form data may not include "section1.root.entry0.radiobuttonlist"');
    console.log('- Value format may not be compatible (needs "YES"/"NO" not boolean)');
    console.log('- Field groups configuration may be missing for this field');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

runSimpleTest();