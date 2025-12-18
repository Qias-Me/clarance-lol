#!/usr/bin/env tsx

import { writeFileSync } from "fs";
import { join } from "path";
import { GoldenKeyBuilder } from "../src/lib/golden-key-builder";
import type { GoldenKeyInventory } from "../src/types/golden-key";

async function generateGoldenKey(): Promise<void> {
  /**
   * Generates golden-key.json file containing UI path to PDF field mappings
   */
  console.log("🔑 Building Golden Key inventory...");

  try {
    // Use the builder directly with file system paths
    const builder = new GoldenKeyBuilder();

    // Load data from file system
    const fieldIndexPath = join(__dirname, "../public/data/field-index.json");
    const sectionsBasePath = join(__dirname, "../public/data/sections");
    const sections = Array.from({ length: 30 }, (_, i) => i + 1);

    await builder.loadData(fieldIndexPath, sectionsBasePath, sections);

    // Build the inventory
    const inventory: GoldenKeyInventory = builder.build();

    // Save to public directory for client access
    const outputPath = join(__dirname, "../public/data/golden-key.json");
    writeFileSync(outputPath, JSON.stringify(inventory, null, 2));

    console.log(`✅ Golden Key generated successfully!`);
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`📊 Total fields mapped: ${inventory.totalFields}`);
    console.log(`📋 Sections mapped: ${Object.keys(inventory.bySection).length}`);

    // Print sample mappings
    const sampleKeys = Object.keys(inventory.records).slice(0, 5);
    console.log("\n🔍 Sample mappings:");
    for (const key of sampleKeys) {
      const record = inventory.records[key];
      console.log(`  ${record.uiPath} → ${record.pdf.fieldName}`);
    }

  } catch (error) {
    console.error("❌ Failed to generate Golden Key:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateGoldenKey();
}

export { generateGoldenKey };