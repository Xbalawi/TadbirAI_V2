"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { Loader2 } from "lucide-react";

export default function ModifierProduitPage({ params }: { params: { id: string } }) {
  const [produit, setProduit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/products`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        const found = list.find((p: any) => p.id === params.id);
        if (found) {
          setProduit({
            ...found,
            nom: found.name || found.nom,
            selling_price: found.selling_price || found.prix || found.prixBase,
            prix: found.selling_price || found.prix || found.prixBase,
            suivreStock: found.track_inventory ?? found.suivreStock,
            unit: found.unit || found.unite || "unité",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  if (!produit) notFound();

  return <ProductForm mode="edit" produit={produit} />;
}
