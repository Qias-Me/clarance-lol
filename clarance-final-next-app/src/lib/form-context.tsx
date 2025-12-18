"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { FormValues, PDFField } from "@/types/pdf-fields";
import type { GoldenKeyInventory } from "@/types/golden-key";
import { formDataPersistence, FormDataPersistenceService } from "@/lib/form-data-persistence";
import {
  type EntryState,
  type SectionEntryConfig,
  detectMultiEntrySections,
  createInitialEntryState,
  addNextEntry,
  removeEntry,
  toggleEntryExpanded,
} from "@/lib/entry-manager";

/**
 * Form context value interface.
 * 
 * @property values - FormValues - Current form field values.
 * @property setValue - Function - Sets a single field value.
 * @property getValue - Function - Gets a single field value.
 * @property setValues - Function - Replaces all form values.
 * @property clearValues - Function - Clears all form values.
 * @property getFilledFieldCount - Function - Counts filled fields.
 * @property selectedField - PDFField | null - Currently selected field.
 * @property setSelectedField - Function - Sets selected field.
 * @property currentSection - string | null - Currently viewed section.
 * @property setCurrentSection - Function - Changes current section.
 * @property currentPage - number - Current page number.
 * @property setCurrentPage - Function - Changes current page.
 * @property saveData - Function - Manually saves form data.
 * @property isLoading - boolean - Whether form data is loading.
 * @property lastSaved - number | null - Timestamp of last save.
 * @property entryConfigs - Record - Multi-entry section configurations.
 * @property entryStates - Record - Current entry states per section.
 * @property initializeEntryConfigs - Function - Initializes entry configs from golden-key.
 * @property addEntry - Function - Adds an entry to a section.
 * @property removeEntryFromSection - Function - Removes an entry from a section.
 * @property toggleEntry - Function - Toggles entry expansion.
 * @property isEntryActive - Function - Checks if entry is active.
 * @property isEntryExpanded - Function - Checks if entry is expanded.
 */
interface FormContextValue {
  values: FormValues;
  setValue: (fieldId: string, value: string | boolean) => void;
  getValue: (fieldId: string) => string | boolean | undefined;
  setValues: (newValues: FormValues) => void;
  clearValues: () => void;
  getFilledFieldCount: () => number;
  selectedField: PDFField | null;
  setSelectedField: (field: PDFField | null) => void;
  currentSection: string | null;
  setCurrentSection: (section: string | null) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  saveData: () => Promise<boolean>;
  isLoading: boolean;
  lastSaved: number | null;
  entryConfigs: Record<string, SectionEntryConfig>;
  entryStates: Record<string, EntryState>;
  initializeEntryConfigs: (goldenKey: GoldenKeyInventory) => void;
  addEntry: (sectionId: string) => void;
  removeEntryFromSection: (sectionId: string, entryNumber: number) => void;
  toggleEntry: (sectionId: string, entryNumber: number) => void;
  isEntryActive: (sectionId: string, entryNumber: number) => boolean;
  isEntryExpanded: (sectionId: string, entryNumber: number) => boolean;
}

const FormContext = createContext<FormContextValue | null>(null);

interface FormProviderProps {
  children: ReactNode;
  initialValues?: FormValues;
}

export function FormProvider({
  children,
  initialValues = {},
}: FormProviderProps): ReactNode {
  const [values, setValuesState] = useState<FormValues>(initialValues);
  const [selectedField, setSelectedField] = useState<PDFField | null>(null);
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [entryConfigs, setEntryConfigs] = useState<Record<string, SectionEntryConfig>>({});
  const [entryStates, setEntryStates] = useState<Record<string, EntryState>>({});

  // Load saved data on component mount
  useEffect(() => {
    async function loadSavedData() {
      if (!(formDataPersistence.constructor as typeof FormDataPersistenceService).isSupported()) {
        console.warn("IndexedDB is not supported. Form data will not be persisted.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const savedValues = await formDataPersistence.loadFormData();
        if (Object.keys(savedValues).length > 0) {
          setValuesState(savedValues);

          // Load metadata
          const metadata = await formDataPersistence.getFormDataMetadata();
          setLastSaved(metadata.lastSaved);

          console.log(`Loaded ${Object.keys(savedValues).length} saved form values`);
        }
      } catch (error) {
        console.error("Failed to load saved form data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSavedData();
  }, []);

  // Auto-save when values change
  useEffect(() => {
    if (!isLoading && Object.keys(values).length > 0) {
      const saveTimeout = setTimeout(async () => {
        try {
          const success = await formDataPersistence.saveFormData(values);
          if (success) {
            setLastSaved(Date.now());
            console.log("Form data auto-saved");
          }
        } catch (error) {
          console.error("Failed to auto-save form data:", error);
        }
      }, 1000); // Debounce save by 1 second

      return () => clearTimeout(saveTimeout);
    }
  }, [values, isLoading]);

  const setValue = useCallback((fieldId: string, value: string | boolean) => {
    setValuesState((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  }, []);

  const getValue = useCallback(
    (fieldId: string): string | boolean | undefined => {
      return values[fieldId];
    },
    [values]
  );

  const setValues = useCallback((newValues: FormValues) => {
    setValuesState(newValues);
  }, []);

  const clearValues = useCallback(() => {
    setValuesState({});
    // Also clear persisted data
    formDataPersistence.clearFormData().catch(console.error);
  }, []);

  const getFilledFieldCount = useCallback((): number => {
    return Object.values(values).filter(
      (v) => v !== "" && v !== false && v !== undefined
    ).length;
  }, [values]);

  const saveData = useCallback(async (): Promise<boolean> => {
    try {
      const success = await formDataPersistence.saveFormData(values);
      if (success) {
        setLastSaved(Date.now());
        console.log("Form data manually saved");
      }
      return success;
    } catch (error) {
      console.error("Failed to save form data:", error);
      return false;
    }
  }, [values]);

  /**
   * Initializes entry configurations from golden-key data.
   * 
   * @param goldenKey - GoldenKeyInventory - The loaded golden-key inventory.
   * 
   * Bug-relevant: Must be called after golden-key loads to enable multi-entry UI.
   */
  const initializeEntryConfigs = useCallback((goldenKey: GoldenKeyInventory) => {
    const configs = detectMultiEntrySections(goldenKey);
    setEntryConfigs(configs);

    const initialStates: Record<string, EntryState> = {};
    Object.keys(configs).forEach((sectionId) => {
      initialStates[sectionId] = createInitialEntryState(configs[sectionId]);
    });
    setEntryStates(initialStates);

    console.log(`📋 Entry configs initialized: ${Object.keys(configs).length} multi-entry sections`);
  }, []);

  /**
   * Adds the next available entry to a section.
   * 
   * @param sectionId - string - The section to add an entry to.
   */
  const handleAddEntry = useCallback((sectionId: string) => {
    const config = entryConfigs[sectionId];
    const state = entryStates[sectionId];
    if (!config || !state) return;

    const newState = addNextEntry(state, config);
    setEntryStates((prev) => ({
      ...prev,
      [sectionId]: newState,
    }));
  }, [entryConfigs, entryStates]);

  /**
   * Removes an entry from a section and clears its values.
   * 
   * @param sectionId - string - The section containing the entry.
   * @param entryNumber - number - The entry number to remove.
   * 
   * Bug-relevant: Also clears form values for removed entry fields.
   */
  const handleRemoveEntry = useCallback((sectionId: string, entryNumber: number) => {
    const config = entryConfigs[sectionId];
    const state = entryStates[sectionId];
    if (!config || !state) return;

    const entrySlot = config.entries.get(entryNumber);
    if (entrySlot) {
      entrySlot.fieldIds.forEach((fieldId) => {
        setValue(fieldId, "");
      });
    }

    const newState = removeEntry(state, entryNumber);
    setEntryStates((prev) => ({
      ...prev,
      [sectionId]: newState,
    }));
  }, [entryConfigs, entryStates, setValue]);

  /**
   * Toggles the expanded/collapsed state of an entry.
   * 
   * @param sectionId - string - The section containing the entry.
   * @param entryNumber - number - The entry number to toggle.
   */
  const handleToggleEntry = useCallback((sectionId: string, entryNumber: number) => {
    const state = entryStates[sectionId];
    if (!state) return;

    const newState = toggleEntryExpanded(state, entryNumber);
    setEntryStates((prev) => ({
      ...prev,
      [sectionId]: newState,
    }));
  }, [entryStates]);

  /**
   * Checks if an entry is currently active (visible).
   * 
   * @param sectionId - string - The section to check.
   * @param entryNumber - number - The entry number to check.
   * @returns boolean - True if entry is active.
   */
  const isEntryActive = useCallback((sectionId: string, entryNumber: number): boolean => {
    const state = entryStates[sectionId];
    return state ? state.activeEntries.has(entryNumber) : entryNumber === 0;
  }, [entryStates]);

  /**
   * Checks if an entry is currently expanded.
   * 
   * @param sectionId - string - The section to check.
   * @param entryNumber - number - The entry number to check.
   * @returns boolean - True if entry is expanded.
   */
  const isEntryExpanded = useCallback((sectionId: string, entryNumber: number): boolean => {
    const state = entryStates[sectionId];
    return state ? state.expandedEntries.has(entryNumber) : true;
  }, [entryStates]);

  // DEBUG: Expose form context to browser for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__CLARANCE_FORM_VALUES__ = values;
      (window as any).formContext = {
        values,
        setValue,
        getValue,
        currentSection,
        setCurrentSection
      };
    }
  }, [values, setValue, getValue, currentSection, setCurrentSection]);

  return (
    <FormContext.Provider
      value={{
        values,
        setValue,
        getValue,
        setValues,
        clearValues,
        getFilledFieldCount,
        selectedField,
        setSelectedField,
        currentSection,
        setCurrentSection,
        currentPage,
        setCurrentPage,
        saveData,
        isLoading,
        lastSaved,
        entryConfigs,
        entryStates,
        initializeEntryConfigs,
        addEntry: handleAddEntry,
        removeEntryFromSection: handleRemoveEntry,
        toggleEntry: handleToggleEntry,
        isEntryActive,
        isEntryExpanded,
      }}
    >
      {children}
    </FormContext.Provider>
  );
}

export function useFormContext(): FormContextValue {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error("useFormContext must be used within a FormProvider");
  }
  return context;
}
