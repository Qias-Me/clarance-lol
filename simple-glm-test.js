/**
 * Simple test to verify GLM vision fix components exist
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Simple GLM Vision Fix Verification');
console.log('='.repeat(40));

// Check key files exist
const checks = [
  {
    name: 'Sections References Loader',
    path: 'clarance-f/api/utils/sections-references-loader.ts'
  },
  {
    name: 'Real GLM Vision Integrator',
    path: 'clarance-f/services/integrity-fixer/real-glm-vision-integrator.ts'
  },
  {
    name: 'Updated AI Vision Integrator',
    path: 'clarance-f/services/integrity-fixer/ai-vision-integrator.ts'
  },
  {
    name: 'Section 13 References JSON',
    path: 'clarance-f/api/sections-references/section-13.json'
  },
  {
    name: 'BMAD GLM Provider',
    path: '.bmad-user-memory/modules/interactive-pdf-mapper/src/vision/glm_provider.py'
  },
  {
    name: 'BMAD Configuration',
    path: '.bmad-user-memory/modules/interactive-pdf-mapper/src/core/config.py'
  }
];

let passedChecks = 0;

checks.forEach(check => {
  const exists = fs.existsSync(path.join(process.cwd(), check.path));
  console.log(`${exists ? '✅' : '❌'} ${check.name}: ${check.path}`);
  if (exists) passedChecks++;
});

console.log('\n📊 Summary:');
console.log(`Checks passed: ${passedChecks}/${checks.length}`);

if (passedChecks === checks.length) {
  console.log('🎉 All GLM Vision Fix components are in place!');

  // Check if section 13 JSON has fields
  try {
    const section13Path = path.join(process.cwd(), 'clarance-f/api/sections-references/section-13.json');
    const section13Data = JSON.parse(fs.readFileSync(section13Path, 'utf8'));
    const fieldCount = section13Data.fields ? section13Data.fields.length : 0;

    console.log(`📋 Section 13 fields available: ${fieldCount}`);
    console.log(`📄 Section 13 page range: ${section13Data.metadata?.pageRange?.join('-') || 'Unknown'}`);

    if (fieldCount > 1000) {
      console.log('🚀 Excellent: Large-scale field data available for processing!');
    }
  } catch (error) {
    console.log('⚠️ Could not read Section 13 data');
  }

  console.log('\n🔧 Next Steps to Enable Real GLM Vision:');
  console.log('1. Set GLM_API_KEY environment variable');
  console.log('2. Set BMAD_MODULE_PATH to point to the interactive-pdf-mapper module');
  console.log('3. Ensure Python 3 is available for BMAD processing');
  console.log('4. Compile TypeScript files for production use');
  console.log('5. Test with actual PDF files');

} else {
  console.log('❌ Some components are missing. Please check the installation.');
}

// Check environment variables
console.log('\n🌍 Environment Variables:');
console.log(`GLM_API_KEY: ${process.env.GLM_API_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`BMAD_MODULE_PATH: ${process.env.BMAD_MODULE_PATH || 'Not set (will auto-detect)'}`);

console.log('\n✅ Simple verification complete!');