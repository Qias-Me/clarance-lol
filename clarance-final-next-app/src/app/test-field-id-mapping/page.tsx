'use client';

import { useState } from 'react';
import FieldIdAwareMapper from '@/lib/field-id-aware-mapper';

export default function TestFieldIdMappingPage() {
  const [testResults, setTestResults] = useState<any[]>([]);

  // Test data based on the conflict analysis
  const testFields = [
    {
      name: 'Section 1 Acknowledgement',
      goldenKeyField: 'form1[0].Sections1-6[0].RadioButtonList[0]',
      fieldId: '9450',
      uiPath: 'section1.root.entry0.radiobuttonlist',
      value: 'YES'
    },
    {
      name: 'Section 4 Acknowledgement',
      goldenKeyField: 'form1[0].Sections1-6[0].RadioButtonList[0]',
      fieldId: '17237',
      uiPath: 'section4.root.entry0.radiobuttonlist',
      value: 'YES'
    },
    {
      name: 'Section 5 Name Field 1',
      goldenKeyField: 'form1[0].Sections1-6[0].section5[0].TextField11[0]',
      fieldId: 'unknown',
      uiPath: 'section5.root.entry0.fullname',
      value: 'John Doe'
    },
    {
      name: 'Section 5 Name Field 2',
      goldenKeyField: 'form1[0].Sections1-6[0].section5[0].TextField11[1]',
      fieldId: 'unknown',
      uiPath: 'section5.root.entry0.firstname',
      value: 'John'
    }
  ];

  const runMappingTest = () => {
    const results = testFields.map(test => {
      const section = FieldIdAwareMapper.extractSectionFromUiPath(test.uiPath);
      const mappedField = FieldIdAwareMapper.mapWithFieldId(
        test.goldenKeyField,
        test.fieldId,
        section
      );

      return {
        testName: test.name,
        originalField: test.goldenKeyField,
        fieldId: test.fieldId,
        detectedSection: section,
        mappedField,
        value: test.value,
        mappingApplied: mappedField !== test.goldenKeyField
      };
    });

    setTestResults(results);
  };

  const testFieldConflicts = () => {
    const conflicts = [
      {
        name: 'form1[0].Sections1-6[0].RadioButtonList[0]',
        fieldId: '9450',
        uiPath: 'section1.root.entry0.radiobuttonlist'
      },
      {
        name: 'form1[0].Sections1-6[0].RadioButtonList[0]',
        fieldId: '17237',
        uiPath: 'section4.root.entry0.radiobuttonlist'
      }
    ];

    FieldIdAwareMapper.analyzeFieldConflicts(conflicts);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Field ID-Aware Mapping Test</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Scenarios</h2>
        <div className="grid grid-cols-1 gap-4 mb-4">
          {testFields.map((test, index) => (
            <div key={index} className="p-4 border rounded-lg">
              <h3 className="font-semibold">{test.name}</h3>
              <p className="text-sm text-gray-600">Field: {test.goldenKeyField}</p>
              <p className="text-sm text-gray-600">Field ID: {test.fieldId}</p>
              <p className="text-sm text-gray-600">UI Path: {test.uiPath}</p>
              <p className="text-sm text-gray-600">Value: {test.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <button
            onClick={runMappingTest}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Run Mapping Test
          </button>
          <button
            onClick={testFieldConflicts}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Analyze Field Conflicts
          </button>
        </div>
      </div>

      {testResults.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Mapping Results</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">Test Name</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Original Field</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Field ID</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Detected Section</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Mapped Field</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Mapping Applied</th>
                </tr>
              </thead>
              <tbody>
                {testResults.map((result, index) => (
                  <tr key={index} className={result.mappingApplied ? 'bg-yellow-50' : ''}>
                    <td className="border border-gray-300 px-4 py-2">{result.testName}</td>
                    <td className="border border-gray-300 px-4 py-2 font-mono text-sm">{result.originalField}</td>
                    <td className="border border-gray-300 px-4 py-2">{result.fieldId}</td>
                    <td className="border border-gray-300 px-4 py-2">{result.detectedSection}</td>
                    <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                      {result.mappedField}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {result.mappingApplied ? (
                        <span className="text-green-600 font-semibold">✅ Yes</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-blue-50 p-6 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">🎯 Critical Issue Being Resolved</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Problem:</strong> Same field name used across multiple sections with different field IDs</p>
          <p><strong>Example:</strong> <code>form1[0].Sections1-6[0].RadioButtonList[0]</code></p>
          <ul className="ml-4 list-disc">
            <li>Section 1: Field ID "9450" → Acknowledgement</li>
            <li>Section 4: Field ID "17237" → Acknowledgement (same physical field)</li>
          </ul>
          <p><strong>Solution:</strong> Field ID-aware mapper that uses both field name + field ID to determine correct mapping</p>
        </div>
      </div>
    </div>
  );
}