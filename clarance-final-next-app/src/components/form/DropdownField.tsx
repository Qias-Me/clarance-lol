"use client";

import { useState, useEffect } from "react";
import { useFormContext } from "@/lib/form-context";
import type { PDFField, DropdownOption } from "@/types/pdf-fields";
import { getDropdownOptions } from "@/lib/dropdown-options-service";

/**
 * Props for the DropdownField component.
 * 
 * @property field - PDFField - The field metadata.
 * @property options - string[] | DropdownOption[] - Pre-loaded options (optional).
 * @property className - string - Additional CSS classes.
 */
interface DropdownFieldProps {
  field: PDFField;
  options?: string[] | DropdownOption[];
  className?: string;
}

/**
 * Dropdown field component with fallback option loading.
 * 
 * @param props - DropdownFieldProps - Component props.
 * @returns React.ReactNode - The rendered dropdown.
 * 
 * Bug-fix: Falls back to PDF extraction when options prop is empty.
 * This ensures dropdowns always show options even when field-groups.json is incomplete.
 */
export function DropdownField({ field, options = [], className = "" }: DropdownFieldProps): React.ReactNode {
  const { getValue, setValue, setSelectedField, selectedField } = useFormContext();
  const value = (getValue(field.id) as string) || "";
  const isSelected = selectedField?.id === field.id;
  const [loadedOptions, setLoadedOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (options.length === 0 && loadedOptions.length === 0 && !isLoading) {
      setIsLoading(true);
      getDropdownOptions(field.name).then((pdfOptions) => {
        if (pdfOptions.length > 0) {
          setLoadedOptions(pdfOptions);
          console.log(`📋 Loaded ${pdfOptions.length} fallback options for: ${field.id}`);
        }
      }).catch((error) => {
        console.warn(`⚠️ Failed to load fallback options for ${field.id}:`, error);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [field.id, field.name, options.length, loadedOptions.length, isLoading]);

  const effectiveOptions = options.length > 0 ? options : loadedOptions;

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
        disabled={isLoading}
        className={`
          w-full px-3 py-2 border rounded-md text-sm bg-white text-gray-900
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          ${isSelected ? "ring-2 ring-blue-500 border-blue-500" : "border-gray-300"}
          ${isLoading ? "opacity-50 cursor-wait" : ""}
        `}
      >
        <option value="">{isLoading ? "Loading options..." : "Select..."}</option>
        {effectiveOptions.map((opt) => {
          if (typeof opt === 'string') {
            return (
              <option key={opt} value={opt}>
                {opt}
              </option>
            );
          } else {
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
