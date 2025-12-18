const fs = require("fs").promises;
const path = require("path");

const PDF_TYPE_MAP = {
  2: "Checkbox",
  3: "Dropdown",
  5: "Radio",
  7: "Text",
};

async function loadFieldIndex(filePath) {
  const data = await fs.readFile(filePath, "utf-8");
  return JSON.parse(data);
}

async function loadSectionIndex(filePath) {
  const data = await fs.readFile(filePath, "utf-8");
  return JSON.parse(data);
}

async function loadAllSectionIndexes(basePath, sectionNumbers) {
  const indexes = {};

  for (const num of sectionNumbers) {
    const sectionPath = path.join(basePath, `section-${num}`, "index.json");
    try {
      const index = await loadSectionIndex(sectionPath);
      indexes[num.toString()] = index;
    } catch (error) {
      console.warn(`Failed to load section ${num}:`, error.message);
    }
  }

  return indexes;
}

function generateFingerprint(page, rect, fieldName) {
  const crypto = require("crypto");
  const data = `${page}:${rect.x.toFixed(2)},${rect.y.toFixed(2)},${rect.width.toFixed(2)},${rect.height.toFixed(2)}:${fieldName}`;
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
}

function generateUIPath(section, subsection, entry, label) {
  const parts = [`section${section}`];

  if (subsection) {
    parts.push(subsection.replace(/\./g, "_"));
  }

  if (entry !== null) {
    parts.push(`entry${entry}`);
  }

  const sanitizedLabel = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  parts.push(sanitizedLabel);

  return parts.join(".");
}

function findFieldLogicalLocation(fieldId, fieldIndex, sectionIndexes) {
  const field = fieldIndex[fieldId];
  if (!field) {
    return { section: "unknown", subsection: null, entry: null };
  }

  const section = field.section;
  const sectionIndex = sectionIndexes[section];

  if (!sectionIndex) {
    return { section, subsection: null, entry: null };
  }

  for (const [subsectionKey, subsection] of Object.entries(
    sectionIndex.subsections
  )) {
    for (const [entryKey, entryData] of Object.entries(subsection.entries)) {
      if (entryData.fieldIds.includes(fieldId)) {
        return {
          section,
          subsection: subsectionKey,
          entry: parseInt(entryKey, 10),
        };
      }
    }
  }

  return { section, subsection: null, entry: null };
}

function groupWidgetsByField(fieldIndex) {
  const fieldGroups = new Map();

  for (const [fieldId, field] of Object.entries(fieldIndex)) {
    const fieldName = field.name;

    if (!fieldGroups.has(fieldName)) {
      fieldGroups.set(fieldName, {
        fieldName,
        widgetIds: [],
        rects: [],
        page: field.page,
        type: field.type,
        label: field.label,
      });
    }

    const group = fieldGroups.get(fieldName);
    group.widgetIds.push(fieldId);
    group.rects.push(field.rect);
  }

  return fieldGroups;
}

async function buildGoldenKeyInventory(
  fieldIndexPath,
  sectionsBasePath,
  sectionNumbers
) {
  console.log("Loading field index...");
  const fieldIndex = await loadFieldIndex(fieldIndexPath);

  console.log("Loading section indexes...");
  const sectionIndexes = await loadAllSectionIndexes(
    sectionsBasePath,
    sectionNumbers
  );

  console.log("Building Golden Key inventory...");
  const records = {};
  const bySection = {};
  const bySubsection = {};

  const fieldGroups = groupWidgetsByField(fieldIndex);

  let processedCount = 0;
  for (const [fieldName, group] of fieldGroups.entries()) {
    const primaryFieldId = group.widgetIds[0];
    const field = fieldIndex[primaryFieldId];

    const logical = findFieldLogicalLocation(
      primaryFieldId,
      fieldIndex,
      sectionIndexes
    );

    const uiPath = generateUIPath(
      logical.section,
      logical.subsection,
      logical.entry,
      field.label
    );

    const fingerprint = generateFingerprint(field.page, field.rect, fieldName);

    const record = {
      uiPath,
      pdf: {
        fieldName,
        fieldId: primaryFieldId,
        widgetIds: group.widgetIds,
        pageNumber: field.page,
        rects: group.rects,
        type: PDF_TYPE_MAP[field.type] || "Text",
        exportValues: undefined,
      },
      logical,
      label: field.label,
      fingerprint,
    };

    records[fingerprint] = record;

    if (!bySection[logical.section]) {
      bySection[logical.section] = [];
    }
    bySection[logical.section].push(fingerprint);

    if (logical.subsection) {
      const subsectionKey = `${logical.section}.${logical.subsection}`;
      if (!bySubsection[subsectionKey]) {
        bySubsection[subsectionKey] = [];
      }
      bySubsection[subsectionKey].push(fingerprint);
    }

    processedCount++;
    if (processedCount % 100 === 0) {
      console.log(`Processed ${processedCount} fields...`);
    }
  }

  console.log(`Total fields processed: ${processedCount}`);

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    totalFields: Object.keys(records).length,
    records,
    bySection,
    bySubsection,
  };
}

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const fieldIndexPath = path.join(
    projectRoot,
    "..",
    "clearance-omg",
    "meta",
    "field-index.json"
  );
  const sectionsBasePath = path.join(
    projectRoot,
    "..",
    "clearance-omg",
    "sections"
  );
  const outputPath = path.join(projectRoot, "public", "data", "golden-key.json");

  const sectionNumbers = Array.from({ length: 30 }, (_, i) => i + 1);

  console.log("Building Golden Key inventory...");
  console.log(`Field index: ${fieldIndexPath}`);
  console.log(`Sections base: ${sectionsBasePath}`);
  console.log(`Output: ${outputPath}`);

  const inventory = await buildGoldenKeyInventory(
    fieldIndexPath,
    sectionsBasePath,
    sectionNumbers
  );

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(inventory, null, 2));

  console.log(`Golden Key inventory written to ${outputPath}`);
  console.log(`Total fields: ${inventory.totalFields}`);
  console.log(`Sections: ${Object.keys(inventory.bySection).length}`);
  console.log(`Subsections: ${Object.keys(inventory.bySubsection).length}`);
}

main().catch((error) => {
  console.error("Error building Golden Key inventory:", error);
  process.exit(1);
});
