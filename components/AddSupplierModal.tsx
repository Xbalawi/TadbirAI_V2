"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Modal from "./Modal";
import FormAlert from "./FormAlert";
import { useTranslation } from "@/lib/i18n";

export default function AddSupplierModal({
  isOpen,
  onClose,
  initialData,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  onSuccess?: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!initialData?.id;

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Maroc");
  const [ice, setIce] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setCompanyName(initialData.company_name || "");
      setContactName(initialData.contact_name || "");
      setEmail(initialData.email || "");
      setPhone(initialData.phone || initialData.mobile || "");
      setCity(initialData.city || "");
      setCountry(initialData.country || "Maroc");
      setIce(initialData.metadata?.ICE || "");
    } else {
      setCompanyName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setCity("");
      setCountry("Maroc");
      setIce("");
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Le nom de l'entreprise est obligatoire.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    const payload = {
      company_name: companyName,
      contact_name: contactName,
      email,
      phone,
      city,
      country,
      metadata: ice ? { ...(initialData?.metadata || {}), ICE: ice } : (initialData?.metadata || {})
    };

    try {
      const endpoint = isEdit ? `/api/suppliers/${initialData.id}` : "/api/suppliers";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Échec de la ${isEdit ? "modification" : "création"} du fournisseur.`);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "suppliers" } }));
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
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `${t("common.edit", "Modifier")} : ${companyName}` : t("modals.add_supplier_title", "Nouveau Fournisseur")}>
      <FormAlert error={error} onClose={() => setError(null)} title="Erreur de formulaire" />

      <form onSubmit={handleSubmit} className="space-y-4 text-slate-100">
        <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">{t("common.company", "Fournisseur / Entreprise")} *</label>
            <input
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Papeterie du Sud"
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">{t("common.name", "Nom du contact")}</label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Ex: Karim Tazi"
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">{t("common.email", "E-mail")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@fournisseur.ma"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">{t("common.phone", "Téléphone")}</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+212 522 000000"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">{t("common.city", "Ville")}</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Casablanca"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-300">ICE (Identifiant Fiscal)</label>
              <input
                value={ice}
                onChange={(e) => setIce(e.target.value)}
                placeholder="000XXXXXXXXXXXX"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
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
            {isEdit ? t("common.save", "Enregistrer") : t("common.add", "Ajouter")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
