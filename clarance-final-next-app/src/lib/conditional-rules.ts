/**
 * Conditional Logic Rules for Dynamic Field Rendering
 * Based on PDF form instructions and field relationships
 */

export interface ConditionalRule {
  when: {
    fieldName: string;
    equals: string;
  };
  show: string[];
  hide?: string[];
}

export interface FieldVisibilityState {
  [subsectionKey: string]: boolean;
}

// Section 13 Employment Activity Rules
// Field: form1[0].section_13_1-2[0].RadioButtonList[0]
const EMPLOYMENT_ACTIVITY_FIELD = "form1[0].section_13_1-2[0].RadioButtonList[0]";

export const section13Rules: ConditionalRule[] = [
  // Active military duty station
  { when: { fieldName: EMPLOYMENT_ACTIVITY_FIELD, equals: "0" }, show: ["13A.1", "13A.5", "13A.6"] },

  // National Guard/Reserve
  { when: { fieldName: EMPLOYMENT_ACTIVITY_FIELD, equals: "1" }, show: ["13A.1", "13A.5", "13A.6"] },

  // USPHS Commissioned Corps
  { when: { fieldName: EMPLOYMENT_ACTIVITY_FIELD, equals: "2" }, show: ["13A.1", "13A.5", "13A.6"] },

  // Other Federal employment
  { when: { fieldName: EMPLOYMENT_ACTIVITY_FIELD, equals: "3" }, show: ["13A.2", "13A.5", "13A.6"] },

  // State Government
  { when: { fieldName: EMPLOYMENT_ACTIVITY_FIELD, equals: "4" }, show: ["13A.2", "13A.5", "13A.6"] },

  // Self-employment
  { when: { fieldName: EMPLOYMENT_ACTIVITY_FIELD, equals: "5" }, show: ["13A.3", "13A.5", "13A.6"] },

  // Unemployment
  { when: { fieldName: EMPLOYMENT_ACTIVITY_FIELD, equals: "6" }, show: ["13A.4"] },

  // Federal Contractor
  { when: { fieldName: EMPLOYMENT_ACTIVITY_FIELD, equals: "7" }, show: ["13A.2", "13A.5", "13A.6"] },

  // Non-government employment
  { when: { fieldName: EMPLOYMENT_ACTIVITY_FIELD, equals: "8" }, show: ["13A.2", "13A.5", "13A.6"] },

  // Other
  { when: { fieldName: EMPLOYMENT_ACTIVITY_FIELD, equals: "9" }, show: ["13A.2", "13A.5", "13A.6"] },
];

// Additional rule sets can be added for other sections
export const conditionalRuleSets = {
  "section13": section13Rules,
  // Add more sections as needed
};

/**
 * Evaluate conditional rules for a given form state
 */
export function evaluateConditionalRules(
  sectionKey: string,
  formValues: Record<string, any>
): FieldVisibilityState {
  const rules = conditionalRuleSets[sectionKey as keyof typeof conditionalRuleSets];

  if (!rules) {
    return {};
  }

  const visibility: FieldVisibilityState = {};

  // Default all subsections to hidden
  const allSubsections = new Set<string>();
  rules.forEach(rule => {
    rule.show.forEach(subsection => allSubsections.add(subsection));
    rule.hide?.forEach(subsection => allSubsections.add(subsection));
  });

  allSubsections.forEach(subsection => {
    visibility[subsection] = false;
  });

  // Apply rules
  rules.forEach(rule => {
    const currentValue = formValues[rule.when.fieldName];

    if (currentValue === rule.when.equals) {
      rule.show.forEach(subsection => {
        visibility[subsection] = true;
      });

      rule.hide?.forEach(subsection => {
        visibility[subsection] = false;
      });
    }
  });

  return visibility;
}

/**
 * Get fields that should be visible for current form state
 */
export function getVisibleFields(
  sectionKey: string,
  formValues: Record<string, any>,
  allFields: Array<{ subsection?: string; entry?: number }>
): Array<{ subsection?: string; entry?: number }> {
  const visibility = evaluateConditionalRules(sectionKey, formValues);

  return allFields.filter(field => {
    if (!field.subsection) return true; // Always show fields without subsection
    return visibility[field.subsection] || false;
  });
}

/**
 * Check if a specific field should be visible
 */
export function isFieldVisible(
  sectionKey: string,
  formValues: Record<string, any>,
  subsectionKey: string
): boolean {
  const visibility = evaluateConditionalRules(sectionKey, formValues);
  return visibility[subsectionKey] || false;
}

/**
 * React hook for conditional field visibility
 */
export function useConditionalVisibility(sectionKey: string, formValues: Record<string, any>) {
  const visibility = evaluateConditionalRules(sectionKey, formValues);

  return {
    visibility,
    isSubsectionVisible: (subsectionKey: string) => visibility[subsectionKey] || false,
    visibleSubsections: Object.entries(visibility)
      .filter(([_, visible]) => visible)
      .map(([subsection]) => subsection),
    hiddenSubsections: Object.entries(visibility)
      .filter(([_, visible]) => !visible)
      .map(([subsection]) => subsection)
  };
}