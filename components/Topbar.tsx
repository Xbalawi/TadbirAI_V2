"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Bell, ChevronDown, Check, LogOut, Settings, User, Plus, FileText, Scan, FileSpreadsheet, Sparkles, Sun, Moon, Building2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import QuickInvoiceModal from "@/components/QuickInvoiceModal";
import ScannerModal from "@/components/ScannerModal";
import SpreadsheetImportModal from "@/components/SpreadsheetImportModal";
import { useLanguage, useTranslation } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/authStore";
import { useTenantStore } from "@/lib/store/tenantStore";

export default function Topbar() {
  const ref = useRef<HTMLDivElement>(null);
  const orgRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t } = useTranslation();
  const { langue, setLangue } = useLanguage();
  const { user, logout } = useAuthStore();
  const { organizations, currentOrganization, currentOrganizationId, setCurrentOrganization, fetchOrganizations, createOrganization } = useTenantStore();
  const [openDropdown, setOpenDropdown] = useState<"lang" | "bell" | "profile" | "actions" | "org" | null>(null);
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Organization modal state
  const [isNewOrgModalOpen, setIsNewOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgEmail, setNewOrgEmail] = useState("");
  const [newOrgPhone, setNewOrgPhone] = useState("");
  const [newOrgCity, setNewOrgCity] = useState("");
  const [newOrgIce, setNewOrgIce] = useState("");
  const [newOrgCurrency, setNewOrgCurrency] = useState("MAD");
  const [newOrgCountry, setNewOrgCountry] = useState("Maroc");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [createOrgError, setCreateOrgError] = useState<string | null>(null);

  // Modals state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [isStockScannerOpen, setIsStockScannerOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  useEffect(() => {
    fetchStockAlerts();
    fetchOrganizations();
    const refreshAlerts = () => fetchStockAlerts();
    window.addEventListener("dataUpdated", refreshAlerts);
    window.addEventListener("tenantChanged", refreshAlerts);
    return () => {
      window.removeEventListener("dataUpdated", refreshAlerts);
      window.removeEventListener("tenantChanged", refreshAlerts);
    };
  }, []);

  const fetchStockAlerts = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const organizationId = typeof window !== "undefined" ? localStorage.getItem("active_organization_id") : null;
      const headers: Record<string, string> = {};
      if (token && token !== "demo_access_token" && token !== "session_token") {
        headers.Authorization = `Bearer ${token}`;
      }
      if (organizationId) headers["x-organization-id"] = organizationId;
      const res = await fetch("/api/products", { headers, cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        let data: any = [];
        try {
          data = text ? JSON.parse(text) : [];
        } catch (e) {
          console.warn("Invalid stock alerts response format", e);
          return;
        }
        const list = Array.isArray(data) ? data : data.results || [];
        
        // Filter track_inventory and quantity < 10 for stock alerts
        const alerts = list
          .filter((p: any) => p.track_inventory && (p.quantity ?? 0) < 10)
          .map((p: any) => ({
            id: p.id,
            title: p.quantity === 0 ? `Rupture : ${p.name}` : `Stock bas : ${p.name}`,
            description: p.quantity === 0 
              ? `Ce produit est complètement épuisé dans vos stocks.` 
              : `Il ne reste que ${p.quantity} unité(s) en stock (Alerte critique).`,
            time: "Alerte de stock",
            type: "danger",
            unread: true
          }));
          
        // Add a friendly system default notification if no alerts exist
        if (alerts.length === 0) {
          alerts.push({
            id: "system-ok",
            title: "Système Prêt",
            description: "Votre application Tadbir AI est opérationnelle.",
            time: "Info",
            type: "info",
            unread: false
          });
        }
        
        setNotifications(alerts);
        setUnreadCount(alerts.filter((n: any) => n.unread).length);
      }
    } catch (err) {
      console.error("Error fetching stock alerts", err);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (ref.current && ref.current.contains(target)) return;
      if (orgRef.current && orgRef.current.contains(target)) return;
      setOpenDropdown(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-2xl px-6 py-3.5 z-40 relative">
        {/* Command Search Bar */}
        <div className="flex flex-1 items-center max-w-md">
          <div className="relative w-full group">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search size={14} className="text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full rounded-xl border border-slate-800/80 bg-slate-900/90 py-2 pl-9 pr-3 text-[12.5px] text-slate-100 placeholder:text-slate-500 transition-all focus:border-indigo-500/80 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
              placeholder={t("topbar.search_placeholder", "Rechercher facture, client, devis, commande... (⌘K)")}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 font-mono">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>

        {/* Organization Switcher Dropdown */}
        <div ref={orgRef} className="relative">
          <button
            type="button"
            onClick={() => setOpenDropdown(openDropdown === "org" ? null : "org")}
            className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/90 px-3 py-2 text-[12px] font-semibold text-slate-200 hover:bg-slate-800 hover:text-white hover:border-indigo-500/40 transition-all active:scale-95 shadow-inner"
            title={t("topbar.switch_org", "Changer d'entreprise")}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
              <Building2 size={12} />
            </div>
            <span className="max-w-[130px] truncate text-slate-100 font-bold">
              {currentOrganization?.name || "Tadbir AI Demo"}
            </span>
            <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${openDropdown === "org" ? "rotate-180" : ""}`} />
          </button>

          {openDropdown === "org" && (
            <div className="absolute left-0 mt-2 w-64 rounded-2xl border border-slate-800 bg-slate-900 p-1.5 shadow-2xl animate-in fade-in zoom-in-95 z-50 space-y-1">
              <div className="px-3 py-2 border-b border-slate-800/80">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {t("topbar.my_organizations", "Mes Entreprises")}
                </p>
              </div>

              <div className="max-h-[200px] overflow-y-auto space-y-0.5 py-1">
                {organizations.map((org) => {
                  const isActive = org.id === currentOrganizationId;
                  return (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => {
                        setCurrentOrganization(org.id);
                        setOpenDropdown(null);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-[12px] font-medium transition-colors ${
                        isActive
                          ? "bg-indigo-600/20 text-indigo-300 font-bold border border-indigo-500/30"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 text-left">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${isActive ? "bg-emerald-400" : "bg-slate-600"}`} />
                        <span className="truncate">{org.name}</span>
                      </div>
                      {isActive && <Check size={14} className="text-indigo-400 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-1 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setOpenDropdown(null);
                    setCreateOrgError(null);
                    setIsNewOrgModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                >
                  <Plus size={14} />
                  <span>{t("topbar.new_organization", "Nouvelle Entreprise")}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* System Status Badge */}
        <div className="hidden lg:flex items-center gap-2.5 rounded-full bg-slate-900/80 px-3.5 py-1.5 border border-slate-800/80 text-[11.5px] font-medium text-slate-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-slate-200 font-semibold">{t("topbar.system_active", "Système Actif")}</span>
          <span className="text-slate-600">•</span>
          <span className="font-mono text-emerald-400 font-bold">{t("topbar.online", "En ligne")}</span>
        </div>

        {/* Right Section */}
        <div ref={ref} className="flex shrink-0 items-center gap-2.5 relative">
          
          {/* Language Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === "lang" ? null : "lang")}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-2 text-[12px] font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all active:scale-95 shadow-xs"
              title="Changer la langue / Change language"
            >
              <span className="text-[14px]">
                {langue === "fr" ? "🇫🇷" : langue === "en" ? "🇬🇧" : "🇲🇦"}
              </span>
              <span className="uppercase font-extrabold text-indigo-400 tracking-wider text-[11px]">{langue}</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {openDropdown === "lang" && (
              <div className="absolute right-0 mt-2 w-40 rounded-2xl border border-slate-800 bg-slate-900 p-1.5 shadow-2xl animate-in fade-in zoom-in-95 z-50 space-y-1">
                <button
                  onClick={() => { setLangue("fr"); setOpenDropdown(null); }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-[12.5px] font-medium transition-colors ${
                    langue === "fr" ? "bg-indigo-600/20 text-indigo-400 font-bold border border-indigo-500/30" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-2"><span>🇫🇷</span> Français</span>
                  {langue === "fr" && <Check size={14} className="text-indigo-400" />}
                </button>
                <button
                  onClick={() => { setLangue("en"); setOpenDropdown(null); }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-[12.5px] font-medium transition-colors ${
                    langue === "en" ? "bg-indigo-600/20 text-indigo-400 font-bold border border-indigo-500/30" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-2"><span>🇬🇧</span> English</span>
                  {langue === "en" && <Check size={14} className="text-indigo-400" />}
                </button>
                <button
                  onClick={() => { setLangue("ar"); setOpenDropdown(null); }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-[12.5px] font-medium transition-colors ${
                    langue === "ar" ? "bg-indigo-600/20 text-indigo-400 font-bold border border-indigo-500/30" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-2"><span>🇲🇦</span> العربية</span>
                  {langue === "ar" && <Check size={14} className="text-indigo-400" />}
                </button>
              </div>
            )}
          </div>
          
          {/* Global Quick Action Hub Button */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === "actions" ? null : "actions")}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-violet-500 active:scale-95 transition-all ring-1 ring-white/20"
            >
              <Plus size={15} />
              <span>{t("topbar.new", "Nouveau")}</span>
              <ChevronDown size={13} className={`transition-transform duration-200 ${openDropdown === "actions" ? "rotate-180" : ""}`} />
            </button>

            {openDropdown === "actions" && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-800 bg-slate-900 p-1.5 shadow-2xl animate-in fade-in zoom-in-95 z-50 space-y-1">
                <button
                  onClick={() => {
                    setOpenDropdown(null);
                    setIsInvoiceModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
                    <FileText size={15} />
                  </div>
                  {t("topbar.quick_invoice", "Facture Rapide")}
                </button>
                <button
                  onClick={() => {
                    setOpenDropdown(null);
                    setIsStockScannerOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-purple-300 hover:bg-slate-800 transition-colors"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30">
                    <Scan size={15} />
                  </div>
                  {t("topbar.scan_invoice", "Scanner Facture (+Stock)")}
                </button>
                <button
                  onClick={() => {
                    setOpenDropdown(null);
                    setIsExcelModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-emerald-300 hover:bg-slate-800 transition-colors"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
                    <FileSpreadsheet size={15} />
                  </div>
                  {t("topbar.import_excel", "Importer Excel / CSV")}
                </button>
                <button
                  onClick={() => {
                    setOpenDropdown(null);
                    setIsNewOrgModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-indigo-300 hover:bg-slate-800 transition-colors border-t border-slate-800/80 pt-2 mt-1"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
                    <Building2 size={15} />
                  </div>
                  {t("topbar.new_enterprise", "Nouvelle Entreprise")}
                </button>
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setOpenDropdown(openDropdown === "bell" ? null : "bell")}
              className="relative rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-all active:scale-95 shadow-xs"
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-slate-950 animate-pulse" />
              )}
            </button>
            
            {openDropdown === "bell" && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 z-50 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                  <h3 className="font-bold text-white text-[13px]">{t("topbar.alerts", "Alertes & Notifications")}</h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={() => {
                        setNotifications(notifications.map(n => ({ ...n, unread: false })));
                        setUnreadCount(0);
                      }}
                      className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
                    >
                      {t("topbar.mark_all_read", "Tout marquer lu")}
                    </button>
                  )}
                </div>
                <div className="max-h-[300px] overflow-y-auto p-2 divide-y divide-slate-800/60">
                  {notifications.length === 0 ? (
                    <p className="text-[12px] text-slate-500 text-center py-6">{t("topbar.no_alerts", "Aucune alerte active.")}</p>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.id} 
                        onClick={() => {
                          setNotifications(notifications.map(item => item.id === n.id ? { ...item, unread: false } : item));
                          setUnreadCount(prev => Math.max(0, prev - (n.unread ? 1 : 0)));
                        }}
                        className={`flex gap-3 p-2.5 hover:bg-slate-800/60 rounded-xl cursor-pointer transition-colors ${!n.unread ? 'opacity-60' : ''}`}
                      >
                        {n.unread && (
                          <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        )}
                        <div>
                          <p className="text-[12.5px] text-white font-semibold">{n.title}</p>
                          <p className="text-[11.5px] text-slate-400 mt-0.5 leading-relaxed">{n.description}</p>
                          <p className="text-[10px] text-indigo-400 mt-1 font-bold">{n.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button 
              onClick={() => setOpenDropdown(openDropdown === "profile" ? null : "profile")}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-1 pr-2.5 hover:bg-slate-800 shadow-xs active:scale-95 transition-all"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-[11px] font-bold text-white shadow-xs">
                {user?.nom ? user.nom.slice(0, 2).toUpperCase() : "TA"}
              </div>
              <span className="hidden text-[12.5px] font-semibold text-slate-200 md:block max-w-[130px] truncate">
                {user?.nom || "Tadbir AI User"}
              </span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
            
            {openDropdown === "profile" && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-800 bg-slate-900 p-1.5 shadow-2xl animate-in fade-in zoom-in-95 z-50">
                <div className="px-3 py-2 border-b border-slate-800 mb-1">
                  <p className="text-[13px] font-bold text-white truncate">{user?.nom || "Tadbir AI User"}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email || "utilisateur@entreprise.ma"}</p>
                  <span className="mt-1 inline-block rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-extrabold text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                    {user?.role || "Lecteur"}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setOpenDropdown(null);
                    router.push("/profil");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <User size={15} className="text-indigo-400" /> {t("topbar.my_profile", "Mon Profil & Sécurité")}
                </button>
                {user?.role === "Administrateur" && (
                  <button
                    onClick={() => {
                      setOpenDropdown(null);
                      router.push("/parametres");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Settings size={15} /> {t("topbar.settings", "Paramètres Global")}
                  </button>
                )}
                <div className="my-1 border-t border-slate-800" />
                <button
                  onClick={() => {
                    setOpenDropdown(null);
                    logout();
                    router.push("/login");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={15} /> {t("topbar.logout", "Déconnexion")}
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Global Modals triggered from Topbar */}
      <QuickInvoiceModal isOpen={isInvoiceModalOpen} onClose={() => setIsInvoiceModalOpen(false)} />
      <ScannerModal isOpen={isScannerModalOpen} onClose={() => setIsScannerModalOpen(false)} targetType="factures" />
      <ScannerModal isOpen={isStockScannerOpen} onClose={() => setIsStockScannerOpen(false)} targetType="reception_stock" />
      <SpreadsheetImportModal isOpen={isExcelModalOpen} onClose={() => setIsExcelModalOpen(false)} />

      {/* New Organization Modal */}
      {isNewOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-white">Ajouter une entreprise</h3>
                  <p className="text-[11.5px] text-slate-400">Créer une nouvelle entité isolée</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewOrgModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-slate-300 mb-1">Nom de l'entreprise *</label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="ex: Atlas Filiale Tanger"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-slate-300 mb-1">Email professionnel</label>
                <input
                  type="email"
                  value={newOrgEmail}
                  onChange={(e) => setNewOrgEmail(e.target.value)}
                  placeholder="contact@filiale.ma"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-slate-300 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={newOrgPhone}
                    onChange={(e) => setNewOrgPhone(e.target.value)}
                    placeholder="+212 5 22 00 00 00"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-300 mb-1">Ville</label>
                  <input
                    type="text"
                    value={newOrgCity}
                    onChange={(e) => setNewOrgCity(e.target.value)}
                    placeholder="Casablanca"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-slate-300 mb-1">ICE (Identifiant Commun de l'Entreprise)</label>
                <input
                  type="text"
                  value={newOrgIce}
                  onChange={(e) => setNewOrgIce(e.target.value)}
                  placeholder="000000000000000"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-slate-300 mb-1">Devise</label>
                  <select
                    value={newOrgCurrency}
                    onChange={(e) => setNewOrgCurrency(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="MAD">MAD (Dirham)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="USD">USD (Dollar)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-300 mb-1">Pays</label>
                  <select
                    value={newOrgCountry}
                    onChange={(e) => setNewOrgCountry(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Maroc">Maroc</option>
                    <option value="France">France</option>
                    <option value="Belgique">Belgique</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>
              {createOrgError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
                  {createOrgError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsNewOrgModalOpen(false);
                  setCreateOrgError(null);
                  setNewOrgName("");
                  setNewOrgEmail("");
                  setNewOrgPhone("");
                  setNewOrgCity("");
                  setNewOrgIce("");
                }}
                className="rounded-xl px-4 py-2 text-[12.5px] font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isCreatingOrg || !newOrgName.trim()}
                onClick={async () => {
                  if (!newOrgName.trim()) return;
                  setIsCreatingOrg(true);
                  setCreateOrgError(null);
                  try {
                    const created = await createOrganization({
                      name: newOrgName.trim(),
                      email: newOrgEmail.trim() || undefined,
                      phone: newOrgPhone.trim() || undefined,
                      city: newOrgCity.trim() || undefined,
                      ice: newOrgIce.trim() || undefined,
                      currency: newOrgCurrency,
                      country: newOrgCountry,
                    });
                    if (created) {
                      setIsNewOrgModalOpen(false);
                      setNewOrgName("");
                      setNewOrgEmail("");
                      setNewOrgPhone("");
                      setNewOrgCity("");
                      setNewOrgIce("");
                      setCreateOrgError(null);
                    }
                  } catch (err: any) {
                    setCreateOrgError(err?.message || "Erreur lors de la création de l'entreprise");
                  } finally {
                    setIsCreatingOrg(false);
                  }
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20"
              >
                {isCreatingOrg ? "Création..." : "Créer l'entreprise"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
