"use client";

import { useState, useRef } from "react";
import Modal from "./Modal";
import FormAlert from "./FormAlert";
import { TableProperties, Upload, Send, Loader2, CheckCircle2, Database } from "lucide-react";
import { addImportHistoryRecord } from "@/lib/import-history-store";
import { useTranslation } from "@/lib/i18n";

interface SpreadsheetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  expectedType?: string;
}

export default function SpreadsheetImportModal({ isOpen, onClose, onSuccess, expectedType = "stock" }: SpreadsheetImportModalProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [importSession, setImportSession] = useState<any>(null);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("expected_type", expectedType);

      const response = await fetch("/api/ai/spreadsheets", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = errorText;
        try {
          const errJson = JSON.parse(errorText);
          if (errJson.error) errorMsg = errJson.error;
        } catch {}
        throw new Error(`${t("analysis_error", "Erreur d'analyse")}: ${errorMsg}`);
      }

      const data = await response.json();
      setImportSession(data);
    } catch (err: any) {
      setError(err.message || t("error_occurred", "Une erreur est survenue lors de l'analyse"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!importSession?.id) return;
    setIsConfirming(true);
    setError(null);

    try {
      const patchResponse = await fetch(`/api/ai/spreadsheets/${importSession.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          column_mapping: importSession.column_mapping
        }),
      });

      if (!patchResponse.ok) {
        throw new Error(t("mapping_save_error", "Erreur lors de la sauvegarde du mapping personnalisé."));
      }

      const response = await fetch(`/api/ai/spreadsheets/${importSession.id}/confirm`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(t("final_import_error", "Erreur lors de l'importation finale."));
      }

      const data = await response.json();
      if (!response.ok || (data.attempted_rows > 0 && data.inserted_rows === 0)) {
        const detail = Array.isArray(data.errors) && data.errors.length > 0 ? data.errors[0] : "Aucune ligne n'a été insérée.";
        throw new Error(detail);
      }
      setFinalResult(data);

      // Record in import history
      addImportHistoryRecord({
        fileName: file?.name || `import_${expectedType}.xlsx`,
        fileSize: file ? `${(file.size / 1024).toFixed(1)} KB` : "120 KB",
        fileType: file?.name.endsWith(".csv") ? "csv" : "xlsx",
        targetTable: expectedType,
        status: "success",
        recordCount: data.inserted_rows,
        details: `${t("import_success", "Importation réussie")} (${data.inserted_rows} lines)`
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: data.data_type || expectedType } }));
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || t("import_error", "Erreur d'import"));
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setImportSession(null);
    setFinalResult(null);
    setError(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { handleReset(); onClose(); }} title={t("import_data_title", "Importer des Données (Excel / CSV)")} maxWidth="max-w-2xl sm:max-w-3xl">
      <div className="flex flex-col gap-4 text-slate-100">
        
        {finalResult ? (
          /* State 3: Success */
          <div className="flex flex-col items-center justify-center py-6 animate-in fade-in zoom-in duration-300">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mb-4 shadow-sm ring-4 ring-emerald-500/20">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-base font-bold text-white mb-2">{t("data_imported_success", "Données importées avec succès !")}</h4>
            <p className="text-xs text-slate-300 mb-6 text-center max-w-[320px]">
              {t("rows_inserted", "Les lignes ont été insérées dans la base de données")} ({finalResult.data_type}).
            </p>
            <button
              onClick={() => { 
                handleReset(); 
                if (onSuccess) onSuccess(); 
                onClose(); 
              }}
              className="rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all shadow-lg active:scale-95"
            >
              {t("finish", "Terminer")}
            </button>
          </div>
        ) : importSession ? (
          /* State 2: Mapping Validation */
          <div className="flex flex-col animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Database size={18} />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-white">{t("mapping_validation", "Validation du Mapping")}</h4>
                <p className="text-[12px] text-slate-400">
                  {importSession.row_count} {t("lines_detected", "lignes détectées")} ({importSession.data_type})
                </p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 mb-4 max-h-[320px] overflow-y-auto custom-scrollbar">
              <p className="text-[12px] text-slate-300 font-medium mb-3">{t("check_mapping", "Vérifiez et personnalisez le mapping :")}</p>
              <div className="flex flex-col gap-2.5">
                {Array.isArray(importSession.column_mapping) ? importSession.column_mapping.map((col: any, idx: number) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 px-3.5 py-2.5 rounded-xl text-[12px] flex justify-between items-center shadow-sm">
                    <span className="text-slate-200 font-semibold truncate max-w-[150px]" title={col.source_header}>
                      {col.source_header || t("unknown_col", "Colonne inconnue")}
                    </span>
                    <span className="text-indigo-400 font-bold mx-2">→</span>
                    <select
                      className="border border-slate-800 rounded-lg px-2.5 py-1.5 bg-slate-950 text-slate-100 font-semibold focus:outline-none focus:border-indigo-500 max-w-[200px]"
                      value={col.mapped_column}
                      onChange={(e) => {
                        const newMapping = [...importSession.column_mapping];
                        newMapping[idx].mapped_column = e.target.value;
                        setImportSession({ ...importSession, column_mapping: newMapping });
                      }}
                    >
                      <option value="UNMAPPED">{t("ignored_metadata", "Ignoré (Métadonnées)")}</option>
                      {expectedType === "stock" && (
                        <>
                          <option value="name">{t("name_product", "Nom / Produit")}</option>
                          <option value="sku">{t("sku_ref", "SKU / Référence")}</option>
                          <option value="barcode">{t("barcode", "Code-barres")}</option>
                          <option value="description">{t("description", "Description")}</option>
                          <option value="category_name">{t("category", "Catégorie")}</option>
                          <option value="sub_category">{t("sub_category", "Sous-catégorie")}</option>
                          <option value="selling_price">{t("selling_price", "Prix de vente")}</option>
                          <option value="quantity">{t("quantity", "Quantité")}</option>
                          <option value="min_stock">{t("min_stock_alert", "Stock Minimum (Alerte)")}</option>
                          <option value="unit">{t("unit", "Unité")}</option>
                          <option value="brand">{t("brand", "Marque")}</option>
                          <option value="supplier_name">{t("fournisseurs", "Fournisseur")}</option>
                          <option value="status">{t("statut", "Statut")}</option>
                        </>
                      )}
                      {expectedType === "clients" && (
                        <>
                          <option value="customer_code">{t("code_client", "Code Client")}</option>
                          <option value="company_name">{t("company_name", "Entreprise")}</option>
                          <option value="contact_name">{t("contact_name", "Nom du contact")}</option>
                          <option value="email">{t("email", "E-mail")}</option>
                          <option value="phone">{t("phone", "Téléphone")}</option>
                          <option value="mobile">{t("mobile", "Mobile")}</option>
                          <option value="address">{t("address", "Adresse")}</option>
                          <option value="city">{t("city", "Ville")}</option>
                          <option value="country">{t("country", "Pays")}</option>
                          <option value="tax_identifier">{t("tax_id", "Matricule Fiscal")}</option>
                          <option value="ice">{t("ice", "ICE")}</option>
                        </>
                      )}
                      {expectedType === "suppliers" && (
                        <>
                          <option value="supplier_code">{t("code_supplier", "Code Fournisseur")}</option>
                          <option value="company_name">{t("company_name", "Entreprise")}</option>
                          <option value="contact_name">{t("contact_name", "Nom du contact")}</option>
                          <option value="email">{t("email", "E-mail")}</option>
                          <option value="phone">{t("phone", "Téléphone")}</option>
                          <option value="mobile">{t("mobile", "Mobile")}</option>
                          <option value="address">{t("address", "Adresse")}</option>
                          <option value="city">{t("city", "Ville")}</option>
                          <option value="country">{t("country", "Pays")}</option>
                          <option value="tax_identifier">{t("tax_id", "Matricule Fiscal")}</option>
                          <option value="ice">{t("ice", "ICE")}</option>
                        </>
                      )}
                      {col.mapped_column !== "UNMAPPED" && 
                       !["name", "sku", "barcode", "description", "category_name", "sub_category", "selling_price", "quantity", "min_stock", "unit", "brand", "supplier_name", "status", "customer_code", "company_name", "contact_name", "email", "phone", "mobile", "address", "city", "country", "tax_identifier", "ice"].includes(col.mapped_column) && (
                        <option value={col.mapped_column}>{col.mapped_column}</option>
                      )}
                    </select>
                  </div>
                )) : <span className="text-slate-400 text-[12px]">{t("invalid_mapping_data", "Erreur: données de mapping invalides")}</span>}
              </div>
            </div>

            <FormAlert error={error} onClose={() => setError(null)} title={t("import_error", "Erreur d'import")} />

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={isConfirming}
                className="rounded-xl px-4 py-2 text-[12.5px] font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
              >
                {t("cancel", "Annuler")}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirming}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-[12.5px] font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
              >
                {isConfirming ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {t("confirm_import", "Confirmer l'import")}
              </button>
            </div>
          </div>
        ) : (
          /* State 1: Upload Form */
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <TableProperties size={22} />
            </div>
            
            <div>
              <h4 className="text-base font-bold text-white mb-1">{t("ai_import_title", "Import Intelligent via IA")}</h4>
              <p className="text-[12px] text-slate-400 leading-relaxed">
                {t("ai_import_desc", "Uploadez un fichier Excel (.xlsx, .xls) ou CSV (.csv). L'IA va analyser les colonnes, vous proposer un mapping, puis insérer les données.")}
              </p>
            </div>

            <FormAlert error={error} onClose={() => setError(null)} title={t("import_error", "Erreur lors de l'import")} />

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all duration-300 ${
                  file ? "border-indigo-500 bg-indigo-500/10" : "border-slate-800 bg-slate-950 hover:border-indigo-500/50 hover:bg-slate-900"
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
                  }}
                />
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl mb-3 shadow-sm ${file ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>
                  {file ? <CheckCircle2 size={20} /> : <Upload size={20} />}
                </div>
                <p className="text-[13px] font-semibold text-slate-200">
                  {file ? file.name : t("select_file", "Sélectionner un fichier Excel ou CSV")}
                </p>
              </div>
              
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="rounded-xl px-4 py-2 text-[12.5px] font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                >
                  {t("cancel", "Annuler")}
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !file}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[12.5px] font-bold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <><Loader2 size={16} className="animate-spin" /> {t("analyzing", "Analyse...")}</>
                  ) : (
                    <><Send size={14} /> {t("next", "Suivant")}</>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}

