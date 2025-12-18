---
name: 'step-06-cache'
description: 'Cache golden map in sidecar for future use and performance optimization'

# Path Definitions
workflow_path: '{project-root}/.bmad-user-memory/modules/interactive-pdf-mapper/workflows/discovery-workflow'

# File References
thisStepFile: '{workflow_path}/steps/step-06-cache.md'
workflowFile: '{workflow_path}/workflow.md'
outputFile: '{output_folder}/golden-map-{project_name}.json'
qaReportFile: '{output_folder}/qa-report-{project_name}.md'
metricsFile: '{output_folder}/metrics-{project_name}.json'

# Sidecar References
sidecarPath: '{agent_sidecar_folder}/golden-map-cache'
---

# Step 6: Cache Management (Final Step)

## STEP GOAL:

To cache the validated golden map in the sidecar storage for future use, enabling 99.8% performance improvement on subsequent accesses.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- NEVER generate content without user input
- CRITICAL: Read the complete step file before taking any action
- YOU ARE A FACILITATOR, not a content generator

### Role Reinforcement:

- You are a cache optimization specialist
- You bring expertise in performance optimization
- Ensure cache integrity and accessibility
- Report completion status clearly

### Step-Specific Rules:

- Focus ONLY on caching operations
- FORBIDDEN to modify golden map content
- Ensure cache is properly indexed
- This is the FINAL step - mark workflow complete

## EXECUTION PROTOCOLS:

- Store golden map in sidecar cache
- Create cache index entry
- Verify cache integrity
- Mark workflow as complete

## CONTEXT BOUNDARIES:

- Complete golden map from step 5
- All output files generated
- Sidecar storage location from config
- This is the final workflow step

## CACHING SEQUENCE:

### 1. Prepare Cache Entry

Create cache metadata:
```json
{
  "cacheId": "[generated-uuid]",
  "documentId": "[from-golden-map]",
  "documentName": "[filename]",
  "documentHash": "[md5-of-pdf]",
  "cachedDate": "[timestamp]",
  "goldenMapPath": "[output-file-path]",
  "qaReportPath": "[qa-report-path]",
  "metricsPath": "[metrics-path]",
  "fieldCount": [n],
  "sectionCount": [n],
  "accuracyScore": [n],
  "evolutionVersion": 1
}
```

### 2. Store in Sidecar

Create or update sidecar cache:

#### A. Ensure Cache Directory Exists
Create `{sidecarPath}` if not exists.

#### B. Store Cache Index
Update `{sidecarPath}/cache-index.json`:
```json
{
  "lastUpdated": "[timestamp]",
  "entries": [
    {
      "cacheId": "[id]",
      "documentHash": "[hash]",
      "documentName": "[name]",
      "cachedDate": "[date]",
      "goldenMapPath": "[path]"
    }
  ]
}
```

#### C. Copy Golden Map to Cache
Store copy at `{sidecarPath}/[documentHash].json` for fast retrieval.

### 3. Verify Cache Integrity

Validate:
- Cache index is valid JSON
- Golden map copy matches original
- All paths are accessible
- Cache entry is retrievable

### 4. Update Output File (Final)

Update metadata to mark workflow complete:
```json
{
  "metadata": {
    "stepsCompleted": [1, 2, 3, 4, 5, 6],
    "workflowComplete": true,
    "completedDate": "[timestamp]",
    "cacheId": "[cache-id]",
    "cachePath": "[sidecar-path]"
  }
}
```

### 5. Workflow Completion Summary

"**PDF Discovery Workflow Complete!**

**Golden Map Generated Successfully**

**Document**: [filename]
**Total Fields**: [N]
**Total Sections**: [N]
**Overall Accuracy**: [X]%

**Output Files:**
1. Golden Map: `[path]`
2. QA Report: `[path]`
3. Performance Metrics: `[path]`

**Cache Status:**
- Cached: YES
- Cache ID: [id]
- Expected performance boost: 99.8%

**Quality Summary:**
- Field Detection: [X]% accuracy
- Coordinate Precision: ±[X] pixels
- Processing Time: [X]s total

**Next Steps:**
1. Use golden map with React Generation Agent
2. Run Interactive Workflow for user form editing
3. Monitor Evolution Workflow for GLM4.5V improvements

---
*Workflow completed successfully. Golden map is ready for UI generation.*"

### 6. Present FINAL MENU

Display: "**Workflow Complete!** [R] Run Again | [E] Exit"

#### Menu Handling Logic:

- IF R: Reset workflow and load step-01-init.md
- IF E: End workflow session gracefully
- IF Any other comments: respond and redisplay menu

#### EXECUTION RULES:

- This is the FINAL step
- Workflow is complete
- User chooses next action

---

## SYSTEM SUCCESS/FAILURE METRICS

### SUCCESS:

- Golden map cached in sidecar
- Cache index updated
- Cache integrity verified
- Workflow marked complete
- Completion summary displayed
- All output files accessible

### SYSTEM FAILURE:

- Not caching golden map
- Cache corruption
- Not marking workflow complete
- Missing completion summary

**Master Rule:** This is the final step. Workflow must be marked complete with all outputs accessible.
