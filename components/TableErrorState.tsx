"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export interface TableErrorStateProps {
  error?: string | null;
  onRetry?: () => void;
  colSpan?: number;
  title?: string;
}

export function TableErrorState({
  error,
  onRetry,
  colSpan,
  title = "Échec du chargement des données",
}: TableErrorStateProps) {
  const content = (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-3 p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
        <AlertTriangle size={20} />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-[13.5px] font-bold text-white">{title}</p>
        <p className="text-[12px] text-rose-200/80 break-words">
          {error || "Une erreur est survenue lors de la communication avec le serveur."}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-[12px] font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 transition-all active:scale-95 cursor-pointer"
        >
          <RefreshCw size={14} />
          <span>Réessayer</span>
        </button>
      )}
    </div>
  );

  if (colSpan !== undefined) {
    return (
      <tr>
        <td colSpan={colSpan} className="py-12 text-center">
          {content}
        </td>
      </tr>
    );
  }

  return <div className="py-12 text-center">{content}</div>;
}

export default TableErrorState;
