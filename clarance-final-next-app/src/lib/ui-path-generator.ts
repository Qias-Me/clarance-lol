interface FieldRecord {
  id: string;
  name: string;
  label: string;
  type: number;
  section: string;
  subsection: string | null;
  entry: number | null;
}

interface ParsedUiPath {
  section: string;
  subsection: string | null;
  entry: number | null;
  fieldName: string;
}

const SECTION_NAMES: Record<string, string> = {
  "1": "personalInformation",
  "2": "dateOfBirth",
  "3": "placeOfBirth",
  "4": "socialSecurityNumber",
  "5": "applicationInformation",
  "6": "identifyingInformation",
  "7": "militaryHistory",
  "8": "peopleWhoKnowYou",
  "9": "whereYouHaveLived",
  "10": "whereYouWentToSchool",
  "11": "yourEmploymentActivities",
  "12": "whereYouHaveLived",
  "13": "employmentActivities",
  "14": "peopleWhoKnowYou",
  "15": "foreignActivities",
  "16": "foreignContacts",
  "17": "maritalStatus",
  "18": "relatives",
  "19": "foreignContacts",
  "20": "foreignActivities",
  "21": "psychologicalHealth",
  "22": "policeRecord",
  "23": "illegalDrugs",
  "24": "alcoholUse",
  "25": "investigationsAndClearances",
  "26": "financialRecord",
  "27": "informationTechnology",
  "28": "involvement",
  "29": "associationRecord",
  "30": "additionalComments"
};

const SUBSECTION_MAPPINGS: Record<string, Record<string, string>> = {
  "13": {
    "13A.1": "employmentDetails",
    "13A": "employmentActivity",
    "13A.2": "employmentAddress",
    "13A.3": "supervisor",
    "13A.4": "additionalPeriods",
    "13A.5": "verifier",
    "13A.6": "additionalActivity",
    "13C": "unemploymentRecord"
  },
  "20": {
    "20A.1": "foreignTravelIntro",
    "20A": "foreignTravel",
    "20A.2": "travelPurpose",
    "20A.3": "travelDetails",
    "20A.4": "travelContacts",
    "20A.5": "additionalTravel",
    "20B.1": "foreignBusinessIntro",
    "20B.2": "foreignBusiness",
    "20B.3": "businessDetails",
    "20B.4": "businessContacts",
    "20B.5": "businessFinancial",
    "20B.6": "businessActivities",
    "20B.7": "businessRelationships",
    "20B": "foreignBusinessSummary",
    "20B.8": "foreignProperty",
    "20B.9": "propertyDetails",
    "20C": "foreignContacts"
  },
  "10": {
    "root": "education"
  },
  "9": {
    "root": "residenceHistory"
  },
  "17": {
    "root": "maritalStatus"
  },
  "18": {
    "root": "relatives"
  },
  "21": {
    "root": "psychologicalHealth"
  },
  "22": {
    "root": "policeRecord"
  },
  "23": {
    "root": "drugUse"
  },
  "24": {
    "root": "alcoholUse"
  },
  "25": {
    "root": "investigations"
  },
  "26": {
    "root": "financialRecord"
  },
  "27": {
    "root": "informationTechnology"
  },
  "28": {
    "root": "involvement"
  },
  "29": {
    "root": "associations"
  }
};

const LABEL_TO_FIELD_NAME_MAP: Record<string, string> = {
  "First Name": "firstName",
  "Middle Name": "middleName",
  "Last Name": "lastName",
  "Suffix": "suffix",
  "Date of Birth": "dateOfBirth",
  "Place of Birth": "placeOfBirth",
  "City": "city",
  "State": "state",
  "Country": "country",
  "Street Address": "streetAddress",
  "Address Line 1": "addressLine1",
  "Address Line 2": "addressLine2",
  "Zip Code": "zipCode",
  "Postal Code": "postalCode",
  "Phone Number": "phoneNumber",
  "Email": "email",
  "Employer": "employer",
  "Position Title": "positionTitle",
  "Supervisor": "supervisor",
  "From Date": "fromDate",
  "To Date": "toDate",
  "From (month/year)": "fromDate",
  "To (month/year)": "toDate",
  "Reason": "reason",
  "Explanation": "explanation",
  "Yes": "yes",
  "No": "no"
};

function labelToFieldName(label: string): string {
  if (LABEL_TO_FIELD_NAME_MAP[label]) {
    return LABEL_TO_FIELD_NAME_MAP[label];
  }

  // Extract actual field name from verbose labels that include section headers
  // Example: "Section 6. Your Identifying Information. Provide your identifying information. Height (feet)."
  // Should become: "heightFeet"

  let processedLabel = label;

  // Remove section headers like "Section 6. Your Identifying Information. Provide your identifying information. "
  processedLabel = processedLabel.replace(/Section \d+\.\s*[^.]*\.\s*[^.]*\.\s*/, '');

  // Remove trailing periods and extra whitespace
  processedLabel = processedLabel.replace(/\.$/, '').trim();

  // Handle common field patterns
  if (processedLabel.includes('(') && processedLabel.includes(')')) {
    // For fields like "Height (feet)" -> "heightFeet"
    const mainPart = processedLabel.substring(0, processedLabel.indexOf('(')).trim();
    const parenthetical = processedLabel.substring(processedLabel.indexOf('(') + 1, processedLabel.indexOf(')')).trim();

    const mainField = mainPart.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+(.)/g, (_, char) => char.toUpperCase());
    const parentheticalField = parenthetical.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+(.)/g, (_, char) => char.toUpperCase());

    return mainField + parentheticalField.charAt(0).toUpperCase() + parentheticalField.slice(1);
  }

  return processedLabel
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^\s+/, "")
    .replace(/\s+$/, "");
}

function getSectionName(sectionNumber: string): string {
  return SECTION_NAMES[sectionNumber] || `section${sectionNumber}`;
}

function getSubsectionName(sectionNumber: string, subsection: string | null): string | null {
  if (!subsection) return null;

  const sectionMappings = SUBSECTION_MAPPINGS[sectionNumber];
  if (!sectionMappings) return subsection;

  return sectionMappings[subsection] || subsection;
}

export function generateUiPath(
  field: FieldRecord,
  subsection?: string | null,
  entry?: number | null
): string {
  const sectionName = getSectionName(field.section);
  const subsectionValue = subsection !== undefined ? subsection : field.subsection;
  const entryValue = entry !== undefined ? entry : field.entry;

  const subsectionName = getSubsectionName(field.section, subsectionValue);
  const fieldName = labelToFieldName(field.label);

  const parts: string[] = [sectionName];

  if (subsectionName && subsectionName !== "root") {
    parts.push(subsectionName);
  }

  if (entryValue !== null && entryValue !== 0) {
    parts.push(`entries[${entryValue - 1}]`);
  }

  parts.push(fieldName);

  return parts.join(".");
}

export function parseUiPath(uiPath: string): ParsedUiPath {
  const parts = uiPath.split(".");

  let section = "";
  let subsection: string | null = null;
  let entry: number | null = null;
  let fieldName = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (i === 0) {
      section = part;
      continue;
    }

    if (part.startsWith("entries[")) {
      const match = part.match(/entries\[(\d+)\]/);
      if (match) {
        entry = parseInt(match[1], 10) + 1;
      }
      continue;
    }

    if (i === parts.length - 1) {
      fieldName = part;
    } else if (!subsection) {
      subsection = part;
    }
  }

  return {
    section,
    subsection,
    entry,
    fieldName
  };
}

export function getFieldsForUiPath(
  uiPath: string,
  goldenKey: Record<string, FieldRecord>
): FieldRecord[] {
  const parsed = parseUiPath(uiPath);
  const results: FieldRecord[] = [];

  const sectionNumber = Object.entries(SECTION_NAMES).find(
    ([, name]) => name === parsed.section
  )?.[0];

  if (!sectionNumber) return results;

  for (const field of Object.values(goldenKey)) {
    if (field.section !== sectionNumber) continue;

    const fieldSubsectionName = getSubsectionName(field.section, field.subsection);

    if (parsed.subsection && fieldSubsectionName !== parsed.subsection) {
      continue;
    }

    if (parsed.entry !== null && field.entry !== parsed.entry) {
      continue;
    }

    const fieldNameFromLabel = labelToFieldName(field.label);
    if (fieldNameFromLabel === parsed.fieldName) {
      results.push(field);
    }
  }

  return results;
}

export function generateUiPathWithContext(
  field: FieldRecord,
  context?: {
    subsection?: string | null;
    entry?: number | null;
    groupName?: string;
  }
): string {
  const basePath = generateUiPath(field, context?.subsection, context?.entry);

  if (context?.groupName) {
    const parts = basePath.split(".");
    const fieldName = parts.pop();
    return [...parts, context.groupName, fieldName].join(".");
  }

  return basePath;
}

export function isArrayPath(uiPath: string): boolean {
  return uiPath.includes("entries[");
}

export function getArrayIndex(uiPath: string): number | null {
  const match = uiPath.match(/entries\[(\d+)\]/);
  return match ? parseInt(match[1], 10) : null;
}

export function replaceArrayIndex(uiPath: string, newIndex: number): string {
  return uiPath.replace(/entries\[\d+\]/, `entries[${newIndex}]`);
}

export function getBasePath(uiPath: string): string {
  return uiPath.replace(/\.entries\[\d+\]/, "");
}

export function getSectionFromPath(uiPath: string): string {
  return uiPath.split(".")[0];
}

export function getFieldNameFromPath(uiPath: string): string {
  const parts = uiPath.split(".");
  return parts[parts.length - 1];
}

export function buildUiPath(
  section: string,
  subsection?: string | null,
  entry?: number | null,
  fieldName?: string
): string {
  const parts: string[] = [section];

  if (subsection && subsection !== "root") {
    parts.push(subsection);
  }

  if (entry !== null && entry !== undefined && entry !== 0) {
    parts.push(`entries[${entry - 1}]`);
  }

  if (fieldName) {
    parts.push(fieldName);
  }

  return parts.join(".");
}

export function validateUiPath(uiPath: string): boolean {
  if (!uiPath || typeof uiPath !== "string") return false;

  const parts = uiPath.split(".");
  if (parts.length < 2) return false;

  const section = parts[0];
  if (!Object.values(SECTION_NAMES).includes(section)) return false;

  for (const part of parts) {
    if (part.startsWith("entries[")) {
      const match = part.match(/^entries\[\d+\]$/);
      if (!match) return false;
    }
  }

  return true;
}

export function normalizeUiPath(uiPath: string): string {
  return uiPath
    .replace(/\s+/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\./, "")
    .replace(/\.$/, "");
}

export {
  SECTION_NAMES,
  SUBSECTION_MAPPINGS,
  LABEL_TO_FIELD_NAME_MAP
};
