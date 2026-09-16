"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ChevronLeft, Send, PackageCheck, Trash2, Loader2 } from "lucide-react";
import { mad } from "@/lib/format";

export default function BonCommandeDetailPage({ params }: { params: { id: string } }) {
  const [po, setPo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPo = async () => {
    try {
      const res = await fetch(`/api/bons-commande?t=${Date.now()}`);
      const data = await res.json();
      const found = data.find((p: any) => p.id === params.id);
      setPo(found);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPo();
    const handleUpdate = () => fetchPo();
    window.addEventListener("dataUpdated", handleUpdate);
    return () => window.removeEventListener("dataUpdated", handleUpdate);
  }, [params.id]);

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-ink-300" size={32} /></div>;
  if (!po) return <div className="p-12 text-center text-ink-500">Bon de commande introuvable</div>;

  const sousTotal = po.articles?.reduce((s: any, a: any) => s + (a.qte || 1) * (a.prixUnitaire || 0), 0) || 0;
  const taxe = sousTotal * 0.2;
  const total = sousTotal + taxe;

  return (
    <div className="mx-auto max-w-[1000px] space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/bons-de-commande"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:border-brass/50 hover:text-ink-800"
          >
            <ChevronLeft size={16} />
          </Link>
          <div>
            <h1 className="font-display text-[20px] font-semibold text-ink-900">{po.id}</h1>
            <p className="text-[12.5px] text-ink-400">{po.fournisseur}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {po.statut === "Brouillon" && (
            <button 
              onClick={async () => {
                try {
                  await fetch(`/api/bons-commande/${po.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ statut: 'Envoyé', status: 'Envoyé' }),
                  });
                  setPo({ ...po, statut: 'Envoyé' });
                  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("dataUpdated"));
                } catch (e) {}
              }}
              className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-[13px] font-medium text-amber-300 hover:bg-slate-700"
            >
              <Send size={14} /> Marquer Envoyé
            </button>
          )}
          {po.statut !== "Reçu" && (
            <button 
              onClick={async () => {
                try {
                  await fetch(`/api/bons-commande/${po.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ statut: 'Reçu', status: 'Reçu' }),
                  });
                  setPo({ ...po, statut: 'Reçu' });
                  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("dataUpdated"));
                } catch (e) {}
              }}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-emerald-500 shadow-md"
            >
              <PackageCheck size={14} /> Marquer Reçu
            </button>
          )}
          <button 
            onClick={async () => {
              try {
                await fetch(`/api/bons-commande/${po.id}`, { method: 'DELETE' });
                if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("dataUpdated"));
                window.location.href = "/bons-de-commande";
              } catch (e) {}
            }}
            className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="ledger-card">
          <p className="text-[11.5px] uppercase tracking-wide text-ink-400">Fournisseur</p>
          <p className="mt-1 text-[14px] font-medium text-ink-900">{po.fournisseur}</p>
        </div>
        <div className="ledger-card">
          <p className="text-[11.5px] uppercase tracking-wide text-ink-400">Dates</p>
          <p className="mt-1 text-[13px] text-ink-700">Émission : {po.dateEmission}</p>
          <p className="text-[13px] text-ink-700">Livraison prévue : {po.livraisonPrevue}</p>
        </div>
        <div className="ledger-card">
          <p className="text-[11.5px] uppercase tracking-wide text-ink-400">Total</p>
          <p className="figure mt-1 text-[20px] font-semibold text-ink-900">{mad(total)}</p>
        </div>
      </div>

      <div className="ledger-card">
        <p className="mb-3 text-[12px] font-medium uppercase tracking-wide text-ink-400">Articles</p>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-ink-200/60 text-left text-[11px] uppercase tracking-wide text-ink-400">
              <th className="pb-2 font-medium">Article</th>
              <th className="pb-2 font-medium text-right">Qté</th>
              <th className="pb-2 font-medium text-right">Reçu</th>
              <th className="pb-2 font-medium text-right">Prix unitaire</th>
              <th className="pb-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200/60">
            {po.articles.map((a: any, idx: number) => (
              <tr key={idx}>
                <td className="py-2.5 text-ink-700">{a.nom}</td>
                <td className="figure py-2.5 text-right text-ink-700">{a.qte}</td>
                <td className="figure py-2.5 text-right text-ink-500">
                  {a.recu}/{a.qte}
                </td>
                <td className="figure py-2.5 text-right text-ink-700">{mad(a.prixUnitaire)}</td>
                <td className="figure py-2.5 text-right font-medium text-ink-900">
                  {mad(a.qte * a.prixUnitaire)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-3 w-full max-w-xs space-y-1.5 text-[13px]">
          <div className="flex justify-between text-ink-500">
            <span>Sous-total</span>
            <span className="figure">{mad(sousTotal)}</span>
          </div>
          <div className="flex justify-between text-ink-500">
            <span>Taxe (20%)</span>
            <span className="figure">{mad(taxe)}</span>
          </div>
          <div className="flex justify-between border-t border-ink-200/60 pt-2 text-[15px] font-semibold text-ink-900">
            <span>Total</span>
            <span className="figure">{mad(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
