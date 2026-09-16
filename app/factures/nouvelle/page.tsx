"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Plus, Trash2, Check, Loader2 } from "lucide-react";
import { mad } from "@/lib/format";

type Ligne = { id: number; article: string; description: string; qte: number; prix: number; remise: number };

let nextId = 10;

function FactureFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get("client_id") || "";
  const fromDevis = searchParams.get("from_devis");

  const [clientId, setClientId] = useState(initialClientId);
  const [clients, setClients] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  
  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => setClients(Array.isArray(data) ? data : (data.results || [])));
    fetch('/api/products').then(r => r.json()).then(data => setProduits(Array.isArray(data) ? data : (data.results || [])));
  }, []);

  const recurrenteOptions = false;
  const [recurrente, setRecurrente] = useState(false);
  const [statut, setStatut] = useState<string>("Brouillon");
  const [echeance, setEcheance] = useState<"15" | "30" | "60" | "perso">("30");
  const [afficherTva, setAfficherTva] = useState(true);
  const [afficherLettres, setAfficherLettres] = useState(true);
  const [taxePct, setTaxePct] = useState(20);
  const [remisePct, setRemisePct] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [lignes, setLignes] = useState<Ligne[]>([
    { id: 1, article: "Prestation de service", description: "Conception & développement web", qte: 1, prix: 15000, remise: 0 },
  ]);

  useEffect(() => {
    if (fromDevis) {
      setClientId("cli-1");
      setLignes([
        { id: 1, article: "Devis " + fromDevis + " - Prestation", description: "Inclus selon devis validé", qte: 1, prix: 10200, remise: 0 }
      ]);
    }
  }, [fromDevis]);

  const sousTotal = useMemo(
    () => lignes.reduce((sum, l) => sum + l.qte * l.prix * (1 - l.remise / 100), 0),
    [lignes]
  );
  const remiseGlobale = sousTotal * (remisePct / 100);
  const taxe = (sousTotal - remiseGlobale) * (taxePct / 100);
  const total = sousTotal - remiseGlobale + taxe;

  function updateLigne(id: number, patch: Partial<Ligne>) {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function addLigne() {
    nextId += 1;
    setLignes((prev) => [
      ...prev,
      { id: nextId, article: "", description: "", qte: 1, prix: 0, remise: 0 },
    ]);
  }

  function removeLigne(id: number) {
    setLignes((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  }

  const handleSave = async (overrideStatut?: string) => {
    setIsSubmitting(true);
    try {
      const targetStatut = overrideStatut || statut || "Brouillon";
      const selectedClient = clients.find(c => c.id === clientId || c.customer_code === clientId);
      const invoiceData = {
        invoice_number: `FAC-${Math.floor(1000 + Math.random() * 9000)}`,
        client: clientId,
        client_name: selectedClient ? (selectedClient.company_name || selectedClient.contact_name || selectedClient.nom) : (clientId || "Client Comptoir"),
        status: targetStatut,
        total_amount: total,
        date: new Date().toISOString().split("T")[0],
        lignes,
      };
      
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      });
      
      if (res.ok) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "invoices" } }));
        }
        setSaveSuccess(true);
        setTimeout(() => {
          router.push("/factures");
        }, 300);
      } else {
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/factures"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:border-brass/50 hover:text-ink-800"
        >
          <ChevronLeft size={16} />
        </Link>
        <h1 className="font-display text-[22px] font-semibold text-ink-900">Créer une facture</h1>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left column: details + lines */}
        <div className="space-y-5">
          <div className="ledger-card space-y-4">
            <p className="text-[12px] font-medium uppercase tracking-wide text-ink-400">
              Détails de la facture
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12.5px] text-slate-300 font-medium">Client *</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- Choisir un client existant --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name || c.contact_name || c.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[12.5px] text-slate-300 font-medium">Statut initial de la facture *</label>
                <select
                  value={statut}
                  onChange={(e) => setStatut(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-[13px] text-white font-semibold focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Brouillon">📝 Brouillon</option>
                  <option value="Envoyée">📩 Envoyée</option>
                  <option value="Vue">👁️ Vue</option>
                  <option value="Payée">✅ Payée</option>
                  <option value="En retard">⚠️ En retard</option>
                  <option value="Annulée">🚫 Annulée</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <div>
                  <label className="mb-1.5 block text-[12.5px] text-slate-300 font-medium">Date d'émission</label>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12.5px] text-slate-300 font-medium">Date d'échéance</label>
                  <input
                    type="date"
                    defaultValue={new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="mt-1.5 flex gap-1">
                    {(["15", "30", "60", "perso"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setEcheance(v)}
                        className={`flex-1 rounded-md border px-1.5 py-1 text-[11px] ${
                          echeance === v
                            ? "border-indigo-500 bg-indigo-500/20 text-indigo-300 font-medium"
                            : "border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        {v === "perso" ? "Perso." : `Net ${v}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <label className="flex items-center justify-between rounded-md border border-ink-200 px-3 py-2.5 cursor-pointer hover:border-ink-300">
              <span className="text-[13px] text-ink-700">
                Facture récurrente
                <span className="block text-[11.5px] text-ink-400">
                  Générer automatiquement chaque mois
                </span>
              </span>
              <input
                type="checkbox"
                checked={recurrente}
                onChange={(e) => setRecurrente(e.target.checked)}
                className="h-4 w-4 accent-brass"
              />
            </label>
          </div>

          <div className="ledger-card space-y-3">
            <p className="text-[12px] font-medium uppercase tracking-wide text-ink-400">
              Lignes de facture
            </p>

            {lignes.map((l, idx) => (
              <div key={l.id} className="rounded-md border border-ink-200 p-3 bg-paper">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-ink-400">Ligne {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeLigne(l.id)}
                    className="text-ink-400 hover:text-status-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Catalogue Picker */}
                <div className="mb-2">
                  <label className="mb-1 block text-[11px] text-ink-500 font-medium">Sélectionner un produit du catalogue</label>
                  <select
                    onChange={(e) => {
                      const selectedProd = produits.find((p: any) => p.id === e.target.value);
                      if (selectedProd) {
                        updateLigne(l.id, {
                          article: selectedProd.name || selectedProd.nom,
                          prix: selectedProd.selling_price || selectedProd.prix
                        });
                      }
                    }}
                    className="w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-[12px] mb-1.5 focus:border-brass/60 focus:outline-none"
                  >
                    <option value="">-- Choisir dans le catalogue --</option>
                    {produits.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.nom} ({mad(p.selling_price || p.prix)})
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  value={l.article}
                  onChange={(e) => updateLigne(l.id, { article: e.target.value })}
                  placeholder="Désignation de l'article / produit"
                  className="mb-2 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-[13px] focus:border-brass/60 focus:outline-none"
                />
                <textarea
                  value={l.description}
                  onChange={(e) => updateLigne(l.id, { description: e.target.value })}
                  placeholder="Description détaillée (optionnel)"
                  rows={2}
                  className="mb-2 w-full resize-none rounded-md border border-ink-200 bg-white px-3 py-2 text-[13px] focus:border-brass/60 focus:outline-none"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-400 font-medium">Quantité</label>
                    <input
                      type="number"
                      value={l.qte}
                      onChange={(e) => updateLigne(l.id, { qte: Number(e.target.value) })}
                      className="w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-[13px] focus:border-brass/60 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-400 font-medium">Prix unitaire (MAD)</label>
                    <input
                      type="number"
                      value={l.prix}
                      onChange={(e) => updateLigne(l.id, { prix: Number(e.target.value) })}
                      className="w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-[13px] focus:border-brass/60 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-ink-400 font-medium">Remise %</label>
                    <input
                      type="number"
                      value={l.remise}
                      onChange={(e) => updateLigne(l.id, { remise: Number(e.target.value) })}
                      className="w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-[13px] focus:border-brass/60 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11.5px] text-ink-400">Total ligne HT</span>
                  <span className="figure text-[13px] font-semibold text-ink-900">
                    {mad(l.qte * l.prix * (1 - l.remise / 100))}
                  </span>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addLigne}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-ink-200 py-2 text-[12.5px] text-ink-500 hover:border-brass/50 hover:text-brass"
            >
              <Plus size={14} /> Ajouter une ligne
            </button>
          </div>
        </div>

        {/* Right column: résumé */}
        <div className="h-fit space-y-4 lg:sticky lg:top-6">
          <div className="ledger-card space-y-4">
            <p className="text-[12px] font-medium uppercase tracking-wide text-ink-400">Résumé du montant</p>

            <div>
              <label className="mb-1.5 block text-[12.5px] text-ink-600 font-medium">Devise</label>
              <select className="w-full rounded-md border border-ink-200 bg-paper px-3 py-2 text-[13px] focus:border-brass/60 focus:outline-none">
                <option>MAD - Dirham Marocain</option>
                <option>EUR - Euro</option>
                <option>USD - Dollar</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[12.5px] text-ink-600 font-medium">TVA %</label>
                <input
                  type="number"
                  value={taxePct}
                  onChange={(e) => setTaxePct(Number(e.target.value))}
                  className="w-full rounded-md border border-ink-200 bg-paper px-3 py-2 text-[13px] focus:border-brass/60 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] text-ink-600 font-medium">Remise Globale %</label>
                <input
                  type="number"
                  value={remisePct}
                  onChange={(e) => setRemisePct(Number(e.target.value))}
                  className="w-full rounded-md border border-ink-200 bg-paper px-3 py-2 text-[13px] focus:border-brass/60 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5 border-t border-ink-200/60 pt-3 text-[13px]">
              <div className="flex justify-between text-ink-500">
                <span>Sous-total HT</span>
                <span className="figure">{mad(sousTotal)}</span>
              </div>
              {remisePct > 0 && (
                <div className="flex justify-between text-ink-500">
                  <span>Remise ({remisePct}%)</span>
                  <span className="figure">-{mad(remiseGlobale)}</span>
                </div>
              )}
              <div className="flex justify-between text-ink-500">
                <span>TVA ({taxePct}%)</span>
                <span className="figure">+{mad(taxe)}</span>
              </div>
              <div className="flex justify-between border-t border-ink-200/60 pt-2 text-[16px] font-semibold text-ink-900">
                <span>Total TTC</span>
                <span className="figure text-brass">{mad(total)}</span>
              </div>
            </div>

            <div className="space-y-2.5 border-t border-ink-200/60 pt-3">
              <label className="flex items-center justify-between text-[13px] text-ink-700 cursor-pointer">
                Afficher TVA détaillée
                <input
                  type="checkbox"
                  checked={afficherTva}
                  onChange={(e) => setAfficherTva(e.target.checked)}
                  className="accent-brass"
                />
              </label>
              <label className="flex items-center justify-between text-[13px] text-ink-700 cursor-pointer">
                Afficher le montant en lettres
                <input
                  type="checkbox"
                  checked={afficherLettres}
                  onChange={(e) => setAfficherLettres(e.target.checked)}
                  className="accent-brass"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave("Brouillon")}
              className="w-full rounded-md border border-slate-700 bg-slate-900 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-slate-800 flex items-center justify-center gap-2"
            >
              {saveSuccess ? <Check size={16} className="text-emerald-400" /> : null}
              {saveSuccess ? "Brouillon enregistré !" : "Enregistrer comme brouillon"}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave("Envoyée")}
              className="w-full rounded-md bg-indigo-600 py-2.5 text-[13px] font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              {saveSuccess ? <Check size={16} /> : null}
              {saveSuccess ? "Facture créée et envoyée !" : "Créer et envoyer la facture"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NouvelleFacturePage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin text-brass" /></div>}>
      <FactureFormContent />
    </Suspense>
  );
}
