---
name: 'step-01b-continue'
description: 'Handle workflow continuation from previous session for large PDF processing'

# Path Definitions
workflow_path: '{project-root}/.bmad-user-memory/modules/interactive-pdf-mapper/workflows/discovery-workflow'

# File References
thisStepFile: '{workflow_path}/steps/step-01b-continue.md'
workflowFile: '{workflow_path}/workflow.md'
outputFile: '{output_folder}/golden-map-{project_name}.json'
---

# Step 1B: Workflow Continuation

## STEP GOAL:

To resume the PDF Discovery workflow from where it was left off, ensuring smooth continuation without loss of context or progress for large PDF processing.

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
- Maintain continuity with previous sessions

### Step-Specific Rules:

- Focus ONLY on analyzing and resuming workflow state
- FORBIDDEN to modify content completed in previous steps
- Maintain continuity with previous sessions
- DETECT exact continuation point from metadata of incomplete file

## EXECUTION PROTOCOLS:

- Show your analysis of current state before taking action
- Keep existing metadata `stepsCompleted` values intact
- Review the fields already detected in output file
- FORBIDDEN to modify fields that were validated in previous steps
- Update metadata with continuation timestamp when resuming

## CONTEXT BOUNDARIES:

- Current golden map document is already loaded
- Previous context = complete structure + existing metadata
- Fields already gathered in previous sessions
- Last completed step = last value in `stepsCompleted` array from metadata

## CONTINUATION SEQUENCE:

### 1. Analyze Current State

Review the metadata of output file to understand:

- `stepsCompleted`: Which steps are already done (the rightmost value is the last step completed)
- `createdDate`: Original workflow start date
- `pdfPath`: PDF being processed
- `totalFields`: Fields detected so far
- `totalSections`: Sections organized so far

Example: If `stepsCompleted: [1, 2, 3, 4]`, then step 4 was the last completed step.

### 2. Read All Completed Step Files

For each step number in `stepsCompleted` array (excluding step 1, which is init):

1. **Construct step filename**: `step-[N]-[name].md`
2. **Read the complete step file** to understand:
   - What that step accomplished
   - What the next step should be (from nextStep references)
   - Any specific context or decisions made

### 3. Review Previous Output

Read the complete output file to understand:

- Fields detected so far
- Sections organized
- Validation status
- Current state of the golden map

### 4. Determine Next Step

Based on the last completed step file:

1. **Find the nextStep reference** in the last completed step file
2. **Validate the file exists** at the referenced path
3. **Confirm the workflow is incomplete** (not all steps finished)

Step mapping:
- After step 1: → step-02-detect.md
- After step 2: → step-03-validate.md
- After step 3: → step-04-organize.md
- After step 4: → step-05-generate.md
- After step 5: → step-06-cache.md

### 5. Welcome Back Dialog

Present a warm, context-aware welcome:

"Welcome back! I see we've completed [X] steps of your PDF Discovery workflow.

**PDF**: [filename]
**Progress**: [X]/6 steps complete
**Fields detected**: [N] fields
**Last activity**: [date]

We last worked on [brief description of last step].

Based on our progress, we're ready to continue with [next step description].

Are you ready to continue where we left off?"

### 6. Validate Continuation Intent

Ask confirmation questions if needed:

"Has anything changed since our last session that might affect our approach?"
"Would you like to review what we've accomplished so far?"

### 7. Present MENU OPTIONS

Display: "**Resuming workflow - Select an Option:** [C] Continue to [Next Step Name]"

#### EXECUTION RULES:

- ALWAYS halt and wait for user input after presenting menu
- ONLY proceed to next step when user selects 'C'
- User can chat or ask questions - always respond and then redisplay menu

#### Menu Handling Logic:

- IF C:
  1. Update metadata: add `lastContinued: [current date]`
  2. Load, read entire file, then execute the appropriate next step file (determined in section 4)
- IF Any other comments or queries: help user respond then redisplay menu

## CRITICAL STEP COMPLETION NOTE

ONLY WHEN C is selected and continuation analysis is complete, will you then:

1. Update metadata in output file with continuation timestamp
2. Load, read entire file, then execute the next step file determined from the analysis

Do NOT modify any other content in the output document during this continuation step.

---

## SYSTEM SUCCESS/FAILURE METRICS

### SUCCESS:

- Correctly identified last completed step from `stepsCompleted` array
- Read and understood all previous step contexts
- User confirmed readiness to continue
- Metadata updated with continuation timestamp
- Workflow resumed at appropriate next step

### SYSTEM FAILURE:

- Skipping analysis of existing state
- Modifying content from previous steps
- Loading wrong next step file
- Not updating metadata with continuation info
- Proceeding without user confirmation

**Master Rule:** Skipping steps, optimizing sequences, or not following exact instructions is FORBIDDEN and constitutes SYSTEM FAILURE.
