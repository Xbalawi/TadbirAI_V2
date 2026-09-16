"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "./Modal";
import FormAlert from "./FormAlert";
import { UNIVERSAL_UNITS, UNIT_CATEGORIES } from "@/lib/units";

export default function EditProductModal({
  product,
  onClose,
  onSuccess
}: {
  product: any;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [name, setName] = useState(product?.name || product?.nom || "");
  const [sku, setSku] = useState(product?.sku || "");
  const [price, setPrice] = useState<number | string>(product?.selling_price ?? product?.prix ?? product?.price ?? 0);
  const [quantity, setQuantity] = useState<number | string>(product?.quantity ?? product?.stock ?? product?.qty ?? product?.quantite ?? 0);
  const [category, setCategory] = useState(product?.category_name || product?.categorie || "Général");
  const [subCategory, setSubCategory] = useState(product?.sub_category || product?.sous_categorie || "");
  const [minStock, setMinStock] = useState<number | string>(product?.min_stock ?? product?.minimum_stock ?? product?.seuil_alerte ?? 5);
  const [unit, setUnit] = useState(product?.unit || product?.unite || "unité");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Le nom du produit est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sku,
          selling_price: Number(price) || 0,
          quantity: Number(quantity) || 0,
          min_stock: Number(minStock) || 0,
          unit,
          category_name: category,
          sub_category: subCategory,
        }),
      });

      if (!res.ok) {
        const responseData = await res.json().catch(() => null);
        throw new Error(responseData?.detail || responseData?.error || "Échec de la modification du produit");
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "products" } }));
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "stock" } }));
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de la modification");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Modifier le Produit : ${product?.name || product?.sku}`}>
      <FormAlert error={error} onClose={() => setError(null)} title="Erreur de formulaire" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Désignation du produit / article *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Prestation Développement Web"
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Référence (SKU)</label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU-1001"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Catégorie</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Services / Informatique"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Sous-catégorie</label>
              <input
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                placeholder="Ex: Câbles, Licences, Consommables"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Stock Minimum (Seuil Alerte)</label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                placeholder="5"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Prix de vente (MAD)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Quantité en Stock</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Unité Universelle</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer font-medium"
              >
                {UNIT_CATEGORIES.map((cat) => (
                  <optgroup key={cat.id} label={cat.label} className="bg-slate-950 font-bold text-indigo-400">
                    {UNIVERSAL_UNITS.filter((u) => u.category === cat.id).map((u) => (
                      <option key={u.value} value={u.value} className="bg-slate-900 text-slate-100 font-normal">
                        {u.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 disabled:opacity-60 transition-all active:scale-95"
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            Enregistrer les modifications
          </button>
        </div>
      </form>
    </Modal>
  );
}
