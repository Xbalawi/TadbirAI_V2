"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Plus, Trash2, Loader2, Sparkles, Check } from "lucide-react";
import { mad } from "@/lib/format";

type Ligne = { id: number; article: string; qte: number; prix: number };
let nextId = 2;

function DevisFormContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const docId = searchParams.get("doc_id");

  const [clientId, setClientId] = useState("");
  const [customClientName, setCustomClientName] = useState("");
  const [devisNumber, setDevisNumber] = useState(`DEV-${Math.floor(1000 + Math.random() * 9000)}`);
  const [validiteJusquau, setValiditeJusquau] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [taxePct, setTaxePct] = useState(20);
  const [clients, setClients] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  
  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => setClients(Array.isArray(data) ? data : (data.results || []))).catch(() => {});
    fetch('/api/products').then(r => r.json()).then(data => setProduits(Array.isArray(data) ? data : (data.results || []))).catch(() => {});
  }, []);

  const [lignes, setLignes] = useState<Ligne[]>([{ id: 1, article: "", qte: 1, prix: 0 }]);
  const [isLoadingOcr, setIsLoadingOcr] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!docId) return;
    const fetchDoc = async () => {
      setIsLoadingOcr(true);
      try {
        const res = await fetch(`/api/ai/documents/${docId}`);
        if (!res.ok) throw new Error("Erreur lors de la récupération du document");
        const doc = await res.json();
        
        const ext = doc.extracted_data || {};

        if (ext.numero_facture) {
          setDevisNumber(ext.numero_facture);
        }

        if (ext.client || ext.fournisseur) {
          const nameExtracted = ext.client || ext.fournisseur;
          setCustomClientName(nameExtracted);
          const matchedClient = clients.find((c: any) => 
            (c.company_name || c.nom || "").toLowerCase().includes(nameExtracted.toLowerCase())
          );
          if (matchedClient) {
            setClientId(matchedClient.id);
          }
        }

        if (ext.taux_tva !== undefined) {
          setTaxePct(Number(ext.taux_tva) || 20);
        }
        
        if (ext.lignes && Array.isArray(ext.lignes) && ext.lignes.length > 0) {
          const newLignes = ext.lignes.map((l: any) => {
            nextId++;
            return {
              id: nextId,
              article: l.description || l.nom || "Article extrait par l'IA",
              qte: Number(l.quantite || l.qte || 1),
              prix: Number(l.prix_unitaire || l.prix || l.montant || 0),
            };
          });
          setLignes(newLignes);
          setOcrMessage("✨ Les données du document ont été analysées avec succès et pré-remplies dans les champs ci-dessous !");
        }
      } catch (err) {
        console.error(err);
        setOcrMessage("Impossible de lire les données du document.");
      } finally {
        setIsLoadingOcr(false);
      }
    };
    fetchDoc();
  }, [docId, clients]);

  const editId = searchParams.get("edit_id");

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/quotations?t=${Date.now()}`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.results || []);
        const found = list.find((d: any) => d.id === editId || d.quotation_number === editId);
        if (found) {
          setDevisNumber(found.quotation_number || found.numero || editId);
          setCustomClientName(found.client_name || "");
          if (found.client) setClientId(found.client);
          if (found.validiteJusquau) setValiditeJusquau(found.validiteJusquau);
          if (found.lignes && found.lignes.length > 0) {
            setLignes(found.lignes.map((l: any, i: number) => ({
              id: i + 1,
              article: l.description || l.article || "",
              qte: l.quantite || l.qte || l.quantity || 1,
              prix: l.prix_unitaire || l.unit_price || l.prix || 0
            })));
          }
        }
      }).catch(err => console.error("Error preloading devis to edit:", err));
  }, [editId]);

  const sousTotal = useMemo(() => lignes.reduce((s, l) => s + (l.qte * l.prix), 0), [lignes]);
  const taxe = sousTotal * (taxePct / 100);
  const total = sousTotal + taxe;

  function updateLigne(id: number, patch: Partial<Ligne>) {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function addLigne() {
    nextId += 1;
    setLignes((prev) => [...prev, { id: nextId, article: "", qte: 1, prix: 0 }]);
  }
  function removeLigne(id: number) {
    setLignes((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  }

  const handleSave = async (status: string) => {
    setIsSubmitting(true);
    try {
      const selectedClientObj = clients.find(c => c.id === clientId);
      const clientFinalName = customClientName.trim() || (selectedClientObj ? (selectedClientObj.company_name || selectedClientObj.nom) : "Client Comptoir");

      const devisData = {
        quotation_number: devisNumber,
        numero: devisNumber,
        client: clientId || null,
        client_name: clientFinalName,
        status: status,
        statut: status,
        total_amount: total,
        montant: total,
        date: new Date().toISOString().split("T")[0],
        validiteJusquau,
        lignes,
      };
      
      const endpoint = editId ? `/api/quotations/${editId}` : '/api/quotations';
      const method = editId ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(devisData)
      });
      
      if (!res.ok) throw new Error("Échec de l'enregistrement du devis");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "quotations" } }));
      }
      
      setSaveSuccess(true);
      router.push("/devis");
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 text-slate-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/devis"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white transition-all"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="font-display text-[22px] font-bold text-white tracking-tight">Créer un devis</h1>
            <p className="text-[12px] text-slate-400">Complétez ou ajustez les informations ci-dessous</p>
          </div>
        </div>
      </div>

      {isLoadingOcr && (
        <div className="rounded-2xl bg-indigo-600/10 border border-indigo-500/30 p-4 flex items-center gap-3">
          <Loader2 className="animate-spin text-indigo-400" size={20} />
          <p className="text-[13.5px] font-bold text-indigo-300">Extraction Gemini 2.5 AI Vision en cours...</p>
        </div>
      )}

      {ocrMessage && !isLoadingOcr && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center gap-3">
          <Sparkles className="text-emerald-400" size={20} />
          <p className="text-[13.5px] font-bold text-emerald-300">{ocrMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          
          {/* Header Details Card */}
          <div className="bento-card space-y-4">
            <p className="text-[12px] font-bold uppercase tracking-wider text-indigo-400">
              Détails du devis
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">N° Devis *</label>
                <input
                  required
                  value={devisNumber}
                  onChange={(e) => setDevisNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] font-mono font-bold text-indigo-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Nom du Client / Entreprise *</label>
                <input
                  required
                  value={customClientName}
                  onChange={(e) => setCustomClientName(e.target.value)}
                  placeholder="Nom du client..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Valide jusqu'au</label>
                <input
                  type="date"
                  value={validiteJusquau}
                  onChange={(e) => setValiditeJusquau(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Line Items Card */}
          <div className="bento-card space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold uppercase tracking-wider text-indigo-400">
                Lignes d'articles / Prestations
              </p>
              <span className="text-[12px] text-slate-400">{lignes.length} article(s)</span>
            </div>

            {lignes.map((l, idx) => (
              <div key={l.id} className="rounded-xl border border-slate-800 p-3.5 bg-slate-950/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-slate-400">Ligne #{idx + 1}</span>
                  {lignes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLigne(l.id)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                
                {/* Product picker */}
                {produits.length > 0 && (
                  <div>
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
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-[12px] text-slate-300 mb-1.5 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">-- Sélectionner depuis le catalogue de produits --</option>
                      {produits.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name || p.nom} ({mad(p.selling_price || p.prix)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      value={l.article}
                      onChange={(e) => updateLigne(l.id, { article: e.target.value })}
                      placeholder="Description de la prestation / article..."
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-[12.5px] text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={l.qte}
                      onChange={(e) => updateLigne(l.id, { qte: Math.max(1, Number(e.target.value)) })}
                      placeholder="Qté"
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-[12.5px] font-mono text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={l.prix}
                      onChange={(e) => updateLigne(l.id, { prix: Math.max(0, Number(e.target.value)) })}
                      placeholder="Prix HT"
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-[12.5px] font-mono text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end text-[12px] text-slate-400 pt-1">
                  <span>Total HT : <strong className="font-mono text-white">{mad(l.qte * l.prix)}</strong></span>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addLigne}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-800 py-2.5 text-[12.5px] font-semibold text-indigo-400 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all"
            >
              <Plus size={15} /> Ajouter une ligne d'article
            </button>
          </div>
        </div>

        {/* Right Summary Sidebar */}
        <div className="space-y-5">
          <div className="bento-card space-y-4 sticky top-6">
            <p className="text-[12px] font-bold uppercase tracking-wider text-indigo-400">
              Récapitulatif Financier
            </p>
            
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between text-slate-400">
                <span>Sous-total HT :</span>
                <span className="font-mono font-bold text-slate-200">{mad(sousTotal)}</span>
              </div>
              
              <div className="flex items-center justify-between text-slate-400">
                <span>Taux de TVA :</span>
                <select
                  value={taxePct}
                  onChange={(e) => setTaxePct(Number(e.target.value))}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[12px] font-bold text-indigo-400 focus:outline-none"
                >
                  <option value={20}>20% (Standard)</option>
                  <option value={14}>14% (Transport)</option>
                  <option value={10}>10% (Restauration)</option>
                  <option value={7}>7% (Eau/Produits)</option>
                  <option value={0}>0% (Exonéré)</option>
                </select>
              </div>

              <div className="flex justify-between text-slate-400">
                <span>TVA ({taxePct}%) :</span>
                <span className="font-mono text-purple-300">+{mad(taxe)}</span>
              </div>

              <div className="flex justify-between border-t border-slate-800 pt-3 text-[16px] font-black text-white">
                <span>TOTAL TTC :</span>
                <span className="font-mono text-emerald-400">{mad(total)}</span>
              </div>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleSave("Accepté")}
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-[13px] font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 disabled:opacity-50 transition-all active:scale-95"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Enregistrer & Marquer Accepté
              </button>

              <button
                type="button"
                onClick={() => handleSave("Brouillon")}
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50 transition-all"
              >
                Sauvegarder en Brouillon
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NouveauDevisPage() {
  return (
    <Suspense fallback={<div className="p-12 flex justify-center"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>}>
      <DevisFormContent />
    </Suspense>
  );
}
