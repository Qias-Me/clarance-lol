/**
 * Fingerprint Utility for Golden Key Drift Detection
 *
 * Creates deterministic hashes for PDF field records to detect
 * when the PDF structure changes.
 */

export interface FingerprintInput {
  fieldName: string;
  pageNumber: number;
  rect: { x: number; y: number; width: number; height: number };
  type: number;
  exportValue?: string;
}

/**
 * Creates a deterministic fingerprint hash for a PDF field.
 *
 * @param input - FingerprintInput - The field data to hash
 * @returns string - A hex string fingerprint
 */
export function createFingerprint(input: FingerprintInput): string {
  const normalized = [
    input.fieldName,
    input.pageNumber.toString(),
    Math.round(input.rect.x).toString(),
    Math.round(input.rect.y).toString(),
    Math.round(input.rect.width).toString(),
    Math.round(input.rect.height).toString(),
    input.type.toString(),
    input.exportValue || "",
  ].join("|");

  return hashString(normalized);
}

/**
 * Simple string hash function (djb2 algorithm).
 *
 * @param str - string - The string to hash
 * @returns string - A hex string hash
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Compares two fingerprints for equality.
 *
 * @param a - string - First fingerprint
 * @param b - string - Second fingerprint
 * @returns boolean - True if fingerprints match
 */
export function fingerprintsMatch(a: string, b: string): boolean {
  return a === b;
}

/**
 * Validates a Golden Key record against current PDF inventory.
 *
 * @param recordFingerprint - string - The stored fingerprint
 * @param currentField - FingerprintInput - Current field data from PDF
 * @returns { valid: boolean; drift: string | null } - Validation result
 */
export function validateFingerprint(
  recordFingerprint: string,
  currentField: FingerprintInput
): { valid: boolean; drift: string | null } {
  const currentFingerprint = createFingerprint(currentField);

  if (fingerprintsMatch(recordFingerprint, currentFingerprint)) {
    return { valid: true, drift: null };
  }

  return {
    valid: false,
    drift: `Fingerprint mismatch: expected ${recordFingerprint}, got ${currentFingerprint}`,
  };
}

/**
 * Batch validates multiple fingerprints.
 *
 * @param records - Array<{ id: string; fingerprint: string; current: FingerprintInput }> - Records to validate
 * @returns { valid: string[]; invalid: Array<{ id: string; drift: string }> } - Validation results
 */
export function batchValidateFingerprints(
  records: Array<{
    id: string;
    fingerprint: string;
    current: FingerprintInput;
  }>
): { valid: string[]; invalid: Array<{ id: string; drift: string }> } {
  const valid: string[] = [];
  const invalid: Array<{ id: string; drift: string }> = [];

  for (const record of records) {
    const result = validateFingerprint(record.fingerprint, record.current);
    if (result.valid) {
      valid.push(record.id);
    } else {
      invalid.push({ id: record.id, drift: result.drift! });
    }
  }

  return { valid, invalid };
}
