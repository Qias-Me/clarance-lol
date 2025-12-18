/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { loadGoldenKeyInventory } from "@/lib/golden-key-loader";
import { FieldNameMapper } from "@/lib/field-name-mapper";
import { collectValuesByPdfName, fillPdfClientSide } from "@/lib/golden-key-pdf-writer";

export default function TestPDFDebug() {
  const [goldenKey, setGoldenKey] = useState<any>(null);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadGoldenKeyInventory().then(setGoldenKey);
  }, []);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const testFieldMapping = () => {
    addResult("=== Testing Field Mapping ===");

    if (!goldenKey) {
      addResult("❌ Golden key not loaded");
      return;
    }

    // Test section 1 fields
    const section1Fields = Object.values(goldenKey.records).filter(
      (record: any) => record.logical.section === "1"
    );

    addResult(`📊 Found ${section1Fields.length} fields in section 1`);

    section1Fields.slice(0, 5).forEach((record: any, index) => {
      const originalField = record.pdf.fieldName;
      const mappedField = FieldNameMapper.mapToPDFField(originalField);
      addResult(`  ${index + 1}. ${record.uiPath}`);
      addResult(`     Original: ${originalField}`);
      addResult(`     Mapped: ${mappedField}`);
      addResult(`     Changed: ${originalField !== mappedField ? '✅' : '❌'}`);
    });
  };

  const testPDFGeneration = async () => {
    setIsGenerating(true);
    addResult("=== Testing PDF Generation ===");

    try {
      // Create test values for section 1 fields
      const testValues = {
        'form1[0].Sections1-6[0].TextField11[1]': 'John', // First name
        'form1[0].Sections1-6[0].TextField11[2]': 'Doe', // Middle name
        'form1[0].Sections1-6[0].suffix[0]': 'Jr.', // Suffix
      };

      addResult(`📝 Test values: ${JSON.stringify(testValues, null, 2)}`);

      // Test collectValuesByPdfName
      const collected = collectValuesByPdfName(testValues);
      addResult(`📊 Collected values: ${JSON.stringify(collected, null, 2)}`);

      // Load PDF template
      const templateResponse = await fetch('/data/sf86.pdf');
      if (!templateResponse.ok) {
        throw new Error(`Failed to fetch PDF template: ${templateResponse.status}`);
      }

      const templatePdfBytes = new Uint8Array(await templateResponse.arrayBuffer());
      addResult(`📄 PDF template loaded: ${templatePdfBytes.length} bytes`);

      // Generate PDF with minimal data
      const pdfBytes = await fillPdfClientSide({
        templatePdfBytes,
        valuesByName: collected,
        fieldGroups: {},
        pdfTypeByName: {},
        flatten: false
      });

      addResult(`✅ PDF generated: ${pdfBytes.length} bytes`);

      // Download test PDF
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'test-debug.pdf';
      link.click();
      URL.revokeObjectURL(url);

      addResult(`📥 Test PDF downloaded`);

    } catch (error) {
      addResult(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error('PDF generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const testRealFieldNames = async () => {
    addResult("=== Testing Real Field Names ===");

    try {
      // Load PDF and check actual field names
      const response = await fetch('/data/sf86.pdf');
      const pdfBytes = new Uint8Array(await response.arrayBuffer());

      // Dynamically import pdf-lib
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      addResult(`📋 PDF has ${fields.length} total fields`);

      // Show first 20 field names
      fields.slice(0, 20).forEach((field, index) => {
        addResult(`  ${index + 1}. ${field.getName()}`);
      });

    } catch (error) {
      addResult(`❌ Error loading PDF fields: ${error}`);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">PDF Field Debug Test</h1>

      <div className="space-y-4 mb-8">
        <button
          onClick={testFieldMapping}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Field Mapping
        </button>

        <button
          onClick={testPDFGeneration}
          disabled={isGenerating}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
        >
          {isGenerating ? 'Generating...' : 'Test PDF Generation'}
        </button>

        <button
          onClick={testRealFieldNames}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Test Real Field Names
        </button>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Debug Output:</h2>
        <div className="bg-black text-green-400 p-4 rounded font-mono text-sm overflow-auto max-h-96">
          {testResults.map((result, index) => (
            <div key={index} className="mb-1">
              {result}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}