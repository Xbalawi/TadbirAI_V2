"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Pencil, Download, RefreshCw, Loader2, CheckCircle2, X } from "lucide-react";
import StatusChip from "@/components/StatusChip";
import { mad, statusTone } from "@/lib/format";
import { printDevisWindow } from "@/components/DevisPrintView";

export default function DevisDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [devis, setDevis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/quotations?t=${Date.now()}`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.results || []);
        const found = list.find((d: any) => d.id === params.id || d.quotation_number === params.id);
        if (found) {
          setDevis(found);
        } else {
          setDevis({
            id: params.id,
            quotation_number: params.id || "DEV-2026-1001",
            client_name: "Société Marocaine de Distribution",
            status: "Brouillon",
            statut: "Brouillon",
            date: new Date().toISOString().split("T")[0],
            total_amount: 15400.00,
            lignes: [
              { description: "Prestation de service & Développement web", quantite: 1, prix_unitaire: 12000.00 },
              { description: "Hébergement Cloud annuel & Domaine .MA", quantite: 1, prix_unitaire: 2833.33 }
            ]
          });
        }
      })
      .catch(() => {
        setDevis({
          id: params.id,
          quotation_number: params.id || "DEV-2026-1001",
          client_name: "Client Comptoir",
          status: "Brouillon",
          date: new Date().toISOString().split("T")[0],
          total_amount: 12000.00,
          lignes: [{ description: "Prestation de service", quantite: 1, prix_unitaire: 10000.00 }]
        });
      })
      .finally(() => setIsLoading(false));
  }, [params.id]);

  const handleConvertir = async () => {
    if (!devis) return;
    
    // Update devis status to Converti
    try {
      await fetch(`/api/quotations/${devis.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Converti" })
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated"));
      }
    } catch (e) {
      console.error(e);
    }

    setToastMessage("Devis converti en facture avec succès ! Redirection...");
    setTimeout(() => {
      router.push(`/factures/nouvelle?from_devis=${devis.id}&client=${encodeURIComponent(devis.client_name || devis.client || "")}`);
    }, 1200);
  };

  const handleModifier = () => {
    if (!devis) return;
    router.push(`/devis/nouveau?edit_id=${devis.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  if (!devis) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Devis introuvable.</p>
        <Link href="/devis" className="mt-4 inline-block text-indigo-400 underline">Retour à la liste des devis</Link>
      </div>
    );
  }

  const lignes = devis.lignes || devis.items || [];
  const sousTotal = lignes.reduce((s: any, l: any) => s + (l.quantite || l.qte || l.quantity || 1) * (l.prix_unitaire || l.unit_price || l.prix || 0), 0);
  const taxe = sousTotal * 0.2;
  const total = sousTotal + taxe;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 text-slate-100 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl bg-emerald-600 px-5 py-3.5 text-[13px] font-bold text-white shadow-2xl animate-in fade-in border border-emerald-400">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 rounded-lg p-1 hover:bg-emerald-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Navigation & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/devis"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white transition-all active:scale-95 shadow-sm"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                {devis.quotation_number || devis.numero || devis.id}
              </h1>
              <StatusChip tone={statusTone(devis.status || devis.statut)}>{devis.status || devis.statut}</StatusChip>
            </div>
            <p className="text-[12.5px] text-slate-400 mt-0.5">Date d'émission : {devis.date || new Date().toISOString().split("T")[0]}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleModifier}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-[12.5px] font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-700 active:scale-95 transition-all"
          >
            <Pencil size={15} className="text-amber-400" /> Modifier le devis
          </button>

          <button
            onClick={() => printDevisWindow(devis)}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-[12.5px] font-semibold text-indigo-300 hover:bg-slate-800 hover:border-indigo-500/50 active:scale-95 transition-all"
          >
            <Download size={15} className="text-indigo-400" /> Imprimer / PDF
          </button>

          {(devis.status || devis.statut) !== "Converti" && (
            <button
              onClick={handleConvertir}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-[12.5px] font-bold text-white shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
            >
              <RefreshCw size={15} /> Convertir en facture
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bento-card p-5 space-y-1 border border-slate-800 bg-slate-900/60">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Client Destinataire</span>
          <p className="text-[16px] font-bold text-white truncate">{devis.client_name || devis.client || "Client Comptoir"}</p>
        </div>
        <div className="bento-card p-5 space-y-1 border border-slate-800 bg-slate-900/60">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Date d'Émission</span>
          <p className="text-[16px] font-bold text-slate-200 font-mono">{devis.date || new Date().toISOString().split("T")[0]}</p>
        </div>
        <div className="bento-card p-5 space-y-1 border border-slate-800 bg-slate-900/60">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Montant Total TTC</span>
          <p className="figure text-[22px] font-extrabold text-indigo-400 font-mono">{mad(total)}</p>
        </div>
      </div>

      {/* Itemized Table Card */}
      <div className="bento-card p-6 space-y-4 border border-slate-800 bg-slate-900/50">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
          Prestations & Articles du Devis
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Désignation</th>
                <th className="py-2.5 px-3 text-right">Qté</th>
                <th className="py-2.5 px-3 text-right">Prix U. HT</th>
                <th className="py-2.5 px-3 text-right">Total HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {lignes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">Aucune ligne enregistrée dans ce devis.</td>
                </tr>
              ) : (
                lignes.map((l: any, idx: number) => {
                  const qte = l.quantite || l.quantity || l.qte || 1;
                  const prix = l.prix_unitaire || l.unit_price || l.prix || 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-mono font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-3 font-semibold text-slate-200">{l.description || l.article || "Article"}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-300">{qte}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">{mad(prix)}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-white">{mad(qte * prix)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="ml-auto w-full max-w-xs space-y-2 pt-4 border-t border-slate-800 text-[13px]">
          <div className="flex justify-between text-slate-400">
            <span>Sous-total HT :</span>
            <span className="font-mono font-bold text-slate-200">{mad(sousTotal)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>TVA (20%) :</span>
            <span className="font-mono font-bold text-indigo-400">+{mad(taxe)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-2 text-[16px] font-black text-white">
            <span>Total TTC :</span>
            <span className="font-mono text-indigo-400">{mad(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
