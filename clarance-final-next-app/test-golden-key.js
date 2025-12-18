// Simple Node.js test script to verify Golden Key mapping
const fs = require('fs').promises;
const path = require('path');

async function testGoldenKey() {
  try {
    // Load the golden key data
    const goldenKeyPath = path.join(__dirname, 'public', 'data', 'golden-key.json');
    const data = await fs.readFile(goldenKeyPath, 'utf-8');
    const goldenKey = JSON.parse(data);

    console.log('✅ Golden Key loaded successfully!');
    console.log(`📊 Total fields mapped: ${goldenKey.totalFields}`);
    console.log(`📋 Sections: ${Object.keys(goldenKey.bySection).length}`);
    console.log(`📅 Generated: ${goldenKey.generatedAt}\n`);

    // Test some example lookups
    const records = Object.values(goldenKey.records);

    console.log('🔍 Example mappings:\n');
    records.slice(0, 5).forEach(record => {
      console.log(`UI Path: ${record.uiPath}`);
      console.log(`  → PDF Field: ${record.pdf.fieldName}`);
      console.log(`  → Page: ${record.pdf.pageNumber}`);
      console.log(`  → Type: ${record.pdf.type}`);
      console.log(`  → Location: Section ${record.logical.section}${record.logical.subsection ? ` • ${record.logical.subsection}` : ''}${record.logical.entry !== null ? ` • Entry ${record.logical.entry}` : ''}\n`);
    });

    // Test a specific lookup
    const firstRecord = records[0];
    console.log('📋 Specific lookup test:');
    console.log(`Looking up UI Path: ${firstRecord.uiPath}`);
    console.log(`Found: ${records.find(r => r.uiPath === firstRecord.uiPath) ? '✅ YES' : '❌ NO'}\n`);

    // Test section grouping
    console.log('📁 Section field counts:');
    Object.entries(goldenKey.bySection).forEach(([section, fingerprints]) => {
      console.log(`  Section ${section}: ${fingerprints.length} fields`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testGoldenKey();