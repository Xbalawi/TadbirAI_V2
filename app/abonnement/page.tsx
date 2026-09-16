"use client";

import { useState } from "react";
import { Sparkles, Rocket, Clock, CheckCircle2, ShieldCheck, Zap, Mail, ArrowRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function AbonnementPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubscribed(true);
    setTimeout(() => {
      setEmail("");
    }, 2000);
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[24px] font-bold text-white tracking-tight">{t("subscription.title", "Abonnement & Licence")}</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/20 to-indigo-500/20 border border-amber-500/30 px-3 py-1 text-[11px] font-extrabold uppercase text-amber-300 shadow-md">
              <Sparkles size={12} className="text-amber-400 animate-pulse" /> Bientôt Disponible
            </span>
          </div>
          <p className="text-[13px] text-slate-400">{t("subscription.subtitle", "Gérez votre offre Tadbir AI et vos factures de service")}</p>
        </div>
      </div>

      {/* Main Hero Coming Soon Card */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-950 p-8 sm:p-12 shadow-2xl">
        {/* Glow decorative blur */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-5">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-600/20">
            <Rocket size={28} className="animate-bounce" />
          </div>

          <h2 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            Une nouvelle expérience d'abonnement arrive très bientôt sur <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-amber-300 bg-clip-text text-transparent">FATOURATI</span> !
          </h2>

          <p className="text-[14px] leading-relaxed text-slate-300">
            Nous préparons des formules flexibles, transparentes et sur-mesure adaptées aux entrepreneurs, TPE et PME au Maroc. Profitez actuellement de toutes les fonctionnalités en version illimitée.
          </p>

          {/* Email Notify Form */}
          <div className="pt-2">
            {isSubscribed ? (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 px-5 py-3 text-[13px] font-bold text-emerald-300">
                <CheckCircle2 size={18} />
                <span>Merci ! Vous serez notifié en priorité lors du lancement de nos offres.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2.5 max-w-md">
                <div className="relative flex-1">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Votre adresse email pro..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-4 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all active:scale-95 whitespace-nowrap"
                >
                  M'avertir <ArrowRight size={14} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Feature Teasers Grid */}
      <div>
        <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
          Ce qui est en cours de préparation :
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bento-card space-y-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20">
              <Zap size={18} />
            </div>
            <h3 className="text-[14px] font-bold text-white">IA Vision & Automatisation</h3>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              Extraction automatique des devis & factures PDF par l'IA Gemini 2.5 et assistant bot WhatsApp.
            </p>
          </div>

          <div className="bento-card space-y-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
              <ShieldCheck size={18} />
            </div>
            <h3 className="text-[14px] font-bold text-white">Paiement CMI & Carte Marocaine</h3>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              Intégration sécurisée des passerelles de paiement locales en Dirhams (MAD).
            </p>
          </div>

          <div className="bento-card space-y-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
              <Clock size={18} />
            </div>
            <h3 className="text-[14px] font-bold text-white">Accès Gratuit Actuel</h3>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              Toutes les fonctionnalités restent 100% gratuites et illimitées pendant la phase de lancement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
