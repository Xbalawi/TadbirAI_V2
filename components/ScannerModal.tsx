"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { FileScan, AlertCircle, Loader2, CheckCircle, Plus, Trash2, Edit3, PackageCheck, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import FormAlert from "./FormAlert";
import { mad } from "@/lib/format";
import { addImportHistoryRecord } from "@/lib/import-history-store";

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: "devis" | "factures" | "reception_stock" | "fournisseur";
}

type ExtractedLine = {
  description: string;
  quantite: number;
  prix_unitaire: number;
  montant?: number;
  matched_product_id?: string;
  matched_product_name?: string;
  confidence_score?: number; // 0 to 1
  needs_admin_review?: boolean;
  create_new_product?: boolean;
};

export default function ScannerModal({ isOpen, onClose, targetType }: ScannerModalProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "verify">("upload");
  const [scannedDocId, setScannedDocId] = useState<string | null>(null);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);

  // Stock update toggle (checked by default for supplier receipts and stocks)
  const [updateStock, setUpdateStock] = useState(targetType === "reception_stock" || targetType === "fournisseur" || targetType === "factures");

  // Editable Extracted Data State
  const [docNumber, setDocNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [docDate, setDocDate] = useState(new Date().toISOString().split("T")[0]);
  const [lignes, setLignes] = useState<ExtractedLine[]>([]);

  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<any[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/products")
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : data.results || [];
          setAvailableProducts(list);
        })
        .catch((err) => console.error("Error loading products for scanner:", err));

      fetch("/api/clients")
        .then((res) => res.json())
        .then((data) => setAvailableClients(Array.isArray(data) ? data : data.results || []))
        .catch(() => {});

      fetch("/api/suppliers")
        .then((res) => res.json())
        .then((data) => setAvailableSuppliers(Array.isArray(data) ? data : data.results || []))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isScanning || step === "verify") return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  // Match line item to inventory with confidence score
  const matchProduct = (description: string, products: any[]) => {
    if (!description || products.length === 0) {
      return { matched_product_id: "", matched_product_name: "", confidence_score: 0, needs_admin_review: true };
    }

    const descLower = description.toLowerCase().trim();
    let bestMatch: any = null;
    let bestScore = 0;

    for (const p of products) {
      const pName = (p.name || p.nom || "").toLowerCase().trim();
      const pSku = (p.sku || "").toLowerCase().trim();

      if (pName === descLower || pSku === descLower) {
        bestMatch = p;
        bestScore = 0.98;
        break;
      }

      if (descLower.includes(pName) || pName.includes(descLower)) {
        const score = Math.min(pName.length, descLower.length) / Math.max(pName.length, descLower.length);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = p;
        }
      }
    }

    const isConfident = bestScore >= 0.75;
    return {
      matched_product_id: isConfident && bestMatch ? bestMatch.id : "",
      matched_product_name: isConfident && bestMatch ? (bestMatch.name || bestMatch.nom) : "",
      confidence_score: bestScore,
      needs_admin_review: !isConfident,
      create_new_product: !isConfident
    };
  };

  const handleScan = async () => {
    if (!file) {
      setError("Veuillez sélectionner un fichier (PDF ou Image).");
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      // Always fetch fresh products before scanning to avoid stale state closures
      let freshProducts = availableProducts;
      if (freshProducts.length === 0) {
        try {
          const prodRes = await fetch("/api/products");
          const prodData = await prodRes.json();
          freshProducts = Array.isArray(prodData) ? prodData : (prodData.results || []);
          setAvailableProducts(freshProducts);
        } catch (e) {
          console.error("Failed to fetch products on demand:", e);
        }
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("doc_type", targetType === "devis" ? "devis" : "invoice");

      const response = await fetch(`/api/ai/documents`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errStr = "Erreur lors du traitement par l'IA";
        try {
          const errData = await response.json();
          errStr = errData.error_message || errData.error || errStr;
        } catch (e) {
          errStr = await response.text();
        }
        throw new Error(errStr);
      }

      const data = await response.json();

      if (data.status === "failed") {
        throw new Error(data.error_message || "Erreur d'extraction OCR avec l'IA.");
      }

      if (data.id) setScannedDocId(data.id);

      const ext = data.extracted_data || {};

      setDocNumber(
        ext.numero_facture ||
          (targetType === "devis"
            ? `DEV-${Math.floor(1000 + Math.random() * 9000)}`
            : targetType === "reception_stock"
            ? `REC-${Math.floor(1000 + Math.random() * 9000)}`
            : `FAC-${Math.floor(1000 + Math.random() * 9000)}`)
      );
      setClientName(ext.fournisseur || ext.client || (targetType === "reception_stock" ? "Fournisseur (Lavazza)" : "Client"));
      setDocDate(ext.date || new Date().toISOString().split("T")[0]);

      let parsedLignes: ExtractedLine[] =
        Array.isArray(ext.lignes) && ext.lignes.length > 0
          ? ext.lignes.map((l: any) => ({
              description: l.description || l.nom || "",
              quantite: Number(l.quantite || 1),
              prix_unitaire: Number(l.prix_unitaire || 0),
            }))
          : [
              {
                description: "Article principal",
                quantite: 1,
                prix_unitaire: 0,
              }
            ];

      // Second Pass: AI Product Matching
      if (parsedLignes.length > 0 && freshProducts.length > 0) {
        try {
          const matchRes = await fetch('/api/ai/match-products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lineItems: parsedLignes.map(l => l.description),
              products: freshProducts
            })
          });
          
          if (matchRes.ok) {
            const matchData = await matchRes.json();
            if (matchData.matches && Array.isArray(matchData.matches)) {
              parsedLignes = parsedLignes.map((l, idx) => {
                const aiMatch = matchData.matches.find((m: any) => m.index === idx);
                if (aiMatch && aiMatch.product_id) {
                  const p = freshProducts.find(p => p.id === aiMatch.product_id);
                  if (p) {
                    return {
                      ...l,
                      quantite: (aiMatch.extracted_quantity && aiMatch.extracted_quantity > 1) ? aiMatch.extracted_quantity : l.quantite,
                      matched_product_id: p.id,
                      matched_product_name: p.name || p.nom,
                      confidence_score: aiMatch.confidence || 0.9,
                      needs_admin_review: (aiMatch.confidence || 0.9) < 0.8,
                      create_new_product: false
                    };
                  }
                }
                // Fallback to manual if AI says null
                const manualMatch = matchProduct(l.description, freshProducts);
                return { ...l, ...manualMatch };
              });
            } else {
              parsedLignes = parsedLignes.map(l => ({ ...l, ...matchProduct(l.description, freshProducts) }));
            }
          } else {
            parsedLignes = parsedLignes.map(l => ({ ...l, ...matchProduct(l.description, freshProducts) }));
          }
        } catch (matchErr) {
          console.warn("AI Match failed, falling back to string matching", matchErr);
          parsedLignes = parsedLignes.map(l => ({ ...l, ...matchProduct(l.description, freshProducts) }));
        }
      } else {
        parsedLignes = parsedLignes.map(l => ({ ...l, ...matchProduct(l.description, freshProducts) }));
      }

      setLignes(parsedLignes);
      setStep("verify");
      setIsScanning(false);
    } catch (err: any) {
      let friendly = err?.message || "Une erreur est survenue lors de l'analyse par l'IA";
      if (friendly.includes("NetworkError") || friendly.includes("Failed to fetch") || friendly.includes("fetch")) {
        friendly = "Problème de connexion réseau avec le serveur. Veuillez vérifier votre connexion ou réduire la taille de l'image/PDF.";
      }
      setError(friendly);
      setIsScanning(false);
    }
  };

  const handleClose = () => {
    if (isScanning || isSaving) return;
    setFile(null);
    setError(null);
    setSuccessMessage(null);
    setStep("upload");
    setLignes([]);
    onClose();
  };

  function updateLine(index: number, patch: Partial<ExtractedLine>) {
    setLignes((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLignes((prev) => [
      ...prev,
      { description: "", quantite: 1, prix_unitaire: 0, needs_admin_review: true, confidence_score: 0 }
    ]);
  }

  function removeLine(index: number) {
    setLignes((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const sousTotal = lignes.reduce((sum, l) => sum + l.quantite * l.prix_unitaire, 0);
  const tva = sousTotal * 0.2;
  const totalTtc = sousTotal + tva;

  const handleConfirm = async () => {
    if (!clientName.trim()) {
      setError("Veuillez renseigner le nom du fournisseur / client.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // 1. If stock update is enabled, perform inventory stock adjustment (+ quantities)
      if (updateStock && lignes.length > 0) {
        const stockItems = lignes.map((l) => ({
          product_id: l.matched_product_id || undefined,
          product_name: l.description,
          quantity: l.quantite,
          selling_price: l.prix_unitaire,
          create_if_missing: l.create_new_product || !l.matched_product_id
        }));

        await fetch("/api/stock-movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: stockItems,
            source: `Facture d'achat / Réception N° ${docNumber}`,
            supplier: clientName
          })
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "stock" } }));
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "products" } }));
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "quotations" } }));
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "invoices" } }));
        }
      }

      // 1b. Resolve or Create Client/Supplier
      let finalEntityId = null;
      if (targetType === "devis" || targetType === "factures") {
        const existing = availableClients.find(c => (c.company_name || c.nom || c.contact_name || "").toLowerCase() === clientName.toLowerCase().trim());
        if (existing) {
          finalEntityId = existing.id;
        } else {
          const res = await fetch("/api/clients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company_name: clientName, customer_code: "CUST-" + Date.now().toString().slice(-6) })
          });
          const data = await res.json();
          finalEntityId = data.id;
        }
      } else {
        const existing = availableSuppliers.find(c => (c.company_name || c.nom || c.contact_name || "").toLowerCase() === clientName.toLowerCase().trim());
        if (existing) {
          finalEntityId = existing.id;
        } else {
          const res = await fetch("/api/suppliers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company_name: clientName, supplier_code: "SUPP-" + Date.now().toString().slice(-6) })
          });
          const data = await res.json();
          finalEntityId = data.id;
        }
      }

      // 2. Save Document record (Invoice, Quotation or Stock Entry)
      const endpoint = targetType === "devis" ? "/api/quotations" : "/api/invoices";
      const payload: any = {
        client_name: clientName,
        client: (targetType === "devis" || targetType === "factures") ? finalEntityId : null,
        supplier: (targetType === "reception_stock" || targetType === "fournisseur") ? finalEntityId : null,
        status: "Payée",
        statut: "Payée",
        date: docDate,
        dateEmission: docDate,
        total_amount: totalTtc,
        montant: totalTtc,
        lignes
      };

      if (targetType === "devis") {
        payload.quotation_number = docNumber;
      } else {
        payload.invoice_number = docNumber;
      }

      const docRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!docRes.ok) {
        let errText = await docRes.text();
        try {
          const parsed = JSON.parse(errText);
          if (parsed.quotation_number) {
            errText = `Le numéro de devis ${docNumber} existe déjà dans votre base de données. Veuillez le modifier manuellement ci-dessus.`;
          } else if (parsed.invoice_number) {
            errText = `Le numéro de facture ${docNumber} existe déjà dans votre base de données. Veuillez le modifier manuellement ci-dessus.`;
          } else {
            const values: any = Object.values(parsed);
            errText = values.flat().join(" ");
          }
        } catch (e) {
          // Keep original text if not JSON
        }
        throw new Error(errText || "Erreur de sauvegarde du document");
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: targetType } }));
      }

      // Record in import history
      addImportHistoryRecord({
        fileName: file?.name || `doc_scan_${docNumber || Date.now()}.pdf`,
        fileSize: file ? `${(file.size / 1024).toFixed(1)} KB` : "450 KB",
        fileType: file?.name.split(".").pop() || "pdf",
        targetTable: targetType === "devis" ? "devis" : (targetType === "reception_stock" ? "stock" : "factures"),
        status: "success",
        recordCount: lignes.length || 1,
        details: `Scan IA & Numérisation (${lignes.length} articles) pour ${clientName}`
      });

      setSuccessMessage(
        updateStock
          ? `Facture enregistrée et stocks mis à drop avec succès (+Entrée de stock) !`
          : `Document numérisé et enregistré avec succès !`
      );

      setTimeout(() => {
        handleClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || "Erreur de sauvegarde de l'analyse IA");
    } finally {
      setIsSaving(false);
    }
  };

  const isReceiptOrStock = targetType === "reception_stock" || targetType === "fournisseur";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        isReceiptOrStock
          ? "Numérisation IA : Facture Fournisseur & Entrée de Stock"
          : `Numérisation IA ${targetType === "devis" ? "de Devis" : "de Facture"}`
      }
      maxWidth="max-w-2xl sm:max-w-3xl"
    >
      <FormAlert error={error} onClose={() => setError(null)} title="Erreur lors du traitement" />

      {successMessage ? (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-4 ring-emerald-500/20">
            <CheckCircle size={36} />
          </div>
          <p className="text-base font-bold text-white">{successMessage}</p>
          <p className="text-xs text-slate-300">Les quantités en stock et l'historique ont été synchronisés en temps réel.</p>
        </div>
      ) : step === "upload" ? (
        <div className="flex flex-col gap-4 text-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <FileScan size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                {isReceiptOrStock
                  ? "Lecture Intelligente de Factures Fournisseurs (Entrées de stock)"
                  : "Analyse Documentaire Vision IA 2.5"}
              </h4>
              <p className="text-[12px] text-slate-400">
                {isReceiptOrStock
                  ? "Extrait les articles achetés (ex: 200 kg de Café) et augmente automatiquement vos stocks en inventaire."
                  : "Extrait automatiquement les clients, articles, numéros et montants depuis tout PDF ou photo."}
              </p>
            </div>
          </div>

          <div
            onClick={() => !isScanning && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all duration-300 ${
              file && !isScanning
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-slate-800 bg-slate-950 hover:border-indigo-500/50 hover:bg-slate-900"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,application/pdf"
            />

            {isScanning ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-indigo-400" size={32} />
                <p className="text-[13.5px] font-bold text-indigo-300 animate-pulse">
                  Extraction IA Vision & Reconnaissance des Stocks en cours...
                </p>
                <p className="text-[11px] text-slate-400">Lecture des lignes d'articles, quantités et tarifs</p>
              </div>
            ) : file ? (
              <div className="text-center">
                <p className="text-[13.5px] font-bold text-indigo-300 truncate max-w-[280px]">{file.name}</p>
                <p className="text-[11px] text-slate-400 mt-1">Cliquez pour modifier le fichier</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[13.5px] font-semibold text-slate-200">
                  Glissez-déposez votre {isReceiptOrStock ? "facture fournisseur / reçu d'achat" : "document"} ici
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Formats PDF, JPG, PNG acceptés (Ex: Facture Lavazza, Métro, etc.)</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              onClick={handleClose}
              disabled={isScanning}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-[12.5px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleScan}
              disabled={isScanning || !file}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[12.5px] font-bold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-50"
            >
              {isScanning && <Loader2 size={15} className="animate-spin" />}
              Lancer l'IA Vision
            </button>
          </div>
        </div>
      ) : (
        /* Verification, Inventory Matching & Refinement View */
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-slate-100 custom-scrollbar">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 size={15} className="text-indigo-400" />
                Vérification & Association au Stock
              </h4>
              <p className="text-[11.5px] text-slate-400">Vérifiez les données extraites et l'association aux produits d'inventaire.</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
              IA Vision Active
            </span>
          </div>

          {/* Stock increment toggle banner */}
          <div className="rounded-xl bg-indigo-950/60 border border-indigo-500/30 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <PackageCheck size={18} className="text-indigo-400 shrink-0" />
              <div>
                <p className="text-[12.5px] font-bold text-white">Mettre à jour le stock en inventaire (+Entrée)</p>
                <p className="text-[11px] text-slate-300">
                  Augmente automatiquement les quantités en stock selon les lignes de cette facture.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={updateStock}
                onChange={(e) => setUpdateStock(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-slate-300">N° Facture / Réception</label>
              <input
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[12.5px] font-mono font-bold text-indigo-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-slate-300">Fournisseur / Émetteur</label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Lavazza Maroc"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[12.5px] font-semibold text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-slate-300">Date</label>
              <input
                type="date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[12.5px] text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Line items editor with stock matching & safety flag */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wider text-indigo-400">Articles Détectés & Affectation Stock</span>
              <span className="text-[11.5px] text-slate-400">{lignes.length} article(s)</span>
            </div>

            {lignes.map((l, idx) => {
              const matchedProd = availableProducts.find((p) => p.id === l.matched_product_id);
              const currentStock = matchedProd ? Number(matchedProd.quantity || 0) : 0;
              const newStockPreview = currentStock + Number(l.quantite || 0);

              return (
                <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11.5px] font-semibold text-slate-400">Ligne #{idx + 1}</span>

                    {/* AI Confidence & Admin Review Flag */}
                    {l.needs_admin_review ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg animate-pulse">
                        <AlertTriangle size={12} /> ⚠️ Nécessite Révision Admin (Doute IA)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                        <CheckCircle size={12} /> Reconnu par IA ({Math.round((l.confidence_score || 0.95) * 100)}%)
                      </span>
                    )}

                    {lignes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-red-400 hover:text-red-300 transition-colors p-1 ml-auto"
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
                        placeholder="Désignation article (ex: Café Lavazza 200kg)..."
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-[12px] text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min="0"
                        value={l.quantite}
                        onChange={(e) => updateLine(idx, { quantite: Number(e.target.value) })}
                        placeholder="Qté"
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[12px] text-white font-mono focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={l.prix_unitaire}
                        onChange={(e) => updateLine(idx, { prix_unitaire: Number(e.target.value) })}
                        placeholder="Prix U (MAD)"
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[12px] text-white font-mono focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Stock Product Mapping Selector */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-[11.5px]">
                    <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                      <span className="text-slate-400 font-medium">Associer au produit :</span>
                      <select
                        value={l.matched_product_id || (l.create_new_product ? "NEW" : "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "NEW") {
                            updateLine(idx, { matched_product_id: "", create_new_product: true, needs_admin_review: false });
                          } else {
                            const found = availableProducts.find((p) => p.id === val);
                            updateLine(idx, {
                              matched_product_id: val,
                              matched_product_name: found ? found.name : "",
                              create_new_product: false,
                              needs_admin_review: false
                            });
                          }
                        }}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 text-[11.5px] flex-1 cursor-pointer"
                      >
                        <option value="">— Choisir un produit existant —</option>
                        {availableProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name || p.nom} ({p.sku}) · En stock : {p.quantity ?? 0} {p.unit || "u"}
                          </option>
                        ))}
                        <option value="NEW" className="text-indigo-400 font-bold">+ Créer comme nouveau produit en stock</option>
                      </select>
                    </div>

                    {updateStock && matchedProd && (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        <span>Stock : {currentStock}</span>
                        <ArrowRight size={12} />
                        <span className="font-bold">+{l.quantite} = {newStockPreview} {matchedProd.unit || "u"}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addLine}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-800 py-2 text-[12px] font-semibold text-indigo-400 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all"
            >
              <Plus size={14} /> Ajouter une ligne
            </button>
          </div>

          {/* Financial summary */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-1 text-[12px]">
            <div className="flex justify-between text-slate-400">
              <span>Sous-total HT :</span>
              <span className="font-mono font-bold text-slate-200">{mad(sousTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>TVA (20%) :</span>
              <span className="font-mono text-indigo-300">+{mad(tva)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800 text-[14px] font-extrabold">
              <span className="text-white">Total TTC :</span>
              <span className="font-mono text-emerald-400">{mad(totalTtc)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSaving}
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-[12.5px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-[12.5px] font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                {updateStock ? "Confirmer & Mettre à jour le stock" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

