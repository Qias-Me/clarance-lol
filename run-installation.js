/**
 * Test runner for Interactive PDF Mapper installation
 */

const fs = require('fs');
const path = require('path');

// Load the installer
const installer = require('./.bmad-user-memory/modules/interactive-pdf-mapper/_module-installer/installer.js');

// Load test configuration
const config = JSON.parse(fs.readFileSync('./install-test-config.json', 'utf8'));

// Installation options
const options = {
  projectRoot: __dirname,
  config: config,
  installedIDEs: ['vscode'], // Simulate VS Code installation
  logger: {
    log: (msg) => console.log(`[INSTALL] ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`)
  }
};

console.log('🚀 Starting Interactive PDF Mapper installation...\n');

// Run installation
installer.install(options).then(success => {
  if (success) {
    console.log('\n✅ Installation completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Copy .env.template to .env.local and configure your API key');
    console.log('2. Run: npm install to install dependencies');
    console.log('3. Place sample PDFs in the samples/ directory');
    console.log('4. Start the development server');
    console.log('5. Visit the documentation for usage examples');
  } else {
    console.log('\n❌ Installation failed. Please check the error messages above.');
  }
}).catch(error => {
  console.error('\n💥 Installation error:', error.message);
});