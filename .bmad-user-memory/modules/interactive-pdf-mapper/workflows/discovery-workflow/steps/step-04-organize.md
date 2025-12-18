---
name: 'step-04-organize'
description: 'Hierarchical organization of validated fields into section/subsection/entry structure'

# Path Definitions
workflow_path: '{project-root}/.bmad-user-memory/modules/interactive-pdf-mapper/workflows/discovery-workflow'

# File References
thisStepFile: '{workflow_path}/steps/step-04-organize.md'
nextStepFile: '{workflow_path}/steps/step-05-generate.md'
workflowFile: '{workflow_path}/workflow.md'
outputFile: '{output_folder}/golden-map-{project_name}.json'
---

# Step 4: Hierarchical Organization

## STEP GOAL:

To organize all validated fields into a UI-friendly hierarchical structure (section → subsection → entry → field) with render order and CSS coordinate conversion.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- NEVER generate content without user input
- CRITICAL: Read the complete step file before taking any action
- CRITICAL: When loading next step with 'C', ensure entire file is read
- YOU ARE A FACILITATOR, not a content generator

### Role Reinforcement:

- You are a UI organization specialist
- You bring expertise in component hierarchy and render optimization
- Maintain focus on React component generation needs
- Report progress verbosely

### Step-Specific Rules:

- Focus ONLY on hierarchical organization
- FORBIDDEN to modify coordinate values
- Generate CSS coordinates from PDF coordinates
- Establish render order for tab navigation

## EXECUTION PROTOCOLS:

- Group fields by section, subsection, entry
- Calculate render order for logical tab flow
- Convert PDF coordinates to CSS coordinates
- Generate UI hints for React components

## CONTEXT BOUNDARIES:

- All validated fields from step 3
- Page dimensions from detection
- Hierarchy information from field detection
- Sections-references for structure validation (if available)

## ORGANIZATION SEQUENCE:

### 1. Analyze Field Hierarchy

Review all validated fields and extract:
- Unique sections
- Subsections within each section
- Entries within subsections (for repeating fields)
- Direct fields (no subsection/entry)

### 2. Build Section Structure

For each unique section:

```json
{
  "sectionId": "[generated-id]",
  "sectionName": "[section-name]",
  "subsections": [],
  "fields": []
}
```

#### A. Organize Subsections

For each subsection in section:
```json
{
  "subsectionId": "[generated-id]",
  "subsectionName": "[subsection-name]",
  "entries": [],
  "fields": []
}
```

#### B. Organize Entries

For repeating field groups:
```json
{
  "entryId": "[generated-id]",
  "entryName": "[entry-name]",
  "fields": []
}
```

### 3. Calculate Render Order

For each field, determine render order based on:
1. Page number (primary sort)
2. Y coordinate (top to bottom)
3. X coordinate (left to right)
4. Section/subsection grouping

Assign `renderOrder` as sequential integer starting from 1.

### 4. Convert to CSS Coordinates

For each field, calculate CSS coordinates:

```javascript
// PDF coordinates are typically in points (72 DPI)
// CSS coordinates need percentage or pixel values

cssCoordinates = {
  top: `${(field.coordinates.y / pageDimensions.height) * 100}%`,
  left: `${(field.coordinates.x / pageDimensions.width) * 100}%`,
  width: `${(field.coordinates.width / pageDimensions.width) * 100}%`,
  height: `${(field.coordinates.height / pageDimensions.height) * 100}%`
}
```

### 5. Generate UI Hints

For each field, determine UI hints:

```json
{
  "labelPosition": "[above|left|inline]",
  "groupWith": ["[related-field-ids]"]
}
```

Logic:
- `labelPosition`: Based on field type and available space
- `groupWith`: Fields in same entry or with adjacent coordinates

### 6. Progress Report (Verbose)

"**Hierarchical Organization Progress**

**Structure Created:**
- Sections: [N]
- Subsections: [N]
- Entries: [N]
- Total fields organized: [N]

**Render Order:**
- First field: [fieldId] (page [N], position [x,y])
- Last field: [fieldId] (page [N], position [x,y])

**CSS Conversion:**
- All [N] fields converted to percentage-based CSS coordinates

**UI Hints Generated:**
- Label positions assigned: [N]
- Field groupings created: [N]"

### 7. Update Output File

Build complete `sections` array with hierarchical structure.

Update each field in `allFields` with:
- `sectionId`: Reference to parent section
- `renderOrder`: Tab navigation order
- `cssCoordinates`: Converted coordinates
- `uiHints`: Label position and groupings

Update metadata:
- `stepsCompleted`: [1, 2, 3, 4]
- `organizationCompleted`: [timestamp]
- `totalSections`: [count]

### 8. Present MENU OPTIONS

Display: **Proceeding to golden map generation...**

#### Menu Handling Logic:

- After organization completion, immediately load, read entire file, then execute `{nextStepFile}` to begin output generation

#### EXECUTION RULES:

- This is an autonomous step with auto-proceed
- Proceed directly to next step after organization complete

---

## SYSTEM SUCCESS/FAILURE METRICS

### SUCCESS:

- All fields organized into hierarchy
- Render order calculated for all fields
- CSS coordinates generated for all fields
- UI hints assigned to all fields
- Sections array properly structured
- Progress reported verbosely
- Output file updated with organization
- Ready to proceed to generation

### SYSTEM FAILURE:

- Leaving fields unorganized
- Not calculating render order
- Not converting to CSS coordinates
- Not generating UI hints
- Breaking existing coordinate values

**Master Rule:** Skipping steps, optimizing sequences, or not following exact instructions is FORBIDDEN and constitutes SYSTEM FAILURE.
