"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  MessageSquare, 
  Plus, 
  CheckCircle2, 
  LifeBuoy, 
  Mail, 
  Smartphone, 
  Clock, 
  ExternalLink, 
  HelpCircle, 
  ChevronRight,
  ShieldCheck,
  Send
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

type Ticket = { id: string; sujet: string; message: string; date: string; status: "En cours" | "Résolu" | "Nouveau" };


export default function SupportPage() {
  const { t } = useTranslation();
  const [formOpen, setFormOpen] = useState(false);
  const [sujet, setSujet] = useState("");
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load tickets from API on mount
  const fetchTickets = async () => {
    try {
      const res = await fetch(`/api/support?t=${Date.now()}`);
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load tickets:", e);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const newTicket = {
      sujet: sujet.trim() || "Demande d'assistance technique",
      message: message.trim(),
      status: "Nouveau" as const
    };

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTicket),
      });
      if (res.ok) {
        await fetchTickets();
      }
    } catch (err) {
      console.error("Failed to create ticket:", err);
    }

    setSujet("");
    setMessage("");
    setFormOpen(false);

    setToastMessage("Ticket de support créé avec succès ! Notre équipe vous répondra sous peu.");
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 text-slate-100 pb-12">
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
            <LifeBuoy size={24} className="text-indigo-400" /> {t("support.title", "Support & Assistance")}
          </h1>
          <p className="text-[13px] text-slate-400">
            {t("support.subtitle", "Besoin d'aide ? Consultez notre documentation ou contactez notre équipe")}
          </p>
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4.5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus size={16} /> Nouveau Ticket
        </button>
      </div>

      {/* Quick Channel Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bento-card p-4 space-y-1.5 border border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2 text-indigo-400">
            <Mail size={16} />
            <span className="text-[12.5px] font-bold uppercase tracking-wider text-white">Support E-mail</span>
          </div>
          <p className="text-[12px] text-slate-300 font-mono">support@tadbir.ai</p>
          <p className="text-[11px] text-slate-400">Réponse garantie sous 2 heures ouvrées.</p>
        </div>

        <Link href="/whatsapp" className="bento-card p-4 space-y-1.5 border border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/50 transition-all block">
          <div className="flex items-center justify-between text-emerald-400">
            <div className="flex items-center gap-2">
              <Smartphone size={16} />
              <span className="text-[12.5px] font-bold uppercase tracking-wider text-white">Assistance WhatsApp</span>
            </div>
            <ChevronRight size={14} className="text-emerald-400" />
          </div>
          <p className="text-[12px] text-emerald-300 font-mono">+212 684 836 656</p>
          <p className="text-[11px] text-slate-400">Envoi direct de pièces jointes et messages.</p>
        </Link>

        <div className="bento-card p-4 space-y-1.5 border border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2 text-amber-400">
            <Clock size={16} />
            <span className="text-[12.5px] font-bold uppercase tracking-wider text-white">Heures d'Ouverture</span>
          </div>
          <p className="text-[12px] text-slate-300">Lun - Sam : 08h30 – 19h00</p>
          <p className="text-[11px] text-slate-400">Support prioritaire pour les comptes Pro & Enterprise.</p>
        </div>
      </div>

      {/* Ticket Creation Form */}
      {formOpen && (
        <form onSubmit={envoyer} className="bento-card p-6 space-y-4 border border-indigo-500/40 bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare size={16} className="text-indigo-400" /> Créer un nouveau ticket de support
            </h2>
            <button type="button" onClick={() => setFormOpen(false)} className="text-[12px] text-slate-400 hover:text-white">Fermer</button>
          </div>

          <div>
            <label className="text-[12.5px] font-semibold text-slate-300 block mb-1.5">Sujet de votre demande *</label>
            <input
              required
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              placeholder="ex: Problème lors de l'export des fiches de paie en PDF..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[12.5px] font-semibold text-slate-300 block mb-1.5">Description détaillée de votre question *</label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Décrivez précisément votre problème ou la fonctionnalité souhaitée..."
              rows={4}
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-[13px] font-semibold text-slate-300 hover:bg-slate-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-[13px] font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all"
            >
              <Send size={15} /> Soumettre le ticket
            </button>
          </div>
        </form>
      )}

      {/* Tickets List */}
      <div className="bento-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">Historique de vos Tickets</h2>
          <span className="text-[12px] font-semibold text-slate-400">{tickets.length} ticket(s) au total</span>
        </div>

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 mb-1">
              <MessageSquare size={24} />
            </div>
            <p className="text-[14px] font-bold text-white">Aucun ticket en cours</p>
            <p className="text-[12.5px] text-slate-400">Vos tickets d'assistance et demandes récentes apparaîtront ici.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {tickets.map((t) => (
              <div key={t.id} className="py-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[12px] font-bold text-indigo-400">{t.id}</span>
                    <h3 className="text-[13.5px] font-bold text-white">{t.sujet}</h3>
                    <span className={`rounded-xl px-2 py-0.5 text-[10px] font-bold ${
                      t.status === "Résolu"
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        : "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                    }`}>
                      {t.status}
                    </span>
                  </div>
                  <span className="text-[11.5px] font-mono text-slate-400">{t.date ? (t.date.includes("T") ? new Date(t.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : t.date) : ""}</span>
                </div>
                <p className="text-[13px] text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">{t.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
