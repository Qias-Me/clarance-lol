/**
 * Interactive PDF Mapper Module Installer
 * Custom installation logic for PDF processing infrastructure
 */

const fs = require('fs');
const path = require('path');

/**
 * @param {Object} options - Installation options
 * @param {string} options.projectRoot - Project root directory
 * @param {Object} options.config - Module configuration from module.yaml
 * @param {Array} options.installedIDEs - List of IDE codes being configured
 * @param {Object} options.logger - Logger instance (log, warn, error methods)
 * @returns {boolean} - true if successful, false to abort installation
 */
async function install(options) {
  const { projectRoot, config, installedIDEs, logger } = options;

  logger.log('Installing Interactive PDF Mapper...');
  logger.log(`Project root: ${projectRoot}`);
  logger.log(`Cache directory: ${config.cache_directory}`);

  try {
    // 1. Create cache directories structure
    const cacheBaseDir = path.join(projectRoot, config.cache_directory);
    const cacheDirs = [
      'golden-maps',
      'validation-reports',
      'user-sessions',
      'temp-processing'
    ];

    for (const dir of cacheDirs) {
      const dirPath = path.join(cacheBaseDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.log(`Created cache directory: ${dirPath}`);
      }
    }

    // 2. Create configuration directory
    const configDir = path.join(projectRoot, '.bmad', 'interactive-pdf-mapper');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      logger.log(`Created config directory: ${configDir}`);
    }

    // 3. Generate main configuration file
    const configPath = path.join(configDir, 'config.yaml');
    const configContent = generateConfigContent(config);
    fs.writeFileSync(configPath, configContent, 'utf8');
    logger.log(`Generated configuration file: ${configPath}`);

    // 4. Create performance monitoring directory
    const perfDir = path.join(configDir, 'performance');
    if (!fs.existsSync(perfDir)) {
      fs.mkdirSync(perfDir, { recursive: true });
      logger.log(`Created performance directory: ${perfDir}`);
    }

    // 5. Initialize performance tracking
    const perfConfigPath = path.join(perfDir, 'config.json');
    const perfConfig = {
      initialized: new Date().toISOString(),
      version: config.version,
      monitoring_enabled: true,
      metrics_collection: true,
      cache_performance: {
        hit_rate_target: 0.998,
        response_time_target: 150, // milliseconds
        memory_limit_mb: 1000
      },
      quality_metrics: {
        coordinate_tolerance: parseFloat(config.validation_tolerance || 0.5),
        field_detection_accuracy_target: 0.999,
        validation_coverage_target: 1.0
      }
    };
    fs.writeFileSync(perfConfigPath, JSON.stringify(perfConfig, null, 2));
    logger.log(`Initialized performance tracking: ${perfConfigPath}`);

    // 6. Create sample data directory
    const sampleDir = path.join(projectRoot, 'samples');
    if (!fs.existsSync(sampleDir)) {
      fs.mkdirSync(sampleDir, { recursive: true });
      logger.log(`Created samples directory: ${sampleDir}`);
    }

    // 7. Generate sample configuration files
    const sampleConfig = {
      sample_pdf_path: 'path/to/sample.pdf',
      test_coordinates: true,
      debug_mode: config.log_verbosity === 'verbose'
    };
    const sampleConfigPath = path.join(sampleDir, 'sample-config.json');
    fs.writeFileSync(sampleConfigPath, JSON.stringify(sampleConfig, null, 2));
    logger.log(`Created sample configuration: ${sampleConfigPath}`);

    // 8. Create validation templates
    const templatesDir = path.join(projectRoot, 'templates');
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
      logger.log(`Created templates directory: ${templatesDir}`);
    }

    // 9. Generate validation template
    const validationTemplate = {
      coordinate_validation: {
        tolerance: parseFloat(config.validation_tolerance || 0.5),
        strict_mode: true,
        evidence_only: true
      },
      field_detection: {
        confidence_threshold: 0.9,
        auto_validate: true,
        sections_integration: true
      },
      component_generation: {
        typescript: config.component_output_format === 'typescript',
        accessibility_enabled: true,
        responsive_design: true
      }
    };
    const validationTemplatePath = path.join(templatesDir, 'validation-template.json');
    fs.writeFileSync(validationTemplatePath, JSON.stringify(validationTemplate, null, 2));
    logger.log(`Created validation template: ${validationTemplatePath}`);

    // 10. Set up environment variables template
    const envTemplate = `# Interactive PDF Mapper Environment Variables
# Copy this file to .env.local and update with your actual values

# GLM4.5V Configuration
GLM45V_API_KEY=${config.glm45v_api_key || 'your-api-key-here'}
GLM45V_ENDPOINT=https://api.openai.com/v1

# Cache Configuration
CACHE_DIRECTORY=${config.cache_directory || 'data/golden-maps'}
CACHE_TTL=3600000
CACHE_MAX_SIZE_MB=1000

# Performance Settings
MAX_CONCURRENT_TASKS=${config.max_concurrent_tasks || '3'}
VALIDATION_TOLERANCE=${config.validation_tolerance || '0.5'}

# Logging
LOG_VERBOSITY=${config.log_verbosity || 'standard'}
LOG_FILE_PATH=./logs/interactive-pdf-mapper.log

# React Component Settings
COMPONENT_OUTPUT_FORMAT=${config.component_output_format || 'typescript'}

# Development Settings
NODE_ENV=development
DEBUG=interactive-pdf-mapper:*`;

    const envTemplatePath = path.join(projectRoot, '.env.template');
    fs.writeFileSync(envTemplatePath, envTemplate, 'utf8');
    logger.log(`Created environment template: ${envTemplatePath}`);

    // 11. Create log directory
    const logDir = path.join(projectRoot, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      logger.log(`Created logs directory: ${logDir}`);
    }

    // 12. Generate .gitignore additions
    const gitignoreAdditions = [
      '# Interactive PDF Mapper generated files',
      '.env.local',
      'data/',
      'logs/',
      '.bmad/interactive-pdf-mapper/performance/',
      'samples/temp/',
      'node_modules/.cache/',
      '*.log'
    ];

    const gitignorePath = path.join(projectRoot, '.gitignore');
    let existingGitignore = '';

    if (fs.existsSync(gitignorePath)) {
      existingGitignore = fs.readFileSync(gitignorePath, 'utf8');
    }

    const newGitignoreContent = existingGitignore + '\n\n' + gitignoreAdditions.join('\n');
    fs.writeFileSync(gitignorePath, newGitignoreContent, 'utf8');
    logger.log(`Updated .gitignore with module exclusions`);

    // 13. Create IDE configuration files for supported IDEs
    for (const ide of installedIDEs) {
      await createIDEConfig(projectRoot, ide, config, logger);
    }

    // 14. Create package.json scripts if they don't exist
    await createPackageScripts(projectRoot, logger);

    // 15. Validate installation
    await validateInstallation(configDir, logger);

    logger.log('✅ Interactive PDF Mapper installation complete!');
    logger.log('');
    logger.log('Next steps:');
    logger.log('1. Copy .env.template to .env.local and configure your API key');
    logger.log('2. Run: npm install to install dependencies');
    logger.log('3. Place sample PDFs in the samples/ directory');
    logger.log('4. Start the development server');
    logger.log('5. Visit the documentation for usage examples');

    return true;

  } catch (error) {
    logger.error(`❌ Installation failed: ${error.message}`);
    logger.error(error.stack);
    return false;
  }
}

/**
 * Generate configuration content for config.yaml
 */
function generateConfigContent(config) {
  return `# Interactive PDF Mapper Configuration
# Generated on: ${new Date().toISOString()}

# API Configuration
api:
  glm45v:
    api_key: "${config.glm45v_api_key}"
    endpoint: "https://api.openai.com/v1"
    timeout: 30000
    max_retries: 3

# Cache Configuration
cache:
  directory: "${config.cache_directory}"
  ttl: 3600000  # 1 hour
  max_size_mb: 1000
  cleanup_interval: 86400000  # 24 hours

# Processing Configuration
processing:
  max_concurrent_tasks: ${config.max_concurrent_tasks}
  default_timeout: 30000
  chunk_size: 10

# Validation Configuration
validation:
  default_tolerance: ${config.validation_tolerance}
  strict_mode: true
  evidence_only: true
  auto_validate: true

# Logging Configuration
logging:
  verbosity: "${config.log_verbosity}"
  file_path: "./logs/interactive-pdf-mapper.log"
  max_file_size_mb: 100
  backup_count: 5

# Component Generation
components:
  output_format: "${config.component_output_format}"
  typescript: ${config.component_output_format === 'typescript'}
  accessibility: true
  responsive: true

# Performance Monitoring
monitoring:
  enabled: true
  metrics_collection: true
  performance_reports: true
  alert_thresholds:
    response_time_ms: 500
    cache_hit_rate: 0.95
    memory_usage_percent: 80
`;
}

/**
 * Create IDE-specific configuration files
 */
async function createIDEConfig(projectRoot, ide, config, logger) {
  switch (ide) {
    case 'vscode':
      await createVSCodeConfig(projectRoot, logger);
      break;
    case 'intellij':
      await createIntelliJConfig(projectRoot, logger);
      break;
    case 'webstorm':
      await createWebStormConfig(projectRoot, logger);
      break;
    default:
      logger.log(`No specific IDE configuration available for: ${ide}`);
  }
}

async function createVSCodeConfig(projectRoot, logger) {
  const vscodeDir = path.join(projectRoot, '.vscode');
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }

  const extensions = [
    'ms-vscode.vscode-typescript-next',
    'bradlc.vscode-tailwindcss',
    'esbenp.prettier-vscode',
    'ms-vscode.vscode-eslint'
  ];

  const settings = {
    'typescript.preferences.importModuleSpecifier': 'relative',
    'editor.formatOnSave': true,
    'editor.defaultFormatter': 'esbenp.prettier-vscode',
    'emmet.includeLanguages': {
      'javascript': 'javascriptreact',
      'typescript': 'typescriptreact'
    }
  };

  const vscodeConfig = {
    'recommendations': extensions,
    'settings': settings
  };

  const extensionsPath = path.join(vscodeDir, 'extensions.json');
  const settingsPath = path.join(vscodeDir, 'settings.json');

  fs.writeFileSync(extensionsPath, JSON.stringify(extensions, null, 2));
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  logger.log(`Created VS Code configuration`);
}

async function createIntelliJConfig(projectRoot, logger) {
  const ideaDir = path.join(projectRoot, '.idea');
  if (!fs.existsSync(ideaDir)) {
    fs.mkdirSync(ideaDir, { recursive: true });
  }

  // Basic IntelliJ IDEA configuration
  const ideaConfig = {
    'nodejs_interpreter_path': 'project',
    'typescript.compiler_version': '5.0.0',
    'eslint.package': 'eslint'
  };

  const ideaConfigPath = path.join(ideaDir, 'idea.config.js');
  fs.writeFileSync(ideaConfigPath, `module.exports = ${JSON.stringify(ideaConfig, null, 2)};`);

  logger.log(`Created IntelliJ IDEA configuration`);
}

async function createWebStormConfig(projectRoot, logger) {
  // Similar to IntelliJ but with web-specific settings
  await createIntelliJConfig(projectRoot, logger);
}

/**
 * Create or update package.json scripts
 */
async function createPackageScripts(projectRoot, logger) {
  const packageJsonPath = path.join(projectRoot, 'package.json');

  let packageJson = {};
  if (fs.existsSync(packageJsonPath)) {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  }

  const scripts = {
    'dev': 'react-router dev',
    'build': 'react-router build',
    'start': 'npm run build && npm run serve',
    'test': 'vitest',
    'test:ui': 'vitest --ui',
    'test:coverage': 'vitest --coverage',
    'lint': 'eslint . --ext .ts,.tsx',
    'lint:fix': 'eslint . --ext .ts,.tsx --fix',
    'type-check': 'tsc --noEmit',
    'validate-pdf': 'node scripts/validate-pdf.js',
    'process-samples': 'node scripts/process-samples.js'
  };

  packageJson.scripts = { ...packageJson.scripts, ...scripts };
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  logger.log(`Updated package.json with module scripts`);
}

/**
 * Validate that installation was successful
 */
async function validateInstallation(configDir, logger) {
  const requiredFiles = [
    'config.yaml',
    'performance/config.json'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(configDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required file missing: ${file}`);
    }
  }

  logger.log('✅ All required configuration files created successfully');
}

// eslint-disable-next-line unicorn/prefer-module
module.exports = { install };