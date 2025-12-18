"use client";

import { useState } from "react";
import { collectValuesByPdfName, fillPdfClientSide } from "@/lib/golden-key-pdf-writer";

export default function TestRadioValues() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const testRadioButtonValue = async (testValue: string) => {
    setIsGenerating(true);
    addResult(`=== Testing Radio Button Value: "${testValue}" ===`);

    try {
      // Test value for the Section 1 acknowledgement field
      const testValues = {
        'form1[0].Sections1-6[0].RadioButtonList[0]': testValue,
        // Also include some text fields to make the PDF more realistic
        'form1[0].Sections1-6[0].TextField11[1]': 'John',
        'form1[0].Sections1-6[0].TextField11[2]': 'Doe'
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

      // Generate PDF with test value
      const pdfBytes = await fillPdfClientSide({
        templatePdfBytes,
        valuesByName: collected,
        fieldGroups: {},
        pdfTypeByName: {},
        flatten: false
      });

      // Check if the value was applied by comparing file sizes
      const sizeIncrease = pdfBytes.length - templatePdfBytes.length;
      addResult(`✅ PDF generated: ${pdfBytes.length} bytes`);
      addResult(`📏 Size increase: ${sizeIncrease} bytes`);

      if (sizeIncrease > 2000) {
        addResult(`🎯 SUCCESS: Value "${testValue}" was likely applied to PDF`);
      } else {
        addResult(`⚠️  WARNING: Value "${testValue}" may not have been applied`);
      }

      // Download test PDF
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `test-radio-${testValue.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      addResult(`📥 Test PDF downloaded as: test-radio-${testValue.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

    } catch (error) {
      addResult(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error('PDF generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Radio Button Value Test</h1>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Test Purpose:</h2>
        <p className="text-gray-700">
          This page tests different value formats for the Section 1 acknowledgement RadioButtonList field.
          PDF radio buttons require very specific value formats (YES/NO, Yes/No, 1/0, etc.).
        </p>
      </div>

      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <button
            onClick={() => testRadioButtonValue('YES')}
            disabled={isGenerating}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            Test: YES (uppercase)
          </button>

          <button
            onClick={() => testRadioButtonValue('Yes')}
            disabled={isGenerating}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            Test: Yes (title case)
          </button>

          <button
            onClick={() => testRadioButtonValue('yes')}
            disabled={isGenerating}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400"
          >
            Test: yes (lowercase)
          </button>

          <button
            onClick={() => testRadioButtonValue('1')}
            disabled={isGenerating}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400"
          >
            Test: 1 (numeric)
          </button>

          <button
            onClick={() => testRadioButtonValue('0')}
            disabled={isGenerating}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
          >
            Test: 0 (numeric)
          </button>

          <button
            onClick={() => testRadioButtonValue('YES ')}
            disabled={isGenerating}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:bg-gray-400"
          >
            Test: YES (with space)
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
        <h2 className="text-lg font-semibold mb-2">Test Output:</h2>
        <div className="bg-black text-green-400 p-4 rounded font-mono text-sm overflow-auto max-h-96">
          {testResults.length === 0 ? (
            <div className="text-gray-400">Click a test button to start...</div>
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