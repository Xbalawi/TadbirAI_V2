"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SpreadsheetImportModal from "@/components/SpreadsheetImportModal";
import { Upload, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ImportPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(true);

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/stocks"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Centre d'Importation Intelligente
            </h1>
            <p className="text-[13px] text-slate-400">
              Importez vos fichiers Excel (.xlsx, .xls) ou CSV en toute simplicité
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all"
        >
          <Upload size={15} /> Ouvrir la fenêtre d'import
        </button>
      </div>

      <div className="bento-card !p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-4 shadow-inner">
          <Upload size={28} />
        </div>
        <h3 className="text-base font-bold text-white mb-1">
          Importation automatique avec intelligence artificielle
        </h3>
        <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
          Téléversez vos catalogues de produits, listes de clients ou de fournisseurs. Les colonnes seront mappées et validées automatiquement.
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-violet-500 active:scale-95 transition-all"
        >
          Lancer l'importation Pop-up
        </button>
      </div>

      {/* Pop-up Import Modal */}
      <SpreadsheetImportModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          router.push("/stocks");
        }}
        onSuccess={() => {
          router.push("/stocks");
        }}
      />
    </div>
  );
}
