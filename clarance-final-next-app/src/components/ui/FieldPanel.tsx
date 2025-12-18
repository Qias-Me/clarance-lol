"use client";

import { useFormContext } from "@/lib/form-context";
import { TextField, CheckboxField, RadioField, DropdownField } from "@/components/form";
import { FieldType, type PDFField, type RadioOption } from "@/types/pdf-fields";
import { groupFieldsByEntry, getEntryLabel, isMultiEntrySection } from "@/lib/entry-manager";

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

  const sectionId = currentSection || "";
  const isMultiEntry = currentSection ? isMultiEntrySection(currentSection, entryConfigs) : false;
  const sectionConfig = currentSection ? entryConfigs[currentSection] : undefined;

  const fieldsByEntry = groupFieldsByEntry(fields);
  const sortedEntries = Array.from(fieldsByEntry.keys()).sort((a, b) => a - b);

  const getFilledCountForEntry = (entryFields: PDFField[]): number => {
    return entryFields.filter((field) => {
      const value = values[field.id];
      return value !== undefined && value !== "" && value !== false;
    }).length;
  };

  const canAddMoreEntries = (): boolean => {
    if (!sectionConfig) return false;
    const activeCount = sortedEntries.filter((e) => isEntryActive(sectionId, e)).length;
    return activeCount < sectionConfig.maxEntries;
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
                      <div className="grid gap-4">
                        {entryFields.map((field) => (
                          <div
                            key={field.id}
                            className={`
                              p-3 rounded-lg transition-colors
                              ${selectedField?.id === field.id ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-gray-50"}
                            `}
                          >
                            {renderField(field)}
                          </div>
                        ))}
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

              return (
                <div key={`entry-${entryNum}`} className="space-y-4">
                  {entryLabel && (
                    <h3 className="text-md font-medium text-gray-600 border-b border-gray-100 pb-2">
                      {entryLabel}
                    </h3>
                  )}
                  <div className="grid gap-4">
                    {entryFields.map((field) => (
                      <div
                        key={field.id}
                        className={`
                          p-3 rounded-lg transition-colors
                          ${selectedField?.id === field.id ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-gray-50"}
                        `}
                      >
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
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
