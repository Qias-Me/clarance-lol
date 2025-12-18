export function generateFingerprint(
  page: number,
  rect: { x: number; y: number; width: number; height: number },
  fieldName: string
): string {
  /**
   * page: number - PDF page number
   * rect: object - Field rectangle coordinates
   * fieldName: string - PDF field name
   * Returns unique 16-character hash fingerprint for field identification
   */
  const data = `${page}:${rect.x.toFixed(2)},${rect.y.toFixed(2)},${rect.width.toFixed(2)},${rect.height.toFixed(2)}:${fieldName}`;

  if (typeof window === "undefined") {
    // Node.js environment - use crypto module
    const { createHash } = eval("require")("crypto");
    return createHash("sha256").update(data).digest("hex").slice(0, 16);
  }

  return simpleHash(data);
}

function simpleHash(str: string): string {
  /**
   * str: string - Input string to hash
   * Returns 16-character deterministic hash using simple algorithm
   */
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, "0").slice(0, 16);
}

export function generateUIPath(
  section: string,
  subsection: string | null,
  entry: number | null,
  label: string
): string {
  /**
   * section: string - Section number
   * subsection: string | null - Subsection identifier
   * entry: number | null - Entry number within subsection
   * label: string - Field label text
   * Returns dot-separated UI path for field navigation
   */
  const parts: string[] = [`section${section}`];

  if (subsection) {
    parts.push(subsection.replace(/\./g, "_"));
  }

  if (entry !== null) {
    parts.push(`entry${entry}`);
  }

  const sanitizedLabel = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  parts.push(sanitizedLabel);

  return parts.join(".");
}
