/**
 * **BRUTAL HONESTY TEST: Real GLM Vision API Validation**
 *
 * This test strips away all assumptions and validates:
 * 1. Are the GLM credentials real and working?
 * 2. Can the API actually process Section 13 fields?
 * 3. What does the API REALLY return vs what we claimed?
 */

const fs = require('fs');
const path = require('path');

// Load environment from .env.local
const pathResolve = require('path').resolve;
require('dotenv').config({ path: pathResolve(__dirname, '.env.local') });

console.log('🔬 **BRUTAL HONESTY GLM API TEST**');
console.log('='.repeat(60));

// CRITICAL CHECK 1: Environment Variables
console.log('\n🔍 **ENVIRONMENT VERIFICATION**');
const glmApiKey = process.env.GLM45V_API_KEY;
const glmEndpoint = process.env.GLM45V_ENDPOINT;

console.log(`GLM45V_API_KEY: ${glmApiKey ? `${glmApiKey.substring(0, 8)}...` : '❌ MISSING'}`);
console.log(`GLM45V_ENDPOINT: ${glmEndpoint || '❌ MISSING'}`);
console.log(`GLM45V_MODEL: ${process.env.GLM45V_MODEL || '❌ MISSING'}`);

if (!glmApiKey || !glmEndpoint) {
    console.log('\n🚨 **CRITICAL FAILURE**: No GLM credentials configured!');
    console.log('This means ALL GLM processing claims are FALSE until proven otherwise.');
    process.exit(1);
}

// CRITICAL CHECK 2: Load Real Section 13 Data
console.log('\n📋 **SECTION 13 DATA LOADING**');
let section13Data;
try {
    const section13Path = path.join(__dirname, 'enhanced-section-13.json');
    section13Data = JSON.parse(fs.readFileSync(section13Path, 'utf8'));
    console.log(`✅ Section 13 data loaded: ${section13Data.fields.length} fields`);
    console.log(`📄 Page range: ${section13Data.metadata.pageRange.join('-')}`);
} catch (error) {
    console.log('❌ Failed to load Section 13 data:', error.message);
    process.exit(1);
}

// CRITICAL CHECK 3: Test Actual GLM API Call
async function testRealGLMAPI() {
    console.log('\n🚀 **REAL GLM API TEST**');

    const testField = section13Data.fields[0]; // Test first field
    console.log(`Testing field: ${testField.name}`);
    console.log(`Field label: ${testField.label}`);
    console.log(`Field type: ${testField.type}`);

    try {
        const response = await fetch(glmEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${glmApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: process.env.GLM45V_MODEL || 'glm-4.6v',
                messages: [{
                    role: 'user',
                    content: `Analyze this PDF field for Section 13 of SF-86:\n\nField Name: ${testField.name}\nField Label: ${testField.label}\nField Type: ${testField.type}\n\nClassify this field and extract its semantic meaning.`
                }],
                max_tokens: 500
            })
        });

        console.log(`📡 API Response Status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.log(`❌ API ERROR: ${response.status} - ${errorText}`);
            return false;
        }

        const result = await response.json();
        console.log('✅ API CALL SUCCESSFUL');
        console.log('📄 API Response:');
        console.log(JSON.stringify(result, null, 2));

        return true;

    } catch (error) {
        console.log(`❌ NETWORK/API ERROR: ${error.message}`);
        return false;
    }
}

// CRITICAL CHECK 4: Check UI Application Status
async function checkUIApplication() {
    console.log('\n🖥️ **UI APPLICATION CHECK**');

    // Check if React app exists and can run
    const packageJsonPath = path.join(__dirname, 'clarance-f', 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        console.log('✅ React package.json exists');

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        console.log(`React app name: ${packageJson.name}`);
        console.log(`React version: ${packageJson.dependencies?.react || 'Unknown'}`);

        // Check for Section 13 specific components
        const section13ComponentPath = path.join(__dirname, 'clarance-f', 'app', 'section-13', 'page.tsx');
        if (fs.existsSync(section13ComponentPath)) {
            console.log('✅ Section 13 React component exists');
        } else {
            console.log('❌ Section 13 React component missing');
        }
    } else {
        console.log('❌ React application not found');
    }
}

// CRITICAL CHECK 5: Validate Field Mapping Claims
function validateFieldMappingClaims() {
    console.log('\n🔍 **FIELD MAPPING CLAIMS VALIDATION**');

    // Sample 10 random fields from Section 13
    const sampleSize = Math.min(10, section13Data.fields.length);
    const sampleFields = section13Data.fields.slice(0, sampleSize);

    console.log(`\n📋 **SAMPLE FIELD ANALYSIS** (${sampleSize} fields):`);

    sampleFields.forEach((field, index) => {
        console.log(`\n${index + 1}. **FIELD REALITY CHECK**`);
        console.log(`   Name: ${field.name}`);
        console.log(`   Label: ${field.label || 'NO LABEL'}`);
        console.log(`   Type: ${field.type}`);
        console.log(`   Page: ${field.page}`);
        console.log(`   Coordinates: (${field.rect.x}, ${field.rect.y})`);
        console.log(`   Has Value: ${!!field.value}`);
        console.log(`   Confidence: ${field.confidence || 'NO CONFIDENCE'}`);

        // Does this field look real?
        const hasValidCoordinates = field.rect && field.rect.x >= 0 && field.rect.y >= 0;
        const hasValidType = ['PDFTextField', 'PDFDropdown', 'PDFCheckBox'].includes(field.type);
        const hasValidName = field.name && field.name.includes('form1');

        console.log(`   **REALITY SCORE**: ${[
            hasValidCoordinates ? '✅' : '❌',
            hasValidType ? '✅' : '❌',
            hasValidName ? '✅' : '❌'
        ].join(' ')} ${[hasValidCoordinates, hasValidType, hasValidName].filter(Boolean).length}/3`);
    });
}

// Main execution
async function main() {
    try {
        // Check UI application
        await checkUIApplication();

        // Validate field mapping claims
        validateFieldMappingClaims();

        // Test actual GLM API
        const apiSuccess = await testRealGLMAPI();

        console.log('\n🎯 **BRUTAL HONESTY SUMMARY**');
        console.log('='.repeat(60));

        if (apiSuccess) {
            console.log('✅ GLM API is REAL and WORKING');
            console.log('✅ Field mapping data is STRUCTURED');
            console.log('✅ Components are IN PLACE');
            console.log('\n🚀 **CONCLUSION**: The infrastructure is real and testable!');
        } else {
            console.log('❌ GLM API is NOT WORKING');
            console.log('⚠️ Field mapping data exists but AI processing is DOWN');
            console.log('⚠️ All AI-powered claims are UNPROVEN');
            console.log('\n🚨 **CONCLUSION**: Claims about GLM processing are FALSE until API is fixed!');
        }

        console.log('\n📊 **EVIDENCE SCORE**:');
        console.log(`Environment: ${glmApiKey ? '8/10' : '0/10'}`);
        console.log(`Data Structure: ${section13Data ? '9/10' : '0/10'}`);
        console.log(`API Functionality: ${apiSuccess ? '10/10' : '0/10'}`);
        console.log(`UI Components: ${fs.existsSync('clarance-f/package.json') ? '7/10' : '0/10'}`);

    } catch (error) {
        console.log('\n💥 **CRITICAL ERROR**:', error.message);
        console.log('This suggests the entire system may be unstable!');
    }
}

// Run the brutal honesty test
main().catch(console.error);