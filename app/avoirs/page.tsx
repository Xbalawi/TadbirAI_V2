"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Search, MoreHorizontal, Printer, CheckCircle, Trash2, Loader2, History } from "lucide-react";
import ImportHistoryModal from "@/components/ImportHistoryModal";
import { mad } from "@/lib/format";
import { matchesSearch } from "@/lib/search";
import StatusChip from "@/components/StatusChip";
import { useTranslation, translateStatus } from "@/lib/i18n";

type AvoirItem = {
  id: string;
  client: string;
  facture: string;
  motif: string;
  montant: number;
  date: string;
  statut?: "Émis" | "Appliqué" | "Remboursé";
};

export default function AvoirsPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [list, setList] = useState<AvoirItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [client, setClient] = useState("");
  const [facture, setFacture] = useState("");
  const [motif, setMotif] = useState("");
  const [montant, setMontant] = useState("");
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("Tous");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const fetchAvoirs = async () => {
    try {
      const res = await fetch(`/api/avoirs?t=${Date.now()}`);
      const data = await res.json();
      setList(data.map((a: any) => ({ ...a, statut: a.statut || "Émis" })));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAvoirs();
    const handleUpdate = () => fetchAvoirs();
    window.addEventListener("dataUpdated", handleUpdate);
    return () => window.removeEventListener("dataUpdated", handleUpdate);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !montant) return;

    const newAvoir = {
      client,
      facture: facture || `FAC-${Math.floor(100 + Math.random() * 900)}`,
      motif: motif || "Retour marchandise / Ajustement",
      montant: parseFloat(montant) || 0,
      date: new Date().toISOString().split("T")[0],
      statut: "Émis",
    };

    try {
      fetch('/api/avoirs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAvoir)
      }).then(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "avoirs" } }));
        }
      });
      setIsModalOpen(false);
      setClient("");
      setFacture("");
      setMotif("");
      setMontant("");
    } catch (err) {
      console.error(err);
    }
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Bulk Delete Selected
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Voulez-vous vraiment supprimer ces ${selectedIds.length} avoirs ?`)) {
      const idsToDelete = [...selectedIds];
      setList((prev) => prev.filter((a) => !idsToDelete.includes(a.id)));
      setSelectedIds([]);
      idsToDelete.forEach(id => {
        fetch(`/api/avoirs/${id}`, { method: "DELETE" }).catch(e => console.error(e));
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "avoirs" } }));
      }
    }
  };

  const filtered = list.filter((a) => {
    const matchesSearchTerm = matchesSearch(a, search);
    const matchesStatut = statutFilter === "Tous" || a.statut === statutFilter;
    return matchesSearchTerm && matchesStatut;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const totalAvoirs = list.reduce((s, a) => s + a.montant, 0);
  const totalEmis = list.filter((a) => a.statut === "Émis").reduce((s, a) => s + a.montant, 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{t("credit_notes.title", "Bons d'Avoir")}</h1>
          <p className="text-[13px] text-slate-400">{t("credit_notes.subtitle", "Gérez les retours produits, remises exceptionnelles et avoirs clients")}</p>
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
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all self-start sm:self-auto"
          >
            <Plus size={16} /> {t("credit_notes.new", "Nouveau Bon d'Avoir")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bento-card space-y-1">
          <p className="text-[12px] font-semibold text-slate-400">Total des avoirs émis</p>
          <p className="figure text-2xl font-extrabold text-white">{mad(totalAvoirs)}</p>
        </div>
        <div className="bento-card space-y-1 border-l-4 border-l-amber-500">
          <p className="text-[12px] font-semibold text-slate-400">En attente d'application</p>
          <p className="figure text-2xl font-extrabold text-amber-400">{mad(totalEmis)}</p>
        </div>
        <div className="bento-card space-y-1">
          <p className="text-[12px] font-semibold text-slate-400">Nombre d'avoirs</p>
          <p className="figure text-2xl font-extrabold text-indigo-400">{list.length}</p>
        </div>
      </div>

      <div className="bento-card !p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-4">
          <div className="flex gap-1.5 flex-wrap">
            {["Tous", "Émis", "Appliqué", "Remboursé"].map((st) => (
              <button
                key={st}
                onClick={() => setStatutFilter(st)}
                className={`rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                  statutFilter === st
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/30"
                    : "bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                }`}
              >
                {st === "Tous" ? t("common.all", "Tous") : translateStatus(st, t)}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search", "Rechercher un avoir...")}
              className="w-64 rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto pb-10 min-h-[300px]">
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
                <th className="py-3 px-3">{t("credit_notes.num", "N° Avoir")}</th>
                <th className="py-3 px-3">{t("common.client", "Client")}</th>
                <th className="py-3 px-3">Facture liée</th>
                <th className="py-3 px-3">Motif</th>
                <th className="py-3 px-3">{t("common.amount", "Montant")}</th>
                <th className="py-3 px-3">{t("common.date", "Date")}</th>
                <th className="py-3 px-3">{t("common.status", "Statut")}</th>
                <th className="py-3 px-3 text-right">{t("common.actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Aucun avoir trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className={`group hover:bg-slate-800/40 transition-colors ${selectedIds.includes(a.id) ? "bg-indigo-950/20" : ""}`}>
                    <td className="py-3.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(a.id)}
                        onChange={() => handleToggleSelect(a.id)}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-indigo-400">{a.id}</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-200">{a.client}</td>
                    <td className="py-3.5 px-3 text-slate-400 font-mono text-[12.5px]">{a.facture}</td>
                    <td className="py-3.5 px-3 text-slate-300">{a.motif}</td>
                    <td className="figure py-3.5 px-3 font-mono font-bold text-red-400">-{mad(a.montant)}</td>
                    <td className="py-3.5 px-3 text-slate-400 text-[12.5px]">{a.date}</td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`rounded-xl px-2.5 py-1 text-[11px] font-bold ${
                          a.statut === "Appliqué"
                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                            : a.statut === "Remboursé"
                            ? "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                            : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        }`}
                      >
                        {a.statut || "Émis"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right relative">
                      <button
                        onClick={() => setActionMenuOpen(actionMenuOpen === a.id ? null : a.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {actionMenuOpen === a.id && (
                        <div className="absolute right-2 top-10 z-50 w-52 rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-2 text-left animate-in fade-in zoom-in-95 space-y-1">
                          <button
                            onClick={() => {
                              window.print();
                              setActionMenuOpen(null);
                            }}
                            className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 text-[12.5px] text-slate-200 hover:bg-slate-800 font-medium"
                          >
                            <Printer size={14} className="text-indigo-400" /> Imprimer l'avoir
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await fetch(`/api/avoirs/${a.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'Appliqué' }),
                                });
                              } catch (err) {
                                console.error('Failed to update avoir status:', err);
                              }
                              setList((prev) =>
                                prev.map((item) =>
                                  item.id === a.id ? { ...item, statut: "Appliqué" } : item
                                )
                              );
                              setActionMenuOpen(null);
                            }}
                            className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 text-[12.5px] text-emerald-300 hover:bg-slate-800 font-semibold"
                          >
                            <CheckCircle size={14} className="text-emerald-400" /> Appliquer sur la facture
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await fetch(`/api/avoirs/${a.id}`, { method: 'DELETE' });
                              } catch (err) {
                                console.error('Failed to delete avoir:', err);
                              }
                              setList((prev) => prev.filter((item) => item.id !== a.id));
                              setActionMenuOpen(null);
                            }}
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
      </div>

      {mounted && isModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col overflow-y-auto my-auto rounded-2xl bg-slate-900 p-6 shadow-2xl border border-slate-800 space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white">Créer un nouvel avoir</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Nom du Client *</label>
                <input
                  required
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Nom du client..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Facture liée</label>
                <input
                  value={facture}
                  onChange={(e) => setFacture(e.target.value)}
                  placeholder="FAC-2026-001"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Motif de l'avoir</label>
                <input
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Retour produit / Remise commerciale"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Montant HT (MAD) *</label>
                <input
                  required
                  type="number"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="1500"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500"
                >
                  Créer l'avoir
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Import History Modal */}
      <ImportHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        defaultTable="avoirs"
      />
    </div>
  );
}
