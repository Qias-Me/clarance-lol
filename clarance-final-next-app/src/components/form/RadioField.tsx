"use client";

import { useFormContext } from "@/lib/form-context";
import type { PDFField, RadioOption } from "@/types/pdf-fields";

interface RadioFieldProps {
  field: PDFField;
  groupFields?: PDFField[];
  radioOptions?: RadioOption[];
  className?: string;
}

export function RadioField({ field, groupFields, radioOptions, className = "" }: RadioFieldProps): React.ReactNode {
  const { getValue, setValue, setSelectedField, selectedField } = useFormContext();
  const value = getValue(field.id) as string;
  const isSelected = selectedField?.id === field.id;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setValue(field.id, e.target.value);
  }

  function handleFocus(): void {
    setSelectedField(field);
  }

  // Use radioOptions if provided, otherwise fall back to groupFields
  const options = radioOptions ? radioOptions.map((option, idx) => ({
    id: option.fieldId,
    label: option.label,
    value: option.value
  })) : groupFields ? groupFields.map((opt, idx) => ({
    id: opt.id,
    label: opt.label || `Option ${idx + 1}`,
    value: opt.id
  })) : [{
    id: field.id,
    label: field.label || field.name,
    value: field.id
  }];

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <span className="text-sm font-medium text-gray-700 truncate" title={field.label}>
        {field.label || field.name}
      </span>
      <div className="flex flex-wrap gap-3">
        {options.map((opt, idx) => (
          <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`radio-group-${field.name}`}
              value={opt.value}
              checked={value === opt.value}
              onChange={handleChange}
              onFocus={handleFocus}
              className={`
                w-4 h-4 text-blue-600 border-gray-300
                focus:ring-2 focus:ring-blue-500
                ${isSelected ? "ring-2 ring-blue-500" : ""}
              `}
            />
            <span className="text-sm text-gray-600">
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
