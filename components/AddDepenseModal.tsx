"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Modal from "./Modal";
import FormAlert from "./FormAlert";
import { mad } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";

const categories = [
  "Fournitures & Bureau",
  "Loyer & Charges",
  "Salaires & Paie",
  "Informatique & Logiciels",
  "Marketing & Publicité",
  "Transport & Déplacement",
  "Services & Honoraires",
  "Taxes & Impôts",
  "Divers & Entretien",
];

const modesPaiement = [
  "Virement Bancaire",
  "Carte Bancaire",
  "Espèces",
  "Chèque",
  "Prélèvement Automatique",
];

export default function AddDepenseModal({
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
  const { t } = useTranslation();
  const isEditing = !!initialData;
  const [titre, setTitre] = useState(initialData?.titre || initialData?.title || "");
  const [fournisseur, setFournisseur] = useState(initialData?.fournisseur || initialData?.supplier || "");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [categorie, setCategorie] = useState(initialData?.categorie || "Fournitures & Bureau");
  const [modePaiement, setModePaiement] = useState(initialData?.modePaiement || "Virement Bancaire");
  const [referenceFacture, setReferenceFacture] = useState(initialData?.referenceFacture || "");
  const [statut, setStatut] = useState<"Payée" | "En attente" | "Annulée">(initialData?.statut || "Payée");
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split("T")[0]);
  
  const [montantHt, setMontantHt] = useState<number | string>(
    initialData?.montantHt ? initialData.montantHt : initialData?.montant ? Math.round(initialData.montant / 1.2) : 1000
  );
  const [taxePct, setTaxePct] = useState<number>(initialData?.taxePct !== undefined ? initialData.taxePct : 20);
  const [notes, setNotes] = useState(initialData?.notes || "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/suppliers').then(r => r.json()).then(data => setSuppliers(Array.isArray(data) ? data : (data.results || []))).catch(() => {});
  }, []);

  const ht = Number(montantHt) || 0;
  const tva = ht * (taxePct / 100);
  const totalTtc = ht + tva;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fournisseur.trim() && !titre.trim()) {
      setError("Le libellé ou le nom du fournisseur est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      titre: titre || `Achat chez ${fournisseur}`,
      fournisseur: fournisseur || "Fournisseur Comptoir",
      categorie,
      modePaiement,
      referenceFacture,
      statut,
      status: statut,
      date,
      montantHt: ht,
      taxePct,
      tva,
      montant: totalTtc,
      total_amount: totalTtc,
      notes
    };

    try {
      const url = isEditing ? `/api/depenses/${initialData.id}` : "/api/depenses";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Échec de l'enregistrement de la dépense");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "depenses" } }));
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
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `${t("common.edit", "Modifier")} ${t("expenses.title", "Dépense")}` : t("modals.add_expense_title", "Saisir une Dépense")}>
      <FormAlert error={error} onClose={() => setError(null)} title="Erreur de formulaire" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1 text-slate-100">
          
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">Libellé / Titre de la dépense *</label>
            <input
              required
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Achat de matériel informatique & logiciels"
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">Fournisseur *</label>
              <input
                list="depense-suppliers-list"
                required
                value={fournisseur}
                onChange={(e) => setFournisseur(e.target.value)}
                placeholder="Ex: ElectroPlanet, Orange, Maroc Telecom..."
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
              />
              <datalist id="depense-suppliers-list">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.company_name || s.contact_name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">Catégorie de Dépense *</label>
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[13px] text-white font-semibold focus:border-indigo-500 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">Date de Dépense</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">Statut de Paiement *</label>
              <select
                value={statut}
                onChange={(e) => setStatut(e.target.value as any)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[13px] text-white font-semibold focus:border-indigo-500 focus:outline-none"
              >
                <option value="Payée">✅ Payée</option>
                <option value="En attente">⏳ En attente</option>
                <option value="Annulée">🚫 Annulée</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">Mode de Paiement</label>
              <select
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
              >
                {modesPaiement.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">Montant HT (MAD)</label>
              <input
                type="number"
                value={montantHt}
                onChange={(e) => setMontantHt(e.target.value)}
                placeholder="1000"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[13px] text-white font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">TVA %</label>
              <select
                value={taxePct}
                onChange={(e) => setTaxePct(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value={20}>20% (Standard)</option>
                <option value={14}>14% (Transport)</option>
                <option value={10}>10% (Restauration / Hôtellerie)</option>
                <option value={7}>7% (Eau / Électricité)</option>
                <option value={0}>0% (Exonéré / Non soumis)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">N° Facture / Reçu</label>
              <input
                value={referenceFacture}
                onChange={(e) => setReferenceFacture(e.target.value)}
                placeholder="FAC-FOUR-992"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[13px] text-white font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Amount Calculation Summary */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-1.5 text-[12.5px]">
            <div className="flex justify-between text-slate-400">
              <span>Montant Hors Taxe (HT) :</span>
              <span className="font-mono font-bold text-slate-200">{mad(ht)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>TVA ({taxePct}%) Déductible :</span>
              <span className="font-mono text-purple-300">+{mad(tva)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800 text-[14px] font-extrabold">
              <span className="text-white">Total TTC :</span>
              <span className="font-mono text-emerald-400">{mad(totalTtc)}</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">Notes / Remarques (Optionnel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Justificatif de dépense ou détail de la prestation..."
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
            {isEditing ? "Enregistrer les modifications" : "Enregistrer la dépense"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
