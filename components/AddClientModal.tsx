"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Modal from "./Modal";
import FormAlert from "./FormAlert";
import { useTranslation } from "@/lib/i18n";

const fieldsByCountry: Record<string, { label: string; placeholder: string; key: string }[]> = {
  Maroc: [
    { label: "Identifiant Fiscal (IF)", placeholder: "IF XXXXXXX", key: "if" },
    { label: "ICE", placeholder: "000XXXXXXXXXXXX", key: "ice" },
    { label: "Registre de Commerce (RC)", placeholder: "RC XXXXX", key: "rc" },
  ],
  France: [
    { label: "SIREN", placeholder: "XXX XXX XXX", key: "siren" },
    { label: "SIRET", placeholder: "XXX XXX XXX XXXXX", key: "siret" },
    { label: "Numéro RCS", placeholder: "RCS Ville XXXXXXXXX", key: "rcs" },
    { label: "N° TVA intracommunautaire", placeholder: "FR XX XXX XXX XXX", key: "tva_intra" },
  ],
};

export default function AddClientModal({ 
  onClose, 
  onSuccess,
  initialData 
}: { 
  onClose: () => void; 
  onSuccess?: () => void;
  initialData?: any;
}) {
  const { t } = useTranslation();
  const isEditing = !!initialData;
  const [companyName, setCompanyName] = useState(initialData?.company_name || "");
  const [contactName, setContactName] = useState(initialData?.contact_name || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [phone, setPhone] = useState(initialData?.phone || initialData?.mobile || "");
  const [address, setAddress] = useState(initialData?.city || initialData?.address || "");
  const [pays, setPays] = useState(initialData?.country || "Maroc");
  const [fiscalData, setFiscalData] = useState<Record<string, string>>(initialData?.metadata || {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fiscalFields = fieldsByCountry[pays] ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Le nom de l'entreprise est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing ? `/api/clients/${initialData.id}` : "/api/clients";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          contact_name: contactName,
          email,
          phone,
          city: address,
          country: pays,
          metadata: fiscalData,
        }),
      });

      if (!res.ok) throw new Error(isEditing ? "Échec de la modification du client" : "Échec de la création du client");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "clients" } }));
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={isEditing ? t("common.edit", "Modifier") : t("modals.add_client_title", "Nouveau Client")}>
      <FormAlert error={error} onClose={() => setError(null)} title="Erreur de formulaire" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">{t("common.company", "Entreprise")} *</label>
            <input
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Atlas Tech SARL"
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">{t("common.name", "Nom du contact")}</label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Ex: Youssef Bennani"
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">{t("common.email", "E-mail")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@exemple.ma"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">{t("common.phone", "Téléphone")}</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+212 661 000000"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">{t("common.city", "Ville")} / {t("common.address", "Adresse")}</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Casablanca"
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">{t("common.country", "Pays")}</label>
            <select
              value={pays}
              onChange={(e) => setPays(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="Maroc">Maroc</option>
              <option value="France">France</option>
              <option value="Belgique">Belgique</option>
              <option value="Allemagne">Allemagne</option>
              <option value="Espagne">Espagne</option>
              <option value="Autre">Autre pays</option>
            </select>
          </div>

          {fiscalFields.length > 0 && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5">
              {fiscalFields.map((f) => (
                <div key={f.key} className={fiscalFields.length % 2 !== 0 && f === fiscalFields[fiscalFields.length - 1] ? "col-span-2" : ""}>
                  <label className="mb-1.5 block text-[12px] font-semibold text-indigo-300">{f.label}</label>
                  <input
                    placeholder={f.placeholder}
                    value={fiscalData[f.key] || ""}
                    onChange={(e) => setFiscalData({ ...fiscalData, [f.key]: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-[12.5px] text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            {t("common.cancel", "Annuler")}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 disabled:opacity-60 transition-all active:scale-95"
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            {isEditing ? t("common.save", "Enregistrer") : t("common.add", "Ajouter")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
