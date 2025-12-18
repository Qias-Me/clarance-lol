/**
 * Dropdown Options Service
 *
 * Provides on-demand extraction of dropdown options from the PDF template.
 * Caches extracted options to avoid repeated PDF parsing.
 * Falls back to PDF extraction when field-groups.json is missing options.
 *
 * @module dropdown-options-service
 */

import { PdfFieldExtractor } from './pdf-field-extractor';

/**
 * Cached dropdown options indexed by field name.
 */
let dropdownCache: Map<string, string[]> | null = null;

/**
 * Cached PDF template bytes.
 */
let pdfTemplateCache: Uint8Array | null = null;

/**
 * Whether extraction is currently in progress.
 */
let extractionInProgress: Promise<void> | null = null;

/**
 * Loads and caches the PDF template.
 * 
 * @returns Promise<Uint8Array> - The PDF template bytes.
 * 
 * Bug-relevant: Caches template to avoid repeated fetches.
 */
async function loadPdfTemplate(): Promise<Uint8Array> {
  if (pdfTemplateCache) {
    return pdfTemplateCache;
  }

  const response = await fetch('/data/sf86.pdf');
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF template: ${response.status}`);
  }

  pdfTemplateCache = new Uint8Array(await response.arrayBuffer());
  console.log(`📄 PDF template cached: ${pdfTemplateCache.length} bytes`);
  return pdfTemplateCache;
}

/**
 * Extracts and caches all dropdown options from the PDF.
 * 
 * @returns Promise<void> - Resolves when extraction is complete.
 * 
 * Bug-relevant: One-time extraction, results cached for all lookups.
 */
async function extractAllDropdowns(): Promise<void> {
  if (dropdownCache !== null) {
    return;
  }

  if (extractionInProgress) {
    await extractionInProgress;
    return;
  }

  extractionInProgress = (async () => {
    try {
      const pdfBytes = await loadPdfTemplate();
      const dropdowns = await PdfFieldExtractor.extractDropdownFields(pdfBytes);

      dropdownCache = new Map();
      for (const dropdown of dropdowns) {
        if (dropdown.accessible && dropdown.options.length > 0) {
          dropdownCache.set(dropdown.name, dropdown.options);
        }
      }

      console.log(`📋 Cached ${dropdownCache.size} dropdown fields with options`);
    } catch (error) {
      console.error('Failed to extract dropdown options:', error);
      dropdownCache = new Map();
    } finally {
      extractionInProgress = null;
    }
  })();

  await extractionInProgress;
}

/**
 * Gets dropdown options for a specific field.
 * 
 * @param fieldName - string - The PDF field name.
 * @returns Promise<string[]> - Array of option values, empty if not found.
 * 
 * Bug-fix: Primary API for fallback dropdown options.
 * Call this when fieldGroups doesn't have options for a dropdown.
 */
export async function getDropdownOptions(fieldName: string): Promise<string[]> {
  await extractAllDropdowns();

  if (dropdownCache?.has(fieldName)) {
    return dropdownCache.get(fieldName) || [];
  }

  const pdfBytes = await loadPdfTemplate();
  const options = await PdfFieldExtractor.extractDropdownOptions(pdfBytes, fieldName);

  if (options.length > 0 && dropdownCache) {
    dropdownCache.set(fieldName, options);
  }

  return options;
}

/**
 * Gets all cached dropdown fields and their options.
 * 
 * @returns Promise<Map<string, string[]>> - Map of field name to options.
 */
export async function getAllDropdownOptions(): Promise<Map<string, string[]>> {
  await extractAllDropdowns();
  return dropdownCache || new Map();
}

/**
 * Checks if a field has cached dropdown options.
 * 
 * @param fieldName - string - The PDF field name.
 * @returns boolean - True if options are cached.
 */
export function hasDropdownOptions(fieldName: string): boolean {
  return dropdownCache?.has(fieldName) || false;
}

/**
 * Clears all cached data (useful for testing).
 */
export function clearDropdownCache(): void {
  dropdownCache = null;
  pdfTemplateCache = null;
  extractionInProgress = null;
}

/**
 * Pre-loads all dropdown options in the background.
 * Call this early to warm the cache before user interaction.
 * 
 * @returns Promise<number> - Number of dropdowns cached.
 */
export async function preloadDropdownOptions(): Promise<number> {
  await extractAllDropdowns();
  return dropdownCache?.size || 0;
}
