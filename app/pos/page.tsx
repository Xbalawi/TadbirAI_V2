"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  Printer,
  Mail,
  MessageCircle,
  X,
} from "lucide-react";
import { mad } from "@/lib/format";
import { fetchAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";
import WhatsAppSendModal from "@/components/WhatsAppSendModal";
import POSReceiptPrint, { printPOSReceiptWindow } from "@/components/POSReceiptPrint";
import { matchesSearch } from "@/lib/search";
import { useTranslation } from "@/lib/i18n";

type CartLine = { produitId: string; nom: string; sku: string; prix: number; qte: number; remise: number };

export default function PosPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [fondCaisse, setFondCaisse] = useState(2000);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [category, setCategory] = useState("Tous");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  const [remisePanierPct, setRemisePanierPct] = useState(0);
  const [tvaPct, setTvaPct] = useState(20);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Espèces");
  const [montantRemis, setMontantRemis] = useState<number>(0);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [receipt, setReceipt] = useState<null | { id?: string; transactionId: string; total: number; rendu: number; paymentMethod?: string; montantRemis?: number; lignes: CartLine[] }>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    const loadProducts = async () => {
      try {
        let list: any[] = [];
        // 1. Fetch from Next.js products API (same data source as Stocks table)
        try {
          const resLocal = await fetch(`/api/products?t=${Date.now()}`);
          if (resLocal.ok) {
            const dataLocal = await resLocal.json();
            list = Array.isArray(dataLocal) ? dataLocal : dataLocal.results || [];
          }
        } catch (e) {}

        // 2. If local list is empty, try Django backend endpoint
        if (list.length === 0) {
          try {
            const resApi = await fetchAPI("api/products/");
            if (resApi.ok) {
              const dataApi = await resApi.json();
              list = Array.isArray(dataApi) ? dataApi : dataApi.results || [];
            }
          } catch (e) {}
        }

        const formatted = list.map((p: any) => ({
          id: p.id,
          nom: p.name || p.nom || "Produit",
          sku: p.sku || "SKU-000",
          prix: Number(p.selling_price || p.prix || 0),
          categorie: p.category_name || p.categorie || "Général",
          stock: p.quantity !== undefined ? p.quantity : p.stock,
        }));
        setAllProducts(formatted);
      } catch (err) {
        console.error("Error loading POS products:", err);
      }
    };

    loadProducts();
    const handleUpdate = () => loadProducts();
    window.addEventListener("dataUpdated", handleUpdate);
    return () => window.removeEventListener("dataUpdated", handleUpdate);
  }, []);

  const dynamicCategories = useMemo(() => {
    const cats = new Set(allProducts.map(p => p.categorie));
    return ["Tous", ...Array.from(cats)];
  }, [allProducts]);

  const filtered = allProducts.filter(
    (p) =>
      (category === "Tous" || p.categorie === category) &&
      matchesSearch(p, search)
  );

  const sousTotal = useMemo(
    () => cart.reduce((s, l) => s + l.prix * l.qte * (1 - l.remise / 100), 0),
    [cart]
  );
  const remisePanier = sousTotal * (remisePanierPct / 100);
  const tva = (sousTotal - remisePanier) * (tvaPct / 100);
  const total = sousTotal - remisePanier + tva;

  function addToCart(produit: any) {
    setCart((prev) => {
      const existing = prev.find((l) => l.produitId === produit.id);
      if (existing) {
        return prev.map((l) =>
          l.produitId === produit.id ? { ...l, qte: l.qte + 1 } : l
        );
      }
      return [
        ...prev,
        { produitId: produit.id, nom: produit.nom, sku: produit.sku, prix: produit.prix, qte: 1, remise: 0 },
      ];
    });
  }

  function updateLine(produitId: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.produitId === produitId ? { ...l, ...patch } : l)));
  }
  function removeLine(produitId: string) {
    setCart((prev) => prev.filter((l) => l.produitId !== produitId));
  }

  async function encaisser() {
    try {
      const transactionId = `TXN-${Date.now().toString().slice(-9)}`;
      
      // Save as a paid invoice in the database
      const invoiceLignes = cart.map(l => ({
        description: l.nom,
        quantite: l.qte,
        prix_unitaire: l.prix
      }));

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_number: transactionId,
          client_name: 'Client Comptoir',
          status: 'Payée',
          total_amount: total,
          date: new Date().toISOString().split("T")[0],
          lignes: invoiceLignes
        })
      });

      const created = await res.json();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "invoices" } }));
      }

      setReceipt({
        id: created.id,
        transactionId,
        total: total,
        rendu: Math.max(0, montantRemis - total),
        paymentMethod,
        montantRemis,
        lignes: cart,
      });
      setCheckoutOpen(false);
    } catch (err) {
      console.error("Erreur d'encaissement:", err);
    }
  }

  function nouvelleVente() {
    setCart([]);
    setRemisePanierPct(0);
    setMontantRemis(0);
    setPaymentMethod("Espèces");
    setReceipt(null);
  }

  return (
    <div className="mx-auto flex h-full max-w-[1500px] gap-5">
      {/* Product grid */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[22px] font-semibold text-ink-900">{t("pos.title", "Point de Vente (POS)")}</h1>
            <p className="text-[13px] text-ink-400">
              {sessionOpen ? "Session ouverte" : "Session fermée"}
            </p>
          </div>
          {!sessionOpen && (
            <button
              onClick={() => setOpenModal(true)}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-indigo-700"
            >
              Ouvrir la session
            </button>
          )}
        </div>

        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher produit, SKU, code-barres..."
            className="w-full rounded-md border border-ink-200 bg-paper-card py-2 pl-8 pr-3 text-[13px] focus:border-brass/60 focus:outline-none"
          />
        </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {dynamicCategories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                  category === c
                    ? "bg-indigo-600 text-white"
                    : "bg-paper text-ink-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                if (!sessionOpen) setSessionOpen(true);
                addToCart(p);
              }}
              className="ledger-card !p-3 text-left hover:border-brass/60 transition-colors"
            >
              <div className="mb-2 flex h-20 items-center justify-center rounded-md bg-brass/10 text-[11px] text-brass/60">
                {p.categorie}
              </div>
              <p className="truncate text-[13px] font-medium text-ink-900">{p.nom}</p>
              <p className="text-[11px] text-ink-400">{p.sku}</p>
              <p className="figure mt-1 text-[13px] font-medium text-ink-900">{mad(p.prix)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Cart panel */}
      <div className="ledger-card flex w-[340px] shrink-0 flex-col !p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-900">
            <ShoppingCart size={15} /> Panier
          </p>
          <span className="text-[12px] text-ink-400">Client de passage</span>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {cart.length === 0 && (
            <p className="py-10 text-center text-[12.5px] text-ink-400">
              Recherchez ou cliquez sur un produit pour l'ajouter
            </p>
          )}
          {cart.map((l) => (
            <div key={l.produitId} className="rounded-md border border-ink-200 p-2.5">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[12.5px] font-medium text-ink-900">{l.nom}</p>
                  <p className="text-[11px] text-ink-400">{l.sku}</p>
                </div>
                <button onClick={() => removeLine(l.produitId)} className="text-ink-300 hover:text-status-danger">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateLine(l.produitId, { qte: Math.max(1, l.qte - 1) })}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:border-brass/50"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="figure w-5 text-center text-[12.5px]">{l.qte}</span>
                  <button
                    onClick={() => updateLine(l.produitId, { qte: l.qte + 1 })}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:border-brass/50"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <span className="figure text-[12.5px] font-medium text-ink-900">
                  {mad(l.prix * l.qte * (1 - l.remise / 100))}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1.5 border-t border-ink-200/60 pt-3 text-[13px]">
          <div className="flex items-center justify-between text-ink-500">
            <span>Remise sur panier</span>
            <input
              type="number"
              value={remisePanierPct}
              onChange={(e) => setRemisePanierPct(Number(e.target.value))}
              className="w-14 rounded-md border border-ink-200 bg-paper px-1.5 py-0.5 text-right text-[12.5px] focus:border-brass/60 focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-between text-ink-500">
            <span>TVA %</span>
            <input
              type="number"
              value={tvaPct}
              onChange={(e) => setTvaPct(Number(e.target.value))}
              className="w-14 rounded-md border border-ink-200 bg-paper px-1.5 py-0.5 text-right text-[12.5px] focus:border-brass/60 focus:outline-none"
            />
          </div>
          <div className="flex justify-between text-ink-500">
            <span>Sous-total</span>
            <span className="figure">{mad(sousTotal)}</span>
          </div>
          <div className="flex justify-between text-ink-500">
            <span>TVA ({tvaPct}%)</span>
            <span className="figure">{mad(tva)}</span>
          </div>
          <div className="flex justify-between border-t border-ink-200/60 pt-2 text-[15px] font-semibold text-ink-900">
            <span>Total</span>
            <span className="figure">{mad(total)}</span>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            disabled={cart.length === 0}
            className="flex-1 rounded-md border border-ink-200 py-2 text-[12.5px] font-medium text-ink-700 hover:border-brass/50 disabled:opacity-40"
          >
            Mettre en attente
          </button>
          <button
            disabled={cart.length === 0}
            onClick={() => {
              setMontantRemis(total);
              setCheckoutOpen(true);
            }}
            className="flex-1 rounded-md bg-indigo-600 py-2 text-[12.5px] font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Encaisser
          </button>
        </div>
      </div>

      {/* Open session modal */}
      {mounted && openModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-card bg-paper-card p-5 shadow-panel">
            <h2 className="mb-4 text-[15px] font-semibold text-ink-900">Ouvrir la session</h2>
            <label className="mb-1.5 block text-[12.5px] text-ink-600">Fond de caisse initial</label>
            <div className="mb-3 flex items-center gap-2">
              <input
                type="number"
                value={fondCaisse}
                onChange={(e) => setFondCaisse(Number(e.target.value))}
                className="w-full rounded-md border border-ink-200 bg-paper px-3 py-2 text-[13px] focus:border-brass/60 focus:outline-none"
              />
              <span className="text-[12px] text-ink-400">DH</span>
            </div>
            <label className="mb-1.5 block text-[12.5px] text-ink-600">Notes</label>
            <input
              placeholder="Optionnel..."
              className="mb-4 w-full rounded-md border border-ink-200 bg-paper px-3 py-2 text-[13px] focus:border-brass/60 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpenModal(false)}
                className="rounded-md border border-ink-200 px-4 py-2 text-[13px] font-medium text-ink-700 hover:border-brass/50"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setSessionOpen(true);
                  setOpenModal(false);
                }}
                className="rounded-md bg-status-success px-4 py-2 text-[13px] font-medium text-white hover:bg-status-success/90"
              >
                Ouvrir la session
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Checkout modal */}
      {mounted && checkoutOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-card bg-paper-card p-5 shadow-panel">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-ink-900">Encaisser</h2>
                <p className="figure text-[12.5px] text-ink-400">Total : {mad(total)}</p>
              </div>
              <button onClick={() => setCheckoutOpen(false)} className="text-ink-400 hover:text-ink-800">
                <X size={18} />
              </button>
            </div>

            <div className="mb-3 grid grid-cols-4 gap-1.5 text-[11.5px]">
              {["Espèces", "Carte", "Virement", "Autre"].map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded-md border py-1.5 transition-colors ${
                    paymentMethod === m ? "border-brass bg-brass/10 text-brass" : "border-ink-200 text-ink-500 hover:border-brass/50 hover:bg-brass/5"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              onClick={() => setMontantRemis(total)}
              className="mb-2 w-full rounded-md border border-ink-200 py-1.5 text-[12.5px] font-medium text-ink-700 hover:border-brass/50"
            >
              Exact
            </button>
            <label className="mb-1.5 block text-[12.5px] text-ink-600">Montant remis</label>
            <div className="mb-3 flex items-center gap-2">
              <input
                type="number"
                value={montantRemis}
                onChange={(e) => setMontantRemis(Number(e.target.value))}
                className="w-full rounded-md border border-ink-200 bg-paper px-3 py-2 text-[13px] focus:border-brass/60 focus:outline-none"
              />
              <span className="text-[12px] text-ink-400">DH</span>
            </div>

            <div className="mb-4 space-y-1 text-[13px]">
              <div className="flex justify-between text-ink-500">
                <span>Total à payer</span>
                <span className="figure">{mad(total)}</span>
              </div>
              <div className="flex justify-between text-ink-500">
                <span>Montant remis</span>
                <span className="figure">{mad(montantRemis)}</span>
              </div>
              {montantRemis > total && (
                <div className="flex justify-between font-medium text-status-success">
                  <span>Monnaie à rendre</span>
                  <span className="figure">{mad(montantRemis - total)}</span>
                </div>
              )}
            </div>

            <button
              onClick={encaisser}
              className="w-full rounded-md bg-indigo-600 py-2.5 text-[13px] font-medium text-white hover:bg-indigo-700"
            >
              Encaisser {mad(total)}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Receipt */}
      {mounted && receipt && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-card bg-paper-card p-5 shadow-panel">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13.5px] font-medium text-ink-900">Reçu</p>
              <div className="flex gap-1.5">
                <button onClick={() => { if (receipt) printPOSReceiptWindow(receipt); else window.print(); }} className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-[12px] font-bold text-indigo-400 hover:bg-indigo-500/20 transition-all active:scale-95">
                  <Printer size={13} /> Imprimer Reçu (Paper/80mm)
                </button>
                <button onClick={() => {
                  if (!receipt) return;
                  const subject = encodeURIComponent(`Reçu TADBIR AI #${receipt.transactionId}`);
                  const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint les détails de votre reçu #${receipt.transactionId} d'un montant de ${receipt.total} MAD.\n\nMerci pour votre visite !`);
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                }} className="flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-600 hover:border-brass/50 transition-colors hover:text-ink-900">
                  <Mail size={12} />
                </button>
                <button onClick={() => {
                  if (!receipt) return;
                  setIsWhatsAppModalOpen(true);
                }} className="flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-600 hover:border-brass/50 transition-colors hover:text-ink-900">
                  <MessageCircle size={12} />
                </button>
              </div>
            </div>

            <div className="mb-3 rounded-md bg-status-successBg px-3 py-2 text-center">
              <p className="text-[11.5px] text-status-success">Vente enregistrée avec succès</p>
              <p className="figure text-[18px] font-semibold text-status-success">{mad(receipt.total)}</p>
            </div>

            <p className="text-[13px] font-semibold text-ink-900">TADBIR AI</p>
            <p className="text-[11px] text-ink-400">Casablanca, Maroc · IF 87654321 · ICE 002345678000091</p>
            <p className="mb-2 text-[11px] text-ink-400">#{receipt.transactionId}</p>

            <div className="space-y-1 border-t border-ink-200/60 py-2 text-[12.5px]">
              {receipt.lignes.map((l) => (
                <div key={l.produitId} className="flex justify-between">
                  <span className="text-ink-700">
                    {l.nom} × {l.qte}
                  </span>
                  <span className="figure text-ink-900">{mad(l.prix * l.qte)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 border-t border-ink-200/60 pt-2 text-[13px]">
              <div className="flex justify-between font-semibold text-ink-900">
                <span>Total</span>
                <span className="figure">{mad(receipt.total)}</span>
              </div>
              {receipt.rendu > 0 && (
                <div className="flex justify-between text-status-success">
                  <span>Monnaie à rendre</span>
                  <span className="figure">{mad(receipt.rendu)}</span>
                </div>
              )}
            </div>

            <button
              onClick={nouvelleVente}
              className="mt-4 w-full rounded-md bg-indigo-600 py-2.5 text-[13px] font-medium text-white hover:bg-indigo-700"
            >
              Nouvelle vente
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex animate-fade-in items-center gap-3 rounded-lg px-4 py-3 shadow-xl ${
          toast.type === 'success' ? 'bg-status-successBg border border-emerald-500/20 text-emerald-800' : 'bg-red-50 border border-red-500/20 text-red-800'
        }`}>
          {toast.type === 'success' ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">✓</div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600">!</div>
          )}
          <p className="text-[13px] font-medium leading-relaxed max-w-[280px]">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* WhatsApp Send Modal */}
      {receipt && (
        <WhatsAppSendModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          documentType="recu"
          recipientName="Client Comptoir"
          recipientPhone=""
          documentNumber={receipt.transactionId}
          amount={receipt.total}
          dueDate={new Date().toLocaleDateString("fr-FR")}
        />
      )}

      {/* Printable Receipt Component for Paper & Thermal Printers */}
      <POSReceiptPrint receipt={receipt} />
    </div>
  );
}
