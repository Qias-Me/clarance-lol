"use client";

import { useFormContext } from "@/lib/form-context";
import type { PDFField } from "@/types/pdf-fields";

interface CheckboxFieldProps {
  field: PDFField;
  className?: string;
}

export function CheckboxField({ field, className = "" }: CheckboxFieldProps): React.ReactNode {
  const { getValue, setValue, setSelectedField, selectedField } = useFormContext();
  const checked = (getValue(field.id) as boolean) || false;
  const isSelected = selectedField?.id === field.id;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setValue(field.id, e.target.checked);
  }

  function handleFocus(): void {
    setSelectedField(field);
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        id={`field-${field.id}`}
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        onFocus={handleFocus}
        className={`
          w-4 h-4 rounded border-gray-300 text-blue-600
          focus:ring-2 focus:ring-blue-500
          ${isSelected ? "ring-2 ring-blue-500" : ""}
        `}
      />
      <label
        htmlFor={`field-${field.id}`}
        className="text-sm font-medium text-gray-700 truncate cursor-pointer"
        title={field.label}
      >
        {field.label || field.name}
      </label>
    </div>
  );
}
