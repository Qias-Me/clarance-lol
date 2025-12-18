// Visibility Rules Debug Script - Run in browser console
// This script will test conditional visibility logic and identify any issues

function debugVisibility() {
  console.log('🔍 DEBUGGING VISIBILITY RULES');
  console.log('===============================');

  const formValues = window.__CLARANCE_FORM_VALUES__;
  const currentSection = window.__CLARANCE_CURRENT_SECTION__;

  if (!formValues) {
    console.error('❌ Form values not found on window object');
    console.log('💡 Fill out some form fields first, especially YES/NO radio buttons');
    return;
  }

  console.log(`📊 Current section: ${currentSection}`);
  console.log(`📊 Total form values: ${Object.keys(formValues).length}`);

  // Show current values for controller fields
  const controllerFields = [
    'form1[0].Sections1-6[0].RadioButtonList[1]',  // Section 5 - Other names
    'form1[0].Sections7-9[0].RadioButtonList[0]',  // Section 7 - Passport
    'form1[0].Sections7-9[0].RadioButtonList[1]',  // Section 8 - Dual citizenship
    'form1[0].Section10\\.1-10\\.2[0].RadioButtonList[0]', // Section 10 - Foreign education
    'form1[0].Section13[0].RadioButtonList[0]',     // Section 13 - Foreign contacts
    'form1[0].Section15[0].RadioButtonList[0]',     // Section 15 - Military
    'form1[0].Section17-1[0].RadioButtonList[0]',   // Section 17 - Bankruptcy
    'form1[0].Section18[0].RadioButtonList[0]',     // Section 18 - Gambling
    'form1[0].Section20[0].RadioButtonList[0]',     // Section 20 - Police record
    'form1[0].Section21[0].RadioButtonList[0]',     // Section 21 - Illegal drugs
    'form1[0].Section22[0].RadioButtonList[0]',     // Section 22 - Alcohol use
  ];

  console.log('\n🎛️ Controller field values:');
  controllerFields.forEach(fieldId => {
    const value = formValues[fieldId];
    if (value !== undefined) {
      console.log(`  ${fieldId}: ${value}`);
    }
  });

  // Test visibility rules for Section 13 (Foreign Contacts)
  if (currentSection === '13' || confirm('Test Section 13 visibility rules?')) {
    console.log('\n🧪 Testing Section 13 visibility rules...');
    const foreignContactsController = 'form1[0].Section13[0].RadioButtonList[0]';
    const controllerValue = formValues[foreignContactsController];

    console.log(`  Controller (${foreignContactsController}): ${controllerValue || 'NOT_SET'}`);

    // Check if subsection should be visible
    const shouldShowDetails = controllerValue === 'YES';
    console.log(`  Should show "foreign_contacts_details" subsection: ${shouldShowDetails}`);

    // Check actual UI elements
    const subsectionHeaders = Array.from(document.querySelectorAll('button')).filter(btn =>
      btn.textContent && btn.textContent.includes('Foreign')
    );

    console.log(`  Found ${subsectionHeaders.length} "Foreign" related UI elements`);
    subsectionHeaders.forEach((header, index) => {
      const isVisible = header.offsetParent !== null;
      console.log(`    [${index}] "${header.textContent.trim()}": ${isVisible ? 'VISIBLE' : 'HIDDEN'}`);
    });
  }

  // Test Section 15 (Military History)
  if (currentSection === '15' || confirm('Test Section 15 visibility rules?')) {
    console.log('\n🧪 Testing Section 15 visibility rules...');
    const militaryController = 'form1[0].Section15[0].RadioButtonList[0]';
    const controllerValue = formValues[militaryController];

    console.log(`  Controller (${militaryController}): ${controllerValue || 'NOT_SET'}`);
    const shouldShowDetails = controllerValue === 'YES';
    console.log(`  Should show "military_details" subsection: ${shouldShowDetails}`);

    // Check actual UI elements
    const militaryElements = Array.from(document.querySelectorAll('*')).filter(el =>
      el.textContent && el.textContent.includes('Military') && (el.tagName === 'BUTTON' || el.tagName === 'H3')
    );

    console.log(`  Found ${militaryElements.length} "Military" related UI elements`);
    militaryElements.forEach((el, index) => {
      const isVisible = el.offsetParent !== null;
      console.log(`    [${index}] "${el.textContent.trim()}": ${isVisible ? 'VISIBLE' : 'HIDDEN'}`);
    });
  }

  // Count currently visible vs hidden fields
  const allFields = document.querySelectorAll('[id^="field-"]');
  const visibleFields = Array.from(allFields).filter(field => field.offsetParent !== null);
  const hiddenFields = allFields.length - visibleFields.length;

  console.log('\n📊 Field visibility summary:');
  console.log(`  Total form fields: ${allFields.length}`);
  console.log(`  Currently visible: ${visibleFields.length}`);
  console.log(`  Currently hidden: ${hiddenFields}`);

  // Test setting a controller value and check immediate effect
  console.log('\n🔧 Testing dynamic visibility changes...');
  console.log('💡 Try running this in console:');
  console.log('  // Show Section 13 details:');
  console.log('  window.formContext.setValue("form1[0].Section13[0].RadioButtonList[0]", "YES");');
  console.log('  // Hide Section 13 details:');
  console.log('  window.formContext.setValue("form1[0].Section13[0].RadioButtonList[0]", "NO");');

  // Expose form context if available
  if (typeof window !== 'undefined' && (window as any).formContext) {
    console.log('\n✅ Form context available as window.formContext');
  } else {
    console.log('\n❌ Form context not available');
  }

  console.log('\n✅ Visibility debug complete!');
}

// Test function to toggle a controller field
function testVisibilityToggle(controllerFieldId, testValue = 'YES') {
  const formContext = window.formContext;
  if (!formContext) {
    console.error('❌ Form context not available');
    return;
  }

  console.log(`🧪 Setting ${controllerFieldId} to ${testValue}`);
  formContext.setValue(controllerFieldId, testValue);

  console.log('💡 Check if conditional fields appeared/disappeared');
}

// Make functions globally available
window.debugVisibility = debugVisibility;
window.testVisibilityToggle = testVisibilityToggle;

// Add some helper functions for common tests
window.testSection13 = () => testVisibilityToggle('form1[0].Section13[0].RadioButtonList[0]', 'YES');
window.testSection15 = () => testVisibilityToggle('form1[0].Section15[0].RadioButtonList[0]', 'YES');

console.log('🐛 Visibility debug script loaded!');
console.log('Available commands:');
console.log('  debugVisibility() - Full visibility debug');
console.log('  testSection13() - Set Section 13 to YES');
console.log('  testSection15() - Set Section 15 to YES');
console.log('  testVisibilityToggle(fieldId, value) - Set any controller field');