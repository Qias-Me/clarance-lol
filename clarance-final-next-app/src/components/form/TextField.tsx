"use client";

import { useFormContext } from "@/lib/form-context";
import type { PDFField } from "@/types/pdf-fields";

interface TextFieldProps {
  field: PDFField;
  className?: string;
}

export function TextField({ field, className = "" }: TextFieldProps): React.ReactNode {
  const { getValue, setValue, setSelectedField, selectedField } = useFormContext();
  const value = (getValue(field.id) as string) || "";
  const isSelected = selectedField?.id === field.id;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
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
      <input
        id={`field-${field.id}`}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        className={`
          w-full px-3 py-2 border rounded-md text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          ${isSelected ? "ring-2 ring-blue-500 border-blue-500" : "border-gray-300"}
          bg-white text-gray-900 placeholder-gray-500
        `}
        placeholder={field.label || "Enter value..."}
      />
    </div>
  );
}
