"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, Loader2, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2, CheckCircle2, X, Eye, Filter, AlertTriangle, FileScan, History } from "lucide-react";
import { mad } from "@/lib/format";
import SpreadsheetImportModal from "@/components/SpreadsheetImportModal";
import EditProductModal from "@/components/EditProductModal";
import ScannerModal from "@/components/ScannerModal";
import ConfirmModal from "@/components/ConfirmModal";
import ImportHistoryModal from "@/components/ImportHistoryModal";
import { matchesSearch } from "@/lib/search";
import { useTranslation } from "@/lib/i18n";

export default function StocksPage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [metadataKeys, setMetadataKeys] = useState<string[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const apiDelete = (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const organizationId = typeof window !== "undefined" ? localStorage.getItem("active_organization_id") : null;
    if (token && token !== "demo_access_token" && token !== "session_token") {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (organizationId) headers.set("x-organization-id", organizationId);
    return fetch(path, { ...options, method: "DELETE", headers });
  };
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchProducts();
    const handleDataUpdate = () => fetchProducts();
    const handleTenantChange = () => {
      setCurrentPage(1);
      setSelectedIds([]);
      fetchProducts();
    };
    window.addEventListener("dataUpdated", handleDataUpdate);
    window.addEventListener("tenantChanged", handleTenantChange);
    return () => {
      window.removeEventListener("dataUpdated", handleDataUpdate);
      window.removeEventListener("tenantChanged", handleTenantChange);
    };
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`/api/products?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.results || [];
      setProducts(list);
      
      const keys = new Set<string>();
      list.forEach((p: any) => {
        if (p.metadata && typeof p.metadata === 'object') {
          Object.keys(p.metadata).forEach((key) => keys.add(key));
        }
      });
      setMetadataKeys(Array.from(keys));
    } catch (err) {
      console.error("Error fetching products", err);
    } finally {
      setLoading(false);
    }
  };

  // Extract distinct categories dynamically
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const cat = p.category_name || p.categorie || "Général";
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [products]);

  // 0ms Optimistic UI Delete Single Product
  const handleDeleteProduct = (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: `Supprimer le produit ${name}`,
      message: "Voulez-vous vraiment supprimer ce produit ? Cette action est irréversible.",
      onConfirm: async () => {
        const previousProducts = products;
        setProducts((prev) => prev.filter((p) => p.id !== id));
        setSelectedIds((prev) => prev.filter((i) => i !== id));
        try {
          const response = await apiDelete(`/api/products/${id}`);
          if (!response.ok) throw new Error(`Suppression impossible (${response.status})`);
          showToast(`Produit ${name} supprimé avec succès !`);
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "stock" } }));
        } catch (err) {
          setProducts(previousProducts);
          showToast(err instanceof Error ? err.message : "Suppression impossible", "error");
        }
      }
    });
    setActionMenuOpen(null);
  };

  // 0ms Optimistic UI Bulk Delete
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    setConfirmConfig({
      isOpen: true,
      title: `Supprimer ${count} produit(s)`,
      message: `Voulez-vous vraiment supprimer les ${count} produits sélectionnés ? Cette action est irréversible.`,
      onConfirm: async () => {
        const idsToDelete = [...selectedIds];
        const previousProducts = products;
        setProducts((prev) => prev.filter((p) => !idsToDelete.includes(p.id)));
        setSelectedIds([]);
        try {
          const response = await apiDelete("/api/products", {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: idsToDelete })
          });
          if (!response.ok) throw new Error(`Suppression impossible (${response.status})`);
          showToast(`${count} produit(s) supprimé(s) avec succès !`);
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "stock" } }));
        } catch (err) {
          setProducts(previousProducts);
          setSelectedIds(idsToDelete);
          showToast(err instanceof Error ? err.message : "Suppression impossible", "error");
        }
      }
    });
  };

  // 0ms Optimistic UI Clear All
  const handleClearProducts = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Vider les produits",
      message: "Voulez-vous vraiment vider toute la liste des produits ? Cette action est irréversible.",
      onConfirm: async () => {
        const previousProducts = products;
        setProducts([]);
        setSelectedIds([]);
        try {
          const response = await apiDelete("/api/products/clear");
          if (!response.ok) throw new Error(`Suppression impossible (${response.status})`);
          showToast("Tous les produits ont été vidés avec succès !");
          window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "stock" } }));
        } catch (err) {
          setProducts(previousProducts);
          showToast(err instanceof Error ? err.message : "Suppression impossible", "error");
        }
      }
    });
  };

  const getQuantity = (p: any): number => {
    if (!p) return 0;
    const raw = p.quantity !== undefined && p.quantity !== null ? p.quantity :
                p.stock !== undefined && p.stock !== null ? p.stock :
                p.qty !== undefined && p.qty !== null ? p.qty :
                p.quantite !== undefined && p.quantite !== null ? p.quantite : 0;
    if (typeof raw === "number") return isNaN(raw) ? 0 : raw;
    const str = String(raw).replace(/[^\d.,-]/g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const getMinStock = (p: any): number => {
    if (!p) return 5;
    const raw = p.min_stock !== undefined && p.min_stock !== null ? p.min_stock :
                p.minimum_stock !== undefined && p.minimum_stock !== null ? p.minimum_stock :
                p.seuil_alerte !== undefined && p.seuil_alerte !== null ? p.seuil_alerte :
                (p.seuil !== undefined && p.seuil !== null ? p.seuil : 5);
    if (typeof raw === "number") return isNaN(raw) ? 5 : raw;
    const str = String(raw).replace(/[^\d.,-]/g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 5 : num;
  };

  const getPrice = (p: any): number => {
    if (!p) return 0;
    const raw = p.selling_price !== undefined && p.selling_price !== null ? p.selling_price :
                p.prix !== undefined && p.prix !== null ? p.prix :
                p.price !== undefined && p.price !== null ? p.price :
                p.prix_vente !== undefined && p.prix_vente !== null ? p.prix_vente : 0;
    if (typeof raw === "number") return isNaN(raw) ? 0 : raw;
    const str = String(raw).replace(/[^\d.,-]/g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const isTracked = (p: any): boolean => {
    if (!p) return true;
    const track = p.track_inventory !== undefined ? p.track_inventory : p.suivi;
    if (track === false || track === "false" || track === "0" || track === 0 || track === "non" || track === "No") return false;
    return true;
  };

  // Filter products by search term and selected category
  const filteredProducts = products.filter((p) => {
    const matchesText = matchesSearch(p, searchTerm);
    const pCat = p.category_name || p.categorie || "Général";
    const matchesCat = selectedCategory === "all" || pCat === selectedCategory;
    return matchesText && matchesCat;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const displayedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Multi-select handlers
  const isAllPageSelected = displayedProducts.length > 0 && displayedProducts.every((p) => selectedIds.includes(p.id));
  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      const pageIds = new Set(displayedProducts.map((p) => p.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...displayedProducts.map((p) => p.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Dynamic real-time metrics calculation
  const suivis = products.filter((p) => isTracked(p));
  const enRupture = suivis.filter((p) => getQuantity(p) === 0).length;
  const stockBas = suivis.filter((p) => getQuantity(p) > 0 && getQuantity(p) <= getMinStock(p)).length;
  const valeurTotale = suivis.reduce((s, p) => s + (getPrice(p) * getQuantity(p)), 0);

  return (
    <>
      {toast && (
        <div className="fixed top-5 right-5 z-[100] flex items-center gap-2.5 rounded-2xl bg-emerald-600 px-5 py-3.5 text-[13px] font-bold text-white shadow-2xl border border-emerald-400 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 size={16} />
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 rounded-lg p-1 hover:bg-emerald-700">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] space-y-5 text-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {t("stocks.title", "Gestion des Stocks & Produits")}
            </h1>
            <p className="text-[13px] text-slate-400">{t("stocks.subtitle", "Gérez vos produits, tarifs, alertes de seuil et inventaire en temps réel")}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
              title="Consulter l'historique des fichiers importés depuis le PC"
            >
              <History size={15} className="text-indigo-400" /> Historique
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 active:scale-95 transition-all animate-in fade-in"
              >
                <Trash2 size={15} /> Supprimer la sélection ({selectedIds.length})
              </button>
            )}
            <button
              onClick={handleClearProducts}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-[12.5px] font-semibold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
            >
              <Trash2 size={14} /> Vider
            </button>
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-slate-200 hover:bg-slate-800 active:scale-95 transition-all"
            >
              Importer
            </button>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-[12.5px] font-semibold text-indigo-300 hover:bg-indigo-500/20 active:scale-95 transition-all"
            >
              <FileScan size={15} /> Scanner Facture (+Stock)
            </button>
            <Link
              href="/stocks/nouveau"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all"
            >
              <Plus size={15} /> {t("stocks.new", "Ajouter un Produit")}
            </Link>
          </div>
        </div>

        {/* Real-time KPI Metric Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="bento-card space-y-1">
            <p className="figure text-[22px] font-extrabold text-white">{suivis.length}</p>
            <p className="text-[12px] text-slate-400">Produits suivis · {products.length} total</p>
          </div>
          <div className="bento-card space-y-1 border-l-4 border-l-red-500">
            <p className="figure text-[22px] font-extrabold text-red-400">{enRupture}</p>
            <p className="text-[12px] text-slate-400">En rupture de stock (0)</p>
          </div>
          <div className="bento-card space-y-1 border-l-4 border-l-amber-500">
            <p className="figure text-[22px] font-extrabold text-amber-400">{stockBas}</p>
            <p className="text-[12px] text-slate-400">Stock sous le seuil min</p>
          </div>
          <div className="bento-card space-y-1">
            <p className="figure text-[22px] font-extrabold text-emerald-400">{mad(valeurTotale)}</p>
            <p className="text-[12px] text-slate-400">Valeur totale du stock</p>
          </div>
        </div>

        <div className="bento-card !p-5 flex flex-col min-h-[500px]">
          {/* Controls Bar: Search + Category Filter */}
          <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t("common.search", "Rechercher par nom, SKU, catégorie...")}
                className="w-72 sm:w-80 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-[13px]">
                <Filter size={14} className="text-indigo-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-slate-200 focus:outline-none font-medium text-[12.5px] cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-white">Toutes les catégories ({products.length})</option>
                  {categories.map((cat) => {
                    const count = products.filter(p => (p.category_name || p.categorie || "Général") === cat).length;
                    return (
                      <option key={cat} value={cat} className="bg-slate-900 text-white">
                        {cat} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {selectedCategory !== "all" && (
              <button
                onClick={() => setSelectedCategory("all")}
                className="text-[12px] text-indigo-400 hover:text-indigo-300 underline font-medium"
              >
                Réinitialiser le filtre
              </button>
            )}
          </div>

          {/* Floating Bulk Action Bar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-indigo-950/80 border border-indigo-500/40 p-3 px-4 mb-4 text-[13px] shadow-lg animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <span className="flex h-6 px-2.5 items-center justify-center rounded-lg bg-indigo-600 text-[11.5px] font-bold text-white shadow-xs">
                  {selectedIds.length}
                </span>
                <span className="font-semibold text-slate-100">
                  {selectedIds.length} produit{selectedIds.length > 1 ? "s" : ""} sélectionné{selectedIds.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIds([])}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[12px] font-medium text-slate-300 hover:bg-slate-800"
                >
                  Désélectionner tout
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-red-500 shadow-md shadow-red-600/20 active:scale-95 transition-all"
                >
                  <Trash2 size={14} /> Supprimer la sélection ({selectedIds.length})
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12 flex-1 items-center">
              <Loader2 className="animate-spin text-indigo-400" size={28} />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto flex-1 pb-10 min-h-[360px]">
                <table className="w-full text-[13.5px] min-w-max border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isAllPageSelected}
                          onChange={toggleSelectAllPage}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 cursor-pointer accent-indigo-600"
                        />
                      </th>
                      <th className="py-3 px-3">{t("common.name", "Produit")}</th>
                      <th className="py-3 px-3">{t("stocks.sku", "SKU")}</th>
                      <th className="py-3 px-3">{t("common.price", "Prix Vente")}</th>
                      <th className="py-3 px-3">Unité</th>
                      <th className="py-3 px-3">{t("common.category", "Catégorie")}</th>
                      <th className="py-3 px-3">Sous-catégorie</th>
                      <th className="py-3 px-3">{t("stocks.stock_level", "Stock Actuel")}</th>
                      <th className="py-3 px-3">{t("stocks.alert_level", "Stock Min")}</th>
                      {metadataKeys.map(key => (
                        <th key={key} className="py-3 px-3 text-indigo-400">{key}</th>
                      ))}
                      <th className="py-3 px-3">{t("common.status", "Statut")}</th>
                      <th className="py-3 px-3 text-right">{t("common.actions", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {displayedProducts.length === 0 ? (
                      <tr>
                        <td colSpan={10 + metadataKeys.length} className="py-12 text-center text-slate-500">
                          Aucun produit trouvé.
                        </td>
                      </tr>
                    ) : (
                      displayedProducts.map((p, idx) => {
                        const isSelected = selectedIds.includes(p.id);
                        const qty = getQuantity(p);
                        const min = getMinStock(p);
                        const tracked = isTracked(p);

                        return (
                          <tr 
                            key={`${p.id}-${idx}`} 
                            className={`group transition-colors ${
                              isSelected ? "bg-indigo-950/30" : "hover:bg-slate-800/40"
                            }`}
                          >
                            <td className="py-3.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectOne(p.id)}
                                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 cursor-pointer accent-indigo-600"
                              />
                            </td>
                            <td className="py-3.5 px-3">
                              <Link href={`/stocks/${p.id}`} className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                                {p.name || p.nom || 'Sans nom'}
                              </Link>
                            </td>
                            <td className="figure py-3.5 px-3 font-mono text-slate-400">{p.sku || '—'}</td>
                            <td className="figure py-3.5 px-3 font-mono font-bold text-white">{mad(getPrice(p))}</td>
                            <td className="py-3.5 px-3 text-slate-400">{p.unit || p.unite || 'unité'}</td>
                            <td className="py-3.5 px-3">
                              <span className="rounded-xl bg-indigo-500/10 px-2.5 py-1 text-[11.5px] font-semibold text-indigo-300 border border-indigo-500/20">
                                {p.category_name || p.categorie || 'Général'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-slate-400 font-medium">
                              {p.sub_category || p.sous_categorie || <span className="text-slate-600">—</span>}
                            </td>
                            <td className="figure py-3.5 px-3 font-mono font-bold">
                              {tracked ? (
                                <span className={qty === 0 ? "text-red-400 font-extrabold" : qty <= min ? "text-amber-400" : "text-emerald-400"}>
                                  {qty}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="figure py-3.5 px-3 font-mono text-slate-400 font-semibold">
                              {tracked ? min : <span className="text-slate-600">—</span>}
                            </td>
                            
                            {metadataKeys.map(key => (
                              <td key={key} className="py-3.5 px-3 text-slate-400">
                                {p.metadata && p.metadata[key] ? p.metadata[key] : '-'}
                              </td>
                            ))}
                            
                            <td className="py-3.5 px-3">
                              {!tracked ? (
                                <span className="rounded-xl px-2.5 py-1 text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                  Non suivi
                                </span>
                              ) : qty === 0 ? (
                                <span className="rounded-xl px-2.5 py-1 text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1 w-fit">
                                  <AlertTriangle size={11} /> En rupture
                                </span>
                              ) : qty <= min ? (
                                <span className="rounded-xl px-2.5 py-1 text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
                                  <AlertTriangle size={11} /> Stock bas ({qty}/{min})
                                </span>
                              ) : (
                                <span className="rounded-xl px-2.5 py-1 text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit block">
                                  En stock
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-right relative">
                              <button 
                                onClick={() => setActionMenuOpen(actionMenuOpen === p.id ? null : p.id)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                              >
                                <MoreHorizontal size={16} />
                              </button>
                              {actionMenuOpen === p.id && (
                                <div className="absolute right-2 top-10 z-50 w-52 rounded-xl bg-slate-900 shadow-2xl border border-slate-800 p-1.5 text-left animate-in fade-in zoom-in-95 space-y-1">
                                  <Link 
                                    href={`/stocks/${p.id}`}
                                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-slate-200 hover:bg-slate-800 font-medium"
                                  >
                                    <Eye size={14} className="text-indigo-400" /> Voir le produit
                                  </Link>
                                  <button
                                    onClick={() => {
                                      setEditingProduct(p);
                                      setActionMenuOpen(null);
                                    }}
                                    className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 text-[12.5px] text-amber-300 hover:bg-slate-800 font-semibold"
                                  >
                                    <Pencil size={14} className="text-amber-400" /> Modifier le produit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(p.id, p.name || p.nom || p.sku)}
                                    className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 text-[12.5px] text-red-400 hover:bg-red-500/10 font-medium border-t border-slate-800 pt-1.5"
                                  >
                                    <Trash2 size={14} className="text-red-400" /> Supprimer
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-4 text-[13px] text-slate-400 flex-wrap gap-2">
                  <span>
                    Affichage {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, filteredProducts.length)} sur {filteredProducts.length} produits
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 rounded-xl border border-slate-800 px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
                    >
                      <ChevronLeft size={16} /> Précédent
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 rounded-xl border border-slate-800 px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
                    >
                      Suivant <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Edit Product Modal */}
        {editingProduct && (
          <EditProductModal 
            product={editingProduct} 
            onClose={() => setEditingProduct(null)} 
            onSuccess={() => {
              showToast("Produit modifié avec succès dans la base de données !");
              fetchProducts();
            }} 
          />
        )}

        {/* Spreadsheet Import Modal */}
        <SpreadsheetImportModal 
          isOpen={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)} 
          expectedType="stock" 
          onSuccess={fetchProducts}
        />

        {/* Scanner Stock Reception Modal */}
        <ScannerModal
          isOpen={isScannerOpen}
          onClose={() => {
            setIsScannerOpen(false);
            fetchProducts();
          }}
          targetType="reception_stock"
        />

        {/* Import History Modal */}
        <ImportHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          defaultTable="stock"
        />

        {/* Confirm Modal */}
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={confirmConfig.onConfirm}
        />
      </div>
    </>
  );
}
