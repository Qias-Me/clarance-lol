import type { FormValues } from "@/types/pdf-fields";

/**
 * IndexedDB service for persisting SF86 form data
 * Based on patterns from clarance-f formDataRepository.ts
 */
// 🔥 CRITICAL: Version key for mapping compatibility
// If golden key mappings change, increment this to prevent stale drafts from applying to mismatched fields
const GOLDEN_KEY_VERSION = "v2.0.0";

export class FormDataPersistenceService {
  private dbName: string;
  private storeName: string;
  private dbVersion: number;
  private goldenKeyVersion: string;

  constructor(goldenKeyVersion: string = GOLDEN_KEY_VERSION) {
    this.dbName = "SF86FormDataDB";
    this.storeName = "FormData";
    this.dbVersion = 2; // Bumped to support mapping version
    this.goldenKeyVersion = goldenKeyVersion;
  }

  /**
   * Open IndexedDB database and create object store if needed
   */
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for form data with keyPath on id
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });

          // Create indexes for efficient queries
          store.createIndex("fieldId", "fieldId", { unique: true });
          store.createIndex("section", "section", { unique: false });
          store.createIndex("lastModified", "lastModified", { unique: false });
        }
      };
    });
  }

  /**
   * Save all form data with timestamp
   */
  async saveFormData(values: FormValues): Promise<boolean> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      const timestamp = Date.now();

      // Clear existing data first
      await new Promise<void>((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onerror = () => reject(clearRequest.error);
        clearRequest.onsuccess = () => resolve();
      });

      // Save each form value as a separate record
      const savePromises = Object.entries(values).map(([fieldId, value]) => {
        return new Promise<boolean>((resolve, reject) => {
          const record = {
            id: fieldId,
            fieldId,
            value,
            lastModified: timestamp
          };

          const request = store.put(record);
          request.onerror = () => {
            console.error(`Failed to save field ${fieldId}:`, request.error);
            reject(request.error);
          };
          request.onsuccess = () => resolve(true);
        });
      });

      const results = await Promise.allSettled(savePromises);
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        throw new Error(`${failed.length} fields failed to save`);
      }

      // Save metadata record with golden key version for compatibility checking
      const metadataRecord = {
        id: "_metadata",
        fieldId: "_metadata",
        value: {
          totalFields: Object.keys(values).length,
          lastSaved: timestamp,
          version: this.dbVersion,
          goldenKeyVersion: this.goldenKeyVersion // 🔥 Track mapping version
        },
        lastModified: timestamp
      };

      store.put(metadataRecord);

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          console.log(`Successfully saved ${Object.keys(values).length} form values`);
          resolve(true);
        };
        transaction.onerror = () => {
          console.error("Transaction failed:", transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error("Failed to save form data:", error);
      return false;
    }
  }

  /**
   * Load all form data from IndexedDB
   *
   * 🔥 CRITICAL: Validates golden key version to prevent stale drafts from applying
   * to mismatched field mappings. If versions don't match, returns empty object
   * to force fresh start (prevents Section 1 data going to Section 20, etc.)
   */
  async loadFormData(): Promise<FormValues> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const records = request.result;
          const formValues: FormValues = {};

          // 🔥 Check golden key version compatibility first
          const metadataRecord = records.find((r: any) => r.fieldId === "_metadata");
          if (metadataRecord?.value?.goldenKeyVersion) {
            const savedVersion = metadataRecord.value.goldenKeyVersion;
            if (savedVersion !== this.goldenKeyVersion) {
              console.warn(
                `⚠️ Golden key version mismatch: saved=${savedVersion}, current=${this.goldenKeyVersion}. ` +
                `Discarding stale draft to prevent field mapping errors.`
              );
              // Return empty to force fresh start - prevents cross-section mapping bugs
              resolve({});
              return;
            }
            console.log(`✅ Golden key version match: ${savedVersion}`);
          }

          records.forEach((record: any) => {
            if (record.fieldId !== "_metadata") {
              formValues[record.fieldId] = record.value;
            }
          });

          resolve(formValues);
        };
      });
    } catch (error) {
      console.error("Failed to load form data:", error);
      return {};
    }
  }

  /**
   * Save a single field value
   */
  async saveFieldValue(fieldId: string, value: any): Promise<boolean> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      const record = {
        id: fieldId,
        fieldId,
        value,
        lastModified: Date.now()
      };

      return new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
      });
    } catch (error) {
      console.error(`Failed to save field ${fieldId}:`, error);
      return false;
    }
  }

  /**
   * Get a single field value
   */
  async getFieldValue(fieldId: string): Promise<any> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.get(fieldId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.value : undefined);
        };
      });
    } catch (error) {
      console.error(`Failed to get field ${fieldId}:`, error);
      return undefined;
    }
  }

  /**
   * Get form data for a specific section
   */
  async getSectionData(sectionFields: string[]): Promise<FormValues> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);

      const sectionData: FormValues = {};

      for (const fieldId of sectionFields) {
        const value = await this.getFieldValue(fieldId);
        if (value !== undefined) {
          sectionData[fieldId] = value;
        }
      }

      return sectionData;
    } catch (error) {
      console.error(`Failed to get section data:`, error);
      return {};
    }
  }

  /**
   * Clear all form data
   */
  async clearFormData(): Promise<boolean> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
      });
    } catch (error) {
      console.error("Failed to clear form data:", error);
      return false;
    }
  }

  /**
   * Get metadata about saved form data
   */
  async getFormDataMetadata(): Promise<{
    totalFields: number;
    lastSaved: number | null;
    version: number;
    goldenKeyVersion: string;
    isCompatible: boolean;
  }> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.get("_metadata");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.value) {
            const savedGoldenKeyVersion = result.value.goldenKeyVersion || "unknown";
            resolve({
              ...result.value,
              goldenKeyVersion: savedGoldenKeyVersion,
              isCompatible: savedGoldenKeyVersion === this.goldenKeyVersion
            });
          } else {
            resolve({
              totalFields: 0,
              lastSaved: null,
              version: this.dbVersion,
              goldenKeyVersion: this.goldenKeyVersion,
              isCompatible: true
            });
          }
        };
      });
    } catch (error) {
      console.error("Failed to get form metadata:", error);
      return {
        totalFields: 0,
        lastSaved: null,
        version: this.dbVersion,
        goldenKeyVersion: this.goldenKeyVersion,
        isCompatible: true
      };
    }
  }

  /**
   * Check if IndexedDB is supported
   */
  static isSupported(): boolean {
    return typeof window !== "undefined" && "indexedDB" in window;
  }

  /**
   * Delete the entire database
   */
  async deleteDatabase(): Promise<boolean> {
    try {
      if (!FormDataPersistenceService.isSupported()) {
        throw new Error("IndexedDB is not supported in this browser");
      }

      return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(this.dbName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
        request.onblocked = () => {
          console.warn("Database deletion blocked. Close all tabs that have this database open.");
          resolve(true);
        };
      });
    } catch (error) {
      console.error("Failed to delete database:", error);
      return false;
    }
  }
}

// Singleton instance
export const formDataPersistence = new FormDataPersistenceService();