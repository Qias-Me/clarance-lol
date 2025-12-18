import type { FormValues } from "@/types/pdf-fields";

interface PersistedState {
  values: FormValues;
  templateHash?: string;
  goldenKeyVersion?: string;
  lastSaved: number;
}

const DB_NAME = "sf86-form-state";
const DB_VERSION = 1;
const STORE_NAME = "form-state";

/**
 * IndexedDB persistence layer for form data
 * Provides automatic saving and loading of form state
 */
export class IndexedDBPersistence {
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("❌ Failed to open IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log("✅ IndexedDB initialized successfully");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("lastSaved", "lastSaved", { unique: false });
        }
      };
    });
  }

  async saveState(
    values: FormValues,
    templateHash?: string,
    goldenKeyVersion?: string
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const state: PersistedState = {
      values,
      templateHash,
      goldenKeyVersion,
      lastSaved: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ ...state, id: "current" });

      request.onerror = () => {
        console.error("❌ Failed to save state:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log(`💾 Saved form state with ${Object.keys(values).length} values`);
        resolve();
      };
    });
  }

  async loadState(): Promise<PersistedState | null> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get("current");

      request.onerror = () => {
        console.error("❌ Failed to load state:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log(`📥 Loaded form state with ${Object.keys(result.values).length} values`);
        } else {
          console.log("📥 No saved state found");
        }
        resolve(result || null);
      };
    });
  }

  async clearState(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete("current");

      request.onerror = () => {
        console.error("❌ Failed to clear state:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log("🗑️ Cleared form state");
        resolve();
      };
    });
  }

  async exportState(): Promise<string> {
    const state = await this.loadState();
    if (!state) {
      throw new Error("No state to export");
    }

    return JSON.stringify(state, null, 2);
  }

  async importState(jsonString: string): Promise<void> {
    try {
      const imported = JSON.parse(jsonString) as PersistedState;

      if (!imported.values || typeof imported.values !== "object") {
        throw new Error("Invalid state format");
      }

      await this.saveState(
        imported.values,
        imported.templateHash,
        imported.goldenKeyVersion
      );

      console.log("📤 State imported successfully");
    } catch (error) {
      console.error("❌ Failed to import state:", error);
      throw error;
    }
  }
}

// Singleton instance
export const formPersistence = new IndexedDBPersistence();

/**
 * Debounced auto-save hook for form state
 */
export function createAutoSave(
  saveCallback: (values: FormValues) => Promise<void>,
  delay: number = 2000
) {
  let timeoutId: NodeJS.Timeout | null = null;

  return (values: FormValues) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(async () => {
      try {
        await saveCallback(values);
      } catch (error) {
        console.error("❌ Auto-save failed:", error);
      }
    }, delay);
  };
}