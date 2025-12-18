"use client";

import { useState, useMemo } from "react";
import { useFormContext } from "@/lib/form-context";
import { TextField, CheckboxField, RadioField, DropdownField } from "@/components/form";
import { FieldType, type PDFField } from "@/types/pdf-fields";
import { groupFieldsByEntry, getEntryLabel, isMultiEntrySection } from "@/lib/entry-manager";
import { isFieldVisible, getControllerFields } from "@/lib/visibility-rules";

/**
 * Groups fields by subsection for collapsible display.
 * 
 * @param fields - PDFField[] - Fields to group.
 * @returns Map<string, PDFField[]> - Fields grouped by subsection name.
 */
function groupFieldsBySubsection(fields: PDFField[]): Map<string, PDFField[]> {
  const groups = new Map<string, PDFField[]>();

  fields.forEach((field) => {
    const subsection = field.subsection || "general";
    if (!groups.has(subsection)) {
      groups.set(subsection, []);
    }
    groups.get(subsection)!.push(field);
  });

  return groups;
}

/**
 * Formats subsection name for display.
 * 
 * @param subsection - string - Raw subsection name.
 * @returns string - Human-readable subsection name.
 */
function formatSubsectionName(subsection: string): string {
  if (subsection === "general" || subsection === "root") {
    return "General Information";
  }
  return subsection
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

/**
 * Y proximity threshold for grouping fields into the same row.
 * SF-86 PDF has fields within ~10-20 Y units that belong together.
 * Increased from 15 to 20 to better capture related fields like
 * "Estimate" checkboxes with their associated date fields.
 */
const Y_PROXIMITY_THRESHOLD = 20;

/**
 * Groups fields by coordinate proximity to match PDF visual layout.
 *
 * @param fields - PDFField[] - Fields to group by row.
 * @returns PDFField[][] - Fields grouped into rows by Y proximity.
 *
 * PDF coordinate system: Y=0 at BOTTOM, larger Y = higher on page.
 * For top-to-bottom rendering: sort Y DESCENDING (larger Y first).
 * For left-to-right rendering: sort X ASCENDING.
 *
 * Bug-fix: Changed Y sort from ascending to descending for correct PDF layout.
 * Bug-fix: Increased Y threshold from 15 to 20 for better field grouping.
 */
function groupFieldsByCoordinates(fields: PDFField[]): PDFField[][] {
  if (fields.length === 0) return [];

  const groups: PDFField[][] = [];
  const processedFields = new Set<string>();

  const sortedFields = [...fields].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.rect.y - b.rect.y) > Y_PROXIMITY_THRESHOLD) {
      return b.rect.y - a.rect.y;
    }
    return a.rect.x - b.rect.x;
  });

  for (const field of sortedFields) {
    if (processedFields.has(field.id)) continue;

    const currentGroup: PDFField[] = [field];
    processedFields.add(field.id);

    for (const otherField of sortedFields) {
      if (processedFields.has(otherField.id)) continue;

      if (field.page === otherField.page &&
          Math.abs(field.rect.y - otherField.rect.y) <= Y_PROXIMITY_THRESHOLD) {
        currentGroup.push(otherField);
        processedFields.add(otherField.id);
      }
    }

    currentGroup.sort((a, b) => a.rect.x - b.rect.x);
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Enhances field labels with contextual information based on nearby fields.
 * Specifically helps disambiguate generic labels like "Estimate" by showing
 * what they relate to (e.g., "Estimate (From Date)" vs "Estimate (To Date)").
 *
 * @param fields - PDFField[] - Fields in a coordinate group (same row).
 * @returns PDFField[] - Fields with enhanced labels where applicable.
 */
function enhanceFieldLabelsWithContext(fields: PDFField[]): PDFField[] {
  // Find generic labels that need context
  const genericLabels = ["Estimate", "Present", "Part-time", "Full-time"];

  return fields.map((field) => {
    const label = field.label || "";

    // Check if this is a generic label that needs context
    if (!genericLabels.some(g => label.toLowerCase() === g.toLowerCase())) {
      return field;
    }

    // Look for nearby text/date fields to provide context
    // Check the field immediately to the left (lower X)
    const leftField = fields
      .filter(f => f.rect.x < field.rect.x && f.type === FieldType.TEXT)
      .sort((a, b) => b.rect.x - a.rect.x)[0];

    if (leftField && leftField.label) {
      // Extract a short context from the nearby field label
      const contextLabel = leftField.label
        .replace(/^Section \d+[A-Z]?\.\d*\s*/i, "") // Remove section prefix
        .replace(/provide|complete|enter|the|your|following/gi, "") // Remove common words
        .trim()
        .split(/[,.(]/)[0] // Take first part before punctuation
        .trim()
        .substring(0, 25); // Limit length

      if (contextLabel && contextLabel.length > 2) {
        return {
          ...field,
          label: `${label} (${contextLabel})`
        };
      }
    }

    // If no left field, check position in row for From/To pattern
    const checkboxFields = fields.filter(f => f.type === FieldType.CHECKBOX);

    if (checkboxFields.length >= 2 && label.toLowerCase() === "estimate") {
      const checkboxIndex = checkboxFields.findIndex(f => f.id === field.id);
      if (checkboxIndex === 0) {
        return { ...field, label: `${label} (From)` };
      } else if (checkboxIndex === 1) {
        return { ...field, label: `${label} (To)` };
      }
    }

    return field;
  });
}

/**
 * Props for the FieldPanel component.
 * 
 * @property fields - PDFField[] - Array of fields to display.
 * @property sectionTitle - string | undefined - Optional section title.
 */
interface FieldPanelProps {
  fields: PDFField[];
  sectionTitle?: string;
}

/**
 * Renders the appropriate field component based on field type.
 *
 * @param field - PDFField - The field to render.
 * @returns React.ReactNode - The rendered field component.
 */
function renderField(field: PDFField): React.ReactNode {
  switch (field.type) {
    case FieldType.TEXT:
      return <TextField key={field.id} field={field} />;
    case FieldType.CHECKBOX:
      return <CheckboxField key={field.id} field={field} />;
    case FieldType.RADIO:
      return <RadioField key={field.id} field={field} radioOptions={field.radioOptions} />;
    case FieldType.DROPDOWN:
      return <DropdownField key={field.id} field={field} options={field.options} />;
    default:
      return <TextField key={field.id} field={field} />;
  }
}

/**
 * Renders a horizontal row of fields that are grouped by coordinate proximity.
 * This matches the PDF layout where related fields appear side by side.
 */
/**
 * Renders a horizontal row of fields grouped by coordinate proximity.
 * Matches PDF layout where related fields appear side by side.
 * 
 * @param fields - PDFField[] - Fields in this row.
 * @param selectedField - PDFField | null - Currently selected field.
 * @returns React.ReactNode - The rendered row.
 * 
 * Bug-fix: Shows entry number for disambiguation of repeated labels like "Estimate".
 */
function CoordinateGroupRow({
  fields,
  selectedField
}: {
  fields: PDFField[],
  selectedField: PDFField | null
}): React.ReactNode {
  // Enhance labels with context for generic fields like "Estimate"
  const enhancedFields = enhanceFieldLabelsWithContext(fields);

  const gridCols = enhancedFields.length === 1 ? "grid-cols-1" :
                   enhancedFields.length === 2 ? "grid-cols-2" :
                   enhancedFields.length === 3 ? "grid-cols-3" :
                   enhancedFields.length <= 6 ? "grid-cols-3 sm:grid-cols-6" :
                   "grid-cols-3 sm:grid-cols-4 md:grid-cols-6";

  return (
    <div className={`grid ${gridCols} gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200`}>
      {enhancedFields.map((field) => (
        <div
          key={field.id}
          className={`
            flex flex-col min-w-0 transition-all duration-200
            ${selectedField?.id === field.id
              ? "bg-blue-100 ring-2 ring-blue-300 rounded-lg p-2 scale-105 shadow-md z-10"
              : "bg-white rounded-lg p-2 hover:shadow-sm hover:border-gray-300 border border-transparent"
            }
          `}
        >
          <div className="text-xs text-gray-500 mb-1 font-medium leading-tight" title={field.label || field.name}>
            {field.label || field.name}
            {field.entry !== undefined && field.entry !== null && field.entry > 0 && (
              <span className="ml-1 text-blue-500">[Entry {field.entry + 1}]</span>
            )}
          </div>
          <div className="flex-1 flex items-center">
            {renderField(field)}
          </div>
          <div className="text-xs text-gray-400 mt-1 text-center" title={`Page ${field.page}, X: ${field.rect.x}, Y: ${field.rect.y}`}>
            Pg {field.page} • Y:{Math.round(field.rect.y)}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Collapsible entry group header component.
 * 
 * @param props.entryNumber - number - The entry number (0-based).
 * @param props.sectionId - string - The section ID.
 * @param props.isExpanded - boolean - Whether the entry is expanded.
 * @param props.fieldCount - number - Total fields in this entry.
 * @param props.filledCount - number - Filled fields in this entry.
 * @param props.onToggle - Function - Callback to toggle expansion.
 * @param props.onRemove - Function | undefined - Callback to remove entry (undefined for entry 0).
 * @param props.canRemove - boolean - Whether this entry can be removed.
 */
interface EntryHeaderProps {
  entryNumber: number;
  sectionId: string;
  isExpanded: boolean;
  fieldCount: number;
  filledCount: number;
  onToggle: () => void;
  onRemove?: () => void;
  canRemove: boolean;
}

function EntryHeader({
  entryNumber,
  sectionId,
  isExpanded,
  fieldCount,
  filledCount,
  onToggle,
  onRemove,
  canRemove,
}: EntryHeaderProps): React.ReactNode {
  const label = getEntryLabel(sectionId, entryNumber);
  const progress = fieldCount > 0 ? Math.round((filledCount / fieldCount) * 100) : 0;

  return (
    <div className="flex items-center justify-between bg-gray-100 px-4 py-3 rounded-t-lg border border-gray-200">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-left flex-1 hover:text-blue-600 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-500">
          ({filledCount}/{fieldCount} fields)
        </span>
        <div className="w-24 bg-gray-200 rounded-full h-1.5 ml-2">
          <div
            className={`h-1.5 rounded-full transition-all ${progress > 0 ? "bg-green-500" : "bg-gray-300"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </button>

      {canRemove && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Remove ${label}? All data in this entry will be cleared.`)) {
              onRemove();
            }
          }}
          className="ml-2 px-2 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
          title="Remove this entry"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Add entry button component.
 * 
 * @param props.onClick - Function - Callback when button is clicked.
 * @param props.disabled - boolean - Whether the button is disabled.
 * @param props.maxReached - boolean - Whether max entries reached.
 */
interface AddEntryButtonProps {
  onClick: () => void;
  disabled: boolean;
  maxReached: boolean;
}

function AddEntryButton({ onClick, disabled, maxReached }: AddEntryButtonProps): React.ReactNode {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full py-3 px-4 border-2 border-dashed rounded-lg
        flex items-center justify-center gap-2
        transition-colors
        ${disabled
          ? "border-gray-200 text-gray-400 cursor-not-allowed"
          : "border-blue-300 text-blue-600 hover:border-blue-500 hover:bg-blue-50"
        }
      `}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
      <span>{maxReached ? "Maximum entries reached" : "Add Another Entry"}</span>
    </button>
  );
}

/**
 * Collapsible subsection header component.
 * 
 * @property subsectionName - string - The subsection name.
 * @property isExpanded - boolean - Whether the subsection is expanded.
 * @property onToggle - Function - Callback to toggle expansion.
 * @property fieldCount - number - Total fields in subsection.
 * @property filledCount - number - Filled fields in subsection.
 * @property isConditional - boolean - Whether this subsection is conditionally shown.
 */
interface SubsectionHeaderProps {
  subsectionName: string;
  isExpanded: boolean;
  onToggle: () => void;
  fieldCount: number;
  filledCount: number;
  isConditional?: boolean;
}

function SubsectionHeader({
  subsectionName,
  isExpanded,
  onToggle,
  fieldCount,
  filledCount,
  isConditional = false,
}: SubsectionHeaderProps): React.ReactNode {
  const progress = fieldCount > 0 ? Math.round((filledCount / fieldCount) * 100) : 0;
  const displayName = formatSubsectionName(subsectionName);

  return (
    <button
      onClick={onToggle}
      className={`
        w-full flex items-center justify-between px-3 py-2 
        rounded-lg transition-colors text-left
        ${isConditional 
          ? "bg-amber-50 hover:bg-amber-100 border border-amber-200" 
          : "bg-gray-50 hover:bg-gray-100 border border-gray-200"
        }
      `}
    >
      <div className="flex items-center gap-2">
        <svg
          className={`w-4 h-4 transition-transform text-gray-500 ${isExpanded ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm font-medium text-gray-700">{displayName}</span>
        {isConditional && (
          <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
            Conditional
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">
          {filledCount}/{fieldCount}
        </span>
        <div className="w-16 bg-gray-200 rounded-full h-1">
          <div
            className={`h-1 rounded-full ${progress > 0 ? "bg-green-500" : "bg-gray-300"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </button>
  );
}

/**
 * Main FieldPanel component.
 * Displays form fields organized by entry, with collapsible sections and add/remove controls.
 * 
 * @param props.fields - PDFField[] - Fields to display.
 * @param props.sectionTitle - string | undefined - Section title.
 * @returns React.ReactNode - The rendered panel.
 * 
 * Bug-relevant: Preserves field.id for PDF mapping - no translation occurs here.
 */
export function FieldPanel({ fields, sectionTitle }: FieldPanelProps): React.ReactNode {
  const {
    selectedField,
    currentSection,
    values,
    entryConfigs,
    addEntry,
    removeEntryFromSection,
    toggleEntry,
    isEntryActive,
    isEntryExpanded,
  } = useFormContext();

  const [expandedSubsections, setExpandedSubsections] = useState<Set<string>>(new Set(["general", "root"]));

  const sectionId = currentSection || "";
  const isMultiEntry = currentSection ? isMultiEntrySection(currentSection, entryConfigs) : false;
  const sectionConfig = currentSection ? entryConfigs[currentSection] : undefined;

  /**
   * Filters fields based on visibility rules.
   * Only renders fields that should be visible based on controller field values.
   */
  const visibleFields = useMemo(() => {
    return fields.filter((field) => {
      const result = isFieldVisible(
        field.id,
        field.section || sectionId,
        field.subsection,
        field.entry,
        values
      );
      return result.visible;
    });
  }, [fields, sectionId, values]);

  const fieldsByEntry = groupFieldsByEntry(visibleFields);
  const sortedEntries = Array.from(fieldsByEntry.keys()).sort((a, b) => a - b);

  const getFilledCountForEntry = (entryFields: PDFField[]): number => {
    return entryFields.filter((field) => {
      const value = values[field.id];
      return value !== undefined && value !== "" && value !== false;
    }).length;
  };

  const getFilledCountForSubsection = (subsectionFields: PDFField[]): number => {
    return subsectionFields.filter((field) => {
      const value = values[field.id];
      return value !== undefined && value !== "" && value !== false;
    }).length;
  };

  const toggleSubsection = (subsection: string): void => {
    setExpandedSubsections((prev) => {
      const next = new Set(prev);
      if (next.has(subsection)) {
        next.delete(subsection);
      } else {
        next.add(subsection);
      }
      return next;
    });
  };

  const canAddMoreEntries = (): boolean => {
    if (!sectionConfig) return false;
    const activeCount = sortedEntries.filter((e) => isEntryActive(sectionId, e)).length;
    return activeCount < sectionConfig.maxEntries;
  };

  /**
   * Checks if a subsection is conditional (controlled by a visibility rule).
   */
  const isConditionalSubsection = (subsection: string): boolean => {
    const controllerFields = getControllerFields(sectionId);
    return controllerFields.length > 0 && subsection !== "general" && subsection !== "root";
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="p-6">
        {sectionTitle && (
          <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-4 border-b border-gray-200">
            {sectionTitle}
          </h2>
        )}

        {fields.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Select a section to view fields</p>
            <p className="text-sm mt-2">Choose a section from the sidebar to start filling out the form</p>
          </div>
        ) : isMultiEntry ? (
          <div className="space-y-6">
            {sortedEntries.map((entryNum) => {
              const entryFields = fieldsByEntry.get(entryNum) || [];
              const active = isEntryActive(sectionId, entryNum);
              const expanded = isEntryExpanded(sectionId, entryNum);
              const filledCount = getFilledCountForEntry(entryFields);

              if (!active) return null;

              return (
                <div key={`entry-${entryNum}`} className="border border-gray-200 rounded-lg overflow-hidden">
                  <EntryHeader
                    entryNumber={entryNum}
                    sectionId={sectionId}
                    isExpanded={expanded}
                    fieldCount={entryFields.length}
                    filledCount={filledCount}
                    onToggle={() => toggleEntry(sectionId, entryNum)}
                    onRemove={entryNum > 0 ? () => removeEntryFromSection(sectionId, entryNum) : undefined}
                    canRemove={entryNum > 0}
                  />

                  {expanded && (
                    <div className="p-4 bg-white border-t border-gray-100">
                      <div className="space-y-3">
                        {(() => {
                          const coordinateGroups = groupFieldsByCoordinates(entryFields);
                          return coordinateGroups.map((group, groupIndex) => (
                            <CoordinateGroupRow
                              key={`group-${groupIndex}`}
                              fields={group}
                              selectedField={selectedField}
                            />
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {sectionConfig && (
              <AddEntryButton
                onClick={() => addEntry(sectionId)}
                disabled={!canAddMoreEntries()}
                maxReached={!canAddMoreEntries()}
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedEntries.map((entryNum) => {
              const entryFields = fieldsByEntry.get(entryNum) || [];
              const entryLabel = entryNum > 0 ? `Entry ${entryNum + 1}` : null;
              const subsectionGroups = groupFieldsBySubsection(entryFields);
              const sortedSubsections = Array.from(subsectionGroups.keys()).sort();

              return (
                <div key={`entry-${entryNum}`} className="space-y-4">
                  {entryLabel && (
                    <h3 className="text-md font-medium text-gray-600 border-b border-gray-100 pb-2">
                      {entryLabel}
                    </h3>
                  )}
                  
                  {sortedSubsections.length > 1 ? (
                    <div className="space-y-3">
                      {sortedSubsections.map((subsection) => {
                        const subsectionFields = subsectionGroups.get(subsection) || [];
                        const isExpanded = expandedSubsections.has(subsection);
                        const isConditional = isConditionalSubsection(subsection);
                        const filledCount = getFilledCountForSubsection(subsectionFields);

                        return (
                          <div key={subsection} className="rounded-lg overflow-hidden">
                            <SubsectionHeader
                              subsectionName={subsection}
                              isExpanded={isExpanded}
                              onToggle={() => toggleSubsection(subsection)}
                              fieldCount={subsectionFields.length}
                              filledCount={filledCount}
                              isConditional={isConditional}
                            />
                            {isExpanded && (
                              <div className="p-3 bg-white border border-t-0 border-gray-200 rounded-b-lg">
                                <div className="space-y-3">
                                  {(() => {
                                    const coordinateGroups = groupFieldsByCoordinates(subsectionFields);
                                    return coordinateGroups.map((group, groupIndex) => (
                                      <CoordinateGroupRow
                                        key={`group-${groupIndex}`}
                                        fields={group}
                                        selectedField={selectedField}
                                      />
                                    ));
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const coordinateGroups = groupFieldsByCoordinates(entryFields);
                        return coordinateGroups.map((group, groupIndex) => (
                          <CoordinateGroupRow
                            key={`group-${groupIndex}`}
                            fields={group}
                            selectedField={selectedField}
                          />
                        ));
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedField && (
        <div className="fixed bottom-0 left-64 right-0 bg-gray-800 text-white p-3 text-sm">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <span className="font-mono text-xs truncate flex-1">
              ID: {selectedField.id} | Page: {selectedField.page}
            </span>
            <span className="text-gray-300 truncate ml-4">
              {selectedField.label || selectedField.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
