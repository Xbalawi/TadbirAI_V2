/**
 * Utility functions for robust, case-insensitive, accent-tolerant,
 * multi-word, and multi-field search matching across data tables.
 */

export function normalizeSearchStr(str: any): string {
  if (str === null || str === undefined) return "";
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Recursively extracts all searchable text from an object or array.
 */
export function extractSearchableText(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return val.toString() + " ";
  }
  if (Array.isArray(val)) {
    return val.map(extractSearchableText).join(" ");
  }
  if (typeof val === "object") {
    return Object.values(val).map(extractSearchableText).join(" ");
  }
  return "";
}

/**
 * Returns true if item matches all tokens in the search query (accent & case-insensitive).
 */
export function matchesSearch(item: any, searchTerm: string): boolean {
  if (!searchTerm || !searchTerm.trim()) return true;
  if (!item) return false;

  const normalizedQuery = normalizeSearchStr(searchTerm.trim());
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const searchableText = normalizeSearchStr(extractSearchableText(item));

  return terms.every((term) => searchableText.includes(term));
}
