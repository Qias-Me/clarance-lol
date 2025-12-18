"use client";

import { useFormContext } from "@/lib/form-context";
import type { PDFField, DropdownOption } from "@/types/pdf-fields";

interface DropdownFieldProps {
  field: PDFField;
  options?: string[] | DropdownOption[];
  className?: string;
}

export function DropdownField({ field, options = [], className = "" }: DropdownFieldProps): React.ReactNode {
  const { getValue, setValue, setSelectedField, selectedField } = useFormContext();
  const value = (getValue(field.id) as string) || "";
  const isSelected = selectedField?.id === field.id;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    setValue(field.id, e.target.value);
  }

  function handleFocus(): void {
    setSelectedField(field);
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label
        htmlFor={`field-${field.id}`}
        className="text-sm font-medium text-gray-700 truncate"
        title={field.label}
      >
        {field.label || field.name}
      </label>
      <select
        id={`field-${field.id}`}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        className={`
          w-full px-3 py-2 border rounded-md text-sm bg-white text-gray-900
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          ${isSelected ? "ring-2 ring-blue-500 border-blue-500" : "border-gray-300"}
        `}
      >
        <option value="">Select...</option>
        {options.map((opt) => {
          // Handle both old string format and new DropdownOption format
          if (typeof opt === 'string') {
            return (
              <option key={opt} value={opt}>
                {opt}
              </option>
            );
          } else {
            // New DropdownOption format with value, label, uiLabel
            const dropdownOption = opt as DropdownOption;
            return (
              <option key={dropdownOption.value} value={dropdownOption.value}>
                {dropdownOption.label || dropdownOption.uiLabel || dropdownOption.value}
              </option>
            );
          }
        })}
      </select>
    </div>
  );
}
