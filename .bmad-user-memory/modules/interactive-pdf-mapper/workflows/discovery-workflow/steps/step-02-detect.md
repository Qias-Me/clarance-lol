---
name: 'step-02-detect'
description: 'Execute GLM4.5V field detection with sections-references integration'

# Path Definitions
workflow_path: '{project-root}/.bmad-user-memory/modules/interactive-pdf-mapper/workflows/discovery-workflow'

# File References
thisStepFile: '{workflow_path}/steps/step-02-detect.md'
nextStepFile: '{workflow_path}/steps/step-03-validate.md'
workflowFile: '{workflow_path}/workflow.md'
outputFile: '{output_folder}/golden-map-{project_name}.json'

# Data References
retryConfig: '{workflow_path}/data/retry-parameters.json'
---

# Step 2: GLM4.5V Field Detection

## STEP GOAL:

To analyze the PDF using GLM4.5V vision capabilities to detect all form fields, extracting coordinates, field types, and hierarchical information (section/subsection/entry).

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- NEVER generate content without user input
- CRITICAL: Read the complete step file before taking any action
- CRITICAL: When loading next step with 'C', ensure entire file is read
- YOU ARE A FACILITATOR, not a content generator

### Role Reinforcement:

- You are a PDF analysis specialist with GLM4.5V expertise
- You bring vision analysis expertise, user brings their PDF documents
- Maintain professional, technical tone throughout
- Report progress verbosely (per page)

### Step-Specific Rules:

- Focus ONLY on field detection, not validation
- FORBIDDEN to skip pages or optimize detection order
- Process pages sequentially for checkpoint support
- Integrate with sections-references if provided

## EXECUTION PROTOCOLS:

- Report progress after each page processed
- Save checkpoint after each page (for continuation support)
- Update metadata with detection progress
- FORBIDDEN to proceed to validation until all pages processed

## CONTEXT BOUNDARIES:

- PDF path from step 1 initialization
- Sections-references JSON (if provided)
- Output file structure initialized
- Detection parameters from configuration

## DETECTION SEQUENCE:

### 1. Load Detection Configuration

Read from output file metadata:
- `pdfPath`: PDF to analyze
- `sectionsReferencesPath`: Ground truth (if available)
- `tolerancePixels`: Coordinate tolerance

Load retry configuration from `{retryConfig}` if exists.

### 2. Initialize Page Processing

For each page in the PDF:

#### A. Page Analysis with GLM4.5V

Send page image to GLM4.5V with prompt:
"Analyze this PDF page and identify all form fields. For each field, provide:
- Field type (text-input, signature, date, checkbox)
- Bounding box coordinates (x, y, width, height)
- Field label (if visible)
- Section/subsection context from surrounding text"

#### B. Extract Field Data

For each detected field, create raw field object:
```json
{
  "fieldId": "[generated-uuid]",
  "fieldType": "[detected-type]",
  "coordinates": {
    "x": [x],
    "y": [y],
    "width": [w],
    "height": [h]
  },
  "hierarchy": {
    "section": "[detected-section]",
    "subsection": "[detected-subsection]",
    "entry": "[detected-entry]",
    "fieldLabel": "[detected-label]"
  },
  "pageNumber": [page],
  "confidenceScore": [glm-confidence],
  "validationStatus": "pending"
}
```

#### C. Sections-References Integration

If sections-references JSON is provided:
- Cross-reference detected fields with ground truth
- Enhance hierarchy classification
- Flag discrepancies for validation step

#### D. Progress Report (Verbose)

After each page, output:
"**Page [N]/[Total] Complete**
- Fields detected: [count]
- Field types: [breakdown]
- Sections identified: [list]
- Confidence range: [min]-[max]%
- Processing time: [X]ms"

#### E. Checkpoint Save

Update output file with:
- New fields added to `allFields` array
- Page added to `pages` array
- Metadata updated: `totalFields`, `lastProcessedPage`
- `stepsCompleted` remains [1] until all pages done

### 3. Detection Summary

After all pages processed:

"**Field Detection Complete**

**Summary:**
- Total pages: [N]
- Total fields detected: [count]
- Field type breakdown:
  - Text inputs: [N]
  - Signatures: [N]
  - Dates: [N]
  - Checkboxes: [N]
- Sections identified: [N]
- Average confidence: [X]%
- Fields requiring validation: [count]

Ready to proceed to coordinate validation."

### 4. Update Output File

- Add all detected fields to `allFields` array
- Update metadata:
  - `totalFields`: [count]
  - `stepsCompleted`: [1, 2]
  - `detectionCompleted`: [timestamp]

### 5. Present MENU OPTIONS

Display: **Proceeding to coordinate validation...**

#### Menu Handling Logic:

- After detection completion, immediately load, read entire file, then execute `{nextStepFile}` to begin validation

#### EXECUTION RULES:

- This is an autonomous step with auto-proceed
- Proceed directly to next step after detection complete

---

## SYSTEM SUCCESS/FAILURE METRICS

### SUCCESS:

- All PDF pages processed
- Fields detected with coordinates and hierarchy
- Sections-references integrated (if provided)
- Progress reported per page (verbose)
- Checkpoints saved for continuation support
- Output file updated with all detected fields
- Ready to proceed to validation

### SYSTEM FAILURE:

- Skipping pages during detection
- Not reporting progress per page
- Not saving checkpoints
- Proceeding without completing all pages
- Not integrating sections-references when provided

**Master Rule:** Skipping steps, optimizing sequences, or not following exact instructions is FORBIDDEN and constitutes SYSTEM FAILURE.
