"use client";

import { useState, useEffect } from "react";
import type { GoldenKeyInventory } from "@/types/golden-key";

export default function TestGoldenKey() {
  const [goldenKey, setGoldenKey] = useState<GoldenKeyInventory | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSection, setSelectedSection] = useState("all");

  useEffect(() => {
    fetch("/data/golden-key.json")
      .then((res) => res.json())
      .then((data: unknown) => {
        const goldenKeyData = data as GoldenKeyInventory;
        setGoldenKey(goldenKeyData);
      })
      .catch(console.error);
  }, []);

  if (!goldenKey) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Loading Golden Key...</h1>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const records = Object.values(goldenKey.records);

  const filteredRecords = records.filter((record) => {
    const matchesSearch = searchTerm === "" ||
      record.uiPath.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.pdf.fieldName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSection = selectedSection === "all" || record.logical.section === selectedSection;

    return matchesSearch && matchesSection;
  });

  const sections = Array.from(
    new Set(records.map((r) => r.logical.section))
  ).sort();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Golden Key Mapping System</h1>
      <p className="text-gray-600 mb-6">
        Total Fields Mapped: {goldenKey.totalFields.toLocaleString()} |
        Sections: {sections.length}
      </p>

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by UI path, label, or PDF field..."
          className="flex-1 px-4 py-2 border rounded-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="px-4 py-2 border rounded-lg"
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value)}
        >
          <option value="all">All Sections</option>
          {sections.map((section) => (
            <option key={section} value={section}>
              Section {section}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-blue-900 mb-2">Example UI Path to PDF Field Mapping:</h2>
        <div className="font-mono text-sm space-y-1">
          <div className="text-blue-700">UI Path: <code className="bg-white px-2 py-1 rounded">section13.root.entry0.your_name</code></div>
          <div className="text-green-700">PDF Field: <code className="bg-white px-2 py-1 rounded">form1[0].Section13[0].YourName[0]</code></div>
          <div className="text-purple-700">Page: <span className="bg-white px-2 py-1 rounded">Page 42</span></div>
          <div className="text-orange-700">Type: <span className="bg-white px-2 py-1 rounded">Text</span></div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                UI Path
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Label
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PDF Field
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRecords.slice(0, 100).map((record, index) => (
              <tr key={record.fingerprint} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {record.uiPath}
                  </code>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {record.label}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <code className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-800">
                    {record.pdf.fieldName}
                  </code>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  Sec {record.logical.section}
                  {record.logical.subsection && ` • ${record.logical.subsection}`}
                  {record.logical.entry !== null && ` • Entry ${record.logical.entry}`}
                  <br />
                  <span className="text-xs">Page {record.pdf.pageNumber}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    record.pdf.type === "Text" ? "bg-green-100 text-green-800" :
                    record.pdf.type === "Checkbox" ? "bg-blue-100 text-blue-800" :
                    record.pdf.type === "Radio" ? "bg-purple-100 text-purple-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {record.pdf.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredRecords.length > 100 && (
          <div className="bg-gray-50 px-6 py-3 text-sm text-gray-500">
            Showing first 100 of {filteredRecords.length} results
          </div>
        )}
      </div>
    </div>
  );
}