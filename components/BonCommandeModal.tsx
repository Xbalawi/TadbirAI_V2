"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import Modal from "./Modal";
import FormAlert from "./FormAlert";
import { mad } from "@/lib/format";

type ArticleLine = {
  id: number;
  nom: string;
  description?: string;
  qte: number;
  prixUnitaire: number;
  recu?: number;
};

let nextLineId = 100;

export default function BonCommandeModal({
  isOpen,
  onClose,
  onSuccess,
  initialData
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: any;
}) {
  const isEditing = !!initialData;
  const [bcNumber, setBcNumber] = useState(initialData?.bc_number || initialData?.id || `BC-${Math.floor(1000 + Math.random() * 9000)}`);
  const [fournisseur, setFournisseur] = useState(initialData?.fournisseur || initialData?.supplier_name || "");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [statut, setStatut] = useState(initialData?.statut || initialData?.status || "Brouillon");
  const [dateEmission, setDateEmission] = useState(initialData?.dateEmission || new Date().toISOString().split("T")[0]);
  const [livraisonPrevue, setLivraisonPrevue] = useState(initialData?.livraisonPrevue || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]);
  const [conditionsPaiement, setConditionsPaiement] = useState(initialData?.conditionsPaiement || "Net 30");
  const [notes, setNotes] = useState(initialData?.notes || "");
  
  const [articles, setArticles] = useState<ArticleLine[]>(
    initialData?.articles && initialData.articles.length > 0
      ? initialData.articles.map((a: any, idx: number) => ({
          id: idx + 1,
          nom: a.nom || a.article || "Article",
          description: a.description || "",
          qte: Number(a.qte) || 1,
          prixUnitaire: Number(a.prixUnitaire || a.prix) || 0,
          recu: Number(a.recu) || 0
        }))
      : [{ id: 1, nom: "Prestation / Fourniture", description: "Matériel informatique & équipements", qte: 1, prixUnitaire: 5000, recu: 0 }]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/suppliers').then(r => r.json()).then(data => setSuppliers(Array.isArray(data) ? data : (data.results || []))).catch(() => {});
    fetch('/api/products').then(r => r.json()).then(data => setProducts(Array.isArray(data) ? data : (data.results || []))).catch(() => {});
  }, []);

  const sousTotal = useMemo(
    () => articles.reduce((sum, l) => sum + (l.qte || 0) * (l.prixUnitaire || 0), 0),
    [articles]
  );
  const tva = sousTotal * 0.2;
  const totalTtc = sousTotal + tva;

  function updateLine(id: number, patch: Partial<ArticleLine>) {
    setArticles((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function addLine() {
    nextLineId += 1;
    setArticles((prev) => [
      ...prev,
      { id: nextLineId, nom: "", description: "", qte: 1, prixUnitaire: 0, recu: 0 },
    ]);
  }

  function removeLine(id: number) {
    setArticles((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fournisseur.trim()) {
      setError("Le nom du fournisseur est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      bc_number: bcNumber,
      fournisseur,
      statut,
      status: statut,
      dateEmission,
      livraisonPrevue,
      conditionsPaiement,
      montant: totalTtc,
      subtotal: sousTotal,
      tax: tva,
      notes,
      articles
    };

    try {
      const url = isEditing ? `/api/bons-commande/${initialData.id}` : "/api/bons-commande";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Échec de l'enregistrement du bon de commande");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "bons-commande" } }));
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `Modifier Bon de Commande ${bcNumber}` : "Nouveau Bon de Commande"}>
      <FormAlert error={error} onClose={() => setError(null)} title="Erreur de formulaire" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4 text-slate-100">
          
          {/* Header row: BC Number, Fournisseur, Statut */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
            <div className="flex flex-col justify-end">
              <label className="mb-1.5 h-5 flex items-end text-[12px] font-semibold text-slate-300 truncate">N° Bon de Commande *</label>
              <input
                required
                value={bcNumber}
                onChange={(e) => setBcNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] font-mono font-bold text-indigo-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="mb-1.5 h-5 flex items-end text-[12px] font-semibold text-slate-300 truncate">Fournisseur *</label>
              <input
                list="suppliers-list"
                required
                value={fournisseur}
                onChange={(e) => setFournisseur(e.target.value)}
                placeholder="Choisir ou saisir..."
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
              />
              <datalist id="suppliers-list">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.company_name || s.contact_name} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col justify-end">
              <label className="mb-1.5 h-5 flex items-end text-[12px] font-semibold text-slate-300 truncate">Statut Initial *</label>
              <select
                value={statut}
                onChange={(e) => setStatut(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white font-semibold focus:border-indigo-500 focus:outline-none"
              >
                <option value="Brouillon">📝 Brouillon</option>
                <option value="Envoyé">📩 Envoyé</option>
                <option value="Validé">⚡ Validé</option>
                <option value="Partiel">📦 Partiel</option>
                <option value="Reçu">✅ Reçu</option>
              </select>
            </div>
          </div>

          {/* Dates & Payment Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
            <div className="flex flex-col justify-end">
              <label className="mb-1.5 h-5 flex items-end text-[12px] font-semibold text-slate-300 truncate">Date d'émission</label>
              <input
                type="date"
                value={dateEmission}
                onChange={(e) => setDateEmission(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="mb-1.5 h-5 flex items-end text-[12px] font-semibold text-slate-300 truncate">Livraison Prévue</label>
              <input
                type="date"
                value={livraisonPrevue}
                onChange={(e) => setLivraisonPrevue(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="mb-1.5 h-5 flex items-end text-[12px] font-semibold text-slate-300 truncate">Conditions de Paiement</label>
              <select
                value={conditionsPaiement}
                onChange={(e) => setConditionsPaiement(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="Net 30">Net 30 jours</option>
                <option value="Net 60">Net 60 jours</option>
                <option value="Comptant">Comptant à la livraison</option>
                <option value="Acompte 30%">30% Acompte / 70% Solde</option>
              </select>
            </div>
          </div>

          {/* Line items section */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wider text-indigo-400">Articles / Produits Commandés</span>
              <span className="text-[11.5px] text-slate-400">{articles.length} ligne(s)</span>
            </div>

            {articles.map((l, idx) => (
              <div key={l.id} className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-slate-400">Ligne #{idx + 1}</span>
                  {articles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(l.id)}
                      className="text-red-400 hover:text-red-300 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Catalogue Picker */}
                <div>
                  <select
                    onChange={(e) => {
                      const prod = products.find(p => p.id === e.target.value);
                      if (prod) {
                        updateLine(l.id, {
                          nom: prod.name || prod.nom,
                          prixUnitaire: prod.selling_price || prod.prix || 0
                        });
                      }
                    }}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[12px] text-slate-300 mb-1.5 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Sélectionner depuis le catalogue produits --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.nom} ({mad(p.selling_price || p.prix || 0)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      value={l.nom}
                      onChange={(e) => updateLine(l.id, { nom: e.target.value })}
                      placeholder="Désignation de l'article"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-[12.5px] text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={l.qte}
                      onChange={(e) => updateLine(l.id, { qte: Number(e.target.value) })}
                      placeholder="Qte"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[12.5px] text-white font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={l.prixUnitaire}
                      onChange={(e) => updateLine(l.id, { prixUnitaire: Number(e.target.value) })}
                      placeholder="Prix HT"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[12.5px] text-white font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11.5px] pt-1">
                  <span className="text-slate-500">Sous-total ligne HT :</span>
                  <span className="font-mono font-bold text-slate-200">{mad(l.qte * l.prixUnitaire)}</span>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addLine}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-800 py-2 text-[12px] font-semibold text-indigo-400 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all"
            >
              <Plus size={14} /> Ajouter une ligne d'article
            </button>
          </div>

          {/* Totals Summary */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1.5 text-[12.5px]">
            <div className="flex justify-between text-slate-400">
              <span>Sous-total HT :</span>
              <span className="font-mono font-bold text-slate-200">{mad(sousTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>TVA (20%) :</span>
              <span className="font-mono text-purple-300">+{mad(tva)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800 text-[14px] font-extrabold">
              <span className="text-white">Total TTC :</span>
              <span className="font-mono text-emerald-400">{mad(totalTtc)}</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-semibold text-slate-300">Notes & Instructions de Livraison (Optionnel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Livrer directement à l'entrepôt principal Casablanca Nord."
              rows={2}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[12.5px] text-white focus:border-indigo-500 focus:outline-none"
            />
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
            {isEditing ? "Enregistrer les modifications" : "Créer le Bon de Commande"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
