# PDF Radio Button Value Requirements

## Overview

PDF forms require very specific value formats for radio button fields. The SF-86 form uses different value formats depending on the field type and section. This document outlines the requirements and provides implementation guidance.

## Value Formats

### 1. Standard Uppercase Format (Most Common)
- **Pattern:** `"YES"` / `"NO"`
- **Usage:** Most acknowledgement, confirmation, and binary choice fields
- **Example:** `form1[0].Sections1-6[0].RadioButtonList[0]` → `"YES"`

### 2. Uppercase with Trailing Space
- **Pattern:** `"YES "` / `"NO "` (note the trailing space)
- **Usage:** Specific fields in Sections 11, 18, 24
- **Example:** `form1[0].Section11_4[0].RadioButtonList[0]` → `"YES "`

### 3. Numeric Format
- **Pattern:** `"1"` / `"0"`
- **Usage:** Employment estimation, frequency, and quantity fields
- **Example:** `form1[0].Section11[0].RadioButtonList[0]` → `"1"`

### 4. Title Case Format
- **Pattern:** `"Yes"` / `"No"`
- **Usage:** Some Section 14 foreign contact fields
- **Example:** `form1[0].Section14_1[0].#area[0].RadioButtonList[0]` → `"Yes"`

## Implementation Guidelines

### Automatic Formatting
Use the `formatAllRadioValues()` function to automatically format radio button values:

```typescript
import { formatAllRadioValues } from '@/lib/pdf-field-value-formatter';

// Apply automatic formatting before PDF generation
const formattedValues = formatAllRadioValues(userValues);
```

### Field Detection
The formatter automatically detects radio button fields by these patterns:
- `RadioButtonList`
- `radiobuttonlist`
- `RadioGroup`

### Validation
Use `createRadioFieldValidationReport()` to check formatting:

```typescript
import { createRadioFieldValidationReport } from '@/lib/pdf-field-value-formatter';

const report = createRadioFieldValidationReport(values);
console.log(`Radio fields: ${report.formatted}/${report.total} valid`);
```

## Field-Specific Configurations

### Section 1 - Personal Information
- **Acknowledgement:** `"YES"` / `"NO"` (uppercase)
- **Field:** `form1[0].Sections1-6[0].RadioButtonList[0]`

### Section 11 - Employment Activities
- **Estimation fields:** `"1"` / `"0"` (numeric)
- **Field pattern:** `form1[0].Section11-2[0].RadioButtonList[0]`

### Section 18 - People Who Know You
- **Foreign military service:** `"YES"` / `"NO"` (uppercase)
- **APO/FPO address:** `"YES "` / `"NO "` (with space)

### Section 22 - Illegal Drugs
- **Confirmation fields:** `"YES"` / `"NO"` (uppercase)

## Common Issues and Solutions

### Issue: Radio button not appearing in PDF
**Cause:** Incorrect value format
**Solution:** Ensure exact match with PDF's exportValue
```typescript
// ❌ Wrong format
values['RadioButtonList[0]'] = 'true';

// ✅ Correct format
values['RadioButtonList[0]'] = 'YES';
```

### Issue: Value appears but isn't selected
**Cause:** Case sensitivity or trailing space requirements
**Solution:** Use exact case and spacing
```typescript
// ❌ Wrong case
values['RadioButtonList[0]'] = 'yes';

// ❌ Missing trailing space
values['RadioButtonList[0]'] = 'YES';

// ✅ Correct format
values['RadioButtonList[0]'] = 'YES';
```

### Issue: Field accepts multiple values
**Cause:** Using array instead of single string
**Solution:** Use single string value
```typescript
// ❌ Wrong format
values['RadioButtonList[0]'] = ['YES', 'NO'];

// ✅ Correct format
values['RadioButtonList[0]'] = 'YES';
```

## Testing Radio Button Values

### Manual Testing
1. Fill form with radio button selections
2. Generate PDF
3. Check console output for formatting messages
4. Verify PDF shows correct selections

### Automated Testing
```typescript
import { validateRadioValue, getExpectedRadioValues } from '@/lib/pdf-field-value-formatter';

const fieldName = 'form1[0].Sections1-6[0].RadioButtonList[0]';
const value = 'YES';

const isValid = validateRadioValue(fieldName, value);
const expectedValues = getExpectedRadioValues(fieldName);

console.log(`Valid: ${isValid}, Expected: ${expectedValues.join(', ')}`);
```

## Migration Guide

### From Boolean Values
```typescript
// Old approach
values[fieldName] = true;

// New approach
values[fieldName] = formatRadioValue(fieldName, true); // → "YES"
```

### From Numeric Values
```typescript
// Old approach
values[fieldName] = 1;

// New approach
values[fieldName] = formatRadioValue(fieldName, 1); // → "1" or "YES" based on field
```

### From String Values
```typescript
// Old approach (may not work)
values[fieldName] = 'selected';

// New approach
values[fieldName] = formatRadioValue(fieldName, 'selected'); // → "YES"
```

## Debug Information

When radio button fields aren't working, check:
1. **Field name:** Exact match with PDF field name
2. **Value format:** Matches PDF's exportValue exactly
3. **Console logs:** Look for formatting messages
4. **PDF size:** Increased size indicates values were applied

The formatter will log all formatting changes:
```
🔧 Radio field formatting applied: 3/3 valid
✅ form1[0].Sections1-6[0].RadioButtonList[0]: "true" → "YES"
```

## Best Practices

1. **Always use the formatter** for radio button values
2. **Test with actual PDF** to verify selections appear
3. **Check console logs** for formatting feedback
4. **Validate field names** match PDF structure exactly
5. **Use automatic formatting** rather than manual value setting

This ensures consistent radio button behavior across all SF-86 form sections.