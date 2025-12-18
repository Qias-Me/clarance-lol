/**
 * Test different value formats for RadioButtonList fields
 */

// Import the required functions
import { loadGoldenKeyInventory } from './lib/golden-key-loader.js';
import { FieldNameMapper } from './lib/field-name-mapper.js';
import { collectValuesByPdfName, fillPdfClientSide } from './lib/golden-key-pdf-writer.js';

console.log('=== Testing RadioButtonList Value Formats ===\n');

// Test different value formats for the Section 1 acknowledgement field
const testCases = [
  {
    name: 'Test 1: Uppercase YES/NO',
    values: {
      'form1[0].Sections1-6[0].RadioButtonList[0]': 'YES'
    }
  },
  {
    name: 'Test 2: Title Case Yes/No',
    values: {
      'form1[0].Sections1-6[0].RadioButtonList[0]': 'Yes'
    }
  },
  {
    name: 'Test 3: Numeric 1/0',
    values: {
      'form1[0].Sections1-6[0].RadioButtonList[0]': '1'
    }
  },
  {
    name: 'Test 4: Lowercase yes/no',
    values: {
      'form1[0].Sections1-6[0].RadioButtonList[0]': 'yes'
    }
  },
  {
    name: 'Test 5: YES with trailing space',
    values: {
      'form1[0].Sections1-6[0].RadioButtonList[0]': 'YES '
    }
  }
];

async function testRadioButtonValues() {
  try {
    // Load PDF template
    const templateResponse = await fetch('/data/sf86.pdf');
    if (!templateResponse.ok) {
      throw new Error(`Failed to fetch PDF template: ${templateResponse.status}`);
    }

    const templatePdfBytes = new Uint8Array(await templateResponse.arrayBuffer());
    console.log(`📄 PDF template loaded: ${templatePdfBytes.length} bytes\n`);

    // Test each value format
    for (const testCase of testCases) {
      console.log(`🧪 ${testCase.name}`);

      try {
        // Collect values using golden key logic
        const collected = collectValuesByPdfName(testCase.values);
        console.log(`   Collected: ${JSON.stringify(collected)}`);

        // Generate PDF
        const pdfBytes = await fillPdfClientSide({
          templatePdfBytes,
          valuesByName: collected,
          fieldGroups: {},
          pdfTypeByName: {},
          flatten: false
        });

        // Compare file sizes - if value was applied, file should be larger
        const sizeIncrease = pdfBytes.length - templatePdfBytes.length;
        console.log(`   ✅ PDF generated: ${pdfBytes.length} bytes (increase: ${sizeIncrease})`);

        if (sizeIncrease > 1000) {
          console.log(`   🎯 SUCCESS: Value was likely applied (significant size increase)`);
        } else {
          console.log(`   ⚠️  WARNING: Value may not have been applied (minimal size change)`);
        }

      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
      }

      console.log('');
    }

  } catch (error) {
    console.error('❌ Test setup error:', error);
  }
}

// Run the test
testRadioButtonValues();