"use client";

import { useFormContext } from "@/lib/form-context";
import type { SectionsSummary } from "@/types/pdf-fields";

interface SectionNavProps {
  sections: SectionsSummary;
  filledCounts: Record<string, number>;
}

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

export function SectionNav({ sections, filledCounts }: SectionNavProps): React.ReactNode {
  const { currentSection, setCurrentSection, setCurrentPage } = useFormContext();

  const sectionKeys = Object.keys(sections).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (isNaN(numA) && isNaN(numB)) return a.localeCompare(b);
    if (isNaN(numA)) return 1;
    if (isNaN(numB)) return -1;
    return numA - numB;
  });

  function handleSectionClick(sectionId: string): void {
    setCurrentSection(sectionId);
    const section = sections[sectionId];
    if (section && section.pages.length > 0) {
      setCurrentPage(section.pages[0]);
    }
  }

  function getProgressPercent(sectionId: string): number {
    const section = sections[sectionId];
    if (!section || section.fieldCount === 0) return 0;
    const filled = filledCounts[sectionId] || 0;
    return Math.round((filled / section.fieldCount) * 100);
  }

  return (
    <nav className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">SF-86 Sections</h2>
        <p className="text-sm text-gray-500 mt-1">
          {sectionKeys.length} sections
        </p>
      </div>
      <ul className="py-2">
        {sectionKeys.map((sectionId) => {
          const section = sections[sectionId];
          const isActive = currentSection === sectionId;
          const progress = getProgressPercent(sectionId);
          const sectionName = SECTION_NAMES[sectionId] || `Section ${sectionId}`;

          return (
            <li key={sectionId}>
              <button
                onClick={() => handleSectionClick(sectionId)}
                className={`
                  w-full px-4 py-3 text-left transition-colors
                  hover:bg-gray-100 focus:outline-none focus:bg-gray-100
                  ${isActive ? "bg-blue-50 border-l-4 border-blue-500" : "border-l-4 border-transparent"}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${isActive ? "text-blue-700" : "text-gray-700"}`}>
                    {sectionId}. {sectionName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {section.fieldCount}
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${progress > 0 ? "bg-green-500" : "bg-gray-300"}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  Pages {section.pageRange[0]}-{section.pageRange[1]}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
