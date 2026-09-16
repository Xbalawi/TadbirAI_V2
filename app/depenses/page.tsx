"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, MoreHorizontal, Loader2, Pencil, Trash2, CheckCircle2, X, Eye, Download, Tag, History } from "lucide-react";
import StatusChip from "@/components/StatusChip";
import ConfirmModal from "@/components/ConfirmModal";
import AddDepenseModal from "@/components/AddDepenseModal";
import ImportHistoryModal from "@/components/ImportHistoryModal";
import { mad, statusTone } from "@/lib/format";
import { matchesSearch } from "@/lib/search";
import { useTranslation } from "@/lib/i18n";

type Depense = {
  id: string;
  titre?: string;
  categorie: string;
  fournisseur: string;
  montant: number;
  montantHt?: number;
  tva?: number;
  statut: "Payée" | "En attente" | "Annulée";
  modePaiement?: string;
  referenceFacture?: string;
  date: string;
  notes?: string;
};

const statutFilters = ["Tous", "Payée", "En attente", "Annulée"];

export default function DepensesPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<Depense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepense, setEditingDepense] = useState<Depense | null>(null);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("Tous");
  const [categoryFilter, setCategoryFilter] = useState("Toutes");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDepenses = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/depenses?t=${Date.now()}`);
      const data = await res.json();
      const apiList = Array.isArray(data) ? data : (data.results || []);
      const formatted = apiList.map((d: any) => ({
        id: d.id || `DEP-${Math.floor(1000 + Math.random() * 9000)}`,
        titre: d.titre || d.title || `Achat ${d.categorie || 'Dépense'}`,
        categorie: d.categorie || d.category || "Fournitures & Bureau",
        fournisseur: d.fournisseur || d.supplier || "Fournisseur Comptoir",
        montant: parseFloat(d.montant || d.total_amount) || 0,
        montantHt: parseFloat(d.montantHt) || parseFloat(d.montant || 0) / 1.2,
        tva: parseFloat(d.tva) || parseFloat(d.montant || 0) * 0.2,
        statut: d.statut || d.status || "Payée",
        modePaiement: d.modePaiement || "Virement Bancaire",
        referenceFacture: d.referenceFacture || "-",
        date: d.date || new Date().toISOString().split("T")[0],
        notes: d.notes || ""
      }));
      setList(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepenses();
    const handleUpdate = () => fetchDepenses();
    window.addEventListener("dataUpdated", handleUpdate);
    return () => window.removeEventListener("dataUpdated", handleUpdate);
  }, []);

  const handleDeleteDepense = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: `${t("common.delete_confirm", "Supprimer")} ${id}`,
      message: t("common.delete_warning", "Voulez-vous vraiment supprimer cette dépense ? Cette action est irréversible."),
      onConfirm: () => {
        setList((prev) => prev.filter((d) => d.id !== id));
        showToast(`${t("common.deleted", "Dépense supprimée avec succès")}`);

        fetch(`/api/depenses/${id}`, { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "depenses" } }));
          }
        }).catch((err) => console.error("Error deleting depense:", err));
      }
    });
    setActionMenuOpen(null);
  };

  const handleClearDepenses = () => {
    setConfirmConfig({
      isOpen: true,
      title: t("common.clear", "Vider"),
      message: t("common.clear_warning", "Voulez-vous vraiment vider toute la liste des dépenses ? Cette action est irréversible."),
      onConfirm: () => {
        setList([]);
        showToast(t("common.cleared", "Toutes les dépenses ont été vidées avec succès !"));

        fetch("/api/depenses/clear", { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "depenses" } }));
          }
        }).catch((err) => console.error("Error clearing depenses:", err));
      }
    });
  };

  const handleUpdateDepenseStatus = (id: string, newStatus: "Payée" | "En attente" | "Annulée") => {
    setList((prev) =>
      prev.map((d) => (d.id === id ? { ...d, statut: newStatus } : d))
    );
    showToast(`${t("expenses.status_updated", "Statut mis à jour")}`);
    setActionMenuOpen(null);

    fetch(`/api/depenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: newStatus, status: newStatus })
    }).then(() => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "depenses" } }));
      }
    }).catch((err) => console.error("Error updating depense status:", err));
  };

  const getStatusCount = (s: string) => {
    if (s === "Tous") return list.length;
    return list.filter((d) => (d.statut || "").toLowerCase() === s.toLowerCase()).length;
  };

  const total = list.reduce((s, d) => s + d.montant, 0);
  const totalPayees = list.filter((d) => d.statut === "Payée").reduce((s, d) => s + d.montant, 0);
  const totalEnAttente = list.filter((d) => d.statut === "En attente").reduce((s, d) => s + d.montant, 0);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: `${t("common.delete", "Supprimer")} (${selectedIds.length})`,
      message: t("common.delete_bulk_warning", "Voulez-vous vraiment supprimer ces dépenses sélectionnées ?"),
      onConfirm: () => {
        const idsToDelete = [...selectedIds];
        setList((prev) => prev.filter((d) => !idsToDelete.includes(d.id)));
        setSelectedIds([]);
        showToast(`${idsToDelete.length} ${t("expenses.deleted_bulk", "dépenses supprimées")}`);

        idsToDelete.forEach(id => {
          fetch(`/api/depenses/${id}`, { method: "DELETE" }).catch(e => console.error(e));
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "depenses" } }));
        }
      }
    });
  };

  const filtered = list.filter((d) => {
    const matchesSearchTerm = matchesSearch(d, search);
    const matchesStatut = statutFilter === "Tous" || (d.statut || "").toLowerCase() === statutFilter.toLowerCase();
    const matchesCat = categoryFilter === "Toutes" || d.categorie === categoryFilter;
    return matchesSearchTerm && matchesStatut && matchesCat;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(d => d.id));
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
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{t("expenses.title", "Dépenses & Charges")}</h1>
            <p className="text-[13px] text-slate-400">{t("expenses.subtitle", "Suivez et contrôlez les charges, paiements et TVA déductible de votre entreprise")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
            >
              <History size={15} className="text-indigo-400" /> {t("common.history", "Historique d'import")}
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 active:scale-95 transition-all animate-in fade-in"
              >
                <Trash2 size={15} /> {t("common.delete_selected", "Supprimer la sélection")} ({selectedIds.length})
              </button>
            )}
            <button
              onClick={handleClearDepenses}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-[12.5px] font-semibold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
            >
              <Trash2 size={14} /> {t("common.clear", "Vider")}
            </button>
            <button
              onClick={() => { setEditingDepense(null); setIsModalOpen(true); }}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all self-start sm:self-auto"
            >
              <Plus size={16} /> {t("expenses.new", "Nouvelle dépense")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bento-card space-y-1">
            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Total Dépenses TTC</p>
            <p className="figure text-2xl font-extrabold text-white">{mad(total)}</p>
            <p className="text-[11.5px] text-slate-400">{list.length} dépense(s) enregistrée(s)</p>
          </div>
          <div className="bento-card space-y-1 border-l-4 border-l-emerald-500">
            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Dépenses Réglées</p>
            <p className="figure text-2xl font-extrabold text-emerald-400">{mad(totalPayees)}</p>
            <p className="text-[11.5px] text-slate-400">{getStatusCount("Payée")} règlement(s) effectué(s)</p>
          </div>
          <div className="bento-card space-y-1 border-l-4 border-l-amber-500">
            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">En attente de règlement</p>
            <p className="figure text-2xl font-extrabold text-amber-400">{mad(totalEnAttente)}</p>
            <p className="text-[11.5px] text-slate-400">{getStatusCount("En attente")} échéance(s) en cours</p>
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
                    <span>{st}</span>
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
                placeholder="Rechercher dépense, fournisseur, catégorie..."
                className="w-72 rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto pb-10 min-h-[360px]">
            <table className="w-full text-[13.5px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3">Référence / Dépense</th>
                  <th className="py-3 px-3">Catégorie</th>
                  <th className="py-3 px-3">Fournisseur</th>
                  <th className="py-3 px-3">Mode Paiement</th>
                  <th className="py-3 px-3">Montant TTC</th>
                  <th className="py-3 px-3">Statut</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      <Loader2 className="animate-spin text-indigo-400 inline mr-2" size={20} /> Chargement des dépenses...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      Aucune dépense trouvée pour cette sélection.
                    </td>
                  </tr>
                ) : (
                  filtered.map((d) => (
                    <tr key={d.id} className={`group hover:bg-slate-800/40 transition-colors ${selectedIds.includes(d.id) ? "bg-indigo-950/20" : ""}`}>
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(d.id)}
                          onChange={() => handleToggleSelect(d.id)}
                          className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-mono font-bold text-indigo-400 text-[13px]">{d.id}</div>
                        <div className="text-[12.5px] font-semibold text-white group-hover:text-indigo-300 transition-colors">
                          {d.titre || `Dépense ${d.categorie}`}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="rounded-xl bg-indigo-500/10 px-2.5 py-1 text-[11.5px] font-semibold text-indigo-300 border border-indigo-500/20">
                          {d.categorie}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-300 font-semibold">{d.fournisseur}</td>
                      <td className="py-3.5 px-3 text-slate-400 text-[12.5px]">{d.modePaiement || "Virement"}</td>
                      <td className="figure py-3.5 px-3 font-mono font-bold text-white text-[14px]">
                        {mad(d.montant)}
                      </td>
                      <td className="py-3.5 px-3">
                        <StatusChip tone={statusTone(d.statut)}>{d.statut}</StatusChip>
                      </td>
                      <td className="py-3.5 px-3 text-slate-400 text-[12.5px]">{d.date}</td>
                      <td className="py-3.5 px-3 text-right relative">
                        <button
                          onClick={() => setActionMenuOpen(actionMenuOpen === d.id ? null : d.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {actionMenuOpen === d.id && (
                          <div className="absolute right-2 top-10 z-50 w-52 rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-2 text-left animate-in fade-in zoom-in-95 space-y-1">
                            <button
                              onClick={() => {
                                setEditingDepense(d);
                                setActionMenuOpen(null);
                              }}
                              className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-amber-300 hover:bg-slate-800 font-semibold"
                            >
                              <Pencil size={14} className="text-amber-400" /> Modifier la Dépense
                            </button>

                            <div className="pt-1.5 pb-1 border-t border-slate-800">
                              <span className="px-2 text-[10px] uppercase font-bold text-slate-500 block mb-1">Changer Statut</span>
                              <div className="grid grid-cols-2 gap-1 text-[11px]">
                                {(["Payée", "En attente", "Annulée"] as const).map((st) => (
                                  <button
                                    key={st}
                                    onClick={() => handleUpdateDepenseStatus(d.id, st)}
                                    className={`rounded-md px-2 py-1 text-left font-medium transition-all ${
                                      d.statut === st
                                        ? "bg-indigo-600 text-white"
                                        : "bg-slate-950 text-slate-300 hover:bg-slate-800"
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteDepense(d.id)}
                              className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 font-medium border-t border-slate-800 pt-1.5"
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
        </div>

        {/* Add/Edit Depense Modal */}
        {(isModalOpen || editingDepense) && (
          <AddDepenseModal
            isOpen={isModalOpen || !!editingDepense}
            onClose={() => { setIsModalOpen(false); setEditingDepense(null); }}
            onSuccess={() => {
              showToast(editingDepense ? "Dépense modifiée avec succès dans la base de données !" : "Nouvelle dépense enregistrée avec succès !");
              fetchDepenses();
            }}
            initialData={editingDepense}
          />
        )}

        {/* Import History Modal */}
        <ImportHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          defaultTable="depenses"
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
