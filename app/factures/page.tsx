"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, MoreHorizontal, MessageSquare, Trash2, CheckCircle2, X, Download, Eye, Tag, Pencil, History } from "lucide-react";
import StatusChip from "@/components/StatusChip";
import { mad, statusTone } from "@/lib/format";
import WhatsAppSendModal from "@/components/WhatsAppSendModal";
import ConfirmModal from "@/components/ConfirmModal";
import EditInvoiceModal from "@/components/EditInvoiceModal";
import ImportHistoryModal from "@/components/ImportHistoryModal";
import { printFactureWindow } from "@/components/FacturePrintView";
import { matchesSearch } from "@/lib/search";
import { useTranslation, translateStatus } from "@/lib/i18n";

const statutFilters = ["Toutes", "Brouillon", "Envoyée", "Vue", "Payée", "En retard", "Annulée"];

export default function FacturesPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const activeStatut = searchParams.get("statut") ?? "Toutes";
  const [searchTerm, setSearchTerm] = useState("");
  const [list, setList] = useState<any[]>([]);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Confirm Modal state
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // WhatsApp Modal state
  const [selectedFactureForWhatsApp, setSelectedFactureForWhatsApp] = useState<any | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`/api/invoices?t=${Date.now()}`);
      const data = await res.json();
      const apiList = Array.isArray(data) ? data : (data.results || []);
      const formatted = apiList.map((inv: any) => ({
        ...inv,
        id: inv.id,
        numero: inv.invoice_number || inv.numero || "FAC-000",
        invoice_number: inv.invoice_number || inv.numero || "FAC-000",
        client: inv.client_name || inv.client || "Client inconnu",
        client_name: inv.client_name || inv.client || "Client inconnu",
        montant: parseFloat(inv.total_amount || inv.montant) || 0,
        total_amount: parseFloat(inv.total_amount || inv.montant) || 0,
        statut: inv.status || inv.statut || "Brouillon",
        status: inv.status || inv.statut || "Brouillon",
        dateEmission: inv.date || inv.dateEmission || new Date().toISOString().split("T")[0],
        date: inv.date || new Date().toISOString().split("T")[0],
        lignes: inv.lignes || inv.items || inv.articles || []
      }));
      setList(formatted);
    } catch (err) {
      console.error("Error fetching invoices:", err);
    }
  };

  useEffect(() => {
    fetchInvoices();
    const handleDataUpdate = (e: any) => {
      if (!e.detail || e.detail.type === "invoices") {
        fetchInvoices();
      }
    };
    window.addEventListener("dataUpdated", handleDataUpdate);
    return () => window.removeEventListener("dataUpdated", handleDataUpdate);
  }, []);

  // 0ms Optimistic UI Delete
  const handleDeleteInvoice = (id: string, numero: string) => {
    setConfirmConfig({
      isOpen: true,
      title: `${t("common.delete", "Supprimer")} ${numero}`,
      message: t("invoices.delete_confirm_msg", "Voulez-vous vraiment supprimer cette facture ? Cette action est irréversible."),
      onConfirm: () => {
        setList((prev) => prev.filter((inv) => inv.id !== id));
        setSelectedIds((prev) => prev.filter(item => item !== id));
        showToast(`Facture ${numero} supprimée avec succès !`);

        fetch(`/api/invoices/${id}`, { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "invoices" } }));
          }
        }).catch((err) => console.error("Error deleting invoice:", err));
      }
    });
    setActionMenuOpen(null);
  };

  // Bulk Delete Selected
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: t("invoices.delete_selected", "Supprimer la sélection"),
      message: `${t("invoices.delete_selected_confirm", "Voulez-vous vraiment supprimer les factures sélectionnées ?")} (${selectedIds.length})`,
      onConfirm: () => {
        const idsToDelete = [...selectedIds];
        setList((prev) => prev.filter((inv) => !idsToDelete.includes(inv.id)));
        setSelectedIds([]);
        showToast(`${idsToDelete.length} factures supprimées.`);

        idsToDelete.forEach(id => {
          fetch(`/api/invoices/${id}`, { method: "DELETE" }).catch(e => console.error(e));
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "invoices" } }));
        }
      }
    });
  };

  // 0ms Optimistic UI Clear All
  const handleClearInvoices = () => {
    setConfirmConfig({
      isOpen: true,
      title: t("invoices.clear_confirm_title", "Vider les factures"),
      message: t("invoices.clear_confirm_msg", "Voulez-vous vraiment vider toute la liste des factures ? Cette action est irréversible."),
      onConfirm: () => {
        setList([]);
        setSelectedIds([]);
        showToast("Toutes les factures ont été vidées avec succès !");

        fetch("/api/invoices/clear", { method: "DELETE" }).then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "invoices" } }));
          }
        }).catch((err) => console.error("Error clearing invoices:", err));
      }
    });
  };

  // 0ms Optimistic UI Status Change to ANY status
  const handleUpdateStatus = (id: string, numero: string, newStatus: string) => {
    setList((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, statut: newStatus } : inv))
    );
    showToast(`Statut de la facture ${numero} passé à "${newStatus}" !`);
    setActionMenuOpen(null);

    fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    }).then(() => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "invoices" } }));
      }
    }).catch((err) => console.error("Error updating invoice:", err));
  };

  // Compute live count for each status
  const getStatusCount = (s: string) => {
    if (s === "Toutes") return list.length;
    return list.filter(item => (item.statut || "").toLowerCase() === s.toLowerCase()).length;
  };

  const rows = list.filter((f) => {
    const matchesStatut = activeStatut === "Toutes" || (f.statut || "").toLowerCase() === activeStatut.toLowerCase();
    return matchesStatut && matchesSearch(f, searchTerm);
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(rows.map(r => r.id));
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
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{t("invoices.title", "Factures de Vente")}</h1>
            <p className="text-[13px] text-slate-400">{t("invoices.subtitle", "Gérez vos factures clients, relances et états de paiement")}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
              title="Consulter l'historique des fichiers importés depuis le PC"
            >
              <History size={15} className="text-indigo-400" /> {t("invoices.import_history", "Historique")}
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 active:scale-95 transition-all animate-in fade-in"
              >
                <Trash2 size={15} /> {t("invoices.delete_selected", "Supprimer la sélection")} ({selectedIds.length})
              </button>
            )}
            <button
              onClick={handleClearInvoices}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-[12.5px] font-semibold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
            >
              <Trash2 size={14} /> {t("invoices.clear", "Vider")}
            </button>
            <Link
              href="/factures/nouvelle"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all active:scale-95 self-start sm:self-auto"
            >
              <Plus size={16} /> {t("invoices.new", "Créer une Facture")}
            </Link>
          </div>
        </div>

        <div className="bento-card !p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div className="flex flex-wrap gap-1.5">
              {statutFilters.map((s) => {
                const count = getStatusCount(s);
                const translatedFilter = s === "Toutes" ? t("common.all", "Toutes") : translateStatus(s, t);
                return (
                  <Link
                    key={s}
                    href={s === "Toutes" ? "/factures" : `/factures?statut=${encodeURIComponent(s)}`}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                      activeStatut === s
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/30"
                        : "bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                    }`}
                  >
                    <span>{translatedFilter}</span>
                    <span className={`rounded-full px-1.5 py-0.2 text-[10.5px] font-bold ${
                      activeStatut === s ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                    }`}>
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("invoices.search_placeholder", "Rechercher une facture...")}
                className="w-64 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-visible pb-64 min-h-[360px]">
            <table className="w-full text-[13.5px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selectedIds.length === rows.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3">{t("invoices.num", "Facture N°")}</th>
                  <th className="py-3 px-3">{t("common.client", "Client")}</th>
                  <th className="py-3 px-3">{t("common.amount", "Montant")}</th>
                  <th className="py-3 px-3">{t("common.status", "Statut")}</th>
                  <th className="py-3 px-3">{t("invoices.date_issue", "Date d'émission")}</th>
                  <th className="py-3 px-3 text-right">{t("common.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rows.map((f, idx) => (
                  <tr key={f.id} className={`group hover:bg-slate-800/40 transition-colors ${selectedIds.includes(f.id) ? "bg-indigo-950/20" : ""}`}>
                    <td className="py-3.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(f.id)}
                        onChange={() => handleToggleSelect(f.id)}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-3.5 px-3">
                      <Link href={`/factures/${f.id}`} className="font-mono font-bold text-indigo-400 hover:text-indigo-300 hover:underline">
                        {f.numero}
                      </Link>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-200">{f.client}</td>
                    <td className="figure py-3.5 px-3 font-mono font-bold text-white">{mad(f.montant)}</td>
                    <td className="py-3.5 px-3">
                      <StatusChip tone={statusTone(f.statut)}>{f.statut}</StatusChip>
                    </td>
                    <td className="py-3.5 px-3 text-slate-400 text-[12.5px]">{f.dateEmission}</td>
                    <td className="py-3.5 px-3 text-right relative">
                      <button 
                        onClick={() => setActionMenuOpen(actionMenuOpen === f.id ? null : f.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {actionMenuOpen === f.id && (
                        <div className={`absolute right-2 z-50 w-52 rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-2 text-left animate-in fade-in zoom-in-95 space-y-1 top-10`}>
                          <Link 
                            href={`/factures/${f.id}`}
                            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 hover:bg-slate-800 font-medium"
                          >
                            <Eye size={14} className="text-indigo-400" /> {t("invoices.view", "Voir la facture")}
                          </Link>
                          <button
                            onClick={() => {
                              setEditingInvoice(f);
                              setActionMenuOpen(null);
                            }}
                            className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-amber-300 hover:bg-slate-800 font-semibold"
                          >
                            <Pencil size={14} className="text-amber-400" /> {t("invoices.edit", "Modifier la facture")}
                          </button>
                          <button
                            onClick={() => {
                              printFactureWindow(f);
                              setActionMenuOpen(null);
                            }}
                            className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-indigo-300 hover:bg-slate-800 font-medium"
                          >
                            <Download size={14} className="text-indigo-400" /> {t("invoices.print_pdf", "Imprimer / PDF (A4)")}
                          </button>
                          
                          <div className="pt-1.5 pb-1 border-t border-slate-800">
                            <span className="px-2 text-[10px] uppercase font-bold text-slate-500 block mb-1">{t("invoices.change_status", "Changer Statut")}</span>
                            <div className="grid grid-cols-2 gap-1 text-[11px]">
                              {["Payée", "Envoyée", "Brouillon", "En retard", "Vue", "Annulée"].map((st) => (
                                <button
                                  key={st}
                                  onClick={() => handleUpdateStatus(f.id, f.numero, st)}
                                  className={`rounded-md px-2 py-1 text-left font-medium transition-all ${
                                    f.statut === st
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
                              setSelectedFactureForWhatsApp(f);
                              setActionMenuOpen(null);
                            }}
                            className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-emerald-300 hover:bg-slate-800 font-medium border-t border-slate-800 pt-1.5"
                          >
                            <MessageSquare size={14} className="text-emerald-400" /> WhatsApp
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(f.id, f.numero)}
                            className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 font-medium"
                          >
                            <Trash2 size={14} className="text-red-400" /> {t("common.delete", "Supprimer")}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      {t("invoices.no_invoices", "Aucune facture pour le statut")} "{activeStatut === "Toutes" ? t("common.all", "Toutes") : translateStatus(activeStatut, t)}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* WhatsApp Modal */}
        {selectedFactureForWhatsApp && (
          <WhatsAppSendModal
            isOpen={!!selectedFactureForWhatsApp}
            onClose={() => setSelectedFactureForWhatsApp(null)}
            documentType="facture"
            recipientName={selectedFactureForWhatsApp.client || "Client"}
            documentNumber={selectedFactureForWhatsApp.numero}
            amount={selectedFactureForWhatsApp.montant}
          />
        )}

        {/* Edit Invoice Modal */}
        {editingInvoice && (
          <EditInvoiceModal
            invoice={editingInvoice}
            onClose={() => setEditingInvoice(null)}
            onSuccess={() => {
              showToast("Facture modifiée avec succès dans la base de données !");
              fetchInvoices();
            }}
          />
        )}

        {/* Import History Modal */}
        <ImportHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          defaultTable="factures"
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
