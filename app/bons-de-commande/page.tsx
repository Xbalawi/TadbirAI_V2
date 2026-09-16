"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, MoreHorizontal, Loader2, Pencil, Trash2, CheckCircle2, X, Eye, Download, MessageSquare, History } from "lucide-react";
import { mad } from "@/lib/format";
import BonCommandeModal from "@/components/BonCommandeModal";
import WhatsAppSendModal from "@/components/WhatsAppSendModal";
import ConfirmModal from "@/components/ConfirmModal";
import ImportHistoryModal from "@/components/ImportHistoryModal";
import { printDevisWindow } from "@/components/DevisPrintView";
import { matchesSearch } from "@/lib/search";
import { useTranslation, translateStatus } from "@/lib/i18n";

const statutStyles: Record<string, string> = {
  Brouillon: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold",
  Envoyé: "bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold",
  Validé: "bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold",
  Partiel: "bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold",
  Reçu: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold",
};

const statutFilters = ["Tous", "Brouillon", "Envoyé", "Validé", "Partiel", "Reçu"];

export default function BonsCommandePage() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBcModalOpen, setIsBcModalOpen] = useState(false);
  const [editingBc, setEditingBc] = useState<any | null>(null);
  const [selectedBcForWhatsApp, setSelectedBcForWhatsApp] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("Tous");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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

  const fetchBons = async () => {
    try {
      const res = await fetch(`/api/bons-commande?t=${Date.now()}`);
      const data = await res.json();
      const apiList = Array.isArray(data) ? data : (data.results || []);
      const formatted = apiList.map((po: any) => ({
        id: po.id || po.bc_number || "BC-000",
        bc_number: po.bc_number || po.id,
        fournisseur: po.fournisseur || po.supplier_name || "Fournisseur",
        statut: po.statut || po.status || "Brouillon",
        dateEmission: po.dateEmission || po.date || new Date().toISOString().split("T")[0],
        livraisonPrevue: po.livraisonPrevue || po.delivery_date || "-",
        conditionsPaiement: po.conditionsPaiement || "Net 30",
        montant: parseFloat(po.montant || po.total_amount) || 0,
        notes: po.notes || "",
        articles: po.articles || [{ nom: "Article général", qte: 1, recu: 0, prixUnitaire: parseFloat(po.montant) || 0 }]
      }));
      setList(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBons();
    const handleUpdate = () => fetchBons();
    window.addEventListener("dataUpdated", handleUpdate);
    return () => window.removeEventListener("dataUpdated", handleUpdate);
  }, []);

  // 0ms Optimistic UI Delete
  const handleDeleteBc = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: `Supprimer le Bon de Commande ${id}`,
      message: "Voulez-vous vraiment supprimer ce bon de commande ? Cette action est irréversible.",
      onConfirm: () => {
        // 1. INSTANT UI removal (0ms delay)
        setList((prev) => prev.filter((po) => po.id !== id));
        showToast(`Bon de commande ${id} supprimé avec succès !`);

        // 2. Asynchronous API sync in background
        fetch(`/api/bons-commande/${id}`, { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "bons-commande" } }));
          }
        }).catch((err) => console.error("Error deleting BC:", err));
      }
    });
    setActionMenuOpen(null);
  };

  // 0ms Optimistic UI Clear All
  const handleClearBons = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Vider les bons de commande",
      message: "Voulez-vous vraiment vider toute la liste des bons de commande ? Cette action est irréversible.",
      onConfirm: () => {
        // 1. INSTANT UI clear (0ms delay)
        setList([]);
        showToast("Tous les bons de commande ont été vidés avec succès !");

        // 2. Asynchronous API sync in background
        fetch("/api/bons-commande/clear", { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "bons-commande" } }));
          }
        }).catch((err) => console.error("Error clearing BCs:", err));
      }
    });
  };

  // 0ms Optimistic UI Status Change
  const handleUpdateBcStatus = (id: string, newStatus: string) => {
    // 1. INSTANT UI update (0ms delay)
    setList((prev) =>
      prev.map((po) => (po.id === id ? { ...po, statut: newStatus } : po))
    );
    showToast(`Statut du bon de commande ${id} passé à "${newStatus}" !`);
    setActionMenuOpen(null);

    // 2. Asynchronous API sync in background
    fetch(`/api/bons-commande/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: newStatus, status: newStatus })
    }).then(() => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "bons-commande" } }));
      }
    }).catch((err) => console.error("Error updating BC status:", err));
  };

  const getStatusCount = (s: string) => {
    if (s === "Tous") return list.length;
    return list.filter((po) => (po.statut || "").toLowerCase() === s.toLowerCase()).length;
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Bulk Delete Selected
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: `Supprimer les ${selectedIds.length} bons de commande sélectionnés`,
      message: `Voulez-vous vraiment supprimer ces ${selectedIds.length} bons de commande ? Cette action est irréversible.`,
      onConfirm: () => {
        const idsToDelete = [...selectedIds];
        setList((prev) => prev.filter((po) => !idsToDelete.includes(po.id)));
        setSelectedIds([]);
        showToast(`${idsToDelete.length} bons de commande supprimés avec succès !`);

        idsToDelete.forEach(id => {
          fetch(`/api/bons-commande/${id}`, { method: "DELETE" }).catch(e => console.error(e));
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "bons-commande" } }));
        }
      }
    });
  };

  const filtered = list.filter((po) => {
    const matchesSearchTerm = matchesSearch(po, search);
    const matchesStatut = statutFilter === "Tous" || (po.statut || "").toLowerCase() === statutFilter.toLowerCase();
    return matchesSearchTerm && matchesStatut;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(po => po.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

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
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {t("bons_commande.title", "Bons de Commande")}
            </h1>
            <p className="text-[13px] text-slate-400">{t("bons_commande.subtitle", "Gérez vos achats, articles commandés et réceptions fournisseurs")}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
              title="Consulter l'historique des fichiers importés depuis le PC"
            >
              <History size={15} className="text-indigo-400" /> Historique
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 active:scale-95 transition-all animate-in fade-in"
              >
                <Trash2 size={15} /> Supprimer la sélection ({selectedIds.length})
              </button>
            )}
            <button
              onClick={handleClearBons}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-[12.5px] font-semibold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
            >
              <Trash2 size={14} /> Vider
            </button>
            <button
              onClick={() => { setEditingBc(null); setIsBcModalOpen(true); }}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all self-start sm:self-auto"
            >
              <Plus size={16} /> {t("bons_commande.new", "Nouveau Bon de Commande")}
            </button>
          </div>
        </div>

        <div className="bento-card !p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div className="flex flex-wrap gap-1.5">
              {statutFilters.map((st) => {
                const count = getStatusCount(st);
                return (
                  <button
                    key={st}
                    onClick={() => setStatutFilter(st)}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                      statutFilter === st
                        ? "bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400/30"
                        : "bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                    }`}
                  >
                    <span>{st === "Tous" ? t("common.all", "Tous") : translateStatus(st, t)}</span>
                    <span className={`rounded-full px-1.5 py-0.2 text-[10.5px] font-bold ${
                      statutFilter === st ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("common.search", "Rechercher BC, fournisseur...")}
                className="w-64 rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-3 min-h-[360px]">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-indigo-400" size={28} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-[13px]">
                Aucun bon de commande trouvé pour cette sélection.
              </div>
            ) : (
              filtered.map((po) => {
                const totalArticles = (po.articles || []).reduce((s: number, a: any) => s + (a.qte || 0), 0);
                const totalRecu = (po.articles || []).reduce((s: number, a: any) => s + (a.recu || 0), 0);
                const progress = totalArticles > 0 ? (totalRecu / totalArticles) * 100 : 0;
                
                return (
                  <div
                    key={po.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 flex items-center justify-between hover:bg-slate-800/40 hover:border-slate-700 transition-all relative"
                  >
                    <Link href={`/bons-de-commande/${po.id}`} className="flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-indigo-400 text-[14px]">{po.id}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] ${statutStyles[po.statut] || statutStyles.Brouillon}`}>
                          {po.statut}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-slate-400 mt-1">
                        Fournisseur : <span className="font-semibold text-slate-200">{po.fournisseur}</span> · Émis le {po.dateEmission} · Livraison prév. {po.livraisonPrevue}
                      </p>
                      {progress > 0 && progress < 100 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-800">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-[10.5px] font-mono text-indigo-300">{Math.round(progress)}% reçu</span>
                        </div>
                      )}
                    </Link>

                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className="figure font-mono font-bold text-white text-[15px]">{mad(po.montant)}</p>
                        <p className="text-[11.5px] text-slate-400">{(po.articles || []).length} article(s) · {po.conditionsPaiement || "Net 30"}</p>
                      </div>
                      <button
                        onClick={() => setActionMenuOpen(actionMenuOpen === po.id ? null : po.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {actionMenuOpen === po.id && (
                        <div className="absolute right-4 top-12 z-50 w-56 rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-2 text-left animate-in fade-in zoom-in-95 space-y-1">
                          <Link
                            href={`/bons-de-commande/${po.id}`}
                            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 hover:bg-slate-800 font-medium"
                          >
                            <Eye size={14} className="text-indigo-400" /> Voir les détails
                          </Link>
                          
                          <button
                            onClick={() => {
                              setEditingBc(po);
                              setActionMenuOpen(null);
                            }}
                            className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-amber-300 hover:bg-slate-800 font-semibold"
                          >
                            <Pencil size={14} className="text-amber-400" /> Modifier le Bon de Commande
                          </button>

                          <Link
                            href={`/bons-de-commande/${po.id}/print`}
                            target="_blank"
                            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-indigo-300 hover:bg-slate-800 font-medium"
                          >
                            <Download size={14} className="text-indigo-400" /> Imprimer / PDF
                          </Link>

                          <div className="pt-1.5 pb-1 border-t border-slate-800">
                            <span className="px-2 text-[10px] uppercase font-bold text-slate-500 block mb-1">{t("invoices.change_status", "Changer Statut")}</span>
                            <div className="grid grid-cols-2 gap-1 text-[11px]">
                              {["Brouillon", "Envoyé", "Validé", "Partiel", "Reçu"].map((st) => (
                                <button
                                  key={st}
                                  onClick={() => handleUpdateBcStatus(po.id, st)}
                                  className={`rounded-md px-2 py-1 text-left font-medium transition-all ${
                                    po.statut === st
                                      ? "bg-indigo-600 text-white"
                                      : "bg-slate-950 text-slate-300 hover:bg-slate-800"
                                  }`}
                                >
                                  {translateStatus(st, t)}
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedBcForWhatsApp(po);
                              setActionMenuOpen(null);
                            }}
                            className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-emerald-300 hover:bg-slate-800 font-medium border-t border-slate-800 pt-1.5"
                          >
                            <MessageSquare size={14} className="text-emerald-400" /> WhatsApp
                          </button>
                          <button
                            onClick={() => handleDeleteBc(po.id)}
                            className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 font-medium"
                          >
                            <Trash2 size={14} className="text-red-400" /> Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Add/Edit Bon de Commande Modal */}
        {(isBcModalOpen || editingBc) && (
          <BonCommandeModal
            isOpen={isBcModalOpen || !!editingBc}
            onClose={() => { setIsBcModalOpen(false); setEditingBc(null); }}
            onSuccess={() => {
              showToast(editingBc ? "Bon de commande modifié avec succès !" : "Nouveau bon de commande créé avec succès !");
              fetchBons();
            }}
            initialData={editingBc}
          />
        )}

        {/* WhatsApp Modal */}
        {selectedBcForWhatsApp && (
          <WhatsAppSendModal
            isOpen={!!selectedBcForWhatsApp}
            onClose={() => setSelectedBcForWhatsApp(null)}
            documentType="devis"
            recipientName={selectedBcForWhatsApp.fournisseur}
            documentNumber={selectedBcForWhatsApp.id}
            amount={selectedBcForWhatsApp.montant}
          />
        )}

        {/* Import History Modal */}
        <ImportHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          defaultTable="bons-commande"
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
