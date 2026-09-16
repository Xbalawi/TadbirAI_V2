"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, ScanLine, MoreHorizontal, FileScan, Loader2, MessageSquare, Trash2, CheckCircle2, X, Eye, Printer, Pencil, History } from "lucide-react";
import StatusChip from "@/components/StatusChip";
import { mad, statusTone } from "@/lib/format";
import ScannerModal from "@/components/ScannerModal";
import WhatsAppSendModal from "@/components/WhatsAppSendModal";
import ConfirmModal from "@/components/ConfirmModal";
import ImportHistoryModal from "@/components/ImportHistoryModal";
import { printDevisWindow } from "@/components/DevisPrintView";
import { matchesSearch } from "@/lib/search";
import { useTranslation, translateStatus } from "@/lib/i18n";

const statutFilters = ["Toutes", "Brouillon", "Envoyée", "Accepté", "Refusé", "Expiré", "Converti"];

function DevisContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const activeStatut = searchParams.get("statut") ?? "Toutes";
  const [devisList, setDevisList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedDevisForWhatsApp, setSelectedDevisForWhatsApp] = useState<any | null>(null);
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

  const fetchDevis = async () => {
    try {
      const res = await fetch(`/api/quotations?t=${Date.now()}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results || []);
      
      const formattedList = list.map((d: any) => ({
        id: d.id,
        numero: d.quotation_number || "-",
        client: d.client_name || "Client inconnu",
        montant: parseFloat(d.total_amount) || 0,
        statut: d.status || "Brouillon",
        validiteJusquau: d.created_at ? new Date(new Date(d.created_at).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR') : "-",
      }));
      setDevisList(formattedList);
    } catch (err) {
      console.error("Error fetching devis", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevis();
    const handleDataUpdate = () => fetchDevis();
    const handleClickOutside = () => {
      setActionMenuOpen(null);
      setMenuPos(null);
    };
    window.addEventListener("dataUpdated", handleDataUpdate);
    window.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("dataUpdated", handleDataUpdate);
      window.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // 0ms Optimistic UI Delete Devis
  const handleDeleteDevis = (id: string, numero: string) => {
    setConfirmConfig({
      isOpen: true,
      title: `Supprimer le devis ${numero}`,
      message: "Voulez-vous vraiment supprimer ce devis ? Cette action est irréversible.",
      onConfirm: () => {
        // 1. INSTANT UI removal (0ms delay)
        setDevisList((prev) => prev.filter((d) => d.id !== id));
        showToast(`Devis ${numero} supprimé avec succès !`);

        // 2. Asynchronous API sync in background
        fetch(`/api/quotations/${id}`, { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "quotations" } }));
          }
        }).catch((err) => console.error("Error deleting devis:", err));
      }
    });
    setActionMenuOpen(null);
  };

  // 0ms Optimistic UI Clear All
  const handleClearDevis = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Vider les devis",
      message: "Voulez-vous vraiment vider toute la liste des devis ? Cette action est irréversible.",
      onConfirm: () => {
        // 1. INSTANT UI clear (0ms delay)
        setDevisList([]);
        showToast("Tous les devis ont été vidés avec succès !");

        // 2. Asynchronous API sync in background
        fetch("/api/quotations/clear", { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "quotations" } }));
          }
        }).catch((err) => console.error("Error clearing devis:", err));
      }
    });
  };

  // 0ms Optimistic UI Status Update
  const handleUpdateDevisStatus = (id: string, numero: string, newStatus: string) => {
    // 1. INSTANT UI update (0ms delay)
    setDevisList((prev) =>
      prev.map((d) => (d.id === id ? { ...d, statut: newStatus } : d))
    );
    showToast(`Statut du devis ${numero} mis à jour : "${newStatus}" !`);
    setActionMenuOpen(null);

    // 2. Asynchronous API sync in background
    fetch(`/api/quotations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    }).then(() => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "quotations" } }));
      }
    }).catch((err) => console.error("Error updating devis status:", err));
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Bulk Delete Selected
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: `Supprimer les ${selectedIds.length} devis sélectionnés`,
      message: `Voulez-vous vraiment supprimer ces ${selectedIds.length} devis ? Cette action est irréversible.`,
      onConfirm: () => {
        const idsToDelete = [...selectedIds];
        setDevisList((prev) => prev.filter((d) => !idsToDelete.includes(d.id)));
        setSelectedIds([]);
        showToast(`${idsToDelete.length} devis supprimés avec succès !`);

        idsToDelete.forEach(id => {
          fetch(`/api/quotations/${id}`, { method: "DELETE" }).catch(e => console.error(e));
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "quotations" } }));
        }
      }
    });
  };

  const filteredDevis = devisList.filter((d) => {
    const matchesStatut = activeStatut === "Toutes" || (d.statut || "").toLowerCase() === activeStatut.toLowerCase();
    return matchesStatut && matchesSearch(d, searchTerm);
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredDevis.map(d => d.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const [isScannerOpen, setIsScannerOpen] = useState(false);

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
              {t("quotes.title", "Devis Clients")}
            </h1>
            <p className="text-[13px] text-slate-400">{t("quotes.subtitle", "Créez, envoyez et suivez la validation de vos devis en temps réel")}</p>
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
              onClick={handleClearDevis}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-[12.5px] font-semibold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
            >
              <Trash2 size={14} /> Vider
            </button>
            <button 
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-slate-200 hover:bg-slate-800 active:scale-95 transition-all"
            >
              <ScanLine size={16} className="text-amber-400" /> IA Scanner
            </button>
            <Link
              href="/devis/nouveau"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all"
            >
              <Plus size={16} /> {t("quotes.new", "Nouveau Devis")}
            </Link>
          </div>
        </div>

        <div className="bento-card !p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div className="flex flex-wrap gap-1.5">
              {statutFilters.map((s) => (
                <Link
                  key={s}
                  href={s === "Toutes" ? "/devis" : `/devis?statut=${encodeURIComponent(s)}`}
                  className={`rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                    activeStatut === s
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/30"
                      : "bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                  }`}
                >
                  {s === "Toutes" ? t("common.all", "Tous") : translateStatus(s, t)}
                </Link>
              ))}
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("common.search", "Rechercher des devis...")}
              className="w-64 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="overflow-visible pb-40 min-h-[500px]">
            <table className="w-full text-[13.5px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredDevis.length > 0 && selectedIds.length === filteredDevis.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3">{t("quotes.num", "Devis N°")}</th>
                  <th className="py-3 px-3">{t("common.client", "Client")}</th>
                  <th className="py-3 px-3">{t("common.amount", "Montant")}</th>
                  <th className="py-3 px-3">{t("common.status", "Statut")}</th>
                  <th className="py-3 px-3">Validité</th>
                  <th className="py-3 px-3 text-right">{t("common.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDevis.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      {t("invoices.no_invoices", "Aucun devis pour le statut")} &quot;{activeStatut === "Toutes" ? t("common.all", "Tous") : translateStatus(activeStatut, t)}&quot;.
                    </td>
                  </tr>
                ) : (
                  filteredDevis.map((d: any, idx: number) => (
                    <tr key={d.id} className={`group hover:bg-slate-800/40 transition-colors ${selectedIds.includes(d.id) ? "bg-indigo-950/20" : ""}`}>
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(d.id)}
                          onChange={() => handleToggleSelect(d.id)}
                          className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-indigo-400">
                        <Link href={`/devis/${d.id}`} className="hover:underline hover:text-indigo-300">
                          {d.numero}
                        </Link>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-200">{d.client}</td>
                      <td className="figure py-3.5 px-3 font-mono font-bold text-white">{mad(d.montant)}</td>
                      <td className="py-3.5 px-3">
                        <StatusChip tone={statusTone(d.statut)}>{d.statut}</StatusChip>
                      </td>
                      <td className="py-3.5 px-3 text-slate-400 text-[12.5px]">{d.validiteJusquau}</td>
                      <td className="py-3.5 px-3 text-right relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (actionMenuOpen === d.id) {
                              setActionMenuOpen(null);
                              setMenuPos(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuHeight = 310;
                              const showAbove = rect.bottom + menuHeight > window.innerHeight;
                              setMenuPos({
                                top: showAbove ? Math.max(10, rect.top - menuHeight) : rect.bottom + 6,
                                left: Math.max(10, rect.right - 224)
                              });
                              setActionMenuOpen(d.id);
                            }
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {actionMenuOpen === d.id && menuPos && (
                          <div 
                            style={{ position: "fixed", top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
                            className="z-[9999] w-56 max-h-[310px] overflow-y-auto rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-2 text-left animate-in fade-in zoom-in-95 space-y-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link
                              href={`/devis/${d.id}`}
                              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 hover:bg-slate-800 font-medium"
                            >
                              <Eye size={14} className="text-indigo-400" /> Voir le devis
                            </Link>
                            <Link
                              href={`/devis/nouveau?edit_id=${d.id}`}
                              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-amber-300 hover:bg-slate-800 font-semibold"
                            >
                              <Pencil size={14} className="text-amber-400" /> Modifier le devis
                            </Link>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                try {
                                  printDevisWindow(d);
                                } catch (err) {
                                  console.error(err);
                                }
                                setActionMenuOpen(null);
                              }}
                              className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-indigo-300 hover:bg-slate-800 font-semibold"
                            >
                              <Printer size={14} className="text-indigo-400" /> Imprimer / PDF
                            </button>
                            <Link
                              href={`/factures/nouvelle?from_devis=${d.id}`}
                              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-emerald-400 hover:bg-slate-800 font-semibold"
                            >
                              <Plus size={14} /> Facturer le devis
                            </Link>

                            <div className="pt-1.5 pb-1 border-t border-slate-800">
                              <span className="px-2 text-[10px] uppercase font-bold text-slate-500 block mb-1">{t("invoices.change_status", "Changer Statut")}</span>
                              <div className="grid grid-cols-2 gap-1 text-[11px]">
                                {["Accepté", "Refusé", "Brouillon", "Envoyée", "Expiré", "Converti"].map((st) => (
                                  <button
                                    key={st}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateDevisStatus(d.id, d.numero, st);
                                    }}
                                    className={`rounded-md px-2 py-1 text-left font-medium transition-all ${
                                      d.statut === st
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
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDevisForWhatsApp(d);
                                setActionMenuOpen(null);
                              }}
                              className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-emerald-300 hover:bg-slate-800 font-medium border-t border-slate-800 pt-1.5"
                            >
                              <MessageSquare size={14} className="text-emerald-400" /> WhatsApp
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDevis(d.id, d.numero);
                              }}
                              className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 font-medium"
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

        {/* IA Scanner Modal */}
        <ScannerModal 
          isOpen={isScannerOpen} 
          onClose={() => setIsScannerOpen(false)} 
          targetType="devis" 
        />

        {/* WhatsApp Modal */}
        {selectedDevisForWhatsApp && (
          <WhatsAppSendModal
            isOpen={!!selectedDevisForWhatsApp}
            onClose={() => setSelectedDevisForWhatsApp(null)}
            documentType="devis"
            recipientName={selectedDevisForWhatsApp.client}
            documentNumber={selectedDevisForWhatsApp.numero}
            amount={selectedDevisForWhatsApp.montant}
          />
        )}

        {/* Import History Modal */}
        <ImportHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          defaultTable="devis"
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

export default function DevisPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-400" /></div>}>
      <DevisContent />
    </Suspense>
  );
}
