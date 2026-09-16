"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  UploadCloud,
  Info,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Search,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { mad } from "@/lib/format";
import { matchesSearch } from "@/lib/search";
import { useTranslation } from "@/lib/i18n";

type BankTransaction = {
  id: string;
  date: string;
  libelle: string;
  montant: number; // positive for credit (deposit), negative for debit (withdrawal)
  type: "Crédit" | "Débit";
  statut: "Rapproché" | "À rapprocher" | "Écart";
  pieceAssociee?: string;
};

export default function RapprochementPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("Tous");
  const [selectedTxn, setSelectedTxn] = useState<BankTransaction | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [pieceInput, setPieceInput] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Parse CSV File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split(/\r?\n/);
      const newItems: BankTransaction[] = [];

      lines.forEach((line, index) => {
        if (index === 0 || !line.trim()) return; // skip header
        const parts = line.split(/[;,]/);
        if (parts.length >= 3) {
          const date = parts[0]?.trim() || new Date().toISOString().split("T")[0];
          const libelle = parts[1]?.trim() || "Transaction importée";
          const montantRaw = parseFloat(parts[2]?.replace(/\s/g, "").replace(",", ".")) || 0;
          
          newItems.push({
            id: `CSV-${Date.now()}-${index}`,
            date,
            libelle,
            montant: montantRaw,
            type: montantRaw >= 0 ? "Crédit" : "Débit",
            statut: "À rapprocher",
          });
        }
      });

      if (newItems.length > 0) {
        setTransactions((prev) => [...newItems, ...prev]);
      }
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  const downloadSampleCSV = () => {
    const csvContent =
      "Date;Libelle;Montant\n" +
      "2026-04-14;VIREMENT REGLEMENT CLIENT FAC-0046;41400\n" +
      "2026-04-13;PRELEVEMENT REDAL ELECTRICITE;-2340\n" +
      "2026-04-12;VIREMENT REGLEMENT CLIENT FAC-0047;15000\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "modele_releve_bancaire.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMatch = () => {
    if (!selectedTxn || !pieceInput.trim()) return;
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === selectedTxn.id
          ? { ...t, statut: "Rapproché", pieceAssociee: pieceInput.toUpperCase() }
          : t
      )
    );
    setIsMatchModalOpen(false);
    setSelectedTxn(null);
    setPieceInput("");
  };

  const autoMatchAll = () => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.statut === "À rapprocher") {
          const match = t.libelle.match(/(FAC-\d+|DEP-\d+|ABO-\d+)/i);
          if (match) {
            return { ...t, statut: "Rapproché", pieceAssociee: match[0].toUpperCase() };
          }
        }
        return t;
      })
    );
  };

  const filtered = transactions.filter((t) => {
    const matchesSearchTerm = matchesSearch(t, search);
    const matchesStatut = statutFilter === "Tous" || t.statut === statutFilter;
    return matchesSearchTerm && matchesStatut;
  });

  const totalCredit = transactions.filter((t) => t.montant > 0).reduce((s, t) => s + t.montant, 0);
  const totalDebit = transactions.filter((t) => t.montant < 0).reduce((s, t) => s + Math.abs(t.montant), 0);
  const percentRapproche = Math.round(
    (transactions.filter((t) => t.statut === "Rapproché").length / (transactions.length || 1)) * 100
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-ink-900">
            {t("bank.title", "Rapprochement Bancaire")}
          </h1>
          <p className="text-[13px] text-ink-400">
            {t("bank.subtitle", "Synchronisez vos mouvements bancaires avec votre comptabilité")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadSampleCSV}
            className="flex items-center gap-2 rounded-md border border-ink-200 px-3.5 py-2 text-[13px] font-medium text-ink-700 hover:border-brass/50 bg-paper"
          >
            <Download size={15} /> Modèle CSV
          </button>
          <button
            onClick={autoMatchAll}
            className="flex items-center gap-2 rounded-md bg-brass/10 text-brass border border-brass/30 px-3.5 py-2 text-[13px] font-medium hover:bg-brass/20"
          >
            <RefreshCw size={15} /> Rapprochement Auto (IA)
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <label className="ledger-card flex cursor-pointer flex-col items-center justify-center gap-2 border-dashed !border-l-4 py-8 text-center hover:border-brass/50 transition-colors">
        <UploadCloud size={30} className="text-brass" />
        <p className="text-[14px] font-medium text-ink-800">
          {isImporting ? "Importation en cours..." : "Téléversez votre relevé bancaire au format CSV"}
        </p>
        <p className="text-[12px] text-ink-400">Formats supportés: CIH, Attijariwafa, BMCE, SG, CSV standard</p>
        <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
      </label>

      {/* KPI Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="ledger-card">
          <p className="text-[12px] text-ink-400">Total Crédits (Encaissements)</p>
          <p className="figure mt-1 text-[18px] font-semibold text-status-success">{mad(totalCredit)}</p>
        </div>
        <div className="ledger-card">
          <p className="text-[12px] text-ink-400">Total Débits (Décaissements)</p>
          <p className="figure mt-1 text-[18px] font-semibold text-status-danger">{mad(totalDebit)}</p>
        </div>
        <div className="ledger-card">
          <p className="text-[12px] text-ink-400">Taux de rapprochement</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="figure text-[18px] font-semibold text-ink-900">{percentRapproche}%</span>
            <span className="text-[12px] text-ink-500">
              {transactions.filter((t) => t.statut === "Rapproché").length} / {transactions.length}
            </span>
          </div>
        </div>
      </div>

      {/* Transaction Table Card */}
      <div className="bento-card !p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-4">
          <div className="flex gap-1.5 flex-wrap">
            {["Tous", "À rapprocher", "Rapproché"].map((st) => (
              <button
                key={st}
                onClick={() => setStatutFilter(st)}
                className={`rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                  statutFilter === st
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/30"
                    : "bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher libellé ou pièce..."
              className="w-64 rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto pb-10 min-h-[300px]">
          <table className="w-full text-[13.5px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Libellé bancaire</th>
                <th className="py-3 px-3">Montant</th>
                <th className="py-3 px-3">Pièce associée</th>
                <th className="py-3 px-3">Statut</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Aucune transaction trouvée.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="group hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-3 text-slate-400 font-mono text-[12.5px]">{t.date}</td>
                    <td className="py-3.5 px-3 font-semibold text-white max-w-md truncate">{t.libelle}</td>
                    <td className={`figure py-3.5 px-3 font-mono font-bold ${t.montant >= 0 ? "text-emerald-400" : "text-white"}`}>
                      {t.montant >= 0 ? `+${mad(t.montant)}` : `-${mad(Math.abs(t.montant))}`}
                    </td>
                    <td className="py-3.5 px-3">
                      {t.pieceAssociee ? (
                        <span className="font-mono text-[12px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-xl font-semibold">
                          {t.pieceAssociee}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-[12px]">Aucune</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      {t.statut === "Rapproché" ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl text-[11px] font-bold">
                          <CheckCircle2 size={13} /> Rapproché
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl text-[11px] font-bold">
                          <Clock size={13} /> À rapprocher
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      {t.statut === "À rapprocher" ? (
                        <button
                          onClick={() => {
                            setSelectedTxn(t);
                            const match = t.libelle.match(/(FAC-\d+|DEP-\d+|ABO-\d+)/i);
                            setPieceInput(match ? match[0].toUpperCase() : "FAC-0045");
                            setIsMatchModalOpen(true);
                          }}
                          className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all"
                        >
                          Rapprocher
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setTransactions((prev) =>
                              prev.map((item) =>
                                item.id === t.id ? { ...item, statut: "À rapprocher", pieceAssociee: undefined } : item
                              )
                            );
                          }}
                          className="text-[12.5px] font-semibold text-slate-400 hover:text-slate-200"
                        >
                          Délier
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Match Modal */}
      {mounted && isMatchModalOpen && selectedTxn && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col overflow-y-auto my-auto rounded-2xl bg-slate-900 p-6 shadow-2xl border border-slate-800 space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white">
                Rapprocher la transaction
              </h3>
              <button onClick={() => setIsMatchModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 rounded-xl bg-slate-950 p-3.5 text-[13px] border border-slate-800">
              <p className="text-slate-400">Date : <span className="text-white font-mono font-semibold">{selectedTxn.date}</span></p>
              <p className="text-slate-400">Libellé : <span className="text-white font-semibold">{selectedTxn.libelle}</span></p>
              <p className="text-slate-400">Montant : <span className="figure text-emerald-400 font-bold">{mad(Math.abs(selectedTxn.montant))}</span></p>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">
                Numéro de facture ou pièce comptable liée
              </label>
              <input
                type="text"
                value={pieceInput}
                onChange={(e) => setPieceInput(e.target.value)}
                placeholder="Ex: FAC-0045, DEP-012"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsMatchModalOpen(false)}
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-slate-800"
              >
                Annuler
              </button>
              <button
                onClick={handleMatch}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all"
              >
                Confirmer le rapprochement
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
