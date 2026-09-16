import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmer",
  cancelText = "Annuler"
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 rounded-full bg-red-500/10 p-3">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <div className="flex-1 pt-1">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 shadow-lg shadow-red-500/20"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
