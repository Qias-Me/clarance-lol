"use client";

import { useState, useEffect, useCallback } from "react";
import { FormProvider, useFormContext } from "@/lib/form-context";
import { loadFieldIndex, loadSectionsSummary, getFieldsBySection } from "@/lib/pdf-data";
import { loadGoldenKeyInventory, getFieldsForUiPath } from "@/lib/golden-key-loader";
import { labelEnhancer } from "@/lib/label-enhancer";
import { loadFieldGroups, type FieldGroups, type RadioOption, type DropdownOption, isDropdownGroup, getDropdownOptions } from "@/lib/field-groups-loader";
import { FieldNameMapper } from "@/lib/field-name-mapper";
import { ClientPdfService } from "@/lib/client-pdf-service";
import { testPDFFields } from "@/lib/pdf-field-tester";
import { collectValuesByPdfName, fillPdfClientSide, downloadPdfBytes } from "@/lib/golden-key-pdf-writer";
import type { GoldenKeyInventory } from "@/types/golden-key";
import { SectionNav, FieldPanel, Header } from "@/components/ui";
import { FieldType, type FieldIndex, SectionsSummary, PDFField, FormValues } from "@/types/pdf-fields";

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

  const { currentSection, values, clearValues, initializeEntryConfigs, entryConfigs } = useFormContext();

  useEffect(() => {
    // Make test function available globally for debugging
    (window as any).testPDFFields = testPDFFields;

    async function loadData(): Promise<void> {
      try {
        setIsLoading(true);
        const [fieldData, sectionData, goldenKeyData, fieldGroupsData] = await Promise.all([
          loadFieldIndex(),
          loadSectionsSummary(),
          loadGoldenKeyInventory(),
          loadFieldGroups(),
        ]);
        setFieldIndex(fieldData);
        setSections(sectionData);
        setGoldenKey(goldenKeyData);
        setFieldGroups(fieldGroupsData);

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

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (goldenKey) {
      initializeEntryConfigs(goldenKey);
    }
  }, [goldenKey, initializeEntryConfigs]);

  useEffect(() => {
    if (goldenKey && currentSection && fieldGroups) {
      // Get fields from golden key data for the current section
      const sectionFields = Object.values(goldenKey.records).filter(
        record => record.logical.section === currentSection
      );

      // Track processed radio groups to avoid duplicate fields
      const processedRadioGroups = new Set<string>();

      // Convert golden key records to PDFField format for compatibility
      const fields: PDFField[] = [];

      sectionFields.forEach(record => {
        // Check if this field has an enhanced field group
        // Try both fieldId and fieldName for matching
        const fieldGroup = fieldGroups[record.pdf.fieldName] || fieldGroups[`form1[0].Sections1-6[0].${record.pdf.fieldName}[0]`];

        if (fieldGroup && fieldGroup.fieldType === "RadioGroup") {
          // Handle enhanced radio groups - create group field only once
          if (!processedRadioGroups.has(fieldGroup.fieldName)) {
            processedRadioGroups.add(fieldGroup.fieldName);

            // Convert enhanced radio options to the expected format
            const radioOptions: RadioOption[] = (fieldGroup.options || []).map(option => ({
              fieldId: option.stableId,
              value: option.exportValue,
              label: option.displayLabel,
              selected: false
            }));

            fields.push({
              id: fieldGroup.fieldName,
              name: fieldGroup.fieldName,
              page: fieldGroup.pageIndex + 1, // Convert 0-based to 1-based
              rect: fieldGroup.widgets?.[0]?.rectTopLeft || { x: 0, y: 0, width: 0, height: 0 },
              label: fieldGroup.displayLabel,
              type: FieldType.RADIO,
              section: record.logical.section,
              subsection: record.logical.subsection,
              entry: record.logical.entry,
              radioOptions: radioOptions,
              groupFieldId: fieldGroup.fieldName
            });
          }
        } else if (fieldGroup && isDropdownGroup(fieldGroup)) {
          // Handle enhanced dropdown groups with full golden key metadata
          const dropdownOptions: DropdownOption[] = getDropdownOptions(fieldGroup);

          fields.push({
            id: fieldGroup.fieldName,
            name: fieldGroup.fieldName,
            page: fieldGroup.pageIndex + 1, // Convert 0-based to 1-based
            rect: fieldGroup.widgets?.[0]?.rectTopLeft || { x: 0, y: 0, width: 0, height: 0 },
            label: fieldGroup.displayLabel,
            type: FieldType.DROPDOWN,
            section: record.logical.section,
            subsection: record.logical.subsection,
            entry: record.logical.entry,
            // Pass full golden key dropdown metadata for proper mapping
            options: dropdownOptions.map(option => ({
              value: option.exportValue,
              label: option.displayLabel,
              uiLabel: option.uiLabel
            }))
          });
        } else {
          // Handle non-radio fields (use enhanced label if available, fall back to label enhancer)
          let fieldLabel: string;

          if (fieldGroup) {
            fieldLabel = fieldGroup.displayLabel;
          } else {
            fieldLabel = labelEnhancer.enhanceLabel(record, currentSection);
          }

          // Map golden key field name to actual PDF field name
          const pdfFieldId = FieldNameMapper.mapToPDFField(record.pdf.fieldName);

          fields.push({
            id: pdfFieldId,
            name: pdfFieldId,
            page: record.pdf.pageNumber,
            rect: record.pdf.rects[0] || { x: 0, y: 0, width: 0, height: 0 },
            label: fieldLabel,
            type: record.pdf.type === "Checkbox" ? FieldType.CHECKBOX :
                  record.pdf.type === "Dropdown" ? FieldType.DROPDOWN :
                  FieldType.TEXT,
            section: record.logical.section,
            subsection: record.logical.subsection,
            entry: record.logical.entry
          });
        }
      });

      // Sort by page and position
      fields.sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (a.rect.y !== b.rect.y) return a.rect.y - b.rect.y;
        return a.rect.x - b.rect.x;
      });

      setCurrentFields(fields);
    } else {
      setCurrentFields([]);
    }
  }, [goldenKey, currentSection, fieldGroups]);

  const getFilledCountsBySection = useCallback((): Record<string, number> => {
    if (!goldenKey) return {};
    const counts: Record<string, number> = {};
    Object.values(goldenKey.records).forEach((record) => {
      if (record.logical.section) {
        const value = values[record.pdf.fieldId];
        if (value !== undefined && value !== "" && value !== false) {
          counts[record.logical.section] = (counts[record.logical.section] || 0) + 1;
        }
      }
    });
    return counts;
  }, [goldenKey, values]);

  const getTotalFieldCount = useCallback((): number => {
    if (!sections) return 0;
    return Object.values(sections).reduce((sum, s) => sum + s.fieldCount, 0);
  }, [sections]);

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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header
        totalFields={getTotalFieldCount()}
        onDownloadEditable={handleDownloadEditable}
        onDownloadFlattened={handleDownloadFlattened}
        onClear={handleClear}
        isDownloading={isDownloading}
      />
      <div className="flex flex-1 overflow-hidden">
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
