"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ImagePlus,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  Mail,
  Smartphone,
  Save,
  Loader2,
  Building2,
  Plus,
  Check,
  ArrowRightLeft,
  ShieldCheck,
  Globe,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useTenantStore, Organization } from "@/lib/store/tenantStore";

const fiscalFieldsByCountry: Record<string, { label: string; placeholder: string; key: string }[]> = {
  Maroc: [
    { label: "Identifiant Fiscal (IF)", placeholder: "IF87654321", key: "identifiant_fiscal" },
    { label: "ICE", placeholder: "002345678000091", key: "ice" },
    { label: "Registre de Commerce (RC)", placeholder: "RC XXXXX", key: "registre_commerce" },
  ],
  France: [
    { label: "SIREN", placeholder: "XXX XXX XXX", key: "siren" },
    { label: "SIRET", placeholder: "XXX XXX XXX XXXXX", key: "siret" },
    { label: "Numéro RCS", placeholder: "RCS Ville XXXXXXXXX", key: "rcs" },
    { label: "N° TVA intracommunautaire", placeholder: "FR XX XXX XXX XXX", key: "tva_intra" },
  ],
};

export default function EntreprisePage() {
  const { t } = useTranslation();
  const {
    organizations,
    currentOrganization,
    currentOrganizationId,
    setCurrentOrganization,
    fetchOrganizations,
    createOrganization,
  } = useTenantStore();

  const [activeTab, setActiveTab] = useState<"settings" | "organizations">("settings");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // New company modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalName, setModalName] = useState("");
  const [modalEmail, setModalEmail] = useState("");
  const [modalCurrency, setModalCurrency] = useState("MAD");
  const [modalCountry, setModalCountry] = useState("Maroc");
  const [modalIce, setModalIce] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // All company fields — synced to DB
  const [settings, setSettings] = useState({
    nom: "",
    adresse: "",
    telephone: "",
    email: "",
    site_web: "",
    secteur: "Technologie & Services",
    pays: "Maroc",
    devise: "MAD",
    tva_rate: "20",
    afficher_tva: true,
    montant_lettres: true,
    // Fiscal
    identifiant_fiscal: "",
    ice: "",
    registre_commerce: "",
    siren: "",
    siret: "",
    rcs: "",
    tva_intra: "",
    // Bank
    rib: "",
    iban: "",
    swift: "",
    bank_name: "",
    bank_address: "",
    capital_social: "",
    cnss: "",
    footer_text: "",
    // SMTP
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    // Twilio
    twilio_account_sid: "",
    twilio_auth_token: "",
    twilio_phone_number: "",
  });

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Load settings from DB on mount or when active company changes
  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/company-settings?org=${encodeURIComponent(currentOrganizationId || '')}&t=${Date.now()}`, {
      headers: { 'x-organization-id': currentOrganizationId || '' }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === "object" && !data.error) {
          setSettings((prev) => ({
            ...prev,
            ...data,
            nom: data.nom || currentOrganization?.name || prev.nom,
            pays: data.pays || currentOrganization?.country || prev.pays,
            devise: data.devise || currentOrganization?.currency || prev.devise,
            email: data.email || currentOrganization?.email || prev.email,
          }));
        }
      })
      .catch((err) => console.error("Failed to load company settings:", err))
      .finally(() => setIsLoading(false));
  }, [currentOrganizationId, currentOrganization]);

  const update = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/company-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": currentOrganizationId || "",
        },
        body: JSON.stringify({
          ...settings,
          organization_id: currentOrganizationId,
        }),
      });
      const responseData = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = responseData?.detail || responseData?.error;
        throw new Error(detail || `Enregistrement impossible (${res.status})`);
      }

      if (typeof window !== "undefined") {
        if (settings.devise) localStorage.setItem("devise", settings.devise);
        if (settings.pays) localStorage.setItem("pays", settings.pays);
        window.dispatchEvent(
          new CustomEvent("settingsUpdated", {
            detail: { devise: settings.devise, pays: settings.pays, nom: settings.nom }
          })
        );
        window.dispatchEvent(
          new CustomEvent("tenantChanged", {
            detail: { organizationId: currentOrganizationId }
          })
        );
      }

      await fetchOrganizations();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Save failed:", err);
      setFormError(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalName.trim()) return;
    setIsCreating(true);
    setFormError(null);
    try {
      const created = await createOrganization({
        name: modalName.trim(),
        email: modalEmail.trim() || undefined,
        currency: modalCurrency,
        country: modalCountry,
        ice: modalIce.trim() || undefined,
      });
      if (!created) throw new Error("La société n'a pas pu être créée");
      setIsModalOpen(false);
      setModalName("");
      setModalEmail("");
      setModalIce("");

      // Update form immediately with new company values
      setSettings((prev) => ({
        ...prev,
        nom: created.name,
        email: created.email || prev.email,
        devise: created.currency || "MAD",
        pays: created.country || "Maroc",
        ice: created.ice || "",
      }));

      if (typeof window !== "undefined") {
        if (created.currency) localStorage.setItem("devise", created.currency);
        if (created.country) localStorage.setItem("pays", created.country);
        window.dispatchEvent(
          new CustomEvent("settingsUpdated", {
            detail: { devise: created.currency, pays: created.country, nom: created.name }
          })
        );
      }
    } catch (err) {
      console.error("Error creating company:", err);
      setFormError(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setIsCreating(false);
    }
  };

  const fiscalFields = fiscalFieldsByCountry[settings.pays] ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      {formError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {formError}
        </div>
      )}
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[24px] font-semibold text-white flex items-center gap-2.5">
            <Building2 className="text-indigo-400" size={24} />
            {t("company.title", "Fiche Entreprise & Multi-Entités")}
          </h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            {t("company.subtitle", "Gérez les paramètres fiscaux et le portefeuille de vos sociétés")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex items-center rounded-xl bg-slate-900/90 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-all ${
                activeTab === "settings"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Société Active</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("organizations")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-all ${
                activeTab === "organizations"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Toutes les Entreprises</span>
              <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.2 text-[10.5px] text-indigo-300 font-mono">
                {organizations.length}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-[12.5px] font-bold text-white hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
          >
            <Plus size={15} />
            <span>Ajouter une entreprise</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ALL ORGANIZATIONS (MULTI-TENANT MANAGEMENT) */}
      {activeTab === "organizations" && (
        <div className="space-y-5 animate-in fade-in">
          {/* Summary Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="ledger-card p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
                <Building2 size={20} />
              </div>
              <div>
                <p className="text-[11.5px] text-slate-400 font-medium">Total Sociétés</p>
                <p className="text-[20px] font-bold text-white font-mono">{organizations.length}</p>
              </div>
            </div>

            <div className="ledger-card p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
                <Globe size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[11.5px] text-slate-400 font-medium">Société Actuelle</p>
                <p className="text-[14px] font-bold text-white truncate">
                  {currentOrganization?.name || "Tadbir AI Demo"}
                </p>
              </div>
            </div>

            <div className="ledger-card p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-[11.5px] text-slate-400 font-medium">Isolation Données</p>
                <p className="text-[13px] font-bold text-purple-300">Multi-Tenant Actif</p>
              </div>
            </div>
          </div>

          {/* Organizations Table Container */}
          <div className="ledger-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-[16px] font-bold text-white">Portefeuille d'entreprises</h2>
                <p className="text-[12px] text-slate-400">
                  Basculez d'une entité à l'autre pour isoler factures, clients, stocks et comptabilité
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
              >
                <Plus size={15} /> Nouvelle Entreprise
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-400">
                    <th className="py-3 px-3 font-semibold">Entreprise</th>
                    <th className="py-3 px-3 font-semibold">Pays / Devise</th>
                    <th className="py-3 px-3 font-semibold">ICE / Identifiant</th>
                    <th className="py-3 px-3 font-semibold">Statut</th>
                    <th className="py-3 px-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {organizations.map((org) => {
                    const isActive = org.id === currentOrganizationId;
                    return (
                      <tr
                        key={org.id}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isActive ? "bg-indigo-600/5" : ""
                        }`}
                      >
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                isActive
                                  ? "bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              <Building2 size={16} />
                            </div>
                            <div>
                              <p className="font-bold text-white">{org.name}</p>
                              <p className="text-[11px] text-slate-400">{org.email || "Aucun email configuré"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="text-slate-300">{org.country || "Maroc"}</span>
                          <span className="text-slate-500 ml-1.5">•</span>
                          <span className="font-mono text-indigo-400 font-bold ml-1.5">
                            {org.currency || "MAD"}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-300">
                          {org.ice || org.tax_identifier || <span className="text-slate-500 italic">Non renseigné</span>}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Actif
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1 text-[12px] font-bold text-emerald-300 border border-emerald-500/30">
                              <Check size={13} /> Actuelle
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentOrganization(org.id);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/20 px-3 py-1 text-[12px] font-bold text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 transition-all active:scale-95"
                            >
                              <ArrowRightLeft size={13} /> Basculer
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE COMPANY SETTINGS (FISCAL, BANK, INTEGRATIONS) */}
      {activeTab === "settings" && (
        <div className="space-y-5 animate-in fade-in">
          {/* Active Company Badge Card */}
          <div className="ledger-card border-indigo-500/30 bg-indigo-950/20 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
                  <Building2 size={20} />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white flex items-center gap-2">
                    {currentOrganization?.name || "Tadbir AI Demo"}
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-extrabold border border-indigo-500/30">
                      Entité Active
                    </span>
                  </p>
                  <p className="text-[12px] text-slate-300">
                    Les modifications ci-dessous s'appliquent exclusivement à cette entité juridique.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("organizations")}
                className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-1.5 text-[12px] font-bold text-slate-200 hover:bg-slate-700 transition-all shrink-0 self-start sm:self-auto"
              >
                <ArrowRightLeft size={14} /> Changer de société
              </button>
            </div>
          </div>

          {/* WhatsApp Configuration Banner */}
          <div className="ledger-card border-emerald-500/30 bg-emerald-950/20 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white flex items-center gap-2">
                    Configuration WhatsApp
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-extrabold border border-emerald-500/30">
                      Prêt à l'emploi
                    </span>
                  </p>
                  <p className="text-[12px] text-slate-300">
                    Gérez votre numéro d'entreprise, testez l'envoi direct et personnalisez les modèles de factures/relances.
                  </p>
                </div>
              </div>
              <Link
                href="/whatsapp"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/30 transition-all shrink-0 self-start sm:self-auto"
              >
                Configurer WhatsApp <ChevronRight size={16} />
              </Link>
            </div>
          </div>

          {/* Company Identity */}
          <div className="ledger-card space-y-4">
            <div className="flex items-center gap-3">
              <label className="flex h-16 w-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 bg-slate-900/60">
                <ImagePlus size={18} />
                <input type="file" accept="image/*" className="hidden" />
              </label>
              <div>
                <p className="text-[13px] font-semibold text-white">Logo de l'entreprise</p>
                <p className="text-[11.5px] text-slate-400">Affiché sur vos factures et devis. JPG, PNG ou SVG. Max 5 Mo.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ControlledField label="Nom de l'entreprise" value={settings.nom} onChange={(v) => update("nom", v)} placeholder="Nom de votre entreprise" />
              <ControlledField label="Adresse" value={settings.adresse} onChange={(v) => update("adresse", v)} placeholder="Adresse complète" />
              <ControlledField label="Téléphone" value={settings.telephone} onChange={(v) => update("telephone", v)} placeholder="+212 5XX XXX XXX" />
              <ControlledField label="E-mail" value={settings.email} onChange={(v) => update("email", v)} placeholder="contact@entreprise.ma" type="email" />
              <ControlledField label="Site web" value={settings.site_web} onChange={(v) => update("site_web", v)} placeholder="https://entreprise.ma" />
              <div>
                <label className="mb-1.5 block text-[12.5px] text-slate-300 font-medium">Secteur d'activité</label>
                <select
                  value={settings.secteur}
                  onChange={(e) => update("secteur", e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option>Technologie & Services</option>
                  <option>Commerce</option>
                  <option>Construction</option>
                  <option>Santé</option>
                  <option>Industrie</option>
                  <option>Agriculture</option>
                  <option>Transport & Logistique</option>
                  <option>Autre</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fiscal & Billing */}
          <div className="ledger-card space-y-4">
            <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
              Informations fiscales et de facturation
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-[12.5px] text-slate-300 font-medium">Pays</label>
                <select
                  value={settings.pays}
                  onChange={(e) => update("pays", e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option>Maroc</option>
                  <option>France</option>
                  <option>Belgique</option>
                  <option>Allemagne</option>
                  <option>Espagne</option>
                  <option>Autre pays</option>
                </select>
              </div>
              <ControlledField label="TVA %" value={settings.tva_rate} onChange={(v) => update("tva_rate", v)} type="number" placeholder="20" />
              <div>
                <label className="mb-1.5 block text-[12.5px] text-slate-300 font-medium">Devise</label>
                <select
                  value={settings.devise}
                  onChange={(e) => update("devise", e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="MAD">MAD - Dirham Marocain</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="USD">USD - Dollar</option>
                </select>
              </div>
            </div>

            {fiscalFields.length > 0 && (
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:grid-cols-3">
                {fiscalFields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1.5 block text-[12px] text-slate-400 font-medium">{f.label}</label>
                    <input
                      value={(settings as any)[f.key] || ""}
                      onChange={(e) => update(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-2.5">
              <span className="text-[13px] text-slate-200">
                Afficher la TVA sur les factures
                <span className="block text-[11.5px] text-slate-400">
                  Si désactivé, la TVA sera masquée sur toutes les factures et les PDF.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.afficher_tva}
                onChange={(e) => update("afficher_tva", e.target.checked)}
                className="h-4 w-4 rounded accent-indigo-600"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-2.5">
              <span className="text-[13px] text-slate-200">
                Montant en lettres
                <span className="block text-[11.5px] text-slate-400">
                  Affiche le total en toutes lettres sous le montant TTC.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.montant_lettres}
                onChange={(e) => update("montant_lettres", e.target.checked)}
                className="h-4 w-4 rounded accent-indigo-600"
              />
            </label>
          </div>

          {/* Bank Info */}
          <div className="ledger-card space-y-4">
            <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
              Coordonnées bancaires
            </p>
            <p className="text-[12px] text-slate-400">
              Ces informations apparaîtront sur vos factures pour permettre à vos clients d'effectuer des virements.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ControlledField label="RIB" value={settings.rib} onChange={(v) => update("rib", v)} placeholder="007 780 0001234567890123 45" />
              <ControlledField label="IBAN" value={settings.iban} onChange={(v) => update("iban", v)} placeholder="MAXX XXXX XXXX XXXX XXXX XXXX" />
              <ControlledField label="Code SWIFT / BIC" value={settings.swift} onChange={(v) => update("swift", v)} placeholder="XXXXXXXX" />
              <ControlledField label="Banque" value={settings.bank_name} onChange={(v) => update("bank_name", v)} placeholder="Nom de la banque" />
              <ControlledField label="Adresse de la banque" value={settings.bank_address} onChange={(v) => update("bank_address", v)} placeholder="Ville / agence" />
              <ControlledField label="Capital social" value={settings.capital_social} onChange={(v) => update("capital_social", v)} placeholder="100 000 MAD" />
              <ControlledField label="CNSS" value={settings.cnss} onChange={(v) => update("cnss", v)} placeholder="Numéro CNSS" />
            </div>
          </div>

          {/* SMTP Config */}
          <div className="ledger-card space-y-4">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-indigo-400" />
              <p className="text-[12px] font-bold uppercase tracking-wider text-indigo-400">
                Configuration Email (SMTP)
              </p>
            </div>
            <p className="text-[12px] text-slate-400">
              Entrez vos identifiants SMTP pour que vos reçus soient envoyés depuis votre propre adresse email.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ControlledField label="Serveur SMTP (Hôte)" value={settings.smtp_host} onChange={(v) => update("smtp_host", v)} placeholder="ex: smtp.gmail.com" />
              <ControlledField label="Port SMTP" value={String(settings.smtp_port)} onChange={(v) => update("smtp_port", parseInt(v) || 587)} placeholder="587" type="number" />
              <ControlledField label="Adresse Email (Utilisateur)" value={settings.smtp_user} onChange={(v) => update("smtp_user", v)} placeholder="contact@entreprise.com" />
              <ControlledField label="Mot de Passe (ou Clé d'application)" value={settings.smtp_password} onChange={(v) => update("smtp_password", v)} placeholder="********" type="password" />
            </div>
          </div>

          {/* Twilio/WhatsApp Config */}
          <div className="ledger-card space-y-4">
            <div className="flex items-center gap-2">
              <Smartphone size={16} className="text-emerald-400" />
              <p className="text-[12px] font-bold uppercase tracking-wider text-emerald-400">
                Configuration WhatsApp (Twilio API)
              </p>
            </div>
            <p className="text-[12px] text-slate-400">
              Entrez vos identifiants Twilio pour que le système puisse automatiser l'envoi WhatsApp en arrière-plan.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ControlledField label="Account SID" value={settings.twilio_account_sid} onChange={(v) => update("twilio_account_sid", v)} placeholder="ACXXXXXXXXXXXXXXXX" />
              <ControlledField label="Auth Token" value={settings.twilio_auth_token} onChange={(v) => update("twilio_auth_token", v)} placeholder="********" type="password" />
              <div className="sm:col-span-2">
                <ControlledField label="Numéro WhatsApp Twilio" value={settings.twilio_phone_number} onChange={(v) => update("twilio_phone_number", v)} placeholder="ex: whatsapp:+123456789" />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {saved && (
              <span className="text-[13px] text-emerald-400 font-medium animate-fade-in flex items-center gap-1.5">
                <CheckCircle2 size={16} /> Modifications enregistrées avec succès !
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-[13px] font-bold text-white hover:bg-indigo-500 disabled:opacity-50 shadow-lg shadow-indigo-600/25 transition-all"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
          </div>
        </div>
      )}

      {/* CREATE NEW COMPANY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-white">Nouvelle Entreprise</h3>
                  <p className="text-[11.5px] text-slate-400">Créer une entité juridique isolée</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-slate-300 mb-1">
                  Nom de la société *
                </label>
                <input
                  type="text"
                  required
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder="ex: Atlas Filiale Sud"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-slate-300 mb-1">
                  Email de contact
                </label>
                <input
                  type="email"
                  value={modalEmail}
                  onChange={(e) => setModalEmail(e.target.value)}
                  placeholder="contact@atlas-sud.ma"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-slate-300 mb-1">Devise</label>
                  <select
                    value={modalCurrency}
                    onChange={(e) => setModalCurrency(e.target.value)}
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
                    value={modalCountry}
                    onChange={(e) => setModalCountry(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Maroc">Maroc</option>
                    <option value="France">France</option>
                    <option value="Belgique">Belgique</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-slate-300 mb-1">
                  Identifiant Fiscal / ICE (Optionnel)
                </label>
                <input
                  type="text"
                  value={modalIce}
                  onChange={(e) => setModalIce(e.target.value)}
                  placeholder="ex: 002345678000091"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-[12.5px] font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !modalName.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20"
                >
                  {isCreating ? "Création en cours..." : "Créer l'entreprise"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlledField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12.5px] text-slate-300 font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
      />
    </div>
  );
}
