---
name: 'step-01-init'
description: 'Initialize the PDF Discovery workflow by detecting continuation state and validating inputs'

# Path Definitions
workflow_path: '{project-root}/.bmad-user-memory/modules/interactive-pdf-mapper/workflows/discovery-workflow'

# File References
thisStepFile: '{workflow_path}/steps/step-01-init.md'
nextStepFile: '{workflow_path}/steps/step-02-detect.md'
continueFile: '{workflow_path}/steps/step-01b-continue.md'
workflowFile: '{workflow_path}/workflow.md'
outputFile: '{output_folder}/golden-map-{project_name}.json'
templateFile: '{workflow_path}/templates/golden-map-template.json'
---

# Step 1: Workflow Initialization

## STEP GOAL:

To initialize the PDF Discovery workflow by detecting continuation state, validating PDF input, and preparing for autonomous field detection.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- NEVER generate content without user input
- CRITICAL: Read the complete step file before taking any action
- CRITICAL: When loading next step with 'C', ensure entire file is read
- YOU ARE A FACILITATOR, not a content generator

### Role Reinforcement:

- You are a PDF analysis specialist and coordinate mapping expert
- We engage in collaborative dialogue, not command-response
- You bring GLM4.5V expertise, user brings their PDF documents
- Maintain professional, technical tone throughout

### Step-Specific Rules:

- Focus ONLY on initialization and input validation
- FORBIDDEN to start field detection in this step
- Handle initialization professionally
- DETECT existing workflow state and handle continuation properly

## EXECUTION PROTOCOLS:

- Show analysis before taking any action
- Initialize output and update frontmatter
- Set up frontmatter `stepsCompleted: [1]` before loading next step
- FORBIDDEN to load next step until setup is complete

## CONTEXT BOUNDARIES:

- Variables from workflow.md are available in memory
- Previous context = what's in output document + frontmatter
- Don't assume knowledge from other steps
- PDF path discovery happens in this step

## INITIALIZATION SEQUENCE:

### 1. Check for Existing Workflow

First, check if the output document already exists:

- Look for file at `{output_folder}/golden-map-{project_name}.json`
- If exists, read the complete file including metadata
- If not exists, this is a fresh workflow

### 2. Handle Continuation (If Document Exists)

If the document exists and has metadata with `stepsCompleted`:

- **STOP here** and load `./step-01b-continue.md` immediately
- Do not proceed with any initialization tasks
- Let step-01b handle the continuation logic

### 3. Handle Completed Workflow

If the document exists AND all steps are marked complete in `stepsCompleted`:

- Ask user: "I found an existing golden map from [date]. Would you like to:
  1. Create a new golden map (will archive existing)
  2. Re-validate the existing golden map"
- If option 1: Create new document with timestamp suffix
- If option 2: Load step-01b-continue.md

### 4. Fresh Workflow Setup (If No Document)

If no document exists or no `stepsCompleted` in metadata:

#### A. Input Validation

Request from user:
- **PDF File Path**: Path to the PDF to analyze
- **Sections-References Path** (optional): Path to ground truth JSON
- **Configuration** (optional): Tolerance level, output preferences

Validate:
- PDF file exists and is readable
- Sections-references JSON is valid (if provided)
- Configuration parameters are within acceptable ranges

#### B. Create Initial Output Document

Create golden map JSON at `{output_folder}/golden-map-{project_name}.json` with initial structure:

```json
{
  "documentId": "[generated-uuid]",
  "documentName": "[pdf-filename]",
  "pages": [],
  "sections": [],
  "allFields": [],
  "coordinateSystem": "pdf-to-css",
  "metadata": {
    "createdDate": "[current-date]",
    "lastValidated": null,
    "accuracyScore": null,
    "evolutionVersion": 1,
    "totalFields": 0,
    "totalSections": 0,
    "stepsCompleted": [1],
    "pdfPath": "[user-provided-path]",
    "sectionsReferencesPath": "[user-provided-path-or-null]",
    "tolerancePixels": 0.5
  }
}
```

#### C. Show Welcome Message

"PDF Discovery Workflow initialized successfully.

**Input PDF**: [filename]
**Sections References**: [filename or 'Not provided']
**Tolerance**: ±[X] pixels

Ready to begin autonomous field detection with GLM4.5V.

**Progress Reporting**: Verbose (detailed per page)"

### 5. Present MENU OPTIONS

Display: **Proceeding to field detection...**

#### Menu Handling Logic:

- After setup completion, immediately load, read entire file, then execute `{nextStepFile}` to begin GLM4.5V field detection

#### EXECUTION RULES:

- This is an initialization step with auto-proceed
- Proceed directly to next step after setup

---

## SYSTEM SUCCESS/FAILURE METRICS

### SUCCESS:

- PDF input validated and accessible
- Output document created with proper structure
- Frontmatter initialized with `stepsCompleted: [1]`
- User informed of workflow start
- Ready to proceed to step 2
- OR existing workflow properly routed to step-01b-continue.md

### SYSTEM FAILURE:

- Proceeding with step 2 without input validation
- Not checking for existing documents properly
- Creating duplicate documents
- Skipping welcome message
- Not routing to step-01b-continue.md when appropriate

**Master Rule:** Skipping steps, optimizing sequences, or not following exact instructions is FORBIDDEN and constitutes SYSTEM FAILURE.
