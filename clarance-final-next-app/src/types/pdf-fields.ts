export enum FieldType {
  CHECKBOX = 2,
  DROPDOWN = 3,
  RADIO = 5,
  TEXT = 7,
}

export interface FieldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RadioOption {
  fieldId: string;
  value: string;
  label: string;
  selected: boolean;
}

export interface DropdownOption {
  value: string;
  label: string;
  uiLabel: string;
}

export interface PDFField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  page: number;
  rect: FieldRect;
  section: string | null;
  subsection: string | null;
  entry: number | null;
  radioOptions?: RadioOption[];
  options?: string[] | DropdownOption[]; // Support both old and new formats
  groupFieldId?: string;
}

export interface EntryInfo {
  pages: number[];
  fieldIds: string[];
}

export interface SubsectionInfo {
  pages: number[];
  entries: Record<string, EntryInfo>;
  fieldCount: number;
}

export interface SectionInfo {
  pages: number[];
  pageRange: [number, number];
  fieldCount: number;
  subsections: Record<string, SubsectionInfo>;
}

export type FieldIndex = Record<string, PDFField>;

export type SectionsSummary = Record<string, SectionInfo>;

export interface FieldValue {
  fieldId: string;
  value: string | boolean;
}

export type FormValues = Record<string, string | boolean>;

export function getFieldTypeLabel(type: FieldType): string {
  switch (type) {
    case FieldType.CHECKBOX:
      return "Checkbox";
    case FieldType.DROPDOWN:
      return "Dropdown";
    case FieldType.RADIO:
      return "Radio";
    case FieldType.TEXT:
      return "Text";
    default:
      return "Unknown";
  }
}

export function isTextField(field: PDFField): boolean {
  return field.type === FieldType.TEXT;
}

export function isCheckboxField(field: PDFField): boolean {
  return field.type === FieldType.CHECKBOX;
}

export function isRadioField(field: PDFField): boolean {
  return field.type === FieldType.RADIO;
}

export function isDropdownField(field: PDFField): boolean {
  return field.type === FieldType.DROPDOWN;
}
