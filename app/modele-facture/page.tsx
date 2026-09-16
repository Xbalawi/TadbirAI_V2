"use client";

import { useState, useEffect } from "react";
import { Check, CheckCircle2, Palette, FileText, Layout, Hash, Eye } from "lucide-react";
import { mad } from "@/lib/format";

const accentColors = [
  { hex: "#1e293b", name: "Anthracite Noir" },
  { hex: "#2C4A7C", name: "Bleu Marine" },
  { hex: "#1F8A5F", name: "Vert Émeraude" },
  { hex: "#B8452F", name: "Terracotta" },
  { hex: "#6B4FA0", name: "Violet Royal" },
  { hex: "#B8863B", name: "Doré Luxe" },
  { hex: "#B03B6A", name: "Rose Pourpre" }
];

const templates = [
  { id: "classique", nom: "Classique", desc: "Design épuré sur fond blanc pur avec en-tête structuré et ligne d'accent." },
  { id: "moderne", nom: "Moderne", desc: "En-tête blanc avec bande latérale d'accent colorée sur la gauche." },
  { id: "minimal", nom: "Minimalist", desc: "Ultra épuré avec typographie haute lisibilité et espaces aérés." },
  { id: "elegant", nom: "Élégant", desc: "Tons sobres avec doubles bordures et finitions dorées ou sombres." },
  { id: "audacieux", nom: "Audacieux", desc: "En-tête structuré avec titre en relief et contraste fort." },
  { id: "epure", nom: "Épuré", desc: "Fond blanc pur avec lignes nettes et grille épurée." },
];

export default function ModeleFacturePage() {
  const [separateur, setSeparateur] = useState("A-B");
  const [inclureAnnee, setInclureAnnee] = useState(false);
  const [longueur, setLongueur] = useState(4);
  const [accent, setAccent] = useState("#1e293b"); // Anthracite Dark default
  const [template, setTemplate] = useState("classique"); // Pure white classic default
  const [footerText, setFooterText] = useState("Merci pour votre confiance ! ICE N° 00294829100032 · Capital Social: 100 000 MAD");
  
  const [prefixeFac, setPrefixeFac] = useState("FAC");
  const [prefixeDev, setPrefixeDev] = useState("DEV");
  const [prefixeAv, setPrefixeAv] = useState("AV");

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load preferences from backend on mount
  useEffect(() => {
    fetch("/api/settings")
      .then(async (res) => {
        if (!res.ok) return null;
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      })
      .then((data) => {
        if (!data) return;
        if (data.factureTemplateConfig) {
          try {
            const parsed = data.factureTemplateConfig;
            if (parsed.accent && parsed.accent !== "#6B4FA0" && parsed.accent !== "#4f46e5") {
              setAccent(parsed.accent);
            } else {
              setAccent("#1e293b");
            }
            if (parsed.template) setTemplate(parsed.template);
            if (parsed.separateur) setSeparateur(parsed.separateur);
            if (parsed.inclureAnnee !== undefined) setInclureAnnee(parsed.inclureAnnee);
            if (parsed.longueur) setLongueur(parsed.longueur);
            if (parsed.footerText) setFooterText(parsed.footerText);
            if (parsed.prefixeFac) setPrefixeFac(parsed.prefixeFac);
            if (parsed.prefixeDev) setPrefixeDev(parsed.prefixeDev);
            if (parsed.prefixeAv) setPrefixeAv(parsed.prefixeAv);
          } catch (e) {
            console.warn("Error reading template config", e);
          }
        }
      })
      .catch((err) => console.warn("Error loading settings in modele-facture", err));
  }, []);

  const handleSave = async () => {
    const config = {
      separateur,
      inclureAnnee,
      longueur,
      accent,
      template,
      footerText,
      prefixeFac,
      prefixeDev,
      prefixeAv
    };

    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factureTemplateConfig: config })
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("templateUpdated"));
      }
      setToastMessage("Modèle de facture enregistré et appliqué à l'ensemble du logiciel !");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setToastMessage("Erreur lors de l'enregistrement du modèle.");
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  function apercu(prefixe: string, n: number) {
    const num = String(n).padStart(longueur, "0");
    const annee = inclureAnnee ? `${new Date().getFullYear()}-` : "";
    return separateur === "A-B"
      ? `${prefixe}-${annee}${num}`
      : separateur === "A/B"
      ? `${prefixe}/${annee}${num}`
      : separateur === "A.B"
      ? `${prefixe}.${annee}${num}`
      : `${prefixe}${annee}${num}`;
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 text-slate-100 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl bg-emerald-600 px-5 py-3.5 text-[13px] font-bold text-white shadow-2xl shadow-emerald-950/50 animate-in fade-in slide-in-from-bottom-5 border border-emerald-400">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <FileText size={24} className="text-indigo-400" /> Modèle & Numérotation de Facture
          </h1>
          <p className="text-[13px] text-slate-400">
            Choisissez votre charte graphique, couleur d'accent et préfixes de numérotation pour toutes vos factures
          </p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all self-start sm:self-auto"
        >
          Enregistrer & Appliquer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form & Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Numérotation */}
          <div className="bento-card space-y-5 p-6 rounded-2xl border border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Hash size={16} className="text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">Numérotation Automatique</h2>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[12.5px] font-semibold text-slate-300">Format de Séparateur</p>
                <div className="grid grid-cols-4 gap-2.5">
                  {["A-B", "A/B", "A.B", "AB"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeparateur(s)}
                      className={`rounded-xl border py-2.5 text-[13px] font-mono font-bold transition-all ${
                        separateur === s ? "border-indigo-500 bg-indigo-600/20 text-indigo-300 ring-2 ring-indigo-500/40" : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 cursor-pointer">
                <span className="text-[13px] font-semibold text-slate-200">
                  Inclure l'année en cours
                  <span className="block text-[11.5px] text-slate-400 font-normal">Insère {new Date().getFullYear()} dans le numéro (ex: FAC-{new Date().getFullYear()}-0001)</span>
                </span>
                <input
                  type="checkbox"
                  checked={inclureAnnee}
                  onChange={(e) => setInclureAnnee(e.target.checked)}
                  className="h-4 w-8 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              <div>
                <p className="mb-2 text-[12.5px] font-semibold text-slate-300">Longueur du séquençage</p>
                <div className="grid grid-cols-4 gap-2.5">
                  {[3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLongueur(n)}
                      className={`rounded-xl border py-2.5 text-[13px] font-semibold transition-all ${
                        longueur === n ? "border-indigo-500 bg-indigo-600/20 text-indigo-300 ring-2 ring-indigo-500/40" : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                      }`}
                    >
                      {n} chiffres
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <p className="text-[12.5px] font-semibold text-slate-300">Préfixes des Documents</p>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Factures</label>
                    <input
                      value={prefixeFac}
                      onChange={(e) => setPrefixeFac(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-[12.5px] text-white font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Devis</label>
                    <input
                      value={prefixeDev}
                      onChange={(e) => setPrefixeDev(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-[12.5px] text-white font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Avoirs</label>
                    <input
                      value={prefixeAv}
                      onChange={(e) => setPrefixeAv(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-[12.5px] text-white font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Accent & Footer */}
          <div className="bento-card space-y-5 p-6 rounded-2xl border border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Palette size={16} className="text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">Couleur d'Accent & Mentions Légales</h2>
            </div>

            <div>
              <label className="text-[12.5px] font-semibold text-slate-300 block mb-2.5">Couleur d'Accent du PDF (Bordures & Lignes)</label>
              <div className="flex flex-wrap gap-3">
                {accentColors.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setAccent(c.hex)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all active:scale-95 shadow-md relative group"
                    style={{ backgroundColor: c.hex, borderColor: accent === c.hex ? "#FFFFFF" : "transparent" }}
                    title={c.name}
                  >
                    {accent === c.hex && <Check size={18} className="text-white drop-shadow-md" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">Pied de page (Mentions Légales)</label>
              <input
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 3: Design Template Selection with RICH VISUAL THUMBNAILS */}
          <div className="bento-card space-y-4 p-6 rounded-2xl border border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Layout size={16} className="text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">Modèles PDF (Template Design)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className={`rounded-2xl border p-4 text-left transition-all relative group flex flex-col justify-between ${
                    template === t.id ? "border-indigo-500 bg-indigo-600/15 ring-2 ring-indigo-500/40" : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                  }`}
                >
                  {/* MINIATURE VISUAL THUMBNAIL OF THE TEMPLATE */}
                  <div className="w-full h-28 bg-white rounded-xl mb-3 border border-slate-300 p-2.5 shadow-md flex flex-col justify-between overflow-hidden relative">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b pb-1" style={{ borderColor: accent }}>
                      <div className="w-12 h-2 rounded" style={{ backgroundColor: accent }} />
                      <div className="w-10 h-1.5 bg-slate-300 rounded" />
                    </div>
                    {/* Side Bar if Moderne */}
                    {t.id === "moderne" && (
                      <div className="absolute top-0 left-0 bottom-0 w-2" style={{ backgroundColor: accent }} />
                    )}
                    {/* Double border if Elegant */}
                    {t.id === "elegant" && (
                      <div className="absolute inset-1 border border-amber-400/40 rounded-lg pointer-events-none" />
                    )}
                    {/* Content Boxes */}
                    <div className="grid grid-cols-2 gap-1.5 my-1">
                      <div className="h-4 bg-slate-100 rounded border border-slate-200" />
                      <div className="h-4 bg-slate-100 rounded border border-slate-200" />
                    </div>
                    {/* Lines */}
                    <div className="space-y-1">
                      <div className="h-1.5 bg-slate-800 rounded w-full" />
                      <div className="h-1.5 bg-slate-200 rounded w-3/4" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[13px] font-bold text-white">{t.nom}</p>
                      {template === t.id && <Check size={16} className="text-indigo-400" />}
                    </div>
                    <p className="text-[11.5px] text-slate-400 leading-snug">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: 100% PURE WHITE A4 LIVE PDF PREVIEW CANVAS (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="sticky top-6">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Eye size={15} /> Aperçu Direct A4 (100% Fond Blanc)
              </span>
              <span className="text-[11px] font-mono text-slate-400">PDF A4 Canvas</span>
            </div>

            {/* PURE WHITE A4 INVOICE CARD PREVIEW */}
            <div 
              className={`!bg-white !text-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-5 text-[11.5px] font-sans relative overflow-hidden ${
                template === 'moderne' ? 'border-l-[6px]' : ''
              }`}
              style={{ 
                background: '#ffffff',
                borderColor: template === 'moderne' ? accent : '#cbd5e1'
              }}
            >
              {/* Double border styling if Elegant */}
              {template === 'elegant' && (
                <div className="absolute inset-1.5 border-2 border-amber-400/30 rounded-xl pointer-events-none" />
              )}
              
              {/* Clean White Invoice Header */}
              <div className="flex justify-between items-start pb-4 border-b-2" style={{ borderColor: accent || '#1e293b' }}>
                <div>
                  <h3 className="text-xl font-black tracking-tight !text-slate-900">FACTURE</h3>
                  <p className="font-mono font-bold text-[12px] mt-0.5" style={{ color: accent || '#1e293b' }}>{apercu(prefixeFac, 47)}</p>
                  <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase !bg-emerald-100 !text-emerald-800 border border-emerald-300">
                    Payée
                  </span>
                </div>

                <div className="text-right">
                  <h4 className="font-black text-[13.5px] !text-slate-900">TADBIR AI SARL</h4>
                  <p className="text-[10px] !text-slate-600 mt-0.5">123 Boulevard Zerktouni, Casablanca</p>
                  <p className="text-[9.5px] !text-slate-500 font-mono mt-0.5">ICE: 002345678000091</p>
                </div>
              </div>

              {/* Client & Date Boxes */}
              <div className="grid grid-cols-2 gap-2.5 text-[10.5px]">
                <div className="!bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[8.5px] font-extrabold uppercase !text-slate-500 block mb-0.5">FACTURÉ À (CLIENT)</span>
                  <strong className="!text-slate-900 text-[11px] block">Société Marocaine SARL</strong>
                  <span className="text-[10px] !text-slate-600">Casablanca, Maroc</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[8.5px] font-extrabold uppercase text-slate-500 block mb-0.5">DÉTAILS DE FACTURATION</span>
                  <span className="text-[10px] text-slate-700 block">Date : <strong className="text-slate-900">{new Date().toISOString().split("T")[0]}</strong></span>
                  <span className="text-[10px] text-slate-700 block mt-0.5">Mode : <strong className="text-slate-900">Virement / CB</strong></span>
                </div>
              </div>

              {/* Table Header */}
              <table className="w-full text-[10.5px] border-collapse">
                <thead>
                  <tr className="!bg-slate-900 !text-white font-bold text-[9.5px] uppercase">
                    <th className="p-2 text-left rounded-l-md">Désignation</th>
                    <th className="p-2 text-right">Qté</th>
                    <th className="p-2 text-right rounded-r-md">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800 bg-white">
                  <tr>
                    <td className="p-2 font-semibold text-slate-900">Développement Web & Cloud</td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900">1</td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900">{mad(12000)}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold text-slate-900">Hébergement & Support API</td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900">1</td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900">{mad(3375)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-between items-end pt-3 border-t border-slate-200">
                <div className="text-[9.5px] bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="font-extrabold block text-slate-500 text-[8.5px] uppercase">RIB RÈGLEMENT</span>
                  <span className="font-mono font-bold text-[10px]" style={{ color: accent || '#1e293b' }}>007 780 0001234567890123 45</span>
                </div>

                <div className="text-right space-y-0.5 text-[11px]">
                  <div className="flex justify-between gap-4 text-slate-600">
                    <span>Sous-total HT:</span>
                    <span className="font-mono font-bold text-slate-900">{mad(15375)}</span>
                  </div>
                  <div className="flex justify-between gap-4 font-black text-[13px] pt-1 border-t border-slate-200" style={{ color: accent || '#1e293b' }}>
                    <span>Total TTC:</span>
                    <span className="font-mono">{mad(18450)}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 text-center text-[9px] font-semibold text-slate-500 leading-tight">
                {footerText}
              </div>
            </div>

            <button
              onClick={handleSave}
              className="mt-4 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[13px] shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
            >
              Enregistrer & Appliquer la Charte
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
