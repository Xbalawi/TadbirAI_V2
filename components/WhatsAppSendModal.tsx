"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MessageSquare, Send, X, ExternalLink, Settings, Phone, CheckCircle2, Copy } from "lucide-react";
import { 
  getWhatsAppConfig, 
  formatPhoneForWhatsApp, 
  renderTemplate, 
  buildWhatsAppWebUrl,
  buildWhatsAppWaMeUrl,
  buildWhatsAppAppUrl,
  openWhatsAppMessage
} from "@/lib/whatsapp";

interface WhatsAppSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: "facture" | "relance" | "devis" | "recu";
  recipientName: string;
  recipientPhone?: string;
  documentNumber: string;
  amount: number | string;
  dueDate?: string;
}

export default function WhatsAppSendModal({
  isOpen,
  onClose,
  documentType,
  recipientName,
  recipientPhone = "",
  documentNumber,
  amount,
  dueDate = "12 Mai 2026"
}: WhatsAppSendModalProps) {
  const [phone, setPhone] = useState(recipientPhone);
  const [templateType, setTemplateType] = useState<"facture" | "relance" | "devis" | "recu">(documentType);
  const [customMessage, setCustomMessage] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    const defaultPhone = recipientPhone || getWhatsAppConfig().phoneNumber || "+212 684 836 656";
    setPhone(defaultPhone);
  }, [recipientPhone, isOpen]);

  useEffect(() => {
    const config = getWhatsAppConfig();
    const rawTemplate = 
      templateType === "facture" ? config.factureTemplate :
      templateType === "relance" ? config.relanceTemplate :
      templateType === "devis" ? config.devisTemplate : config.recuTemplate;

    const data = {
      client: recipientName || "Client",
      numero: documentNumber || "FAC-0000",
      montant: typeof amount === "number" ? amount.toLocaleString("fr-FR") : amount,
      echeance: dueDate || "Prochainement",
      lien: `https://tadbir.ai/f/${documentNumber}`
    };

    setCustomMessage(renderTemplate(rawTemplate, data));
  }, [templateType, recipientName, documentNumber, amount, dueDate, isOpen]);

  if (!isOpen) return null;

  const config = getWhatsAppConfig();
  const cleanPhone = formatPhoneForWhatsApp(phone, config.defaultCountryCode);
  const webUrl = buildWhatsAppWebUrl(cleanPhone, customMessage);
  const waMeUrl = buildWhatsAppWaMeUrl(cleanPhone, customMessage);
  const appUrl = buildWhatsAppAppUrl(cleanPhone, customMessage);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(webUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(customMessage);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleOpenWeb = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open(webUrl, "_blank");
    onClose();
  };

  const handleOpenApp = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open(appUrl, "_self");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-white leading-tight">Envoyer sur WhatsApp</h3>
              <p className="text-[11.5px] text-slate-400">Document : <span className="text-indigo-400 font-mono font-bold">{documentNumber}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Template Quick Selection */}
        <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {(["facture", "relance", "devis", "recu"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTemplateType(t)}
              className={`flex-1 py-1.5 rounded-lg text-[11.5px] font-bold capitalize transition-all ${
                templateType === t
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Recipient Phone Input */}
        <div className="space-y-1">
          <label className="text-[12px] font-bold text-slate-300 flex items-center justify-between">
            <span>Numéro WhatsApp du Destinataire</span>
            <span className="text-[11px] font-mono text-emerald-400">{cleanPhone ? `Format : +${cleanPhone}` : "⚠️ Numéro requis"}</span>
          </label>
          <div className="relative">
            <Phone size={15} className="absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="ex: +212 661 111 222 ou 0661111222"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3.5 py-2.5 text-[13px] text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Message Preview */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-bold text-slate-300">Message pré-rempli :</label>
            <button
              type="button"
              onClick={handleCopyText}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
            >
              {copiedText ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copiedText ? "Texte copié !" : "Copier le texte"}
            </button>
          </div>
          <textarea
            rows={5}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-[12.5px] font-sans leading-relaxed text-slate-200 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Direct Open Buttons */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleOpenApp}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-[14px] font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
          >
            <ExternalLink size={18} /> Ouvrir l'application WhatsApp Desktop
          </button>

          <div className="flex items-center justify-between gap-2 pt-1 text-[11.5px]">
            <button
              onClick={handleOpenWeb}
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium underline"
            >
              Continuer sur WhatsApp Web (Navigateur)
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
            >
              {copiedText ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copiedText ? "Texte copié !" : "Copier le texte"}
            </button>
          </div>
        </div>

        {/* Footer options */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <Link
            href="/whatsapp"
            onClick={onClose}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-400 hover:text-indigo-300"
          >
            <Settings size={14} /> Modèles & Paramètres
          </Link>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1 text-[12px] font-semibold text-slate-400 hover:text-slate-200"
          >
            {copiedLink ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copiedLink ? "Lien web copié !" : "Copier le lien direct"}
          </button>
        </div>
      </div>
    </div>
  );
}
