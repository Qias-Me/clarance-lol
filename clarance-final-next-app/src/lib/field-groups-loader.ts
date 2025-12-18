export interface RadioOption {
  exportValue: string;
  onState: string;
  stableId: string;
  pageIndex: number;
  uiLabel: string;
  displayLabel: string;
}

export interface DropdownOption {
  label: string;
  exportValue: string;
  uiLabel: string;
  displayLabel: string;
}

interface Widget {
  stableId: string;
  onState: string;
  rectTopLeft: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface FieldGroup {
  fieldName: string;
  fieldType: string;
  displayLabel: string;
  section: string | null;
  sectionPart: string | null;
  subsection: string | null;
  entry: string | null;
  pageIndex: number;
  options?: RadioOption[] | DropdownOption[];
  widgets?: Widget[];
}

export type FieldGroups = Record<string, FieldGroup>;

export async function loadFieldGroups(): Promise<FieldGroups> {
  if (typeof window === "undefined") {
    const { readFile } = eval("require")("fs/promises");
    const data = await readFile("./public/data/field-groups.json", "utf-8");
    return JSON.parse(data);
  }

  const response = await fetch("/data/field-groups.json");
  if (!response.ok) {
    throw new Error(`Failed to load field groups: ${response.statusText}`);
  }
  return response.json();
}

export function getFieldGroup(fieldName: string, fieldGroups: FieldGroups): FieldGroup | null {
  return fieldGroups[fieldName] || null;
}

export function isRadioGroup(fieldGroup: FieldGroup): boolean {
  return fieldGroup.fieldType === "RadioGroup" && !!fieldGroup.options;
}

export function getRadioOptions(fieldGroup: FieldGroup): RadioOption[] {
  return isRadioGroup(fieldGroup) ? (fieldGroup.options as RadioOption[]) || [] : [];
}

export function isDropdownGroup(fieldGroup: FieldGroup): boolean {
  return fieldGroup.fieldType === "Dropdown" && !!fieldGroup.options;
}

export function getDropdownOptions(fieldGroup: FieldGroup): DropdownOption[] {
  return isDropdownGroup(fieldGroup) ? (fieldGroup.options as DropdownOption[]) || [] : [];
}