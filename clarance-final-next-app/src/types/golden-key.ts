export interface SubsectionEntry {
  pages: number[];
  fieldIds: string[];
}

export interface Subsection {
  pages: number[];
  entries: Record<string, SubsectionEntry>;
  fieldCount: number;
}

export interface SectionIndex {
  pages: number[];
  pageRange: [number, number];
  fieldCount: number;
  subsections: Record<string, Subsection>;
}

export interface GoldenKeyField {
  id: string;
  pdfFieldName: string;
  label: string;
  type: number;
  page: number;
  section: string;
  subsection: string | null;
  entry: number | null;
  uiPath: string;
  groupKey: string;
}

export interface GoldenKeyIndex {
  fields: Record<string, GoldenKeyField>;
  sections: Record<string, SectionIndex>;
  subsectionMap: Record<string, string[]>;
  entryMap: Record<string, Record<number, string[]>>;
}

export interface FieldGroup {
  subsection: string;
  entry: number | null;
  label: string;
  fields: GoldenKeyField[];
}

export interface SectionFieldGroups {
  section: string;
  sectionName: string;
  groups: FieldGroup[];
}

export interface GoldenKeyRecord {
  uiPath: string;
  pdf: {
    fieldName: string;
    fieldId: string;
    widgetIds: string[];
    pageNumber: number;
    rects: { x: number; y: number; width: number; height: number }[];
    type: "Text" | "Checkbox" | "Radio" | "Dropdown";
    exportValues?: string[];
  };
  logical: {
    section: string;
    subsection: string | null;
    entry: number | null;
  };
  label: string;
  fingerprint: string;
}

export interface GoldenKeyInventory {
  version: string;
  generatedAt: string;
  totalFields: number;
  records: Record<string, GoldenKeyRecord>;
  bySection: Record<string, string[]>;
  bySubsection: Record<string, string[]>;
}

export const SUBSECTION_LABELS: Record<string, string> = {
  "root": "General Information",
  "13A": "Employment Activity",
  "13A.1": "Employment Details",
  "13A.2": "Supervisor Information",
  "13A.3": "Employment Verification",
  "13A.4": "Reprimands/Disciplinary",
  "13A.5": "Leaving Employment",
  "13A.6": "Additional Employment Info",
  "13C": "Employment Record Continuation",
};

export const SECTION_NAMES: Record<string, string> = {
  "1": "Personal Information",
  "2": "Date of Birth",
  "3": "Place of Birth",
  "4": "Social Security Number",
  "5": "Other Names Used",
  "6": "Citizenship",
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
