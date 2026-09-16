"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Modal from "./Modal";
import FormAlert from "./FormAlert";
import { mad } from "@/lib/format";

type LineItem = {
  description: string;
  quantite: number;
  prix_unitaire: number;
};

export default function EditInvoiceModal({
  invoice,
  onClose,
  onSuccess
}: {
  invoice: any;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoice_number || invoice?.numero || "");
  const [clientName, setClientName] = useState(invoice?.client_name || invoice?.client || "");
  const [clients, setClients] = useState<any[]>([]);
  const [status, setStatus] = useState(invoice?.status || invoice?.statut || "Brouillon");
  const [date, setDate] = useState(invoice?.date || invoice?.dateEmission || new Date().toISOString().split("T")[0]);
  
  const [lignes, setLignes] = useState<LineItem[]>(
    invoice?.lignes && invoice.lignes.length > 0
      ? invoice.lignes.map((l: any) => ({
          description: l.description || l.article || "Article",
          quantite: Number(l.quantite || l.qte || 1),
          prix_unitaire: Number(l.prix_unitaire || l.prix || 0)
        }))
      : [{ description: "Prestation / Service", quantite: 1, prix_unitaire: Number(invoice?.total_amount || invoice?.montant || 1000) / 1.2 }]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => setClients(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => {});
  }, []);

  const sousTotal = lignes.reduce((sum, l) => sum + (l.quantite * l.prix_unitaire), 0);
  const tva = sousTotal * 0.2;
  const totalTtc = sousTotal + tva;

  function updateLine(index: number, patch: Partial<LineItem>) {
    setLignes((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLignes((prev) => [...prev, { description: "", quantite: 1, prix_unitaire: 0 }]);
  }

  function removeLine(index: number) {
    setLignes((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setError("Le nom du client est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_number: invoiceNumber,
          client_name: clientName,
          client: clientName,
          status,
          statut: status,
          date,
          total_amount: totalTtc,
          montant: totalTtc,
          lignes
        }),
      });

      if (!res.ok) throw new Error("Échec de la modification de la facture");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "invoices" } }));
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
    <Modal isOpen={true} onClose={onClose} title={`Modifier la Facture N° ${invoiceNumber}`}>
      <FormAlert error={error} onClose={() => setError(null)} title="Erreur de formulaire" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1 text-slate-100">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">N° Facture *</label>
              <input
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] font-mono font-bold text-indigo-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">Client *</label>
              <input
                list="invoice-clients-list"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nom ou Entreprise client..."
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
              />
              <datalist id="invoice-clients-list">
                {clients.map((c) => (
                  <option key={c.id} value={c.company_name || c.contact_name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">Statut Facture *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white font-semibold focus:border-indigo-500 focus:outline-none"
              >
                <option value="Payée">✅ Payée</option>
                <option value="Envoyée">📩 Envoyée</option>
                <option value="Brouillon">📝 Brouillon</option>
                <option value="Vue">👁️ Vue</option>
                <option value="En retard">⚠️ En retard</option>
                <option value="Annulée">🚫 Annulée</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-slate-300">Date d'Émission</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Line items */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wider text-indigo-400">Lignes de Facture</span>
              <span className="text-[11.5px] text-slate-400">{lignes.length} ligne(s)</span>
            </div>

            {lignes.map((l, idx) => (
              <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-slate-400">Ligne #{idx + 1}</span>
                  {lignes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="text-red-400 hover:text-red-300 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      value={l.description}
                      onChange={(e) => updateLine(idx, { description: e.target.value })}
                      placeholder="Désignation / Description"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-[12.5px] text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={l.quantite}
                      onChange={(e) => updateLine(idx, { quantite: Number(e.target.value) })}
                      placeholder="Qté"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[12.5px] text-white font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={l.prix_unitaire}
                      onChange={(e) => updateLine(idx, { prix_unitaire: Number(e.target.value) })}
                      placeholder="Prix U HT"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[12.5px] text-white font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11.5px] pt-1">
                  <span className="text-slate-500">Sous-total HT :</span>
                  <span className="font-mono font-bold text-slate-200">{mad(l.quantite * l.prix_unitaire)}</span>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addLine}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-800 py-2 text-[12px] font-semibold text-indigo-400 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all"
            >
              <Plus size={14} /> Ajouter une ligne
            </button>
          </div>

          {/* Amount Calculation */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-1.5 text-[12.5px]">
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
