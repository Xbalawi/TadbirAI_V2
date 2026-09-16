"use client";

export interface ImportRecord {
  id: string;
  fileName: string;
  fileSize?: string;
  fileType: string; // e.g. "xlsx", "csv", "pdf", "image"
  targetTable: string; // e.g. "stock", "clients", "suppliers", "factures", "depenses", "all"
  importedAt: string;
  status: "success" | "pending" | "failed";
  recordCount: number;
  details?: string;
}

const STORAGE_KEY = "fawatir_import_history";

// Initial seed mock history so users see history immediately even before uploading new files
const defaultHistoryRecords: ImportRecord[] = [
  {
    id: "imp-101",
    fileName: "catalogue_produits_2026.xlsx",
    fileSize: "142 KB",
    fileType: "xlsx",
    targetTable: "stock",
    importedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    status: "success",
    recordCount: 45,
    details: "Importation des articles de stock avec mapping automatique"
  },
  {
    id: "imp-102",
    fileName: "clients_import_maroc.csv",
    fileSize: "88 KB",
    fileType: "csv",
    targetTable: "clients",
    importedAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
    status: "success",
    recordCount: 28,
    details: "Liste clients avec ICE et matricules fiscaux"
  },
  {
    id: "imp-103",
    fileName: "fournisseurs_materiel.xlsx",
    fileSize: "64 KB",
    fileType: "xlsx",
    targetTable: "suppliers",
    importedAt: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
    status: "success",
    recordCount: 14,
    details: "Nouveaux fournisseurs informatiques"
  }
];

export function getImportHistoryRecords(targetTable?: string): ImportRecord[] {
  if (typeof window === "undefined") return defaultHistoryRecords;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultHistoryRecords));
      return targetTable && targetTable !== "all" 
        ? defaultHistoryRecords.filter(r => r.targetTable === targetTable)
        : defaultHistoryRecords;
    }
    const records: ImportRecord[] = JSON.parse(raw);
    if (!targetTable || targetTable === "all") return records;
    return records.filter(r => r.targetTable === targetTable || r.targetTable === "all");
  } catch (e) {
    console.error("Error reading import history", e);
    return defaultHistoryRecords;
  }
}

export function addImportHistoryRecord(
  data: Omit<ImportRecord, "id" | "importedAt">
): ImportRecord {
  const newRecord: ImportRecord = {
    ...data,
    id: `imp-${Date.now()}`,
    importedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const current = getImportHistoryRecords();
      const updated = [newRecord, ...current];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("importHistoryUpdated", { detail: newRecord }));
    } catch (e) {
      console.error("Error saving import history", e);
    }
  }

  return newRecord;
}

export function deleteImportHistoryRecord(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getImportHistoryRecords();
    const updated = current.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("importHistoryUpdated"));
  } catch (e) {
    console.error("Error deleting import record", e);
  }
}

export function clearImportHistoryRecords(targetTable?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!targetTable || targetTable === "all") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } else {
      const current = getImportHistoryRecords();
      const updated = current.filter(r => r.targetTable !== targetTable);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
    window.dispatchEvent(new CustomEvent("importHistoryUpdated"));
  } catch (e) {
    console.error("Error clearing import history", e);
  }
}
