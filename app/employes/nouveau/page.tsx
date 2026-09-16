"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { mad } from "@/lib/format";
import { useRouter } from "next/navigation";

const DEDUCTION_PAR_PERSONNE = 360; // MAD/an, per Moroccan IR rules referenced in the cartography

export default function NouvelEmployePage() {
  const router = useRouter();
  const [personnesACharge, setPersonnesACharge] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    prenom: "",
    nom: "",
    cin: "",
    cnss: "",
    poste: "",
    departement: "",
    dateEmbauche: "2026-04-12",
    statut: "Actif",
    salaireBase: "",
    email: "",
    telephone: "",
    adresse: ""
  });

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await fetch('/api/employes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prenom: formData.prenom,
          nom: formData.nom,
          cin: formData.cin,
          cnss: formData.cnss,
          poste: formData.poste,
          departement: formData.departement,
          salaire_base: parseFloat(formData.salaireBase) || 0,
          statut: formData.statut
        })
      });
      
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dataUpdated", { detail: { type: "employes" } }));
      }
      
      router.refresh();
      router.push("/employes");
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  const economieAnnuelle = personnesACharge * DEDUCTION_PAR_PERSONNE;
  const economieMensuelle = economieAnnuelle / 12;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-[820px] space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/employes"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:border-brass/50 hover:text-ink-800"
        >
          <ChevronLeft size={16} />
        </Link>
        <h1 className="font-display text-[22px] font-semibold text-ink-900">Nouvel employé</h1>
      </div>

      <div className="ledger-card space-y-4">
        <p className="text-[12px] font-medium uppercase tracking-wide text-ink-400">
          CIN &amp; Numéro CNSS
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Prénom *" name="prenom" value={formData.prenom} onChange={handleChange} placeholder="Prénom" required />
          <Field label="Nom *" name="nom" value={formData.nom} onChange={handleChange} placeholder="Nom" required />
          <Field label="CIN *" name="cin" value={formData.cin} onChange={handleChange} placeholder="AB123456" required />
          <Field label="Numéro CNSS" name="cnss" value={formData.cnss} onChange={handleChange} placeholder="123456789" />
        </div>
      </div>

      <div className="ledger-card space-y-4">
        <p className="text-[12px] font-medium uppercase tracking-wide text-ink-400">
          Poste &amp; Département
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Poste" name="poste" value={formData.poste} onChange={handleChange} placeholder="Développeur Full-Stack" />
          <Field label="Département" name="departement" value={formData.departement} onChange={handleChange} placeholder="Ingénierie" />
          <Field label="Date d'embauche *" name="dateEmbauche" value={formData.dateEmbauche} onChange={handleChange} type="date" required />
          <div>
            <label className="mb-1.5 block text-[12.5px] text-ink-600">Statut</label>
            <select name="statut" value={formData.statut} onChange={handleChange} className="w-full rounded-md border border-ink-200 bg-paper px-3 py-2 text-[13px] focus:border-brass/60 focus:outline-none">
              <option value="Actif">Actif</option>
              <option value="Inactif">Inactif</option>
            </select>
          </div>
        </div>
      </div>

      <div className="ledger-card space-y-4">
        <p className="text-[12px] font-medium uppercase tracking-wide text-ink-400">
          Salaire de base (MAD/mois)
        </p>
        <Field label="Salaire de base (MAD/mois) *" name="salaireBase" value={formData.salaireBase} onChange={handleChange} type="number" placeholder="0.00" suffix="MAD / mois" required />

        <div>
          <label className="mb-2 block text-[12.5px] text-ink-600">Personnes à charge</label>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPersonnesACharge(i + 1 === personnesACharge ? i : i + 1)}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium ${
                  i < personnesACharge ? "bg-brass text-white" : "bg-ink-200/60 text-ink-500"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <span className="ml-1 text-[12px] text-ink-400">{personnesACharge} / 6</span>
          </div>
          {personnesACharge > 0 && (
            <div className="mt-2 rounded-md bg-status-successBg px-3 py-2 text-[12.5px] text-status-success">
              ~{mad(economieAnnuelle)}/an · ~{mad(Math.round(economieMensuelle))}/mois
              <span className="ml-1 text-status-success/70">économie IR</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Link
          href="/employes"
          className="rounded-md border border-ink-200 px-4 py-2 text-[13px] font-medium text-ink-700 hover:border-brass/50"
        >
          Annuler
        </Link>
        <button type="submit" disabled={isSubmitting} className="rounded-md bg-ink-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-ink-800 disabled:opacity-50">
          {isSubmitting ? "Enregistrement..." : "Ajouter l'employé"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  suffix,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: any) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  suffix?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12.5px] text-ink-600">{label}</label>
      <div className="flex items-center gap-2">
        <input
          name={name}
          value={value}
          onChange={onChange}
          type={type}
          placeholder={placeholder}
          required={required}
          className="w-full rounded-md border border-ink-200 bg-paper px-3 py-2 text-[13px] focus:border-brass/60 focus:outline-none"
        />
        {suffix && <span className="shrink-0 text-[12px] text-ink-400">{suffix}</span>}
      </div>
    </div>
  );
}
