---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
workflowName: discovery-workflow
targetLocation: .bmad-user-memory/modules/interactive-pdf-mapper/workflows/discovery-workflow
createdBy: TJ
createdDate: 2025-12-14
completionDate: 2025-12-14
status: COMPLETE
---

# Workflow Creation Plan: discovery-workflow

## Initial Project Context

- **Module:** Interactive PDF Mapper (custom module)
- **Target Location:** .bmad-user-memory/modules/interactive-pdf-mapper/workflows/discovery-workflow
- **Created:** December 14, 2025
- **Created By:** TJ

## Blueprint Summary (from README.md)

### Purpose
Initial PDF analysis and golden map creation using GLM4.5V vision detection and collaborative validation.

### Process Overview
1. PDF ingestion and preprocessing
2. GLM4.5V field detection with sections-references integration
3. Coordinate validation with ±0.5 pixel tolerance
4. Golden map generation and caching
5. Quality assurance and approval

### Key Agents Involved
- **PDF Vision Agent**: Primary field detection and analysis
- **Coordinate Validation Agent**: Quality assurance and validation
- **Golden Map Cache Agent**: Performance optimization and caching

### Expected Outputs
- Validated golden map with field coordinates
- Quality assurance report
- Performance metrics
- Cache optimization recommendations

### Success Criteria
- Field detection accuracy: 99.9%
- Coordinate precision: ±0.5 pixels
- Processing time: <5 seconds per page
- Cache hit rate improvement: >99.8%

---

## Requirements Gathering (Step 2)

### Workflow Context
- **Primary User:** Developers integrating the system
- **Trigger:** Request to re-analyze an existing PDF
- **Interaction Level:** Mostly autonomous (upload PDF → get golden map)

### Workflow Classification
- **Type:** Autonomous Workflow
- **Pattern:** Linear with validation checkpoints
- **Human Intervention:** Minimal - primarily for error cases

### Process Flow (from Blueprint)
1. PDF ingestion and preprocessing
2. GLM4.5V field detection with sections-references integration
3. Coordinate validation with ±0.5 pixel tolerance
4. Golden map generation and caching
5. Quality assurance and approval

### Key Agents
- **PDF Vision Agent**: Primary field detection and analysis
- **Coordinate Validation Agent**: Quality assurance and validation
- **Golden Map Cache Agent**: Performance optimization and caching

### Expected Inputs
- PDF file for analysis
- Sections-references JSON (ground truth data)
- Configuration parameters (tolerance levels, etc.)

### Expected Outputs
- Validated golden map with field coordinates
- Quality assurance report
- Performance metrics
- Cache optimization recommendations

### Success Criteria
- Field detection accuracy: 99.9%
- Coordinate precision: ±0.5 pixels
- Processing time: <5 seconds per page
- Cache hit rate improvement: >99.8%

---

## Tools & Configuration (Step 3)

### Core BMAD Tools
- **Party-Mode**: Excluded - Autonomous workflow, no collaborative ideation needed
- **Advanced Elicitation**: Excluded - No human quality gates in autonomous flow
- **Brainstorming**: Excluded - No creative exploration phase

### LLM Features
- **Web-Browsing**: Excluded - All data is local (PDF + sections-references)
- **File I/O**: ✅ Included - Read PDF files, write golden map JSON, save validation reports
- **Sub-Agents**: ✅ Included - Coordinate PDF Vision Agent, Validation Agent, and Cache Agent
- **Sub-Processes**: Excluded - Sub-Agents covers parallel coordination needs

### Memory Systems
- **Sidecar File**: ✅ Included - Persist golden map cache and session state between runs
- **Vector Database**: Excluded - Sidecar file sufficient for golden map caching

### External Integrations
- None required - All operations are local

### Installation Requirements
- **None** - All selected tools are built-in, no installation needed
- **User Installation Preference**: N/A

---

## Plan Review (Step 4)

### Review Status: ✅ APPROVED

### Refinements Added:
- **UI Mapping Requirement**: Golden map fields must be organized with UI rendering in mind - including logical groupings, render order, pre-converted CSS coordinates, and UI hints for the React Generation Agent.

### Enhanced Golden Map Field Structure:
```typescript
interface GoldenMapField {
  // Core identification
  fieldId: string;
  fieldType: 'text-input' | 'signature' | 'date' | 'checkbox';

  // PDF coordinates
  coordinates: { x: number; y: number; width: number; height: number };

  // UI-friendly organization (NEW)
  pageNumber: number;
  sectionId: string;           // Logical grouping
  renderOrder: number;         // Tab/focus order
  cssCoordinates: {            // Pre-converted for React
    top: string;
    left: string;
    width: string;
    height: string;
  };
  uiHints: {
    labelPosition?: 'above' | 'left' | 'inline';
    groupWith?: string[];      // Related fields
  };

  // Validation data
  confidenceScore: number;
  sectionClassification: string;
}
```

### Output Documents Confirmed:
1. **Golden Map JSON** - Primary output with UI-friendly field coordinates
2. **Quality Assurance Report** - Validation results
3. **Performance Metrics** - Processing statistics

---

## Output Format Design (Step 5)

### Format Type: Strict Template

### Output Requirements
- **Document type**: Golden Map JSON (primary), QA Report, Performance Metrics
- **File format**: JSON (.json)
- **Frequency**: Single output per PDF analysis

### Golden Map Field Schema

```typescript
interface GoldenMapField {
  // Core identification
  fieldId: string;
  fieldType: 'text-input' | 'signature' | 'date' | 'checkbox';

  // PDF coordinates (original)
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // HIERARCHICAL ORGANIZATION
  hierarchy: {
    section: string;           // e.g., "Section 13"
    subsection?: string;       // e.g., "13.A - Personal Information"
    entry?: string;            // e.g., "Entry 1" (for repeating fields)
    fieldLabel?: string;       // Human-readable label from PDF
  };

  // UI-friendly organization
  pageNumber: number;
  sectionId: string;           // Logical grouping ID
  renderOrder: number;         // Tab/focus order
  cssCoordinates: {            // Pre-converted for React
    top: string;
    left: string;
    width: string;
    height: string;
  };
  uiHints: {
    labelPosition?: 'above' | 'left' | 'inline';
    groupWith?: string[];      // Related fields
  };

  // Validation data
  confidenceScore: number;
  sectionClassification: string;
}
```

### Golden Map Document Schema

```typescript
interface GoldenMap {
  documentId: string;
  documentName: string;

  // Page information
  pages: {
    pageNumber: number;
    dimensions: { width: number; height: number };
  }[];

  // Hierarchical field organization
  sections: {
    sectionId: string;
    sectionName: string;       // e.g., "Section 13"
    subsections?: {
      subsectionId: string;
      subsectionName: string;  // e.g., "13.A - Personal Information"
      entries?: {
        entryId: string;
        entryName: string;     // e.g., "Entry 1"
        fields: GoldenMapField[];
      }[];
      fields?: GoldenMapField[];  // Direct fields (no entries)
    }[];
    fields?: GoldenMapField[];    // Direct fields (no subsections)
  }[];

  // Flat field list (for quick access)
  allFields: GoldenMapField[];

  // Metadata
  coordinateSystem: 'pdf-to-css';
  metadata: {
    createdDate: string;
    lastValidated: string;
    accuracyScore: number;
    evolutionVersion: number;
    totalFields: number;
    totalSections: number;
  };
}
```

### Template Information
- **Template source**: Created collaboratively
- **Schema validation**: TypeScript interfaces
- **Hierarchical organization**: Section → Subsection → Entry → Field

### Special Considerations
- UI Mapping: Fields organized for easy React component generation
- Dual access: Both hierarchical (sections[]) and flat (allFields[]) access patterns
- Coordinate systems: Both PDF and CSS coordinates included

---

## Workflow Step Design (Step 6)

### Step Structure (6 Steps)

| Step | File | Purpose | Type |
|------|------|---------|------|
| 1 | `step-01-init.md` | Initialize workflow, load PDF, validate inputs, check for continuation | Required |
| 1b | `step-01b-continue.md` | Resume from checkpoint (for large PDFs 100+ pages) | Conditional |
| 2 | `step-02-detect.md` | GLM4.5V field detection with sections-references integration | Required |
| 3 | `step-03-validate.md` | Coordinate validation (±0.5 pixel tolerance) with auto-retry | Required |
| 4 | `step-04-organize.md` | Hierarchical organization (section/subsection/entry) | Required |
| 5 | `step-05-generate.md` | Generate Golden Map JSON + QA Report + Metrics | Required |
| 6 | `step-06-cache.md` | Cache golden map in sidecar for future use | Optional |

### Continuation Support
- **Enabled**: Yes (for large PDFs 100+ pages)
- **Checkpoint**: After each page processed
- **Resume**: Via step-01b-continue.md

### Retry Logic
- **Max attempts**: 7 per field
- **Strategy**: Auto-retry with adjusted parameters
- **On failure**: Skip field, add to "retry pool" for next iteration
- **Rationale**: Smaller pool in next iteration may help detection

### Interaction Pattern
- **Type**: Autonomous workflow
- **User interaction**: Minimal (provide PDF path + config at init)
- **Progress reporting**: Verbose (detailed progress per page)

### Data Flow
```
PDF + Config → GLM4.5V Detection → Raw Fields
                    ↓
Sections-References → Validation (±0.5px) ←─┐
                    ↓                        │ retry (max 7)
              Organize Hierarchy ────────────┘
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
Golden Map      QA Report       Metrics
  JSON
```

### File Structure
```
discovery-workflow/
├── workflow.md                    # Main workflow config
├── steps/
│   ├── step-01-init.md           # Initialize + continuation check
│   ├── step-01b-continue.md      # Resume from checkpoint
│   ├── step-02-detect.md         # GLM4.5V field detection
│   ├── step-03-validate.md       # Coordinate validation + retry
│   ├── step-04-organize.md       # Hierarchical organization
│   ├── step-05-generate.md       # Output generation
│   └── step-06-cache.md          # Cache management
├── templates/
│   └── golden-map-template.json  # Output schema template
└── data/
    └── retry-parameters.json     # Retry configuration
```

### AI Role Definition
- **Expertise**: PDF analysis, coordinate systems, GLM4.5V integration
- **Communication**: Technical, progress-focused, verbose reporting
- **Tone**: Professional, informative
- **Collaboration level**: Autonomous with status updates

### Validation & Error Handling
- **Field validation**: ±0.5 pixel coordinate tolerance
- **Retry on failure**: Up to 7 attempts with parameter adjustment
- **Skip strategy**: Failed fields added to retry pool
- **Success criteria**: 99.9% field detection accuracy

---

## Build Phase (Step 7)

### Build Status: ✅ COMPLETE

### Files Generated

| File | Path | Purpose |
|------|------|---------|
| workflow.md | `discovery-workflow/workflow.md` | Main workflow configuration and entry point |
| step-01-init.md | `discovery-workflow/steps/step-01-init.md` | Initialize workflow, validate inputs, check continuation |
| step-01b-continue.md | `discovery-workflow/steps/step-01b-continue.md` | Resume from checkpoint for large PDFs |
| step-02-detect.md | `discovery-workflow/steps/step-02-detect.md` | GLM4.5V field detection with page-by-page processing |
| step-03-validate.md | `discovery-workflow/steps/step-03-validate.md` | Coordinate validation with auto-retry (max 7) |
| step-04-organize.md | `discovery-workflow/steps/step-04-organize.md` | Hierarchical organization and CSS conversion |
| step-05-generate.md | `discovery-workflow/steps/step-05-generate.md` | Generate Golden Map, QA Report, Metrics |
| step-06-cache.md | `discovery-workflow/steps/step-06-cache.md` | Cache golden map in sidecar storage |
| golden-map-template.json | `discovery-workflow/templates/golden-map-template.json` | Output schema template |
| retry-parameters.json | `discovery-workflow/data/retry-parameters.json` | Retry configuration (7 attempts) |

### Build Summary
- **Total Files**: 10
- **Step Files**: 7 (including continuation step)
- **Template Files**: 1
- **Data Files**: 1
- **Build Date**: 2025-12-14

### Key Features Implemented
1. **Continuation Support**: step-01b-continue.md handles resume for 100+ page PDFs
2. **Auto-Retry Logic**: 7 attempts with progressive parameter adjustment
3. **Hierarchical Organization**: Section → Subsection → Entry → Field structure
4. **Dual Coordinate Systems**: PDF coordinates + CSS coordinates
5. **Verbose Progress Reporting**: Per-page status updates
6. **Sidecar Caching**: 99.8% performance improvement on subsequent access

---

## Review Phase (Step 8)

### Review Status: ✅ COMPLETE

### Validation Results

| Category | Result |
|----------|--------|
| Configuration validation | ✅ PASSED |
| Step compliance | ✅ PASSED |
| Cross-file consistency | ✅ PASSED |
| Requirements verification | ✅ PASSED |

### Issues Found
- **Critical Issues**: None
- **Warnings**: None
- **Suggestions**: Consider adding example sections-references JSON for testing

### All Requirements Met
- Autonomous workflow with auto-proceed
- Verbose progress reporting (per-page)
- Continuation support for 100+ page PDFs
- Auto-retry logic (max 7 attempts)
- Skip strategy with retry pool
- Hierarchical organization (Section → Subsection → Entry → Field)
- UI-friendly output with CSS coordinates
- Sidecar caching for performance

---

## Completion (Step 9)

### Final Status: ✅ WORKFLOW CREATION COMPLETE

- **Workflow Name**: discovery-workflow
- **Module**: Interactive PDF Mapper
- **Created By**: TJ
- **Creation Date**: 2025-12-14
- **Completion Date**: 2025-12-14
- **Total Files**: 10
- **All Steps Completed**: [1, 2, 3, 4, 5, 6, 7, 8, 9]
