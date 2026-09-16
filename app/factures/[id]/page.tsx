"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Download, CheckCircle2, MessageSquare, MoreHorizontal, Loader2 } from "lucide-react";
import StatusChip from "@/components/StatusChip";
import { mad, statusTone } from "@/lib/format";
import WhatsAppSendModal from "@/components/WhatsAppSendModal";
import { printFactureWindow } from "@/components/FacturePrintView";

import { useTranslation } from "@/lib/i18n";

export default function FactureDetailPage({ params }: { params: { id: string } }) {
  const { t } = useTranslation();
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [facture, setFacture] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFacture = () => {
      fetch(`/api/invoices?t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          const list = Array.isArray(data) ? data : (data.results || []);
          const found = list.find((f: any) => f.id === params.id);
          setFacture(found);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };
    loadFacture();
    const handleUpdate = () => loadFacture();
    window.addEventListener("dataUpdated", handleUpdate);
    return () => window.removeEventListener("dataUpdated", handleUpdate);
  }, [params.id]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>;
  if (!facture) return <div className="p-12 text-center text-white">{t("common.no_results", "Facture introuvable (404)")}</div>;

  const clientInfo = { telephone: facture.phone || "" }; // Fallback

  const lignes = facture.lignes || [];
  const sousTotal = lignes.reduce((sum: any, l: any) => sum + (l.quantite || l.qte || 1) * (l.prix_unitaire || l.prix || 0), 0);
  const remiseAmount = 0; // Remise is not yet natively supported in Scanner
  const taxe = sousTotal * 0.2; // Default 20%
  const total = sousTotal - remiseAmount + taxe;

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/factures"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white transition-all"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[22px] font-bold text-white tracking-tight">
                {facture.invoice_number}
              </h1>
              <StatusChip tone={statusTone(facture.status)}>{facture.status}</StatusChip>
            </div>
            <p className="text-[12.5px] text-slate-400">{t("common.date", "Date")} : {facture.date}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowWhatsApp(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/30 transition-all active:scale-95"
          >
            <MessageSquare size={15} /> WhatsApp
          </button>
          <button
            onClick={() => printFactureWindow(facture)}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-[12.5px] font-bold text-indigo-400 hover:bg-indigo-500/20 shadow-md transition-all active:scale-95"
          >
            <Download size={15} /> {t("invoices.print_pdf", "Imprimer / PDF (A4)")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="ledger-card">
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">{t("common.client", "Client")}</p>
          <p className="mt-1 text-[15px] font-bold text-white">{facture.client_name}</p>
          {clientInfo?.telephone && (
            <p className="text-[12px] text-emerald-400 font-mono mt-0.5">📞 {clientInfo.telephone}</p>
          )}
        </div>
        <div className="ledger-card">
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">{t("common.date", "Dates")}</p>
          <div className="mt-1 flex justify-between text-[13px] text-slate-300">
            <span>{t("invoices.date_issue", "Émise")} :</span>
            <span className="font-semibold text-white">{facture.date}</span>
          </div>
        </div>
        <div className="ledger-card">
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">{t("common.total", "Total à payer")}</p>
          <p className="figure mt-1 text-[22px] font-extrabold text-white">{mad(total)}</p>
        </div>
      </div>

      <div className="ledger-card flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
          {t("company.rib", "Coordonnées bancaires")}
        </p>
        <p className="figure text-[13px] font-mono font-bold text-slate-200">007 780 0001234567890123 45</p>
      </div>

      <div className="ledger-card">
        <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-3">
          <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
            {t("nav.factures", "Lignes de facture")}
          </p>
          <span className="text-[12px] text-slate-400">{lignes.length} article(s)</span>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="pb-2">#</th>
              <th className="pb-2">{t("common.name", "Article")}</th>
              <th className="pb-2 text-right">{t("common.quantity", "Qté")}</th>
              <th className="pb-2 text-right">{t("common.price", "Prix U")}</th>
              <th className="pb-2 text-right">{t("common.total", "Total")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {lignes.map((l: any, idx: number) => {
              const qte = l.quantite || l.qte || 1;
              const prix = l.prix_unitaire || l.prix || 0;
              return (
                <tr key={idx}>
                  <td className="py-2.5 text-slate-500 font-mono">{idx + 1}</td>
                  <td className="py-2.5 text-slate-200 font-semibold">{l.description || l.article || "Article inconnu"}</td>
                  <td className="figure py-2.5 text-right text-slate-300">{qte}</td>
                  <td className="figure py-2.5 text-right text-slate-300">{mad(prix)}</td>
                  <td className="figure py-2.5 text-right font-bold text-white">
                    {mad(qte * prix)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-full max-w-xs space-y-2 text-[13px] border-t border-slate-800 pt-3">
          <div className="flex justify-between text-slate-400">
            <span>Sous-total</span>
            <span className="figure font-mono">{mad(sousTotal)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>TVA (20%)</span>
            <span className="figure font-mono">{mad(taxe)}</span>
          </div>
          {remiseAmount > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Remise</span>
              <span className="figure font-mono">-{mad(remiseAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-800 pt-2 text-[16px] font-extrabold text-white">
            <span>Total TTC</span>
            <span className="figure font-mono text-indigo-400">{mad(total)}</span>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal */}
      <WhatsAppSendModal
        isOpen={showWhatsApp}
        onClose={() => setShowWhatsApp(false)}
        documentType={facture.status === "En retard" ? "relance" : "facture"}
        recipientName={facture.client_name || "Client"}
        recipientPhone={clientInfo?.telephone || ""}
        documentNumber={facture.invoice_number}
        amount={total}
        dueDate={"À réception"}
      />
    </div>
  );
}
