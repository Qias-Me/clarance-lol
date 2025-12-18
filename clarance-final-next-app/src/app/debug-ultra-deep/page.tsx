/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react/no-unescaped-entities */
'use client';

import { useState, useEffect } from 'react';
import { DebugPdfFieldMapping } from '@/lib/debug-pdf-field-mapping';
import CoordinateFieldMapper from '@/lib/coordinate-field-mapper';
import { PdfFieldExtractor } from '@/lib/pdf-field-extractor';

export default function DebugUltraDeepPage() {
  const [pdfTemplate, setPdfTemplate] = useState<Uint8Array | null>(null);
  const [goldenKeyData, setGoldenKeyData] = useState<any>(null);
  const [fieldAnalysis, setFieldAnalysis] = useState<any>(null);
  const [radioFields, setRadioFields] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [allFields, setAllFields] = useState<any>(null);
  const [pdfInfo, setPdfInfo] = useState<any>(null);

  const targetField = 'form1[0].Sections1-6[0].RadioButtonList[0]';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load PDF template
      const pdfResponse = await fetch('/SF86.pdf');
      const pdfBytes = await pdfResponse.arrayBuffer();
      setPdfTemplate(new Uint8Array(pdfBytes));
      console.log('📄 PDF template loaded:', pdfBytes.byteLength, 'bytes');

      // Load golden key data
      const goldenKeyResponse = await fetch('/data/golden-key.json');
      const goldenKey = await goldenKeyResponse.json() as Record<string, any>;
      setGoldenKeyData(goldenKey);
      console.log('🔑 Golden key loaded:', Object.keys(goldenKey).length, 'fields');

    } catch (error) {
      console.error('❌ Failed to load data:', error);
    }
  };

  const analyzeField = async () => {
    if (!pdfTemplate) return;

    console.log('🔍 ANALYZING PDF FIELD ACCESS');
    console.log('===============================');

    const analysis = await DebugPdfFieldMapping.analyzePdfField(pdfTemplate, targetField);
    setFieldAnalysis(analysis);

    console.log('📊 FIELD ANALYSIS RESULTS:');
    console.log('   Field Name:', targetField);
    console.log('   Exists:', analysis.exists);
    console.log('   Accessible:', analysis.accessible);
    console.log('   Field Type:', analysis.fieldType);
    if (analysis.error) {
      console.log('   Error:', analysis.error);
    }

    // Search for field variations
    const variations = DebugPdfFieldMapping.searchFieldVariations(targetField);
    console.log('🔍 FIELD VARIATIONS:');
    console.log('   Exact Matches:', variations.exactMatches);
    console.log('   Partial Matches:', variations.partialMatches);
  };

  const extractRadioFields = async () => {
    if (!pdfTemplate) return;

    console.log('📻 EXTRACTING ALL RADIO FIELDS');
    console.log('===============================');

    const radioData = await DebugPdfFieldMapping.extractAllRadioFields(pdfTemplate);
    setRadioFields(radioData);

    console.log(`📊 Found ${radioData.radioFields.length} radio fields:`);
    radioData.radioFields.forEach((field, index) => {
      console.log(`   ${index + 1}. ${field.name}`);
      console.log(`      Options: ${field.options.join(', ')}`);
    });

    // Look for our target field
    const targetRadioField = radioData.radioFields.find(field =>
      field.name.includes('RadioButtonList[0]') ||
      field.name.includes('Sections1-6')
    );

    if (targetRadioField) {
      console.log('🎯 FOUND TARGET RADIO FIELD:');
      console.log(`   Name: ${targetRadioField.name}`);
      console.log(`   Options: ${targetRadioField.options.join(', ')}`);
    } else {
      console.log('❌ TARGET RADIO FIELD NOT FOUND');
    }
  };

  const testDirectApplication = async () => {
    if (!pdfTemplate || !fieldAnalysis?.exists) return;

    console.log('🧪 TESTING DIRECT FIELD APPLICATION');
    console.log('===================================');

    const testValue = 'YES';
    const result = await DebugPdfFieldMapping.testDirectFieldApplication(
      pdfTemplate,
      targetField,
      testValue
    );

    setTestResults(result);

    console.log('📊 DIRECT APPLICATION RESULTS:');
    console.log('   Success:', result.success);
    console.log('   Test Value:', testValue);
    if (result.error) {
      console.log('   Error:', result.error);
    }
    if (result.resultPdfSize) {
      console.log('   Result PDF Size:', result.resultPdfSize, 'bytes');
    }

    // Create download link if successful
    if (result.success && result.resultPdfSize) {
      console.log('💾 Field application successful - creating download');
    }
  };

  const analyzeGoldenKeyMapping = () => {
    if (!goldenKeyData) return;

    console.log('🗺️ ANALYZING GOLDEN KEY FIELD MAPPING');
    console.log('=====================================');

    const coordinateMapper = new CoordinateFieldMapper(goldenKeyData);

    // Find our target field in golden key
    let targetFieldData: any = null;
    Object.entries(goldenKeyData).forEach(([key, fieldData]: [string, any]) => {
      if (fieldData.pdf?.fieldName === targetField) {
        targetFieldData = fieldData;
      }
    });

    if (targetFieldData) {
      console.log('🎯 TARGET FIELD FOUND IN GOLDEN KEY:');
      console.log('   Field Name:', targetFieldData.pdf.fieldName);
      console.log('   Field ID:', targetFieldData.pdf.fieldId);
      console.log('   Page Number:', targetFieldData.pdf.pageNumber);
      console.log('   Coordinates:', targetFieldData.pdf.rects);
      console.log('   Logical Section:', targetFieldData.logical.section);
      console.log('   UI Path:', targetFieldData.uiPath);

      // Test coordinate mapping
      const mappedField = coordinateMapper.mapField(targetField);
      const detectedSection = coordinateMapper.getSectionByCoordinates(targetField);

      console.log('📍 COORDINATE MAPPING RESULTS:');
      console.log('   Original Field:', targetField);
      console.log('   Mapped Field:', mappedField);
      console.log('   Detected Section:', detectedSection);
      console.log('   Mapping Applied:', mappedField !== targetField);

    } else {
      console.log('❌ TARGET FIELD NOT FOUND IN GOLDEN KEY');
    }

    // Analyze field conflicts
    coordinateMapper.analyzeFieldConflicts();
  };

  const extractAllFields = async () => {
    if (!pdfTemplate) return;

    console.log('📋 EXTRACTING ALL PDF FIELDS');
    console.log('===============================');

    const fields = await PdfFieldExtractor.extractAllFields(pdfTemplate);
    setAllFields(fields);

    console.log(`📊 PDF contains ${fields.totalFields} fields:`);
    fields.fieldNames.slice(0, 20).forEach((name, index) => {
      console.log(`   ${index + 1}. ${name} (${fields.fieldTypes[name]})`);
    });

    if (fields.fieldNames.length > 20) {
      console.log(`   ... and ${fields.fieldNames.length - 20} more fields`);
    }

    // Check if our target field exists
    const targetExists = fields.fieldNames.includes(targetField);
    console.log(`🎯 Target field "${targetField}" exists: ${targetExists ? '✅ YES' : '❌ NO'}`);

    if (!targetExists) {
      // Find similar fields
      const similarFields = fields.fieldNames.filter(name =>
        name.toLowerCase().includes('radiobuttonlist') ||
        name.toLowerCase().includes('acknowledg') ||
        name.includes('Sections1-6')
      );

      console.log('🔍 Similar fields found:');
      similarFields.forEach(name => {
        console.log(`   - ${name}`);
      });
    }
  };

  const getPdfInfo = async () => {
    if (!pdfTemplate) return;

    console.log('📄 GETTING PDF INFO');
    console.log('==================');

    const info = await PdfFieldExtractor.getPdfInfo(pdfTemplate);
    setPdfInfo(info);

    console.log(`Title: ${info.title}`);
    console.log(`Pages: ${info.pages}`);
    console.log(`Has Form: ${info.hasForm}`);
  };

  const comprehensiveTest = async () => {
    console.log('🚀 COMPREHENSIVE FIELD MAPPING TEST');
    console.log('====================================');

    await getPdfInfo();
    await extractAllFields();
    await analyzeField();
    await extractRadioFields();
    analyzeGoldenKeyMapping();
    await testDirectApplication();

    console.log('✅ COMPREHENSIVE TEST COMPLETE');
    console.log('Check the console output for detailed analysis');
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Ultra-Deep Field Mapping Debug</h1>

      <div className="bg-red-50 border border-red-200 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-3 text-red-800">🎯 Target Field</h2>
        <p className="font-mono bg-red-100 px-3 py-2 rounded">{targetField}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Data Status</h2>
          <div className="space-y-2 text-sm">
            <p>PDF Template: {pdfTemplate ? '✅ Loaded' : '⏳ Loading...'}</p>
            <p>Golden Key Data: {goldenKeyData ? '✅ Loaded' : '⏳ Loading...'}</p>
            <p>PDF Info: {pdfInfo ? '✅ Analyzed' : '⏳ Pending...'}</p>
            <p>All Fields: {allFields ? `✅ ${allFields.totalFields} fields` : '⏳ Pending...'}</p>
            <p>Field Analysis: {fieldAnalysis ? '✅ Complete' : '⏳ Pending...'}</p>
            <p>Radio Fields: {radioFields ? '✅ Extracted' : '⏳ Pending...'}</p>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Debug Actions</h2>
          <div className="space-y-3">
            <button
              onClick={getPdfInfo}
              disabled={!pdfTemplate}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-300"
            >
              Get PDF Info
            </button>
            <button
              onClick={extractAllFields}
              disabled={!pdfTemplate}
              className="w-full px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:bg-gray-300"
            >
              Extract All Fields
            </button>
            <button
              onClick={analyzeField}
              disabled={!pdfTemplate}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
            >
              Analyze Field Access
            </button>
            <button
              onClick={extractRadioFields}
              disabled={!pdfTemplate}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300"
            >
              Extract Radio Fields
            </button>
            <button
              onClick={analyzeGoldenKeyMapping}
              disabled={!goldenKeyData}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
            >
              Analyze Golden Key Mapping
            </button>
            <button
              onClick={testDirectApplication}
              disabled={!pdfTemplate || !fieldAnalysis?.exists}
              className="w-full px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300"
            >
              Test Direct Application
            </button>
            <button
              onClick={comprehensiveTest}
              disabled={!pdfTemplate || !goldenKeyData}
              className="w-full px-4 py-3 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300 font-semibold"
            >
              🚀 Comprehensive Test
            </button>
          </div>
        </div>
      </div>

      {pdfInfo && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">PDF Information</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-semibold">Title:</span>
              <div className="ml-2">{pdfInfo.title}</div>
            </div>
            <div>
              <span className="font-semibold">Pages:</span>
              <div className="ml-2">{pdfInfo.pages}</div>
            </div>
            <div>
              <span className="font-semibold">Has Form:</span>
              <div className="ml-2">{pdfInfo.hasForm ? '✅ Yes' : '❌ No'}</div>
            </div>
          </div>
        </div>
      )}

      {allFields && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">All PDF Fields ({allFields.totalFields})</h2>
          <div className="mb-4">
            <span className="font-semibold">Target Field Exists:</span>
            <span className={`ml-2 ${allFields.fieldNames.includes(targetField) ? 'text-green-600' : 'text-red-600'}`}>
              {allFields.fieldNames.includes(targetField) ? '✅ YES' : '❌ NO'}
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Field Name</th>
                  <th className="px-4 py-2 text-left">Type</th>
                </tr>
              </thead>
              <tbody>
                {allFields.fieldNames.map((fieldName: string, index: number) => (
                  <tr key={index} className={fieldName === targetField ? 'bg-yellow-100' : ''}>
                    <td className="px-4 py-2">{index + 1}</td>
                    <td className="px-4 py-2 font-mono text-xs">{fieldName}</td>
                    <td className="px-4 py-2">{allFields.fieldTypes[fieldName]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {fieldAnalysis && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Field Analysis Results</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold">Exists:</span>
              <span className={`ml-2 ${fieldAnalysis.exists ? 'text-green-600' : 'text-red-600'}`}>
                {fieldAnalysis.exists ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            <div>
              <span className="font-semibold">Accessible:</span>
              <span className={`ml-2 ${fieldAnalysis.accessible ? 'text-green-600' : 'text-red-600'}`}>
                {fieldAnalysis.accessible ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            <div>
              <span className="font-semibold">Field Type:</span>
              <span className="ml-2">{fieldAnalysis.fieldType || 'N/A'}</span>
            </div>
          </div>
          {fieldAnalysis.error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded text-sm text-red-800">
              <strong>Error:</strong> {fieldAnalysis.error}
            </div>
          )}
        </div>
      )}

      {radioFields && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Radio Fields ({radioFields.radioFields.length})</h2>
          <div className="max-h-64 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Field Name</th>
                  <th className="px-4 py-2 text-left">Options</th>
                </tr>
              </thead>
              <tbody>
                {radioFields.radioFields.map((field: any, index: number) => (
                  <tr key={index} className={field.name.includes('RadioButtonList[0]') ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-2 font-mono text-xs">{field.name}</td>
                    <td className="px-4 py-2 text-xs">{field.options.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {testResults && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Direct Application Test</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-semibold">Success:</span>
              <span className={`ml-2 ${testResults.success ? 'text-green-600' : 'text-red-600'}`}>
                {testResults.success ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            {testResults.resultPdfSize && (
              <div>
                <span className="font-semibold">Result PDF Size:</span>
                <span className="ml-2">{testResults.resultPdfSize} bytes</span>
              </div>
            )}
            {testResults.error && (
              <div className="p-3 bg-red-100 border border-red-200 rounded text-sm text-red-800">
                <strong>Error:</strong> {testResults.error}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-blue-50 p-6 rounded-lg">
        <h2 className="text-lg font-semibold mb-3 text-blue-800">🔍 Instructions</h2>
        <ol className="list-decimal list-inside text-sm text-blue-700 space-y-2">
          <li>Click "Comprehensive Test" to run full analysis</li>
          <li>Check browser console for detailed output</li>
          <li>Look for field existence, accessibility, and mapping results</li>
          <li>Verify if the PDF template actually contains the target field</li>
          <li>Check if field options match expected values (YES/NO)</li>
        </ol>
      </div>
    </div>
  );
}