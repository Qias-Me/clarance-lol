// Dropdown Debug Script - Run in browser console
// This script will trace the dropdown data flow and identify where options are getting lost

function debugDropdowns() {
  console.log('🔍 DEBUGGING DROPDOWN OPTIONS FLOW');
  console.log('=====================================');

  // 1. Check if fieldGroups is loaded and has dropdowns
  const fieldGroups = window.__CLARANCE_FIELD_GROUPS__;
  if (fieldGroups) {
    const dropdowns = Object.values(fieldGroups).filter(fg => fg.fieldType === 'Dropdown');
    console.log(`📋 Found ${dropdowns.length} dropdowns in fieldGroups:`);
    dropdowns.slice(0, 3).forEach(dg => {
      console.log(`  - ${dg.fieldName}: ${dg.options?.length || 0} options`);
      if (dg.options && dg.options.length > 0) {
        console.log(`    First option: ${JSON.stringify(dg.options[0])}`);
      }
    });
  } else {
    console.error('❌ fieldGroups not found on window object');
  }

  // 2. Check current section fields
  const currentSection = window.__CLARANCE_CURRENT_SECTION__;
  if (currentSection) {
    console.log(`🎯 Current section: ${currentSection}`);
    const sectionRenderer = window.__CLARANCE_SECTION_RENDERER__;
    if (sectionRenderer) {
      const fields = sectionRenderer.getFieldsForSection(currentSection);
      const dropdownFields = fields.filter(f => f.type === 'DROPDOWN');
      console.log(`🎭 Found ${dropdownFields.length} dropdown fields in section ${currentSection}:`);
      dropdownFields.forEach(df => {
        console.log(`  - ${df.id}: ${df.options?.length || 0} options`);
        if (df.options && df.options.length > 0) {
          console.log(`    First option: ${JSON.stringify(df.options[0])}`);
        } else {
          console.log(`    ❌ NO OPTIONS!`);
        }
      });
    } else {
      console.error('❌ sectionRenderer not found on window object');
    }
  }

  // 3. Test dropdown options service directly
  console.log('\n🔧 Testing dropdown-options-service...');
  const getDropdownOptions = window.__CLARANCE_GET_DROPDOWN_OPTIONS__;
  if (getDropdownOptions) {
    const testFields = [
      'form1[0].Sections1-6[0].suffix[0]',
      'form1[0].Sections1-6[0].State[0]'
    ];

    testFields.forEach(async (fieldName) => {
      try {
        const options = await getDropdownOptions(fieldName);
        console.log(`  📋 ${fieldName}: ${options.length} options`);
        if (options.length > 0) {
          console.log(`    First: ${options[0]}`);
        }
      } catch (error) {
        console.error(`  ❌ ${fieldName}: Error - ${error.message}`);
      }
    });
  } else {
    console.error('❌ getDropdownOptions function not available');
  }

  // 4. Check if dropdowns in UI have options
  console.log('\n🎨 Checking UI dropdown elements...');
  const dropdownElements = document.querySelectorAll('select');
  console.log(`Found ${dropdownElements.length} dropdown elements in UI:`);
  dropdownElements.forEach((select, index) => {
    const options = Array.from(select.options);
    const hasRealOptions = options.length > 2; // More than just "Select..." and maybe one option
    console.log(`  [${index}] ${select.id || 'unnamed'}: ${options.length} options (has real options: ${hasRealOptions})`);
    if (!hasRealOptions && options.length > 0) {
      console.log(`    Only option: "${options[0].text}"`);
    }
  });

  console.log('\n✅ Debug complete! Check the logs above to identify where dropdown options are lost.');
}

// Make the debug function globally available
window.debugDropdowns = debugDropdowns;

// Also expose internal state if not already available
window.__CLARANCE_DEBUG__ = true;

console.log('🐛 Dropdown debug script loaded! Run debugDropdowns() to start debugging.');