"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, MoreHorizontal, Loader2, ChevronLeft, ChevronRight, MessageSquare, Pencil, Trash2, CheckCircle2, X, Eye, History } from "lucide-react";
import AddClientModal from "@/components/AddClientModal";
import SpreadsheetImportModal from "@/components/SpreadsheetImportModal";
import WhatsAppSendModal from "@/components/WhatsAppSendModal";
import ConfirmModal from "@/components/ConfirmModal";
import ImportHistoryModal from "@/components/ImportHistoryModal";
import { matchesSearch } from "@/lib/search";
import { useTranslation } from "@/lib/i18n";

export default function ClientsPage() {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedClientForWhatsApp, setSelectedClientForWhatsApp] = useState<any | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [metadataKeys, setMetadataKeys] = useState<string[]>([]);

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
    fetchClients();
    const handleDataUpdate = () => fetchClients();
    window.addEventListener("dataUpdated", handleDataUpdate);
    return () => window.removeEventListener("dataUpdated", handleDataUpdate);
  }, []);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clients?t=${Date.now()}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results || []);
      const formatted = list.map((c: any) => ({
        ...c,
        id: c.id,
        nom: c.name || c.nom || "Client",
        name: c.name || c.nom || "Client",
        entreprise: c.company || c.entreprise || "-",
        company: c.company || c.entreprise || "-",
        email: c.email || "-",
        telephone: c.phone || c.telephone || "-"
      }));
      setClients(formatted);

      // Extract all unique custom metadata keys
      const keysSet = new Set<string>();
      formatted.forEach((c: any) => {
        if (c.metadata && typeof c.metadata === "object") {
          Object.keys(c.metadata).forEach(k => keysSet.add(k));
        }
      });
      setMetadataKeys(Array.from(keysSet));
    } catch (err) {
      console.error("Error fetching clients:", err);
    } finally {
      setLoading(false);
    }
  };

  // 0ms Optimistic UI Delete
  const handleDeleteClient = (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: `Supprimer le client ${name}`,
      message: "Voulez-vous vraiment supprimer ce client ? Cette action est irréversible.",
      onConfirm: () => {
        // 1. INSTANT UI removal (0ms delay)
        setClients((prev) => prev.filter((c) => c.id !== id));
        showToast(`Client ${name} supprimé avec succès !`);

        // 2. Asynchronous API sync in background
        fetch(`/api/clients/${id}`, { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "clients" } }));
          }
        }).catch((err) => console.error("Error deleting client:", err));
      }
    });
    setActionMenuOpen(null);
  };

  // 0ms Optimistic UI Clear All
  const handleClearClients = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Vider les clients",
      message: "Voulez-vous vraiment supprimer TOUS les clients ? Cette action est irréversible.",
      onConfirm: () => {
        setClients([]);
        setSelectedIds([]);
        showToast("Tous les clients ont été vidés avec succès !");

        fetch("/api/clients/clear", { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "clients" } }));
          }
        }).catch((err) => console.error("Error clearing clients:", err));
      }
    });
  };

  // Bulk Delete Selected
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: "Supprimer la sélection",
      message: `Voulez-vous vraiment supprimer les ${selectedIds.length} clients sélectionnés ?`,
      onConfirm: () => {
        const idsToDelete = [...selectedIds];
        setClients((prev) => prev.filter((c) => !idsToDelete.includes(c.id)));
        setSelectedIds([]);
        showToast(`${idsToDelete.length} clients supprimés avec succès !`);

        idsToDelete.forEach(id => {
          fetch(`/api/clients/${id}`, { method: "DELETE" }).catch(e => console.error(e));
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "clients" } }));
        }
      }
    });
  };

  const filteredClients = clients.filter((c) => matchesSearch(c, searchTerm));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(displayedClients.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const displayedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <>
      {toast && (
        <div className="fixed top-5 right-5 z-[100] flex items-center gap-2.5 rounded-2xl bg-emerald-600 px-5 py-3.5 text-[13px] font-bold text-white shadow-2xl border border-emerald-400 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 size={16} />
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 rounded-lg p-1 hover:bg-emerald-700">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] space-y-6 text-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{t("clients.title", "Gestion des Clients")}</h1>
            <p className="text-[13px] text-slate-400">{t("clients.subtitle", "Répertoire client, historique des achats et encours financier")}</p>
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
            <button
              onClick={handleClearClients}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-[12.5px] font-semibold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
            >
              <Trash2 size={14} /> {t("common.delete", "Vider")}
            </button>
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-slate-200 hover:bg-slate-800 active:scale-95 transition-all"
            >
              {t("topbar.import_excel", "Importer Excel")}
            </button>
            <button
              onClick={() => { setEditingClient(null); setModalOpen(true); }}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all"
            >
              <Plus size={16} /> {t("clients.new", "Ajouter un Client")}
            </button>
          </div>
        </div>

        <div className="bento-card !p-5 flex flex-col min-h-[500px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={t("common.search", "Rechercher un client par nom, e-mail, entreprise, téléphone...")}
            className="mb-5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {loading ? (
            <div className="flex flex-1 items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : (
            <>
              <div className="overflow-visible flex-1 pb-32 min-h-[360px]">
                <table className="w-full text-[13px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={displayedClients.length > 0 && selectedIds.length === displayedClients.length}
                          onChange={handleSelectAll}
                          className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3">{t("common.client", "Nom")}</th>
                      <th className="py-3 px-3">{t("settings.company_card", "Entreprise")}</th>
                      <th className="py-3 px-3">{t("common.email", "E-mail")}</th>
                      <th className="py-3 px-3">{t("common.phone", "Téléphone")}</th>
                      {metadataKeys.map(key => (
                        <th key={key} className="py-3 px-3 text-indigo-400">{key}</th>
                      ))}
                      <th className="py-3 px-3 text-right">{t("common.actions", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {displayedClients.length === 0 ? (
                      <tr>
                        <td colSpan={6 + metadataKeys.length} className="py-12 text-center text-slate-500">
                          {t("common.no_results", "Aucun client trouvé.")}
                        </td>
                      </tr>
                    ) : (
                      displayedClients.map((c, idx) => (
                        <tr key={`${c.id}-${idx}`} className={`group hover:bg-slate-800/40 transition-colors ${selectedIds.includes(c.id) ? "bg-indigo-950/20" : ""}`}>
                          <td className="py-3.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(c.id)}
                              onChange={() => handleToggleSelect(c.id)}
                              className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                            />
                          </td>
                          <td className="py-3.5 px-3">
                            <Link href={`/clients/${c.id}`} className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-[12px] font-bold text-indigo-300 ring-1 ring-indigo-500/30">
                                {(c.contact_name || c.company_name || "?").charAt(0).toUpperCase()}
                              </span>
                              <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors">{c.contact_name || c.company_name}</span>
                            </Link>
                          </td>
                          <td className="py-3.5 px-3 text-slate-300 font-medium">{c.company_name}</td>
                          <td className="py-3.5 px-3 text-slate-400">{c.email}</td>
                          <td className="figure py-3.5 px-3 text-slate-400 font-mono">{c.phone || c.mobile}</td>
                          
                          {metadataKeys.map(key => (
                            <td key={key} className="py-3.5 px-3 text-slate-400">
                              {c.metadata && c.metadata[key] ? c.metadata[key] : '-'}
                            </td>
                          ))}
                          
                          <td className="py-3.5 px-3 text-right relative">
                            <button 
                              onClick={() => setActionMenuOpen(actionMenuOpen === c.id ? null : c.id)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {actionMenuOpen === c.id && (
                              <div className="absolute right-2 top-10 z-50 w-52 rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-1.5 text-left animate-in fade-in zoom-in-95 space-y-1">
                                <Link 
                                  href={`/clients/${c.id}`}
                                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-slate-200 hover:bg-slate-800 font-medium"
                                >
                                  <Eye size={14} className="text-indigo-400" /> Voir la fiche
                                </Link>
                                <button
                                  onClick={() => {
                                    setEditingClient(c);
                                    setActionMenuOpen(null);
                                  }}
                                  className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 text-[12.5px] text-amber-300 hover:bg-slate-800 font-semibold"
                                >
                                  <Pencil size={14} className="text-amber-400" /> Modifier le client
                                </button>
                                <Link 
                                  href={`/factures/nouvelle?client_id=${c.id}`}
                                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-indigo-400 hover:bg-slate-800 font-semibold"
                                >
                                  <Plus size={14} /> Créer une facture
                                </Link>
                                <Link 
                                  href={`/devis/nouveau?client_id=${c.id}`}
                                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-slate-300 hover:bg-slate-800"
                                >
                                  <Plus size={14} /> Créer un devis
                                </Link>
                                <button
                                  onClick={() => {
                                    setSelectedClientForWhatsApp(c);
                                    setActionMenuOpen(null);
                                  }}
                                  className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 text-[12.5px] text-emerald-300 hover:bg-slate-800 font-medium"
                                >
                                  <MessageSquare size={14} className="text-emerald-400" />
                                  WhatsApp
                                </button>
                                <button
                                  onClick={() => handleDeleteClient(c.id, c.company_name || c.contact_name)}
                                  className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 text-[12.5px] text-red-400 hover:bg-red-500/10 font-medium border-t border-slate-800 pt-1.5"
                                >
                                  <Trash2 size={14} className="text-red-400" /> Supprimer
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-4 text-[13px] text-slate-400">
                  <span>
                    Affichage {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, filteredClients.length)} sur {filteredClients.length} clients
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 rounded-xl border border-slate-800 px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
                    >
                      <ChevronLeft size={16} /> Précédent
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 rounded-xl border border-slate-800 px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
                    >
                      Suivant <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add/Edit Client Modal */}
        {(modalOpen || editingClient) && (
          <AddClientModal 
            onClose={() => { setModalOpen(false); setEditingClient(null); }} 
            onSuccess={() => {
              showToast(editingClient ? "Client modifié avec succès dans la base de données !" : "Nouveau client ajouté avec succès !");
              fetchClients();
            }}
            initialData={editingClient}
          />
        )}

        {/* Spreadsheet Import Modal */}
        <SpreadsheetImportModal 
          isOpen={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)} 
          expectedType="clients" 
        />

        {/* WhatsApp Modal */}
        {selectedClientForWhatsApp && (
          <WhatsAppSendModal
            isOpen={!!selectedClientForWhatsApp}
            onClose={() => setSelectedClientForWhatsApp(null)}
            documentType="facture"
            recipientName={selectedClientForWhatsApp.contact_name || selectedClientForWhatsApp.company_name}
            recipientPhone={selectedClientForWhatsApp.phone || selectedClientForWhatsApp.mobile}
            documentNumber="CLI-001"
            amount={0}
          />
        )}

        {/* Import History Modal */}
        <ImportHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          defaultTable="clients"
        />

        {/* Confirm Modal */}
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={confirmConfig.onConfirm}
        />
      </div>
    </>
  );
}
