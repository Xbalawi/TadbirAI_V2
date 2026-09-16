"use client";

export interface UploadHistoryRecord {
  id: string;
  fileName: string;
  fileSize: string;
  fileType: "xlsx" | "xls" | "csv" | "pdf" | "png" | "jpg" | string;
  tableType: "stock" | "clients" | "suppliers" | "depenses" | "factures" | "general" | string;
  tableLabel: string;
  uploadDate: string; // ISO string or human-readable date
  timestamp: number;
  status: "success" | "pending" | "failed";
  rowCount?: number;
  mappedColumnsCount?: number;
  note?: string;
}

const STORAGE_KEY = "fawatir_upload_history";

const INITIAL_MOCK_HISTORY: UploadHistoryRecord[] = [
  {
    id: "hist-101",
    fileName: "inventaire_produits_q3_2026.xlsx",
    fileSize: "348 KB",
    fileType: "xlsx",
    tableType: "stock",
    tableLabel: "Stocks & Produits",
    uploadDate: "05/09/2026 11:20",
    timestamp: Date.now() - 1000 * 60 * 150,
    status: "success",
    rowCount: 142,
    mappedColumnsCount: 8,
    note: "142 produits importés et mis à jour avec prix de vente"
  },
  {
    id: "hist-102",
    fileName: "base_clients_entreprise_maroc.csv",
    fileSize: "185 KB",
    fileType: "csv",
    tableType: "clients",
    tableLabel: "Clients",
    uploadDate: "04/09/2026 16:45",
    timestamp: Date.now() - 1000 * 60 * 60 * 22,
    status: "success",
    rowCount: 68,
    mappedColumnsCount: 7,
    note: "68 fiches clients avec ICE et téléphone"
  },
  {
    id: "hist-103",
    fileName: "fournisseurs_locaux_v2.xlsx",
    fileSize: "210 KB",
    fileType: "xlsx",
    tableType: "suppliers",
    tableLabel: "Fournisseurs",
    uploadDate: "02/09/2026 09:15",
    timestamp: Date.now() - 1000 * 60 * 60 * 75,
    status: "success",
    rowCount: 34,
    mappedColumnsCount: 6,
    note: "34 fournisseurs principaux enregistrés"
  },
  {
    id: "hist-104",
    fileName: "factures_achat_juillet.pdf",
    fileSize: "1.4 MB",
    fileType: "pdf",
    tableType: "depenses",
    tableLabel: "Dépenses",
    uploadDate: "28/08/2026 14:10",
    timestamp: Date.now() - 1000 * 60 * 60 * 180,
    status: "success",
    rowCount: 12,
    mappedColumnsCount: 5,
    note: "Scan OCR automatique réussi"
  }
];

export const getUploadHistory = (tableTypeFilter?: string): UploadHistoryRecord[] => {
  if (typeof window === "undefined") return INITIAL_MOCK_HISTORY;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let list: UploadHistoryRecord[] = raw ? JSON.parse(raw) : [];
    
    if (!raw || list.length === 0) {
      list = INITIAL_MOCK_HISTORY;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    if (tableTypeFilter && tableTypeFilter !== "all" && tableTypeFilter !== "Tous") {
      return list.filter((item) => {
        const itemType = item.tableType.toLowerCase();
        const filter = tableTypeFilter.toLowerCase();
        if (filter === "stock" || filter === "stocks" || filter === "produits") {
          return itemType === "stock" || itemType === "stocks" || itemType === "products";
        }
        if (filter === "suppliers" || filter === "fournisseurs") {
          return itemType === "suppliers" || itemType === "fournisseurs";
        }
        return itemType === filter;
      });
    }

    return list.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.error("Error reading upload history", err);
    return INITIAL_MOCK_HISTORY;
  }
};

export const addUploadRecord = (record: Omit<UploadHistoryRecord, "id" | "timestamp">): UploadHistoryRecord => {
  const newRecord: UploadHistoryRecord = {
    ...record,
    id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: Date.now(),
    uploadDate: record.uploadDate || new Date().toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  };

  if (typeof window !== "undefined") {
    try {
      const current = getUploadHistory();
      const updated = [newRecord, ...current];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("uploadHistoryUpdated", { detail: newRecord }));
    } catch (err) {
      console.error("Error saving upload history record", err);
    }
  }

  return newRecord;
};

export const deleteUploadRecord = (id: string) => {
  if (typeof window === "undefined") return;
  try {
    const current = getUploadHistory();
    const updated = current.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("uploadHistoryUpdated"));
  } catch (err) {
    console.error("Error deleting upload record", err);
  }
};

export const clearUploadHistory = (tableTypeFilter?: string) => {
  if (typeof window === "undefined") return;
  try {
    if (tableTypeFilter && tableTypeFilter !== "all" && tableTypeFilter !== "Tous") {
      const current = getUploadHistory();
      const updated = current.filter((item) => item.tableType !== tableTypeFilter);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent("uploadHistoryUpdated"));
  } catch (err) {
    console.error("Error clearing upload history", err);
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Octets";
  const k = 1024;
  const sizes = ["Octets", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};
