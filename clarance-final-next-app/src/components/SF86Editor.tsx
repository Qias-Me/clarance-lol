"use client";

import { useState, useEffect, useCallback } from "react";
import { FormProvider, useFormContext } from "@/lib/form-context";
import { loadFieldIndex, loadSectionsSummary } from "@/lib/pdf-data";
import { loadGoldenKeyInventory } from "@/lib/golden-key-loader";
import { reconcileSections } from "@/lib/section-reconciliation";
import { loadFieldGroups, type FieldGroups } from "@/lib/field-groups-loader";
import { FieldNameMapper } from "@/lib/field-name-mapper";
import { testPDFFields } from "@/lib/pdf-field-tester";
import { collectValuesByPdfName, fillPdfClientSide, downloadPdfBytes } from "@/lib/golden-key-pdf-writer";
import type { GoldenKeyInventory } from "@/types/golden-key";
import { SectionNav, FieldPanel, Header } from "@/components/ui";
import { GoldenKeySectionRenderer } from "@/lib/golden-key-section-renderer";
import { formPersistence, createAutoSave } from "@/lib/indexeddb-persistence";
import { type FieldIndex, SectionsSummary, PDFField } from "@/types/pdf-fields";

const SECTION_NAMES: Record<string, string> = {
  "1": "Personal Information",
  "2": "Date of Birth",
  "3": "Place of Birth",
  "4": "Social Security Number",
  "5": "Other Names Used",
  "6": "Identifying Information",
  "7": "Passport Information",
  "8": "Dual Citizenship",
  "9": "Residence History",
  "10": "Education",
  "11": "Employment Activities",
  "12": "People Who Know You",
  "13": "Foreign Contacts",
  "14": "Foreign Activities",
  "15": "Military History",
  "16": "Investigations Record",
  "17": "Financial Record",
  "18": "Gambling",
  "19": "Mental Health",
  "20": "Police Record",
  "21": "Illegal Drugs",
  "22": "Alcohol Use",
  "23": "IT Systems",
  "24": "Protected Information",
  "25": "Association Record",
  "26": "Civil Court Actions",
  "27": "Non-Criminal Court Actions",
  "28": "Signature",
  "29": "Release",
  "30": "Continuation",
};

function EditorContent(): React.ReactNode {
  const [fieldIndex, setFieldIndex] = useState<FieldIndex | null>(null);
  const [sections, setSections] = useState<SectionsSummary | null>(null);
  const [currentFields, setCurrentFields] = useState<PDFField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [goldenKey, setGoldenKey] = useState<GoldenKeyInventory | null>(null);
  const [fieldGroups, setFieldGroups] = useState<FieldGroups>({});
  const [pdfTypeByName, setPdfTypeByName] = useState<Record<string, "Text" | "CheckBox" | "RadioButton" | "ComboBox">>({});
  const [sectionRenderer, setSectionRenderer] = useState<GoldenKeySectionRenderer | null>(null);
  const [autoSave, setAutoSave] = useState<ReturnType<typeof createAutoSave> | null>(null);

  const { currentSection, values, clearValues, initializeEntryConfigs } = useFormContext();

  useEffect(() => {
    // Make test function available globally for debugging
    (window as unknown as { testPDFFields: typeof testPDFFields }).testPDFFields = testPDFFields;

    function loadData(): void {
      setIsLoading(true);

      Promise.all([
        loadFieldIndex(),
        loadSectionsSummary(),
        loadGoldenKeyInventory(),
        loadFieldGroups(),
      ]).then(([fieldData, sectionData, goldenKeyData, fieldGroupsData]) => {
        setFieldIndex(fieldData);
        setSections(sectionData);

        // 🔧 Apply section reconciliation to fix section placement issues
        console.log('🔧 Applying section reconciliation to golden-key data...');
        const reconciliationResult = reconcileSections(goldenKeyData);
        if (reconciliationResult.correctedRecords > 0) {
          console.log(`✅ Fixed ${reconciliationResult.correctedRecords} section assignments`);
        }

        setGoldenKey(goldenKeyData);
        setFieldGroups(fieldGroupsData);

        // Initialize the deterministic section renderer
        const renderer = new GoldenKeySectionRenderer(goldenKeyData, fieldGroupsData);
        setSectionRenderer(renderer);

        // Validate section integrity and log any issues
        renderer.validateSectionIntegrity();

        // Create pdfTypeByName mapping from field groups
        const typeMap: Record<string, "Text" | "CheckBox" | "RadioButton" | "ComboBox"> = {};
        Object.values(fieldGroupsData).forEach(group => {
          if (group.fieldType === "RadioGroup") {
            typeMap[group.fieldName] = "RadioButton";
          } else if (group.fieldType === "Dropdown") {
            typeMap[group.fieldName] = "ComboBox";
          } else if (group.fieldType === "Checkbox") {
            typeMap[group.fieldName] = "CheckBox";
          } else if (group.fieldType === "Text") {
            typeMap[group.fieldName] = "Text";
          }
        });
        setPdfTypeByName(typeMap);
        console.log(`📋 Built PDF type mapping: ${Object.keys(typeMap).length} fields`);

        // Load persisted state
        formPersistence.init().then(() => {
          return formPersistence.loadState();
        }).then((persistedState) => {
          if (persistedState) {
            console.log(`🔄 Loaded ${Object.keys(persistedState.values).length} values from IndexedDB`);
            // The form context should handle setting the values
          }
        }).catch((error) => {
          console.warn("⚠️ Failed to load persisted state:", error);
        });

        // Setup auto-save
        const saveHandler = createAutoSave(async (valuesToSave) => {
          await formPersistence.saveState(
            valuesToSave,
            goldenKeyData.version || "unknown",
            goldenKeyData.generatedAt
          );
        });
        setAutoSave(() => saveHandler);

        // DEBUG: Expose internals to browser for debugging dropdowns
        if (typeof window !== 'undefined') {
          (window as any).__CLARANCE_FIELD_GROUPS__ = fieldGroupsData;
          (window as any).__CLARANCE_GOLDEN_KEY__ = goldenKeyData;
          (window as any).__CLARANCE_SECTION_RENDERER__ = renderer;
          (window as any).__CLARANCE_GET_DROPDOWN_OPTIONS__ = async (fieldName: string) => {
            const { getDropdownOptions } = await import('@/lib/dropdown-options-service');
            return getDropdownOptions(fieldName);
          };
          console.log('🐛 Debug hooks exposed to window object');
        }

        setError(null);
        setIsLoading(false);
      }).catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load data");
        setIsLoading(false);
      });
    }
    loadData();
  }, []);

  useEffect(() => {
    if (goldenKey) {
      initializeEntryConfigs(goldenKey);
    }
  }, [goldenKey, initializeEntryConfigs]);

  useEffect(() => {
    if (sectionRenderer && currentSection) {
      console.log(`🔧 Rendering section ${currentSection} using deterministic renderer`);

      // Use the deterministic section renderer - this is the source of truth
      const fields = sectionRenderer.getFieldsForSection(currentSection);
      setCurrentFields(fields);

      // DEBUG: Expose current section for debugging
      if (typeof window !== 'undefined') {
        (window as any).__CLARANCE_CURRENT_SECTION__ = currentSection;
      }
    } else {
      setCurrentFields([]);
    }
  }, [sectionRenderer, currentSection]);

  // Auto-save effect
  useEffect(() => {
    if (autoSave && values && Object.keys(values).length > 0) {
      autoSave(values);
    }
  }, [values, autoSave]);

  /**
   * Counts filled fields per section using correct field ID lookup.
   * 
   * @returns Record<string, number> - Map of section ID to filled field count.
   * 
   * Bug-fix: Uses mapped field names matching form field IDs, not raw fieldId.
   * Radio/Dropdown fields use fieldGroup.fieldName as ID.
   * Other fields use FieldNameMapper.mapToPDFField(record.pdf.fieldName).
   */
  const getFilledCountsBySection = useCallback((): Record<string, number> => {
    if (!goldenKey) return {};
    const counts: Record<string, number> = {};
    const processedRadioGroups = new Set<string>();

    Object.values(goldenKey.records).forEach((record) => {
      if (!record.logical.section) return;

      const fieldGroup = fieldGroups[record.pdf.fieldName];
      let fieldKey: string;

      if (fieldGroup && (fieldGroup.fieldType === "RadioGroup" || fieldGroup.fieldType === "Dropdown")) {
        if (processedRadioGroups.has(fieldGroup.fieldName)) return;
        processedRadioGroups.add(fieldGroup.fieldName);
        fieldKey = fieldGroup.fieldName;
      } else {
        fieldKey = FieldNameMapper.mapToPDFField(record.pdf.fieldName);
      }

      const value = values[fieldKey];
      if (value !== undefined && value !== "" && value !== false) {
        counts[record.logical.section] = (counts[record.logical.section] || 0) + 1;
      }
    });
    return counts;
  }, [goldenKey, values, fieldGroups]);

  const getTotalFieldCount = useCallback((): number => {
    if (!sections) return 0;
    return Object.values(sections).reduce((sum, s) => sum + s.fieldCount, 0);
  }, [sections]);

  /**
   * Gets the field count for the current section from actual displayed fields.
   * 
   * @returns number - Count of fields in current section.
   * 
   * Bug-fix: Uses currentFields.length (actual displayed fields) instead of
   * sections-summary.json fieldCount which may not match golden-key data.
   */
  const getCurrentSectionFieldCount = useCallback((): number => {
    return currentFields.length;
  }, [currentFields]);

  /**
   * Counts filled fields in the current section from actual displayed fields.
   * 
   * @returns number - Count of filled fields in current section.
   * 
   * Bug-fix: Counts from currentFields array using correct field.id lookup,
   * ensuring consistency between displayed fields and progress count.
   */
  const getCurrentSectionFilledCount = useCallback((): number => {
    return currentFields.filter((field) => {
      const value = values[field.id];
      return value !== undefined && value !== "" && value !== false;
    }).length;
  }, [currentFields, values]);

  async function generatePDF(flatten: boolean): Promise<void> {
    setIsDownloading(true);
    try {
      console.log("🚀 Starting GOLDEN-KEY-AWARE PDF generation with values:", Object.keys(values).length, "fields");

      // CRITICAL FIX: Collect values by PDF name using golden key structure
      const valuesByName = collectValuesByPdfName(values);

      console.log(`📊 Collected ${Object.keys(valuesByName).length} values by PDF name`);

      // Fetch the blank PDF template
      const templateResponse = await fetch('/data/sf86.pdf');
      if (!templateResponse.ok) {
        throw new Error(`Failed to fetch PDF template: ${templateResponse.status}`);
      }

      const templatePdfBytes = new Uint8Array(await templateResponse.arrayBuffer());
      console.log(`📄 PDF template loaded: ${templatePdfBytes.length} bytes`);

      // Use golden-key-aware PDF writer with appearance updates
      const pdfBytes = await fillPdfClientSide({
        templatePdfBytes,
        valuesByName,
        fieldGroups,
        pdfTypeByName,
        flatten
      });

      // Download the PDF with descriptive filename
      const editableLabel = flatten ? "Flattened" : "Editable";
      const filename = `SF86_${editableLabel}_${new Date().toISOString().split("T")[0]}.pdf`;
      downloadPdfBytes(pdfBytes, filename);

      console.log("✅ Golden-key-aware PDF download completed successfully");

      // Show success message with detailed results
      alert(
        `🎉 ${editableLabel} PDF generated and downloaded successfully!\n\n` +
        `🚀 Golden-Key-Aware Generation:\n` +
        `• Field values: ${Object.keys(valuesByName).length}\n` +
        `• Field groups: ${Object.keys(fieldGroups).length}\n` +
        `• PDF type mappings: ${Object.keys(pdfTypeByName).length}\n` +
        `• Appearance updates: ✅ Applied\n` +
        `• Editable PDF: ${flatten ? '❌ No (flattened)' : '✅ Yes'}\n` +
        `• Filename: ${filename}\n\n` +
        `💡 PDF now contains properly mapped form values!\n` +
        `${flatten ? '\n📋 Note: This PDF cannot be edited further.' : '\n✏️ Note: This PDF can still be edited.'}`
      );

    } catch (err) {
      console.error("❌ Golden-key-aware PDF generation error:", err);
      alert(`Failed to generate PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
    }
  }

  // Editable PDF download (keep form fields active)
  async function handleDownloadEditable(): Promise<void> {
    await generatePDF(false);
  }

  // Flattened PDF download (make values permanent, fields read-only)
  async function handleDownloadFlattened(): Promise<void> {
    if (confirm("Are you sure you want to create a flattened (read-only) PDF? This will remove the ability to edit form fields.")) {
      await generatePDF(true);
    }
  }

  function handleClear(): void {
    if (confirm("Are you sure you want to clear all form data?")) {
      clearValues();
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading SF-86 form data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center text-red-600">
          <p className="text-xl font-semibold">Error loading form</p>
          <p className="mt-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!sections || !fieldIndex) {
    return null;
  }

  const sectionTitle = currentSection
    ? `Section ${currentSection}: ${SECTION_NAMES[currentSection] || "Unknown"}`
    : undefined;

  // Get section-specific progress data using actual displayed fields
  const currentSectionFields = getCurrentSectionFieldCount();
  const currentSectionFilled = getCurrentSectionFilledCount();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header
        totalFields={getTotalFieldCount()}
        onDownloadEditable={handleDownloadEditable}
        onDownloadFlattened={handleDownloadFlattened}
        onClear={handleClear}
        isDownloading={isDownloading}
        currentSectionFields={currentSectionFields}
        currentSectionFilled={currentSectionFilled}
        sectionTitle={currentSection ? SECTION_NAMES[currentSection] : undefined}
      />
      <div className="flex flex-1 min-h-0">
        <SectionNav sections={sections} filledCounts={getFilledCountsBySection()} />
        <FieldPanel fields={currentFields} sectionTitle={sectionTitle} />
      </div>
    </div>
  );
}

export function SF86Editor(): React.ReactNode {
  return (
    <FormProvider>
      <EditorContent />
    </FormProvider>
  );
}
