"use client";

import { AlertTriangle, X } from "lucide-react";

interface FormAlertProps {
  error: string | null;
  onClose?: () => void;
  title?: string;
}

export default function FormAlert({ error, onClose, title = "Attention required" }: FormAlertProps) {
  if (!error) return null;

  return (
    <div className="relative mb-4 overflow-hidden rounded-xl border border-red-500/40 bg-red-950/40 p-4 shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-400 ring-1 ring-red-500/40">
          <AlertTriangle size={18} />
        </div>
        <div className="flex-1 pr-6">
          <h4 className="text-[13px] font-bold text-red-300 tracking-wide uppercase">{title}</h4>
          <p className="mt-1 text-[12.5px] leading-relaxed text-red-200 font-medium">{error}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 rounded-lg p-1 text-red-400 hover:bg-red-500/20 hover:text-red-200 transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
