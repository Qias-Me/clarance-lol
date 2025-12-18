/**
 * Test field mapping and PDF generation
 */

// Import the functions from our lib directory
import { FieldNameMapper } from './lib/field-name-mapper.js';
import { collectValuesByPdfName } from './lib/golden-key-pdf-writer.js';

// Test data from golden key for section 1
const section1TestData = {
  'form1[0].Sections1-6[0].TextField11[1]': 'John', // First name
  'form1[0].Sections1-6[0].TextField11[2]': 'Doe', // Middle name
  'form1[0].Sections1-6[0].suffix[0]': 'Jr.', // Suffix
};

console.log('=== Testing Field Name Mapping ===');

section1TestData.forEach((value, goldenKeyField) => {
  const mappedField = FieldNameMapper.mapToPDFField(goldenKeyField);
  console.log(`Golden Key: ${goldenKeyField}`);
  console.log(`Value: ${value}`);
  console.log(`Mapped: ${mappedField}`);
  console.log(`Changed: ${goldenKeyField !== mappedField ? '✅' : '❌'}`);
  console.log('---');
});

console.log('\n=== Testing Value Collection ===');
const collected = collectValuesByPdfName(section1TestData);
console.log('Collected values:', JSON.stringify(collected, null, 2));

console.log('\n=== Field Mapping Summary ===');
const originalCount = Object.keys(section1TestData).length;
const collectedCount = Object.keys(collected).length;
console.log(`Original fields: ${originalCount}`);
console.log(`Collected fields: ${collectedCount}`);
console.log(`Mapping success: ${originalCount === collectedCount ? '✅' : '❌'}`);