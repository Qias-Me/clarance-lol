/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PDF Field Tester - Debug utility to check if PDF template has accessible form fields
 */

import { PDFDocument } from 'pdf-lib';

export async function testPDFFields(): Promise<void> {
  try {
    console.log("🔍 Testing PDF template for accessible form fields...");

    // Fetch the PDF template
    const response = await fetch('/sf86.pdf');
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }

    const pdfBytes = await response.arrayBuffer();
    console.log(`📄 PDF loaded: ${pdfBytes.byteLength} bytes`);

    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // Get all fields
    const allFields = form.getFields();
    console.log(`📊 Total PDF form fields: ${allFields.length}`);

    // Sample first few fields
    const sampleFields = allFields.slice(0, 10);
    console.log("🔍 Sample field names:");
    sampleFields.forEach((field, index) => {
      const fieldName = field.getName();
      const fieldType = field.constructor.name;
      console.log(`  ${index + 1}. "${fieldName}" (${fieldType})`);
    });

    // Test if we can find our expected fields
    const expectedFields = [
      'form1[0].#subform[68].TextField11[1]',
      'form1[0].#subform[68].suffix[0]',
      'TextField11[1]',
      'suffix[0]'
    ];

    console.log("🔍 Testing expected field names:");
    expectedFields.forEach((expectedName) => {
      try {
        const field = form.getField(expectedName);
        if (field) {
          console.log(`  ✅ Found: "${expectedName}" (${field.constructor.name})`);

          // Test setting a value
          if (field.constructor.name === 'PDFTextField') {
            (field as any).setText('TEST_VALUE');
            console.log(`    ✅ Successfully set test value`);
          }
        } else {
          console.log(`  ❌ Not found: "${expectedName}"`);
        }
      } catch (error) {
        console.log(`  ❌ Error accessing "${expectedName}": ${error}`);
      }
    });

    // Try to save a test version
    console.log("💾 Saving test PDF...");
    const testPdfBytes = await pdfDoc.save();
    const testBlob = new Blob([testPdfBytes], { type: 'application/pdf' });
    const testUrl = URL.createObjectURL(testBlob);

    const link = document.createElement('a');
    link.href = testUrl;
    link.download = 'pdf-field-test.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(testUrl);

    console.log("✅ PDF field test completed - check downloaded test file");

  } catch (error) {
    console.error("❌ PDF field test failed:", error);
  }
}