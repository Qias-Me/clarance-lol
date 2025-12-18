"use client";

import { useState } from "react";
import { collectValuesByPdfName, fillPdfClientSide } from "@/lib/golden-key-pdf-writer";
import { formatRadioValue, getExpectedRadioValues, validateRadioValue } from "@/lib/pdf-field-value-formatter";
import { loadFieldGroups } from "@/lib/field-groups-loader";

export default function DebugAcknowledgement() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const testAcknowledgementField = async (testValue: string) => {
    setIsGenerating(true);
    addResult(`=== Testing Acknowledgement Field ===`);
    addResult(`Test Value: "${testValue}"`);

    try {
      // Load field groups
      addResult(`Loading field groups...`);
      const fieldGroups = await loadFieldGroups();
      addResult(`Field groups loaded: ${Object.keys(fieldGroups).length} fields`);

      // Get field info
      const fieldName = 'form1[0].Sections1-6[0].RadioButtonList[0]';
      const expectedValues = getExpectedRadioValues(fieldName);
      const isValid = validateRadioValue(fieldName, testValue);
      const formattedValue = formatRadioValue(fieldName, testValue);

      addResult(`Field: ${fieldName}`);
      addResult(`Expected values: ${expectedValues.join(', ')}`);
      addResult(`Input value: "${testValue}"`);
      addResult(`Is valid: ${isValid}`);
      addResult(`Formatted: "${formattedValue}"`);

      // Check if field exists in field groups
      const fieldGroup = fieldGroups[fieldName];
      if (fieldGroup) {
        addResult(`✅ Field found in field groups: ${fieldGroup.fieldType}`);
        addResult(`Display label: ${fieldGroup.displayLabel.substring(0, 100)}...`);
        addResult(`Options: ${fieldGroup.options?.map((opt: { exportValue: string }) => opt.exportValue).join(', ')}`);
      } else {
        addResult(`❌ Field NOT found in field groups`);
      }

      // Test with text fields + acknowledgement
      const testValues = {
        // Text fields that work
        'form1[0].Sections1-6[0].TextField11[1]': 'John', // First name
        'form1[0].Sections1-6[0].TextField11[2]': 'Doe', // Middle name
        'form1[0].Sections1-6[0].suffix[0]': 'Jr.', // Suffix
        // Acknowledgement field
        'form1[0].Sections1-6[0].RadioButtonList[0]': formattedValue
      };

      addResult(`Test values: ${JSON.stringify(testValues, null, 2)}`);

      // Test value collection with formatting
      const collected = collectValuesByPdfName(testValues);
      addResult(`Collected values: ${JSON.stringify(collected, null, 2)}`);

      // Check if the acknowledgement field is in the collected values
      const ackField = 'form1[0].Sections1-6[0].RadioButtonList[0]';
      const ackValue = collected[ackField];
      addResult(`Acknowledgement in collected: ${ackValue ? `"${ackValue}"` : 'MISSING'}`);

      // Load PDF template
      const templateResponse = await fetch('/data/sf86.pdf');
      if (!templateResponse.ok) {
        throw new Error(`Failed to fetch PDF template: ${templateResponse.status}`);
      }

      const templatePdfBytes = new Uint8Array(await templateResponse.arrayBuffer());
      addResult(`PDF template: ${templatePdfBytes.length} bytes`);

      // Generate PDF
      const pdfBytes = await fillPdfClientSide({
        templatePdfBytes,
        valuesByName: collected,
        fieldGroups,
        pdfTypeByName: {},
        flatten: false
      });

      const sizeIncrease = pdfBytes.length - templatePdfBytes.length;
      addResult(`Generated PDF: ${pdfBytes.length} bytes (increase: ${sizeIncrease})`);

      // Download test PDF
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `debug-acknowledgement-${testValue.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      addResult(`PDF downloaded as: debug-acknowledgement-${testValue.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

      if (sizeIncrease > 2000) {
        addResult(`✅ SUCCESS: Field value was applied (significant size increase)`);
      } else {
        addResult(`⚠️  WARNING: Field value may not have been applied`);
      }

    } catch (error) {
      addResult(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Test error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Acknowledgement Field Debug</h1>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Issue:</h2>
        <p className="text-gray-700">
          The acknowledgement field (Section 1 RadioButtonList[0]) is not being applied to the PDF.
          This test will try different value formats to find what works.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <button
            onClick={() => testAcknowledgementField('YES')}
            disabled={isGenerating}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            Test: YES
          </button>

          <button
            onClick={() => testAcknowledgementField('YES ')}
            disabled={isGenerating}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            Test: YES (space)
          </button>

          <button
            onClick={() => testAcknowledgementField('Yes')}
            disabled={isGenerating}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            Test: Yes
          </button>

          <button
            onClick={() => testAcknowledgementField('1')}
            disabled={isGenerating}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400"
          >
            Test: 1
          </button>

          <button
            onClick={() => testAcknowledgementField('0')}
            disabled={isGenerating}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
          >
            Test: 0
          </button>

          <button
            onClick={() => testAcknowledgementField('true')}
            disabled={isGenerating}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400"
          >
            Test: true
          </button>

          <button
            onClick={() => testAcknowledgementField('checked')}
            disabled={isGenerating}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:bg-gray-400"
          >
            Test: checked
          </button>

          <button
            onClick={() => testAcknowledgementField('selected')}
            disabled={isGenerating}
            className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 disabled:bg-gray-400"
          >
            Test: selected
          </button>

          <button
            onClick={() => testAcknowledgementField('on')}
            disabled={isGenerating}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:bg-gray-400"
          >
            Test: on
          </button>
        </div>

        <button
          onClick={clearResults}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Clear Results
        </button>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Debug Output:</h2>
        <div className="bg-black text-green-400 p-4 rounded font-mono text-sm overflow-auto max-h-96">
          {testResults.length === 0 ? (
            <div className="text-gray-400">Click a test button to start debugging...</div>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="mb-1">
                {result}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}