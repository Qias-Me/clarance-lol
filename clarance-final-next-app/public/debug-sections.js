// Section Debug Script - Run in browser console
// This script will analyze section placement and identify fields in wrong sections

function debugSections() {
  console.log('🔍 DEBUGGING SECTION PLACEMENT');
  console.log('===============================');

  const goldenKey = window.__CLARANCE_GOLDEN_KEY__;
  const sectionRenderer = window.__CLARANCE_SECTION_RENDERER__;

  if (!goldenKey) {
    console.error('❌ goldenKey not found on window object');
    return;
  }

  console.log(`📊 Total records in golden-key: ${Object.keys(goldenKey.records).length}`);

  // 1. Analyze section distribution
  const sectionCounts = {};
  const sectionPageRanges = {};
  const problematicSections = {};

  Object.values(goldenKey.records).forEach(record => {
    const section = record.logical.section;
    const page = record.pdf.pageNumber;

    if (!section) {
      console.warn('⚠️ Found record without section:', record.pdf.fieldName);
      return;
    }

    sectionCounts[section] = (sectionCounts[section] || 0) + 1;

    if (!sectionPageRanges[section]) {
      sectionPageRanges[section] = { min: page, max: page };
    } else {
      sectionPageRanges[section].min = Math.min(sectionPageRanges[section].min, page);
      sectionPageRanges[section].max = Math.max(sectionPageRanges[section].max, page);
    }

    // Check for suspicious page assignments (fields in wrong sections)
    if (section === '13' && page > 100) {
      if (!problematicSections['13']) problematicSections['13'] = [];
      problematicSections['13'].push({ ...record, issue: 'Page too high for Section 13' });
    }
    if (section === '14' && page < 80) {
      if (!problematicSections['14']) problematicSections['14'] = [];
      problematicSections['14'].push({ ...record, issue: 'Page too low for Section 14' });
    }
  });

  console.log('📈 Section field counts:');
  Object.entries(sectionCounts)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([section, count]) => {
      const range = sectionPageRanges[section];
      console.log(`  Section ${section}: ${count} fields (pages ${range.min}-${range.max})`);
    });

  // 2. Look for section bleed issues
  console.log('\n🔍 Checking for potential section bleed...');
  Object.entries(sectionPageRanges).forEach(([section, range]) => {
    const sectionNum = parseInt(section);
    const nextPageSection = Object.entries(sectionPageRanges)
      .find(([s, r]) => parseInt(s) === sectionNum + 1);

    if (nextPageSection) {
      const [nextSection, nextRange] = nextPageSection;
      if (range.max > nextRange.min - 5) { // Allow 5-page overlap
        console.log(`⚠️ Possible bleed: Section ${section} (max pg ${range.max}) overlaps with Section ${nextSection} (min pg ${nextRange.min})`);
      }
    }
  });

  // 3. Show problematic fields
  if (Object.keys(problematicSections).length > 0) {
    console.log('\n❌ Problematic fields found:');
    Object.entries(problematicSections).forEach(([section, fields]) => {
      console.log(`  Section ${section} (${fields.length} problematic fields):`);
      fields.slice(0, 5).forEach(field => {
        console.log(`    - ${field.pdf.fieldName} (page ${field.pdf.pageNumber}): ${field.issue}`);
      });
      if (fields.length > 5) {
        console.log(`    ... and ${fields.length - 5} more`);
      }
    });
  }

  // 4. Test section renderer for problematic sections
  if (sectionRenderer) {
    console.log('\n🎭 Testing section renderer...');
    ['13', '14', '15'].forEach(sectionNum => {
      try {
        const fields = sectionRenderer.getFieldsForSection(sectionNum);
        const pages = [...new Set(fields.map(f => f.page))].sort((a, b) => a - b);
        console.log(`  Section ${sectionNum}: ${fields.length} fields on pages ${pages.join(', ')}`);

        // Check if fields seem to belong to this section
        const sampleFields = fields.slice(0, 3);
        sampleFields.forEach(field => {
          console.log(`    Sample: ${field.label} (pg ${field.page}, entry ${field.entry})`);
        });
      } catch (error) {
        console.error(`  ❌ Error rendering section ${sectionNum}: ${error.message}`);
      }
    });
  }

  console.log('\n✅ Section debug complete!');
  console.log('💡 If you see Section 13 fields on high page numbers or Section 14 fields on low page numbers, that\'s likely the problem.');
}

// Make the debug function globally available
window.debugSections = debugSections;

console.log('🐛 Section debug script loaded! Run debugSections() to start debugging.');