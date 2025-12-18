// Simple test to verify dropdown field groups are loaded correctly
const fs = require('fs');

// Read the updated field-groups.json
const fieldGroupsPath = './clearance-omg-dropdowns/references/field-groups.json';
const fieldGroups = JSON.parse(fs.readFileSync(fieldGroupsPath, 'utf-8'));

// Find dropdown fields
const dropdownFields = Object.entries(fieldGroups).filter(([key, field]) => field.fieldType === 'Dropdown');

console.log(`Found ${dropdownFields.length} dropdown fields`);

// Show some examples
const examples = dropdownFields.slice(0, 5);
examples.forEach(([fieldName, field]) => {
  console.log(`\nDropdown: ${field.displayLabel}`);
  console.log(`Field Name: ${fieldName}`);
  console.log(`Options count: ${field.options ? field.options.length : 0}`);
  if (field.options && field.options.length > 0) {
    console.log(`First few options: ${field.options.slice(0, 3).map(o => o.exportValue).join(', ')}`);
  }
});

// Check specific suffix field
const suffixField = fieldGroups['form1[0].Sections1-6[0].suffix[0]'];
if (suffixField) {
  console.log('\n\nSuffix Field Details:');
  console.log(`Type: ${suffixField.fieldType}`);
  console.log(`Display Label: ${suffixField.displayLabel}`);
  console.log(`Options: ${suffixField.options ? suffixField.options.map(o => o.exportValue).join(', ') : 'None'}`);
}