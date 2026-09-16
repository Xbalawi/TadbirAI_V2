"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Loader2 } from "lucide-react";
import { mad } from "@/lib/format";
import { useState, useEffect } from "react";

export default function FicheProduitPage({ params }: { params: { id: string } }) {
  const [produit, setProduit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/products`)
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.results || []);
        const p = list.find((item: any) => item.id === params.id);
        if (p) {
          setProduit({
            ...p,
            nom: p.name,
            categorie: p.category,
            statut: p.status,
            unite: p.unit,
            prix: p.selling_price,
            suivreStock: p.track_inventory,
            stock: p.quantity || 0,
            variantes: []
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>;
  if (!produit) return <div className="p-12 text-center text-white">Produit introuvable (404)</div>;

  return (
    <div className="mx-auto max-w-[1000px] space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/stocks"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:border-brass/50 hover:text-ink-800"
          >
            <ChevronLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[20px] font-semibold text-ink-900">{produit.nom}</h1>
              <span className="rounded-full bg-status-infoBg px-2 py-0.5 text-[11px] font-medium text-status-info">
                {produit.categorie}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  produit.statut === "Actif"
                    ? "bg-status-successBg text-status-success"
                    : "bg-ink-200/60 text-ink-500"
                }`}
              >
                {produit.statut}
              </span>
            </div>
            <p className="text-[12.5px] text-ink-400">Unité : {produit.unite}</p>
          </div>
        </div>
        <Link
          href={`/stocks/${produit.id}/modifier`}
          className="flex items-center gap-1.5 rounded-md border border-ink-200 px-3 py-2 text-[13px] font-medium text-ink-700 hover:border-brass/50"
        >
          <Pencil size={14} /> Modifier le produit
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="ledger-card">
          <p className="text-[11.5px] uppercase tracking-wide text-ink-400">Prix</p>
          <p className="figure mt-1 text-[20px] font-medium text-ink-900">{mad(produit.prix)}</p>
        </div>
        <div className="ledger-card">
          <p className="text-[11.5px] uppercase tracking-wide text-ink-400">SKU</p>
          <p className="figure mt-1 text-[15px] font-medium text-ink-900">{produit.sku}</p>
        </div>
        <div className="ledger-card">
          <p className="text-[11.5px] uppercase tracking-wide text-ink-400">Catégorie</p>
          <p className="mt-1 text-[15px] font-medium text-ink-900">{produit.categorie}</p>
        </div>
      </div>

      <div className="ledger-card">
        <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-ink-400">
          Description
        </p>
        <p className="text-[13px] text-ink-700">{produit.description}</p>
      </div>

      {produit.suivreStock && (
        <div className="ledger-card">
          <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-ink-400">Stock</p>
          <p className="figure text-[15px] font-medium text-ink-900">
            {produit.stock} en stock{produit.fournisseur ? ` · Fournisseur : ${produit.fournisseur}` : ""}
          </p>
        </div>
      )}

      {produit.variantes.length > 0 && (
        <div className="ledger-card">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-wide text-ink-400">
            Variantes
          </p>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-ink-200/60 text-left text-[11px] uppercase tracking-wide text-ink-400">
                <th className="pb-2 font-medium">Nom</th>
                <th className="pb-2 font-medium">SKU</th>
                <th className="pb-2 font-medium text-right">Prix</th>
                <th className="pb-2 font-medium text-right">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200/60">
              {produit.variantes.map((v: any) => (
                <tr key={v.sku}>
                  <td className="py-2.5 text-ink-700">{v.nom}</td>
                  <td className="figure py-2.5 text-ink-500">{v.sku}</td>
                  <td className="figure py-2.5 text-right text-ink-900">{mad(v.prix)}</td>
                  <td className="figure py-2.5 text-right text-ink-700">{v.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
