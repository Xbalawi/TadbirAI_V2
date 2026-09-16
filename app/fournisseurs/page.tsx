"use client";

import { Plus, MoreHorizontal, Loader2, ChevronLeft, ChevronRight, Eye, Pencil, FileText, Trash2, CheckCircle2, X, History } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import SpreadsheetImportModal from "@/components/SpreadsheetImportModal";
import AddSupplierModal from "@/components/AddSupplierModal";
import ConfirmModal from "@/components/ConfirmModal";
import ImportHistoryModal from "@/components/ImportHistoryModal";
import { matchesSearch } from "@/lib/search";
import { useTranslation } from "@/lib/i18n";

export default function FournisseursPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [metadataKeys, setMetadataKeys] = useState<string[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Selection / View State
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<any | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [searchTerm, setSearchTerm] = useState("");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchSuppliers();
    const handleDataUpdate = () => fetchSuppliers();
    window.addEventListener("dataUpdated", handleDataUpdate);
    return () => window.removeEventListener("dataUpdated", handleDataUpdate);
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/suppliers?t=${Date.now()}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results || []);
      setSuppliers(list);

      const keysSet = new Set<string>();
      list.forEach((s: any) => {
        if (s.metadata && typeof s.metadata === "object") {
          Object.keys(s.metadata).forEach(k => keysSet.add(k));
        }
      });
      setMetadataKeys(Array.from(keysSet));
    } catch (err) {
      console.error("Error fetching suppliers:", err);
    } finally {
      setLoading(false);
    }
  };

  // 0ms Optimistic UI Delete
  const handleDeleteSupplier = (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: `Supprimer le fournisseur : ${name}`,
      message: "Voulez-vous vraiment supprimer ce fournisseur ? Cette action est irréversible.",
      onConfirm: () => {
        // 1. INSTANT UI removal (0ms delay)
        setSuppliers((prev) => prev.filter((s) => s.id !== id));
        showToast(`Fournisseur ${name} supprimé avec succès !`);

        // 2. Asynchronous API sync in background
        fetch(`/api/suppliers/${id}`, { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "suppliers" } }));
          }
        }).catch((err) => console.error("Error deleting supplier:", err));
      }
    });
    setActionMenuOpen(null);
  };

  // 0ms Optimistic UI Clear All
  const handleClearSuppliers = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Vider les fournisseurs",
      message: "Voulez-vous vraiment vider toute la liste des fournisseurs ? Cette action est irréversible.",
      onConfirm: () => {
        // 1. INSTANT UI clear (0ms delay)
        setSuppliers([]);
        setSelectedIds([]);
        showToast("Tous les fournisseurs ont été vidés avec succès !");

        // 2. Asynchronous API sync in background
        fetch("/api/suppliers/clear", { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "suppliers" } }));
          }
        }).catch((err) => console.error("Error clearing suppliers:", err));
      }
    });
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Bulk Delete Selected
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: "Supprimer la sélection",
      message: `Voulez-vous vraiment supprimer les ${selectedIds.length} fournisseurs sélectionnés ?`,
      onConfirm: () => {
        const idsToDelete = [...selectedIds];
        setSuppliers((prev) => prev.filter((s) => !idsToDelete.includes(s.id)));
        setSelectedIds([]);
        showToast(`${idsToDelete.length} fournisseurs supprimés avec succès !`);

        idsToDelete.forEach(id => {
          fetch(`/api/suppliers/${id}`, { method: "DELETE" }).catch(e => console.error(e));
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "suppliers" } }));
        }
      }
    });
  };

  const filteredSuppliers = suppliers.filter((s) => matchesSearch(s, searchTerm));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(displayedSuppliers.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const displayedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 text-slate-100">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-[100] flex items-center gap-2.5 rounded-2xl bg-emerald-600 px-5 py-3.5 text-[13px] font-bold text-white shadow-2xl border border-emerald-400 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 size={16} />
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 rounded-lg p-1 hover:bg-emerald-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{t("suppliers.title", "Gestion des Fournisseurs")}</h1>
          <p className="text-[13px] text-slate-400">
            {t("suppliers.subtitle", "Répertoire des fournisseurs, contacts et achats d'entreprise")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
            title="Consulter l'historique des fichiers importés depuis le PC"
          >
            <History size={15} className="text-indigo-400" /> {t("common.export", "Historique")}
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 active:scale-95 transition-all animate-in fade-in"
            >
              <Trash2 size={15} /> {t("common.delete", "Supprimer la sélection")} ({selectedIds.length})
            </button>
          )}
          {suppliers.length > 0 && (
            <button
              onClick={handleClearSuppliers}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-[12.5px] font-semibold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
            >
              {t("common.delete", "Vider")}
            </button>
          )}
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-slate-200 hover:bg-slate-800 active:scale-95 transition-all"
          >
            {t("topbar.import_excel", "Importer Excel")}
          </button>
          <button 
            onClick={() => {
              setSelectedSupplier(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all"
          >
            <Plus size={16} /> {t("suppliers.new", "Nouveau Fournisseur")}
          </button>
        </div>
      </div>

      {/* Main Bento Card */}
      <div className="bento-card !p-5 flex flex-col min-h-[500px]">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          placeholder="Rechercher des fournisseurs (nom, contact, code, ville...)..."
          className="mb-5 w-80 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        
        {loading ? (
          <div className="flex justify-center py-12 flex-1 items-center">
            <Loader2 className="animate-spin text-indigo-400" size={28} />
          </div>
        ) : (
          <>
            <div className="min-h-[380px] max-h-[calc(100vh-360px)] flex-1 overflow-auto pb-4 custom-scrollbar">
              <table className="w-full min-w-max text-[13.5px] border-collapse text-left">
                <thead className="sticky top-0 z-20">
                  <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={displayedSuppliers.length > 0 && selectedIds.length === displayedSuppliers.length}
                        onChange={handleSelectAll}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3">Code</th>
                    <th className="py-3 px-3">Entreprise</th>
                    <th className="py-3 px-3">Contact</th>
                    <th className="py-3 px-3">E-mail</th>
                    <th className="py-3 px-3">Téléphone</th>
                    <th className="py-3 px-3">Ville</th>
                    {metadataKeys.map(key => (
                      <th key={key} className="py-3 px-3 text-indigo-400">{key}</th>
                    ))}
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayedSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={8 + metadataKeys.length} className="py-12 text-center text-slate-500">
                        Aucun fournisseur trouvé.
                      </td>
                    </tr>
                  ) : (
                    displayedSuppliers.map((f, idx) => {
                      const isNearBottom = idx >= displayedSuppliers.length - 2 && displayedSuppliers.length > 2;
                      return (
                        <tr key={`${f.id}-${idx}`} className={`group hover:bg-slate-800/40 transition-colors ${selectedIds.includes(f.id) ? "bg-indigo-950/20" : ""}`}>
                          <td className="py-3.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(f.id)}
                              onChange={() => handleToggleSelect(f.id)}
                              className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                            />
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-indigo-400">{f.supplier_code || "FR-000"}</td>
                          <td className="py-3.5 px-3 font-semibold text-white">{f.company_name || "-"}</td>
                          <td className="py-3.5 px-3 text-slate-300 font-medium">{f.contact_name || "-"}</td>
                          <td className="py-3.5 px-3 text-slate-400">{f.email || "-"}</td>
                          <td className="figure py-3.5 px-3 text-slate-400 font-mono">{f.phone || f.mobile || "-"}</td>
                          <td className="py-3.5 px-3 text-slate-300">{f.city || f.country || "Maroc"}</td>
                          
                          {metadataKeys.map(key => (
                            <td key={key} className="py-3.5 px-3 text-slate-400">
                              {f.metadata && f.metadata[key] ? f.metadata[key] : '-'}
                            </td>
                          ))}
                          
                          <td className="py-3.5 px-3 text-right relative">
                            <button 
                              onClick={() => setActionMenuOpen(actionMenuOpen === f.id ? null : f.id)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                            >
                              <MoreHorizontal size={18} />
                            </button>

                            {/* Dropdown Menu - Smart Directional Positioning */}
                            {actionMenuOpen === f.id && (
                              <div className={`absolute right-2 top-10 z-50 w-52 rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-2 text-left animate-in fade-in zoom-in-95 space-y-1`}>
                                <button
                                  onClick={() => {
                                    setViewingSupplier(f);
                                    setActionMenuOpen(null);
                                  }}
                                  className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 hover:bg-slate-800 font-medium"
                                >
                                  <Eye size={14} className="text-indigo-400" /> Voir les détails
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedSupplier(f);
                                    setIsAddModalOpen(true);
                                    setActionMenuOpen(null);
                                  }}
                                  className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-amber-300 hover:bg-slate-800 font-semibold"
                                >
                                  <Pencil size={14} className="text-amber-400" /> Modifier le fournisseur
                                </button>

                                <Link
                                  href={`/bons-de-commande?fournisseur=${encodeURIComponent(f.company_name || f.id)}`}
                                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-emerald-300 hover:bg-slate-800 font-medium"
                                >
                                  <FileText size={14} className="text-emerald-400" /> Bon de Commande
                                </Link>

                                <button
                                  onClick={() => handleDeleteSupplier(f.id, f.company_name || f.contact_name)}
                                  className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 font-medium border-t border-slate-800 pt-1.5"
                                >
                                  <Trash2 size={14} className="text-red-400" /> Supprimer
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-800 pt-4 mt-4 gap-3">
              <span className="text-[13px] text-slate-400">
                Affichage de {suppliers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} à {Math.min(currentPage * itemsPerPage, suppliers.length)} sur {suppliers.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center justify-center rounded-lg border border-slate-800 bg-slate-950 h-8 w-8 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[13px] font-bold px-3 text-white">
                  Page {currentPage} / {Math.max(1, totalPages)}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="flex items-center justify-center rounded-lg border border-slate-800 bg-slate-950 h-8 w-8 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Supplier Modal */}
      <AddSupplierModal 
        isOpen={isAddModalOpen} 
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedSupplier(null);
        }}
        initialData={selectedSupplier}
        onSuccess={() => {
          showToast(selectedSupplier ? "Fournisseur modifié avec succès !" : "Nouveau fournisseur créé avec succès !");
          fetchSuppliers();
        }} 
      />

      {/* View Details Modal */}
      {mounted && viewingSupplier && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col overflow-y-auto my-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Fiche Fournisseur</h3>
              <button onClick={() => setViewingSupplier(null)} className="rounded-lg p-1 text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-3 text-[13px]">
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Entreprise / Raison Sociale</span>
                <span className="font-bold text-white text-base">{viewingSupplier.company_name}</span>
                <span className="ml-2 font-mono text-[12px] text-indigo-400">({viewingSupplier.supplier_code})</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">Contact Principal</span>
                  <span className="text-slate-200 font-medium">{viewingSupplier.contact_name || "-"}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">Téléphone</span>
                  <span className="font-mono text-slate-200">{viewingSupplier.phone || viewingSupplier.mobile || "-"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">E-mail</span>
                  <span className="text-slate-200">{viewingSupplier.email || "-"}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">Ville & Pays</span>
                  <span className="text-slate-200">{viewingSupplier.city ? `${viewingSupplier.city}, ${viewingSupplier.country || "Maroc"}` : viewingSupplier.country || "Maroc"}</span>
                </div>
              </div>

              {viewingSupplier.metadata && Object.keys(viewingSupplier.metadata).length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Informations Complémentaires</span>
                  <div className="grid grid-cols-2 gap-2 font-mono text-[12px]">
                    {Object.entries(viewingSupplier.metadata).map(([k, v]) => (
                      <div key={k} className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase">{k}</span>
                        <span className="text-indigo-300 font-bold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingSupplier(null)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-[12.5px] font-bold text-slate-300 hover:text-white"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <SpreadsheetImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => {
          setIsImportModalOpen(false);
          fetchSuppliers();
        }} 
        expectedType="suppliers"
        onSuccess={fetchSuppliers}
      />

      {/* Import History Modal */}
      <ImportHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        defaultTable="suppliers"
      />

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
      />
    </div>
  );
}
