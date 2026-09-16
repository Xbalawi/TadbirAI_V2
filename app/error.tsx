"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log exception safely to console
    console.error("Global client exception caught by Error Boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center text-center px-4 space-y-5 animate-in fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-xl">
        <AlertTriangle size={32} />
      </div>

      <div className="space-y-1.5">
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl tracking-tight">
          Une erreur inattendue s'est produite
        </h1>
        <p className="max-w-md mx-auto text-[13.5px] text-slate-400 leading-relaxed">
          Le système a intercepté une exception client. Vous pouvez réinitialiser le composant ou retourner au tableau de bord.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all"
        >
          <RefreshCw size={15} /> Réessayer
        </button>

        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-slate-200 hover:bg-slate-800 transition-all active:scale-95"
        >
          <ArrowLeft size={15} /> Retour au Tableau de Bord
        </Link>
      </div>
    </div>
  );
}
