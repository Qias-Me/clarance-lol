'use client';

import { useState, useEffect } from 'react';
import CoordinateFieldMapper from '@/lib/coordinate-field-mapper';

export default function TestSection1AcknowledgementPage() {
  const [coordinateMapper, setCoordinateMapper] = useState<CoordinateFieldMapper | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [goldenKeyData, setGoldenKeyData] = useState<any>(null);

  useEffect(() => {
    // Load golden key data
    fetch('/data/golden-key.json')
      .then(res => res.json())
      .then(data => {
        setGoldenKeyData(data);
        const mapper = new CoordinateFieldMapper(data);
        setCoordinateMapper(mapper);
        console.log('🔑 Golden key data loaded');
        console.log('📊 Total fields:', Object.keys(data).length);
      })
      .catch(err => console.error('Failed to load golden key data:', err));
  }, []);

  const testSection1Acknowledgement = () => {
    if (!coordinateMapper) {
      console.error('Coordinate mapper not initialized');
      return;
    }

    const fieldName = 'form1[0].Sections1-6[0].RadioButtonList[0]';
    const testValue = 'YES';

    console.log('🎯 TESTING SECTION 1 ACKNOWLEDGEMENT FIELD');
    console.log('=====================================');

    // Get field information
    const fieldInfo = coordinateMapper.getFieldInfo(fieldName);
    if (!fieldInfo) {
      console.error('❌ Field not found:', fieldName);
      return;
    }

    // Test field mapping
    const mappedField = coordinateMapper.mapField(fieldName);
    const detectedSection = coordinateMapper.getSectionByCoordinates(fieldName);
    const fieldId = coordinateMapper.getFieldId(fieldName);

    const results = {
      fieldName,
      testValue,
      fieldId,
      detectedSection,
      mappedField,
      coordinates: fieldInfo.rects,
      pageNumber: fieldInfo.pageNumber,
      logicalSection: fieldInfo.logical.section,
      uiPath: fieldInfo.uiPath,
      needsSubformMapping: coordinateMapper.needsSubformMapping(fieldName)
    };

    setTestResults(results);

    console.log('📋 TEST RESULTS:');
    console.log('   Field Name:', results.fieldName);
    console.log('   Field ID:', results.fieldId);
    console.log('   Test Value:', results.testValue);
    console.log('   Detected Section:', results.detectedSection);
    console.log('   Logical Section:', results.logicalSection);
    console.log('   Mapped Field:', results.mappedField);
    console.log('   Page Number:', results.pageNumber);
    console.log('   Coordinates:', results.coordinates.map(c => `(${c.x.toFixed(2)}, ${c.y.toFixed(2)})`).join(', '));
    console.log('   UI Path:', results.uiPath);
    console.log('   Needs Subform Mapping:', results.needsSubformMapping);

    // Check if this is a direct mapping (should be for Section 1)
    if (mappedField === fieldName) {
      console.log('✅ SUCCESS: Direct mapping applied (Section 1 field should work correctly)');
    } else {
      console.log('⚠️  Field was transformed:', fieldName, '→', mappedField);
    }
  };

  const analyzeAllFields = () => {
    if (!coordinateMapper) {
      console.error('Coordinate mapper not initialized');
      return;
    }

    console.log('🔍 ANALYZING ALL FIELD COORDINATES');
    console.log('=================================');

    coordinateMapper.analyzeFieldConflicts();

    const stats = coordinateMapper.getSectionStats();
    console.log('📊 SECTION STATISTICS:');
    Object.entries(stats).forEach(([section, count]) => {
      console.log(`   ${section}: ${count} fields`);
    });
  };

  const testPdfApplication = async () => {
    if (!testResults) {
      alert('Please run the field test first');
      return;
    }

    console.log('🚀 TESTING PDF APPLICATION');
    console.log('==========================');

    // Create test form data
    const formData = {
      [testResults.fieldName]: testResults.testValue,
      'form1[0].Sections1-6[0].TextField11[1]': 'John', // First name
      'form1[0].Sections1-6[0].TextField11[2]': 'Doe', // Last name
    };

    try {
      // Load template PDF
      const response = await fetch('/SF86.pdf');
      const pdfBytes = await response.arrayBuffer();

      console.log('📄 Template PDF loaded:', pdfBytes.byteLength, 'bytes');

      // Load golden key data for field mapping
      const goldenKeyResponse = await fetch('/data/golden-key.json');
      const goldenKeyData = await goldenKeyResponse.json();

      // Import PDF writer dynamically
      const { fillPdfClientSide } = await import('@/lib/golden-key-pdf-writer');
      const { loadFieldGroups } = await import('@/lib/field-groups-loader');

      // Load field groups
      const fieldGroups = await loadFieldGroups();

      // Apply field mapping using coordinate mapper
      const mappedFormData: Record<string, any> = {};
      Object.entries(formData).forEach(([fieldName, value]) => {
        const mappedField = coordinateMapper!.mapField(fieldName);
        mappedFormData[mappedField] = value;
      });

      console.log('📋 Form data after mapping:');
      Object.entries(mappedFormData).forEach(([field, value]) => {
        console.log(`   ${field}: ${value}`);
      });

      // Fill PDF
      console.log('🔄 Filling PDF with mapped fields...');
      const filledPdfBytes = await fillPdfClientSide({
        templatePdfBytes: new Uint8Array(pdfBytes),
        valuesByName: mappedFormData,
        fieldGroups,
        pdfTypeByName: {},
        flatten: false,
        goldenKeyData
      });

      console.log('✅ PDF filled successfully:', filledPdfBytes.length, 'bytes');

      // Create download link
      const blob = new Blob([filledPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'test-section1-acknowledgement.pdf';
      a.click();
      URL.revokeObjectURL(url);

      console.log('📥 PDF download started');

    } catch (error) {
      console.error('❌ PDF application failed:', error);
      alert('PDF application failed: ' + error);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Section 1 Acknowledgement Field Test</h1>

      <div className="bg-red-50 border border-red-200 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-3 text-red-800">🎯 Objective</h2>
        <p className="text-red-700">
          Get <code className="bg-red-100 px-2 py-1">form1[0].Sections1-6[0].RadioButtonList[0]</code> (Section 1 acknowledgement) to apply properly to the PDF using coordinate-based mapping.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Test Controls</h2>

          <div className="space-y-4">
            <button
              onClick={testSection1Acknowledgement}
              disabled={!coordinateMapper}
              className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
            >
              Test Section 1 Acknowledgement Field
            </button>

            <button
              onClick={analyzeAllFields}
              disabled={!coordinateMapper}
              className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300"
            >
              Analyze All Field Coordinates
            </button>

            <button
              onClick={testPdfApplication}
              disabled={!testResults}
              className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300"
            >
              Test PDF Application & Download
            </button>
          </div>

          <div className="mt-6 text-sm text-gray-600">
            <p>Golden Key Data: {goldenKeyData ? '✅ Loaded' : '⏳ Loading...'}</p>
            <p>Coordinate Mapper: {coordinateMapper ? '✅ Ready' : '⏳ Initializing...'}</p>
          </div>
        </div>

        {testResults && (
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Field Analysis Results</h2>

            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold">Field Name:</span>
                <div className="font-mono bg-gray-100 p-2 rounded mt-1">{testResults.fieldName}</div>
              </div>

              <div>
                <span className="font-semibold">Test Value:</span>
                <div className="bg-green-100 p-2 rounded mt-1 text-green-800">{testResults.testValue}</div>
              </div>

              <div>
                <span className="font-semibold">Field ID:</span>
                <div className="bg-blue-100 p-2 rounded mt-1">{testResults.fieldId}</div>
              </div>

              <div>
                <span className="font-semibold">Section Detection:</span>
                <div className="bg-purple-100 p-2 rounded mt-1">
                  <div>Detected: {testResults.detectedSection}</div>
                  <div>Logical: section{testResults.logicalSection}</div>
                </div>
              </div>

              <div>
                <span className="font-semibold">Mapping Result:</span>
                <div className="bg-yellow-100 p-2 rounded mt-1">
                  {testResults.mappedField === testResults.fieldName ? (
                    <span className="text-green-800">✅ Direct mapping (should work)</span>
                  ) : (
                    <span className="text-blue-800">🔄 Transformed: {testResults.mappedField}</span>
                  )}
                </div>
              </div>

              <div>
                <span className="font-semibold">Coordinates:</span>
                <div className="bg-gray-100 p-2 rounded mt-1 font-mono text-xs">
                  Page {testResults.pageNumber}: {testResults.coordinates.map((c: any) => `(${c.x.toFixed(2)}, ${c.y.toFixed(2)})`).join(', ')}
                </div>
              </div>

              <div>
                <span className="font-semibold">UI Path:</span>
                <div className="font-mono bg-gray-100 p-2 rounded mt-1 text-xs">{testResults.uiPath}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 p-6 rounded-lg">
        <h2 className="text-lg font-semibold mb-3 text-blue-800">🔍 Expected Results</h2>
        <div className="space-y-2 text-sm text-blue-700">
          <p><strong>Field ID:</strong> 9450</p>
          <p><strong>Section:</strong> section1 (from golden key logical.section)</p>
          <p><strong>Coordinates:</strong> Page 5 at (559.83, 91.75) and (515.84, 91.75)</p>
          <p><strong>Mapping:</strong> Should be direct mapping (no transformation needed)</p>
          <p><strong>PDF Application:</strong> Should apply YES value correctly to the acknowledgement radio button</p>
        </div>
      </div>
    </div>
  );
}