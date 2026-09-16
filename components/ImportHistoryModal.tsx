"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import { 
  History, 
  FileSpreadsheet, 
  FileText, 
  Trash2, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  UploadCloud,
  Database,
  Filter
} from "lucide-react";
import { 
  getImportHistoryRecords, 
  deleteImportHistoryRecord, 
  clearImportHistoryRecords, 
  ImportRecord 
} from "@/lib/import-history-store";

interface ImportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTable?: string;
}

const tableLabels: Record<string, string> = {
  all: "Toutes les tables",
  stock: "Stocks & Produits",
  clients: "Clients",
  suppliers: "Fournisseurs",
  factures: "Factures",
  depenses: "Dépenses",
  devis: "Devis",
  employes: "Employés"
};

export default function ImportHistoryModal({ isOpen, onClose, defaultTable = "all" }: ImportHistoryModalProps) {
  const [selectedTable, setSelectedTable] = useState<string>(defaultTable);
  const [records, setRecords] = useState<ImportRecord[]>([]);
  const [search, setSearch] = useState("");

  const refreshRecords = () => {
    setRecords(getImportHistoryRecords(selectedTable));
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedTable(defaultTable);
      refreshRecords();
    }
  }, [isOpen, defaultTable]);

  useEffect(() => {
    refreshRecords();
    const handleUpdate = () => refreshRecords();
    window.addEventListener("importHistoryUpdated", handleUpdate);
    return () => window.removeEventListener("importHistoryUpdated", handleUpdate);
  }, [selectedTable]);

  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      r.fileName.toLowerCase().includes(search.toLowerCase()) ||
      (r.details && r.details.toLowerCase().includes(search.toLowerCase())) ||
      (r.targetTable && r.targetTable.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  const handleDelete = (id: string) => {
    deleteImportHistoryRecord(id);
  };

  const handleClearAll = () => {
    if (confirm("Voulez-vous vraiment effacer tout l'historique d'importation des fichiers ?")) {
      clearImportHistoryRecords(selectedTable);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Historique des Fichiers Importés depuis le PC" 
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col gap-4 text-slate-100">
        
        {/* Controls & Filter Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          {/* Search input */}
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom de fichier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-[12.5px] text-white focus:border-indigo-500 focus:outline-none placeholder:text-slate-500"
            />
          </div>

          {/* Table filter selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter size={15} className="text-indigo-400 shrink-0" />
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full sm:w-auto rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[12.5px] text-white font-semibold focus:border-indigo-500 focus:outline-none"
            >
              {Object.entries(tableLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            {records.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] font-bold text-rose-400 hover:bg-rose-500/20 transition-all shrink-0 ml-auto"
                title="Vider l'historique"
              >
                <Trash2 size={14} /> Vider
              </button>
            )}
          </div>
        </div>

        {/* History List Table */}
        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-950/40 rounded-2xl border border-slate-800/80">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 mb-3">
              <UploadCloud size={28} />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Aucun fichier importé pour le moment</h4>
            <p className="text-xs text-slate-400 max-w-sm">
              Toutes vos importations de fichiers Excel, CSV, PDF ou images depuis votre PC sur les tables apparaîtront ici avec les détails et statistiques.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 shadow-md">
            <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-slate-900 text-slate-300 font-bold sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Fichier Uploadé</th>
                    <th className="px-4 py-3">Table Cible</th>
                    <th className="px-4 py-3">Date d'import</th>
                    <th className="px-4 py-3 text-center">Lignes / Éléments</th>
                    <th className="px-4 py-3 text-center">Statut</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredRecords.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0 border border-indigo-500/30">
                            {item.fileType === "pdf" ? <FileText size={17} /> : <FileSpreadsheet size={17} />}
                          </div>
                          <div>
                            <p className="font-bold text-white truncate max-w-[200px]" title={item.fileName}>
                              {item.fileName}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {item.fileSize || "PC Upload"} · {item.details || "Importé dans la base"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-semibold text-indigo-300">
                          <Database size={12} />
                          {tableLabels[item.targetTable] || item.targetTable}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-medium">
                        <div className="flex items-center gap-1.5 text-[11.5px]">
                          <Clock size={13} className="text-slate-500" />
                          {new Date(item.importedAt).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-400">
                        +{item.recordCount}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.status === "success" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
                            <CheckCircle2 size={12} /> Réussi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-bold border border-amber-500/30">
                            <AlertTriangle size={12} /> {item.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                          title="Supprimer du journal"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2 text-[12.5px] font-bold text-white hover:bg-slate-700 transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
}
