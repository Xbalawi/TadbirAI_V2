"use client";

import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brass/10 text-brass mb-4">
        <FileQuestion size={32} />
      </div>
      <h1 className="font-display text-2xl font-bold text-ink-900 sm:text-3xl">Page introuvable (404)</h1>
      <p className="mt-2 max-w-md text-[14px] text-ink-500">
        La page ou la ressource que vous recherchez n'existe pas ou a été déplacée.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md bg-ink-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-ink-800 transition-colors"
        >
          <ArrowLeft size={16} /> Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
