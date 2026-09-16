"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  Sparkles, 
  AlertCircle, 
  Phone, 
  FileText, 
  RefreshCw,
  HelpCircle,
  Smartphone,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { 
  WhatsAppConfig, 
  getWhatsAppConfig, 
  saveWhatsAppConfig, 
  formatPhoneForWhatsApp, 
  renderTemplate, 
  buildWhatsAppUrl, 
  buildWhatsAppWebUrl,
  buildWhatsAppWaMeUrl,
  openWhatsAppMessage 
} from "@/lib/whatsapp";
import { useTranslation } from "@/lib/i18n";

export default function WhatsAppConfigPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<WhatsAppConfig>(getWhatsAppConfig());
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Testing State
  const [testPhone, setTestPhone] = useState("+212 684 836 656");
  const [testType, setTestType] = useState<"facture" | "relance" | "devis" | "recu">("facture");
  const [testData, setTestData] = useState({
    client: "Karim Idrissi",
    numero: "FAC-0046",
    montant: "41 400",
    echeance: "12 Mai 2026",
    lien: "https://tadbir.ai/f/FAC-0046"
  });

  useEffect(() => {
    fetch("/api/settings")
      .then(async (res) => {
        if (!res.ok) return null;
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      })
      .then((data) => {
        if (!data) return;
        if (data.whatsappPhoneNumber) {
          setConfig({
            phoneNumber: data.whatsappPhoneNumber,
            defaultCountryCode: data.whatsappDefaultCountryCode,
            sendMode: data.whatsappSendMode,
            factureTemplate: data.whatsappFactureTemplate,
            relanceTemplate: data.whatsappRelanceTemplate,
            devisTemplate: data.whatsappDevisTemplate,
            recuTemplate: data.whatsappRecuTemplate
          });
        }
      })
      .catch((err) => console.warn("Could not load WhatsApp settings", err));
  }, []);

  const handleSave = async () => {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappPhoneNumber: config.phoneNumber,
          whatsappDefaultCountryCode: config.defaultCountryCode,
          whatsappSendMode: config.sendMode,
          whatsappFactureTemplate: config.factureTemplate,
          whatsappRelanceTemplate: config.relanceTemplate,
          whatsappDevisTemplate: config.devisTemplate,
          whatsappRecuTemplate: config.recuTemplate
        })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Get current active template text
  const currentTemplate = 
    testType === "facture" ? config.factureTemplate :
    testType === "relance" ? config.relanceTemplate :
    testType === "devis" ? config.devisTemplate : config.recuTemplate;

  const renderedMessage = renderTemplate(currentTemplate, testData);
  const formattedTestPhone = formatPhoneForWhatsApp(testPhone, config.defaultCountryCode);
  const generatedUrl = buildWhatsAppUrl(formattedTestPhone, renderedMessage, config.sendMode === "web");

  const handleTestSend = () => {
    if (!formattedTestPhone) {
      alert("Veuillez saisir un numéro de téléphone valide pour le test.");
      return;
    }
    openWhatsAppMessage(formattedTestPhone, renderedMessage);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const insertPlaceholder = (templateKey: keyof WhatsAppConfig, placeholder: string) => {
    setConfig((prev) => ({
      ...prev,
      [templateKey]: (prev[templateKey] as string) + ` {${placeholder}}`
    }));
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-500/10">
            <MessageSquare size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">{t("whatsapp.title", "Configuration WhatsApp API")}</h1>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                100% Fonctionnel
              </span>
            </div>
            <p className="text-[13px] text-slate-400">
              {t("whatsapp.subtitle", "Automatisations d'envoi de factures et rappels de paiement")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-[13px] text-emerald-400 font-semibold flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 size={16} /> Enregistré avec succès !
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            Enregistrer les paramètres
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: General Config & Templates */}
        <div className="lg:col-span-7 space-y-6">
          {/* General WhatsApp Settings */}
          <div className="ledger-card space-y-4">
            <h2 className="text-[15px] font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Phone size={18} className="text-emerald-400" /> Numéro & Mode d'envoi
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-slate-300">
                  Indicatif par défaut (Pays)
                </label>
                <select
                  value={config.defaultCountryCode}
                  onChange={(e) => setConfig({ ...config, defaultCountryCode: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="212">🇲🇦 Maroc (+212)</option>
                  <option value="33">🇫🇷 France (+33)</option>
                  <option value="221">🇸🇳 Sénégal (+221)</option>
                  <option value="225">🇨🇮 Côte d'Ivoire (+225)</option>
                  <option value="216">🇹🇳 Tunisie (+216)</option>
                  <option value="213">🇩🇿 Algérie (+213)</option>
                  <option value="32">🇧🇪 Belgique (+32)</option>
                  <option value="1">🇺🇸 USA / Canada (+1)</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-slate-300">
                  Numéro WhatsApp de l'Entreprise
                </label>
                <input
                  type="text"
                  value={config.phoneNumber}
                  onChange={(e) => setConfig({ ...config, phoneNumber: e.target.value })}
                  placeholder="ex: +212 661 111 222"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Format nettoyé pour l'API : <span className="font-mono text-emerald-400 font-bold">{formatPhoneForWhatsApp(config.phoneNumber, config.defaultCountryCode) || "Non défini"}</span>
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-medium text-slate-300">
                Mode d'Ouverture WhatsApp
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, sendMode: "web" })}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                    config.sendMode === "web"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-white shadow-sm ring-1 ring-emerald-500/30"
                      : "border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <ExternalLink size={18} className={config.sendMode === "web" ? "text-emerald-400" : "text-slate-500"} />
                  <div>
                    <p className="text-[13px] font-bold">WhatsApp Web</p>
                    <p className="text-[11px] text-slate-400">Ouvre dans le navigateur (web.whatsapp.com)</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, sendMode: "app" })}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                    config.sendMode === "app"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-white shadow-sm ring-1 ring-emerald-500/30"
                      : "border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <Smartphone size={18} className={config.sendMode === "app" ? "text-emerald-400" : "text-slate-500"} />
                  <div>
                    <p className="text-[13px] font-bold">WhatsApp Application</p>
                    <p className="text-[11px] text-slate-400">Ouvre l'application Bureau / Mobile (wa.me)</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Templates Editor */}
          <div className="ledger-card space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
                <FileText size={18} className="text-indigo-400" /> Modèles de Messages WhatsApp
              </h2>
              <span className="text-[11px] text-slate-400">Supporte le gras *texte* et l'italique _texte_</span>
            </div>

            {/* Template Selector Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-800/80 pb-3">
              {[
                { key: "factureTemplate", label: "Envoi Facture" },
                { key: "relanceTemplate", label: "Relance Facture" },
                { key: "devisTemplate", label: "Envoi Devis" },
                { key: "recuTemplate", label: "Reçu de Paiement" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    if (t.key === "factureTemplate") setTestType("facture");
                    if (t.key === "relanceTemplate") setTestType("relance");
                    if (t.key === "devisTemplate") setTestType("devis");
                    if (t.key === "recuTemplate") setTestType("recu");
                  }}
                  className={`rounded-xl px-3.5 py-1.5 text-[12px] font-bold transition-all ${
                    (testType === "facture" && t.key === "factureTemplate") ||
                    (testType === "relance" && t.key === "relanceTemplate") ||
                    (testType === "devis" && t.key === "devisTemplate") ||
                    (testType === "recu" && t.key === "recuTemplate")
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Template Field */}
            {testType === "facture" && (
              <TemplateEditor
                label="Message d'envoi de Facture"
                value={config.factureTemplate}
                onChange={(val) => setConfig({ ...config, factureTemplate: val })}
                onInsert={(p) => insertPlaceholder("factureTemplate", p)}
              />
            )}
            {testType === "relance" && (
              <TemplateEditor
                label="Message de Relance (Rappel Impayé)"
                value={config.relanceTemplate}
                onChange={(val) => setConfig({ ...config, relanceTemplate: val })}
                onInsert={(p) => insertPlaceholder("relanceTemplate", p)}
              />
            )}
            {testType === "devis" && (
              <TemplateEditor
                label="Message d'envoi de Devis"
                value={config.devisTemplate}
                onChange={(val) => setConfig({ ...config, devisTemplate: val })}
                onInsert={(p) => insertPlaceholder("devisTemplate", p)}
              />
            )}
            {testType === "recu" && (
              <TemplateEditor
                label="Message de Reçu de Paiement"
                value={config.recuTemplate}
                onChange={(val) => setConfig({ ...config, recuTemplate: val })}
                onInsert={(p) => insertPlaceholder("recuTemplate", p)}
              />
            )}
          </div>
        </div>

        {/* Right Column: Interactive Test & Preview & Troubleshooting */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Test & WhatsApp Bubble Preview */}
          <div className="ledger-card space-y-4 border-emerald-500/30 bg-gradient-to-b from-slate-900 to-slate-950">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-400" /> Test Direct WhatsApp
              </h2>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Aperçu Réel
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-300">
                  Numéro du Destinataire pour le Test
                </label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="ex: +212 661 111 222"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-[13px] text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* WhatsApp Bubble Preview */}
              <div className="space-y-1">
                <label className="block text-[12px] font-medium text-slate-300">
                  Rendu du message dans WhatsApp :
                </label>
                <div className="rounded-2xl bg-[#0b141a] p-4 text-[13px] text-emerald-100 border border-emerald-900/40 relative shadow-inner space-y-2">
                  <div className="flex items-center justify-between border-b border-emerald-900/30 pb-2 text-[11px] text-emerald-400/80 font-mono">
                    <span>📱 WhatsApp Chat Preview</span>
                    <span>Aujourd'hui</span>
                  </div>
                  <div className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-100">
                    {renderedMessage}
                  </div>
                  <div className="text-right text-[10px] text-slate-400 pt-1">
                    12:45 ✓✓
                  </div>
                </div>
              </div>

              {/* Formatted URL info */}
              <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 space-y-1">
                <p className="text-[11px] text-slate-400">Lien généré pour l'ouverture :</p>
                <p className="text-[11.5px] font-mono text-emerald-400 truncate">
                  {generatedUrl}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <a
                  href={generatedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-[14px] font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                >
                  <ExternalLink size={17} /> {config.sendMode === 'web' ? 'Ouvrir sur WhatsApp Web' : 'Ouvrir l\'Application WhatsApp'}
                </a>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <a
                    href={buildWhatsAppWaMeUrl(formattedTestPhone, renderedMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-slate-400 hover:text-slate-200 underline font-medium"
                  >
                    Lien mobile wa.me
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="text-[12px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copied ? "Lien copié !" : "Copier le lien"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Guide & Troubleshooting */}
          <div className="ledger-card space-y-4">
            <h2 className="text-[14.5px] font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <HelpCircle size={18} className="text-amber-400" /> Dépannage & Questions Fréquentes
            </h2>

            <div className="space-y-3 text-[12.5px]">
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-1">
                <p className="font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertCircle size={14} /> WhatsApp indique "Numéro de téléphone non valide" ?
                </p>
                <p className="text-slate-300 text-[12px] leading-relaxed">
                  Assurez-vous que le numéro contient l'indicatif du pays sans espace ni zéro au début (ex : pour le Maroc <code className="text-emerald-400 font-mono">212661111222</code> et NON <code className="text-red-400 font-mono">0661111222</code>). Notre système formate automatiquement le numéro !
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-1">
                <p className="font-bold text-indigo-300 flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Le navigateur bloque la fenêtre pop-up ?
                </p>
                <p className="text-slate-300 text-[12px] leading-relaxed">
                  Si le clic ne fait rien, vérifiez l'icône de blocage de fenêtres surgissantes dans la barre d'adresse de votre navigateur et autorisez l'ouverture pour ce site.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-1">
                <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Smartphone size={14} /> Sur Mobile vs Ordinateur ?
                </p>
                <p className="text-slate-300 text-[12px] leading-relaxed">
                  Sur smartphone, le lien ouvre directement l'application WhatsApp. Sur ordinateur, il ouvre WhatsApp Web ou l'application WhatsApp Bureau.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateEditor({
  label,
  value,
  onChange,
  onInsert
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onInsert: (placeholder: string) => void;
}) {
  const placeholders = ["client", "numero", "montant", "echeance", "lien"];

  return (
    <div className="space-y-2">
      <label className="block text-[13px] font-bold text-slate-200">{label}</label>
      
      {/* Insert Placeholders Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-slate-400">Insérer :</span>
        {placeholders.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onInsert(p)}
            className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[11px] font-mono font-bold text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 border border-indigo-500/20 transition-all"
          >
            +{`{${p}}`}
          </button>
        ))}
      </div>

      <textarea
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-[13px] font-mono leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
      />
    </div>
  );
}
