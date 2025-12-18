---
name: 'step-03-validate'
description: 'Coordinate validation with ±0.5 pixel tolerance and auto-retry logic'

# Path Definitions
workflow_path: '{project-root}/.bmad-user-memory/modules/interactive-pdf-mapper/workflows/discovery-workflow'

# File References
thisStepFile: '{workflow_path}/steps/step-03-validate.md'
nextStepFile: '{workflow_path}/steps/step-04-organize.md'
retryStepFile: '{workflow_path}/steps/step-02-detect.md'
workflowFile: '{workflow_path}/workflow.md'
outputFile: '{output_folder}/golden-map-{project_name}.json'

# Data References
retryConfig: '{workflow_path}/data/retry-parameters.json'
---

# Step 3: Coordinate Validation

## STEP GOAL:

To validate all detected field coordinates against the ±0.5 pixel tolerance requirement, using GLM4.5V self-validation and auto-retry logic for failed fields.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- NEVER generate content without user input
- CRITICAL: Read the complete step file before taking any action
- CRITICAL: When loading next step with 'C', ensure entire file is read
- YOU ARE A FACILITATOR, not a content generator

### Role Reinforcement:

- You are a coordinate validation specialist with zero-hallucination protocols
- You bring precision validation expertise
- Maintain evidence-based validation throughout
- Report progress verbosely (per field batch)

### Step-Specific Rules:

- Focus ONLY on coordinate validation
- FORBIDDEN to modify field hierarchy in this step
- Auto-retry failed fields up to 7 times
- Skip persistently failing fields for next iteration

## EXECUTION PROTOCOLS:

- Validate coordinates against ±0.5 pixel tolerance
- Auto-retry with adjusted parameters on failure
- Maximum 7 retry attempts per field
- Skip and log fields that fail after 7 attempts
- Update validation status for each field

## CONTEXT BOUNDARIES:

- All detected fields from step 2
- Tolerance setting from configuration
- Retry parameters from data file
- Sections-references for cross-validation (if available)

## VALIDATION SEQUENCE:

### 1. Load Validation Configuration

Read from output file and retry config:
- `tolerancePixels`: Default ±0.5
- `maxRetryAttempts`: 7
- `retryParameterAdjustments`: Scaling factors for retry

### 2. Initialize Validation Tracking

Create validation tracking structure:
```json
{
  "totalFields": [count],
  "validated": 0,
  "passed": 0,
  "failed": 0,
  "skipped": 0,
  "retryPool": []
}
```

### 3. Validate Each Field

For each field in `allFields`:

#### A. GLM4.5V Self-Validation

Send field coordinates back to GLM4.5V with validation prompt:
"Verify these coordinates for the field at position (x, y, w, h) on page [N].
Measure the actual field boundaries and report:
- Measured coordinates
- Difference from provided coordinates
- Pass/Fail based on ±[tolerance] pixel tolerance"

#### B. Evaluate Validation Result

```
IF difference <= tolerance:
  - Mark field as "validated"
  - Set validationStatus: "passed"
  - Record evidence

ELSE IF retryCount < 7:
  - Increment retryCount
  - Adjust detection parameters
  - Re-detect field with GLM4.5V
  - Return to validation

ELSE (retryCount >= 7):
  - Mark field as "skipped"
  - Add to retryPool for next iteration
  - Log failure reason
```

#### C. Progress Report (Verbose)

After each batch of 10 fields:
"**Validation Progress: [N]/[Total]**
- Passed: [count] ([%])
- Failed (retrying): [count]
- Skipped (max retries): [count]
- Current accuracy: [%]"

### 4. Handle Retry Pool

For fields in retry pool:
- Log field details and failure reasons
- Store for potential future iteration with smaller pool
- Note: Smaller pool may improve detection accuracy

"**Retry Pool Summary**
- Fields skipped after 7 attempts: [count]
- These fields will be available for re-processing in future iterations
- Reason: Smaller field pool may improve GLM4.5V focus"

### 5. Validation Summary

After all fields processed:

"**Coordinate Validation Complete**

**Results:**
- Total fields: [N]
- Passed validation: [N] ([%])
- Skipped (retry pool): [N] ([%])
- Overall accuracy: [%]

**Tolerance**: ±[X] pixels
**Max retries used**: [N]

**Quality Assessment:**
- [PASS/WARN/FAIL based on 99.9% target]

Ready to proceed to hierarchical organization."

### 6. Update Output File

For each field, update:
- `validationStatus`: "passed" | "skipped"
- `validationEvidence`: [measurement data]
- `retryCount`: [attempts used]

Update metadata:
- `stepsCompleted`: [1, 2, 3]
- `validationCompleted`: [timestamp]
- `accuracyScore`: [percentage]
- `retryPoolCount`: [count]

### 7. Present MENU OPTIONS

Display: **Proceeding to hierarchical organization...**

#### Menu Handling Logic:

- After validation completion, immediately load, read entire file, then execute `{nextStepFile}` to begin organization

#### EXECUTION RULES:

- This is an autonomous step with auto-proceed
- Proceed directly to next step after validation complete

---

## SYSTEM SUCCESS/FAILURE METRICS

### SUCCESS:

- All fields validated or appropriately skipped
- Retry logic executed correctly (max 7 attempts)
- Skipped fields logged with reasons
- Accuracy score calculated
- Progress reported verbosely
- Output file updated with validation results
- Ready to proceed to organization

### SYSTEM FAILURE:

- Skipping validation for any field
- Not implementing retry logic
- Exceeding 7 retry attempts
- Not logging skipped fields
- Proceeding without completing validation pass

**Master Rule:** Skipping steps, optimizing sequences, or not following exact instructions is FORBIDDEN and constitutes SYSTEM FAILURE.
