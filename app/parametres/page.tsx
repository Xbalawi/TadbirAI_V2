"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Settings, 
  Bell, 
  ShieldCheck, 
  Globe, 
  Palette, 
  Key, 
  Smartphone, 
  Building2, 
  Users2, 
  CreditCard, 
  CheckCircle2, 
  ChevronRight, 
  Lock, 
  Mail, 
  Sliders,
  Moon,
  Sun,
  Laptop
} from "lucide-react";
import { useLanguage, useTranslation, Language } from "@/lib/i18n";

export default function ParametresPage() {
  const { langue, setLangue } = useLanguage();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"general" | "notifications" | "security" | "integrations">("general");

  // General state
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [formatDate, setFormatDate] = useState("DD/MM/YYYY");
  const [devise, setDevise] = useState("MAD");

  // Notifications state
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [stockAlerts, setStockAlerts] = useState(true);

  // Security state
  const [twoFactor, setTwoFactor] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("30");

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load saved preferences on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = (localStorage.getItem("theme") as "dark" | "light" | "system") || "dark";
      setTheme(savedTheme);
      applyThemeClass(savedTheme);
    }
    
    // Fetch global enterprise settings from backend
    fetch("/api/settings")
      .then(async (res) => {
        if (!res.ok) return null;
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      })
      .then((data) => {
        if (!data) return;
        if (data.formatDate) setFormatDate(data.formatDate);
        if (data.devise) setDevise(data.devise);
        if (data.emailAlerts !== undefined) setEmailAlerts(data.emailAlerts);
        if (data.whatsappAlerts !== undefined) setWhatsappAlerts(data.whatsappAlerts);
        if (data.weeklyReport !== undefined) setWeeklyReport(data.weeklyReport);
        if (data.stockAlerts !== undefined) setStockAlerts(data.stockAlerts);
        if (data.twoFactor !== undefined) setTwoFactor(data.twoFactor);
        if (data.sessionTimeout !== undefined) setSessionTimeout(data.sessionTimeout);
      })
      .catch((err) => console.warn("Erreur de chargement des paramètres", err));
  }, []);

  const applyThemeClass = (newTheme: "dark" | "light" | "system") => {
    if (typeof document === "undefined") return;
    if (newTheme === "light") {
      document.documentElement.classList.add("light-mode");
    } else if (newTheme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches) {
      document.documentElement.classList.add("light-mode");
    } else {
      document.documentElement.classList.remove("light-mode");
    }
  };

  const handleThemeChange = (newTheme: "dark" | "light" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyThemeClass(newTheme);
  };

  const handleLangueChange = (newLang: Language) => {
    setLangue(newLang);
  };

  const handleSave = async () => {
    if (typeof window !== "undefined") {
      // Local display preferences
      localStorage.setItem("theme", theme);
      localStorage.setItem("langue", langue);
    }

    try {
      // Global enterprise settings
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formatDate,
          devise,
          emailAlerts,
          whatsappAlerts,
          weeklyReport,
          stockAlerts,
          twoFactor,
          sessionTimeout
        })
      });

      if (typeof window !== "undefined") {
        // Dispatch global update events so all components, tables, and views reflect changes live
        window.dispatchEvent(new CustomEvent("settingsUpdated"));
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "settings" } }));
      }

      setToastMessage(t("settings.saved_toast", "Paramètres enregistrés et appliqués à toute l'application !"));
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error(err);
      setToastMessage("Erreur lors de l'enregistrement des paramètres.");
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl bg-emerald-600 px-4 py-3 text-[13px] font-bold text-white shadow-2xl shadow-emerald-950/50 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Settings size={24} className="text-indigo-400" /> {t("settings.title", "Paramètres Globaux")}
          </h1>
          <p className="text-[13px] text-slate-400">
            {t("settings.subtitle", "Personnalisez vos préférences d'application, sécurité et notifications")}
          </p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all self-start sm:self-auto"
        >
          {t("settings.save", "Enregistrer les modifications")}
        </button>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Navigation Sidebar */}
        <div className="space-y-1 md:col-span-1">
          <button
            onClick={() => setActiveTab("general")}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-semibold transition-all ${
              activeTab === "general"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800/80"
            }`}
          >
            <Sliders size={16} /> {t("settings.tab.general", "Général & Apparence")}
          </button>
          
          <button
            onClick={() => setActiveTab("notifications")}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-semibold transition-all ${
              activeTab === "notifications"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800/80"
            }`}
          >
            <Bell size={16} /> {t("settings.tab.notifications", "Notifications & Alertes")}
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-semibold transition-all ${
              activeTab === "security"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800/80"
            }`}
          >
            <ShieldCheck size={16} /> {t("settings.tab.security", "Sécurité & Accès")}
          </button>

          <button
            onClick={() => setActiveTab("integrations")}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] font-semibold transition-all ${
              activeTab === "integrations"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800/80"
            }`}
          >
            <Key size={16} /> {t("settings.tab.integrations", "Raccourcis & Modules")}
          </button>

          {/* Quick Hub Links */}
          <div className="pt-4 space-y-2 border-t border-slate-800 mt-4">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t("settings.dedicated_modules", "Modules Dédiés")}</p>
            
            <Link
              href="/entreprise"
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[12px] font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-all"
            >
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-indigo-400" />
                <span>{t("nav.entreprise", "Mon Entreprise")}</span>
              </div>
              <ChevronRight size={14} className="text-slate-500" />
            </Link>

            <Link
              href="/equipe"
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[12px] font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-all"
            >
              <div className="flex items-center gap-2">
                <Users2 size={14} className="text-indigo-400" />
                <span>{t("nav.equipe", "Équipe & Rôles")}</span>
              </div>
              <ChevronRight size={14} className="text-slate-500" />
            </Link>

            <Link
              href="/whatsapp"
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[12px] font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-all"
            >
              <div className="flex items-center gap-2">
                <Smartphone size={14} className="text-emerald-400" />
                <span>{t("nav.whatsapp", "WhatsApp API")}</span>
              </div>
              <ChevronRight size={14} className="text-slate-500" />
            </Link>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 space-y-6">

          {/* TAB 1: GENERAL */}
          {activeTab === "general" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Apparence */}
              <div className="bento-card p-5 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Palette size={16} className="text-indigo-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide">{t("settings.theme_title", "Thème & Apparence")}</h2>
                </div>

                <div>
                  <label className="text-[12.5px] font-semibold text-slate-300 block mb-2">{t("settings.theme_mode", "Mode d'affichage (Thème)")}</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => handleThemeChange("dark")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-[12.5px] font-semibold transition-all ${
                        theme === "dark"
                          ? "border-indigo-500 bg-indigo-500/20 text-indigo-300 ring-2 ring-indigo-500/50"
                          : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <Moon size={15} /> {t("settings.theme_dark", "Mode Sombre")}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleThemeChange("light")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-[12.5px] font-semibold transition-all ${
                        theme === "light"
                          ? "border-indigo-500 bg-indigo-500/20 text-indigo-300 ring-2 ring-indigo-500/50"
                          : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <Sun size={15} /> {t("settings.theme_light", "Mode Clair")}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleThemeChange("system")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-[12.5px] font-semibold transition-all ${
                        theme === "system"
                          ? "border-indigo-500 bg-indigo-500/20 text-indigo-300 ring-2 ring-indigo-500/50"
                          : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <Laptop size={15} /> {t("settings.theme_system", "Système")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Localisation */}
              <div className="bento-card p-5 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Globe size={16} className="text-indigo-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide">{t("settings.region_title", "Langue & Région")}</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12.5px] font-semibold text-slate-300 block mb-1.5">{t("settings.lang_label", "Langue de l'interface")}</label>
                    <select
                      value={langue}
                      onChange={(e) => handleLangueChange(e.target.value as Language)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="fr">Français (Maroc)</option>
                      <option value="ar">العربية (Arabe)</option>
                      <option value="en">English (International)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[12.5px] font-semibold text-slate-300 block mb-1.5">{t("settings.currency_label", "Devise par défaut")}</label>
                    <select
                      value={devise}
                      onChange={(e) => setDevise(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="MAD">MAD (Dirham Marocain)</option>
                      <option value="EUR">EUR (€ Euro)</option>
                      <option value="USD">USD ($ Dollar US)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[12.5px] font-semibold text-slate-300 block mb-1.5">{t("settings.date_format_label", "Format de Date")}</label>
                    <select
                      value={formatDate}
                      onChange={(e) => setFormatDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="DD/MM/YYYY">JJ/MM/AAAA (ex: 22/08/2026)</option>
                      <option value="YYYY-MM-DD">AAAA-MM-JJ (ex: 2026-08-22)</option>
                      <option value="MM/DD/YYYY">MM/JJ/AAAA (ex: 08/22/2026)</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bento-card p-5 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Bell size={16} className="text-indigo-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide">{t("settings.notif_title", "Préférences d'Alertes")}</h2>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer">
                    <div>
                      <p className="text-[13px] font-bold text-white">{t("settings.email_alerts", "Alertes de Stock Bas par E-mail")}</p>
                      <p className="text-[11.5px] text-slate-400">{t("settings.email_alerts_desc", "Recevez un e-mail dès qu'un produit passe en dessous du seuil critique.")}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      className="h-4 w-8 accent-indigo-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer">
                    <div>
                      <p className="text-[13px] font-bold text-white">{t("settings.whatsapp_alerts", "Relances Factures via WhatsApp")}</p>
                      <p className="text-[11.5px] text-slate-400">{t("settings.whatsapp_alerts_desc", "Activer l'envoi de rappels automatiques aux clients ayant des factures en retard.")}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={whatsappAlerts}
                      onChange={(e) => setWhatsappAlerts(e.target.checked)}
                      className="h-4 w-8 accent-emerald-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer">
                    <div>
                      <p className="text-[13px] font-bold text-white">{t("settings.weekly_report", "Rapport Financier Hebdomadaire")}</p>
                      <p className="text-[11.5px] text-slate-400">{t("settings.weekly_report_desc", "Résumé chaque lundi matin avec le chiffre d'affaires et la trésorerie.")}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={weeklyReport}
                      onChange={(e) => setWeeklyReport(e.target.checked)}
                      className="h-4 w-8 accent-indigo-600 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer">
                    <div>
                      <p className="text-[13px] font-bold text-white">{t("settings.browser_notif", "Notifications dans le Navigateur")}</p>
                      <p className="text-[11.5px] text-slate-400">{t("settings.browser_notif_desc", "Affiche une pastille rouge en haut à droite lors d'une nouvelle notification.")}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={stockAlerts}
                      onChange={(e) => setStockAlerts(e.target.checked)}
                      className="h-4 w-8 accent-indigo-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY */}
          {activeTab === "security" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bento-card p-5 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <ShieldCheck size={16} className="text-indigo-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide">{t("settings.security_title", "Sécurité de Compte")}</h2>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                    <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
                      <Lock size={15} className="text-indigo-400" /> {t("settings.change_password", "Modifier le mot de passe")}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="password"
                        placeholder={t("settings.current_password", "Mot de passe actuel")}
                        className="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-[12.5px] text-white focus:border-indigo-500 focus:outline-none"
                      />
                      <input
                        type="password"
                        placeholder={t("settings.new_password", "Nouveau mot de passe")}
                        className="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-[12.5px] text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer">
                    <div>
                      <p className="text-[13px] font-bold text-white">{t("settings.two_factor", "Authentification à deux facteurs (2FA)")}</p>
                      <p className="text-[11.5px] text-slate-400">{t("settings.two_factor_desc", "Exiger un code de vérification SMS/Application lors de la connexion.")}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={twoFactor}
                      onChange={(e) => setTwoFactor(e.target.checked)}
                      className="h-4 w-8 accent-indigo-600 rounded cursor-pointer"
                    />
                  </label>

                  <div>
                    <label className="text-[12.5px] font-semibold text-slate-300 block mb-1.5">{t("settings.session_timeout", "Expiration automatique de la session")}</label>
                    <select
                      value={sessionTimeout}
                      onChange={(e) => setSessionTimeout(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="15">Après 15 minutes d'inactivité</option>
                      <option value="30">Après 30 minutes d'inactivité</option>
                      <option value="60">Après 1 heure d'inactivité</option>
                      <option value="never">Jamais (Restant connecté)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: INTEGRATIONS & SHORTCUTS */}
          {activeTab === "integrations" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bento-card p-5 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Key size={16} className="text-indigo-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide">{t("settings.modules_title", "Accès & Intégrations Spécialisées")}</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Link
                    href="/entreprise"
                    className="p-4 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800/80 transition-all block group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 size={18} className="text-indigo-400" />
                        <span className="font-bold text-white text-[13.5px]">{t("settings.company_card", "Fiche Entreprise & Fiscalité")}</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11.5px] text-slate-400">{t("settings.company_card_desc", "Gérez le nom, adresse, ICE, IF, RIB et paramètres d'impression des factures.")}</p>
                  </Link>

                  <Link
                    href="/whatsapp"
                    className="p-4 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800/80 transition-all block group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Smartphone size={18} className="text-emerald-400" />
                        <span className="font-bold text-white text-[13.5px]">{t("settings.whatsapp_card", "WhatsApp & Twilio API")}</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11.5px] text-slate-400">{t("settings.whatsapp_card_desc", "Configurez les comptes Twilio, les numéros d'envoi et les modèles de messages.")}</p>
                  </Link>

                  <Link
                    href="/equipe"
                    className="p-4 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800/80 transition-all block group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Users2 size={18} className="text-indigo-400" />
                        <span className="font-bold text-white text-[13.5px]">{t("settings.team_card", "Utilisateurs & Permissions")}</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11.5px] text-slate-400">{t("settings.team_card_desc", "Invitez vos collaborateurs et définissez les accès (Comptable, Commercial...)")}</p>
                  </Link>

                  <Link
                    href="/abonnement"
                    className="p-4 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800/80 transition-all block group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CreditCard size={18} className="text-amber-400" />
                        <span className="font-bold text-white text-[13.5px]">{t("settings.subscription_card", "Abonnement & Licence")}</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11.5px] text-slate-400">{t("settings.subscription_card_desc", "Supervisez votre plan actuel, consultez vos factures d'abonnement Tadbir AI.")}</p>
                  </Link>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
