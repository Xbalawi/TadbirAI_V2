"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Fatal Root App Error caught:", error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="bg-slate-950 text-white font-sans flex min-h-screen items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center text-center max-w-md space-y-4 p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertTriangle size={28} />
          </div>

          <h1 className="text-xl font-bold text-white">Une erreur système s'est produite</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            L'application a rencontré une erreur globale. Cliquez sur le bouton ci-dessous pour recharger la page.
          </p>

          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
          >
            <RefreshCw size={14} /> Recharger l'application
          </button>
        </div>
      </body>
    </html>
  );
}
