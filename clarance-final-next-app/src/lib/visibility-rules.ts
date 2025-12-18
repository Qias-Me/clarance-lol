/**
 * Visibility Rules Engine
 * 
 * Controls conditional visibility of fields and subsections based on controller field values.
 * This is a client-side, deterministic system that never modifies field IDs or mapping.
 * 
 * @module visibility-rules
 */

import type { FormValues } from "@/types/pdf-fields";

/**
 * Rule to show/hide fields based on a controller field's value.
 * 
 * @property controllerFieldId - string - The field that triggers the rule.
 * @property triggerValue - string | string[] - Value(s) that activate the rule.
 * @property action - "show" | "hide" - What to do when triggered.
 * @property targetType - "section" | "subsection" | "entry" | "fieldIds" - What to target.
 * @property targetSection - string - Target section (optional).
 * @property targetSubsection - string - Target subsection (optional).
 * @property targetEntry - number - Target entry number (optional).
 * @property targetFieldIds - string[] - Specific field IDs to target (optional).
 */
export interface VisibilityRule {
  controllerFieldId: string;
  triggerValue: string | string[];
  action: "show" | "hide";
  targetType: "section" | "subsection" | "entry" | "fieldIds";
  targetSection?: string;
  targetSubsection?: string;
  targetEntry?: number;
  targetFieldIds?: string[];
}

/**
 * Result of evaluating visibility rules for a field.
 * 
 * @property visible - boolean - Whether the field should be visible.
 * @property reason - string - Why the field is visible/hidden (for debugging).
 */
export interface VisibilityResult {
  visible: boolean;
  reason?: string;
}

/**
 * SF-86 Visibility Rules
 *
 * These rules define conditional field visibility based on YES/NO answers.
 * Structure: When controllerFieldId equals triggerValue, show/hide targets.
 *
 * Implementation: Uses actual field IDs from field-groups.json and subsection mapping.
 * Controller fields trigger visibility changes for dependent subsections and fields.
 */
export const SF86_VISIBILITY_RULES: VisibilityRule[] = [
  // Section 13: Foreign Contacts - Show 13A subsections when user has foreign contacts
  {
    controllerFieldId: "form1[0].#subform[68].RadioButtonList[0]", // "Do you have foreign contacts?" YES/NO
    triggerValue: "1", // YES option (assuming exportValue "1" for YES)
    action: "show",
    targetType: "subsection",
    targetSection: "13",
    targetSubsection: "13A.1"
  },
  {
    controllerFieldId: "form1[0].#subform[68].RadioButtonList[0]", // "Do you have foreign contacts?" YES/NO
    triggerValue: "1", // YES option
    action: "show",
    targetType: "subsection",
    targetSection: "13",
    targetSubsection: "13A.2"
  },
  {
    controllerFieldId: "form1[0].#subform[68].RadioButtonList[0]", // "Do you have foreign contacts?" YES/NO
    triggerValue: "1", // YES option
    action: "show",
    targetType: "subsection",
    targetSection: "13",
    targetSubsection: "13B"
  },

  // Section 14: Foreign Activities - Show subsections based on specific activities
  {
    controllerFieldId: "form1[0].#subform[70].RadioButtonList[0]", // "Foreign travel?" YES/NO
    triggerValue: "1", // YES option
    action: "show",
    targetType: "subsection",
    targetSection: "14",
    targetSubsection: "14A"
  },
  {
    controllerFieldId: "form1[0].#subform[71].RadioButtonList[0]", // "Foreign employment?" YES/NO
    triggerValue: "1", // YES option
    action: "show",
    targetType: "subsection",
    targetSection: "14",
    targetSubsection: "14B"
  },
  {
    controllerFieldId: "form1[0].#subform[72].RadioButtonList[0]", // "Foreign business?" YES/NO
    triggerValue: "1", // YES option
    action: "show",
    targetType: "subsection",
    targetSection: "14",
    targetSubsection: "14C"
  },
  {
    controllerFieldId: "form1[0].#subform[73].RadioButtonList[0]", // "Foreign investments?" YES/NO
    triggerValue: "1", // YES option
    action: "show",
    targetType: "subsection",
    targetSection: "14",
    targetSubsection: "14D"
  },
  {
    controllerFieldId: "form1[0].#subform[74].RadioButtonList[0]", // "Foreign real estate?" YES/NO
    triggerValue: "1", // YES option
    action: "show",
    targetType: "subsection",
    targetSection: "14",
    targetSubsection: "14E"
  },
  {
    controllerFieldId: "form1[0].#subform[75].RadioButtonList[0]", // "Foreign contacts?" YES/NO (different from Section 13)
    triggerValue: "1", // YES option
    action: "show",
    targetType: "subsection",
    targetSection: "14",
    targetSubsection: "14F"
  },

  // Section 20: Police Record - Show details when user has police record
  {
    controllerFieldId: "form1[0].#subform[90].RadioButtonList[0]", // "Police record?" YES/NO
    triggerValue: "1", // YES option
    action: "show",
    targetType: "subsection",
    targetSection: "20",
    targetSubsection: "20A"
  },

  // Section 21: Illegal Drugs - Show drug details when user has used illegal drugs
  {
    controllerFieldId: "form1[0].#subform[92].RadioButtonList[0]", // "Used illegal drugs?" YES/NO
    triggerValue: "1", // YES option
    action: "show",
    targetType: "subsection",
    targetSection: "21",
    targetSubsection: "21A"
  },
  {
    controllerFieldId: "form1[0].#subform[93].RadioButtonList[0]", // "Used drugs in last 7 years?" YES/NO
    triggerValue: "1", // YES option
    action: "show",
    targetType: "subsection",
    targetSection: "21",
    targetSubsection: "21B"
  },

  // Section 26: Civil Court Actions - Show details when user has civil court actions
  {
    controllerFieldId: "form1[0].#subform[100].RadioButtonList[0]", // "Civil court actions?" YES/NO
    triggerValue: "1", // YES option
    action: "show",
    targetType: "subsection",
    targetSection: "26",
    targetSubsection: "26A"
  }
];

/**
 * Evaluates whether a value matches the trigger.
 * 
 * @param actualValue - string | boolean | undefined - The current field value.
 * @param triggerValue - string | string[] - The value(s) to match.
 * @returns boolean - True if the value matches the trigger.
 */
function matchesTrigger(actualValue: string | boolean | undefined, triggerValue: string | string[]): boolean {
  if (actualValue === undefined) return false;
  
  const stringValue = String(actualValue).toUpperCase();
  
  if (Array.isArray(triggerValue)) {
    return triggerValue.some(tv => tv.toUpperCase() === stringValue);
  }
  
  return triggerValue.toUpperCase() === stringValue;
}

/**
 * Checks if a field should be visible based on visibility rules.
 * 
 * @param fieldId - string - The field ID to check.
 * @param fieldSection - string - The field's section.
 * @param fieldSubsection - string | null - The field's subsection.
 * @param fieldEntry - number | null - The field's entry number.
 * @param formValues - FormValues - Current form values.
 * @param rules - VisibilityRule[] - Rules to evaluate (defaults to SF86_VISIBILITY_RULES).
 * @returns VisibilityResult - Whether the field should be visible.
 * 
 * Bug-relevant: Default is visible=true. Rules only hide when conditions unmet.
 */
export function isFieldVisible(
  fieldId: string,
  fieldSection: string,
  fieldSubsection: string | null,
  fieldEntry: number | null,
  formValues: FormValues,
  rules: VisibilityRule[] = SF86_VISIBILITY_RULES
): VisibilityResult {
  // Default: all fields are visible
  let visible = true;
  let reason: string | undefined;

  for (const rule of rules) {
    const controllerValue = formValues[rule.controllerFieldId];
    const triggered = matchesTrigger(controllerValue, rule.triggerValue);

    // Check if this rule applies to this field
    let ruleApplies = false;

    switch (rule.targetType) {
      case "section":
        ruleApplies = rule.targetSection === fieldSection;
        break;
      case "subsection":
        ruleApplies = rule.targetSection === fieldSection && 
                      rule.targetSubsection === fieldSubsection;
        break;
      case "entry":
        ruleApplies = rule.targetSection === fieldSection && 
                      rule.targetEntry === fieldEntry;
        break;
      case "fieldIds":
        ruleApplies = rule.targetFieldIds?.includes(fieldId) || false;
        break;
    }

    if (ruleApplies) {
      if (rule.action === "show") {
        // Show rule: visible only if triggered
        visible = triggered;
        reason = triggered 
          ? `Shown by ${rule.controllerFieldId}=${controllerValue}`
          : `Hidden: ${rule.controllerFieldId} is not ${rule.triggerValue}`;
      } else {
        // Hide rule: hidden only if triggered
        visible = !triggered;
        reason = triggered
          ? `Hidden by ${rule.controllerFieldId}=${controllerValue}`
          : `Shown: ${rule.controllerFieldId} is not ${rule.triggerValue}`;
      }
    }
  }

  return { visible, reason };
}

/**
 * Gets all subsections that should be visible for a section.
 * 
 * @param sectionId - string - The section to check.
 * @param formValues - FormValues - Current form values.
 * @param allSubsections - string[] - All subsections in the section.
 * @returns string[] - Visible subsection names.
 */
export function getVisibleSubsections(
  sectionId: string,
  formValues: FormValues,
  allSubsections: string[]
): string[] {
  return allSubsections.filter(subsection => {
    const result = isFieldVisible("", sectionId, subsection, null, formValues);
    return result.visible;
  });
}

/**
 * Checks if any entry in a section should be hidden based on rules.
 * 
 * @param sectionId - string - The section to check.
 * @param entryNumber - number - The entry number.
 * @param formValues - FormValues - Current form values.
 * @returns boolean - True if the entry should be visible.
 */
export function isEntryVisible(
  sectionId: string,
  entryNumber: number,
  formValues: FormValues
): boolean {
  const result = isFieldVisible("", sectionId, null, entryNumber, formValues);
  return result.visible;
}

/**
 * Gets controller field IDs for a section (fields that control visibility).
 * 
 * @param sectionId - string - The section to check.
 * @returns string[] - Controller field IDs for this section.
 */
export function getControllerFields(sectionId: string): string[] {
  return SF86_VISIBILITY_RULES
    .filter(rule => rule.targetSection === sectionId)
    .map(rule => rule.controllerFieldId);
}
