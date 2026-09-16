"use client";

import { useTranslation } from "@/lib/i18n";

const styles: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold",
  warning: "bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold",
  danger: "bg-red-500/15 text-red-300 border border-red-500/30 font-semibold",
  info: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold",
};

const statusKeyMap: Record<string, string> = {
  "Payée": "status.payee",
  "Payee": "status.payee",
  "En attente": "status.en_attente",
  "Envoyée": "status.envoyee",
  "Envoyee": "status.envoyee",
  "En retard": "status.en_retard",
  "Annulée": "status.annulee",
  "Annulee": "status.annulee",
  "Refusé": "status.refuse",
  "Refuse": "status.refuse",
  "Expiré": "status.expire",
  "Expire": "status.expire",
  "Brouillon": "status.brouillon",
  "Vue": "status.vue",
  "Accepté": "status.accepte",
  "Accepte": "status.accepte",
  "Converti": "status.converti",
  "Envoyé": "status.envoye",
  "Envoye": "status.envoye",
  "Validé": "status.valide",
  "Valide": "status.valide",
  "Partiel": "status.partiel",
  "Reçu": "status.recu",
  "Recu": "status.recu",
};

export default function StatusChip({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  let label: React.ReactNode = children;
  if (typeof children === "string") {
    const key = statusKeyMap[children];
    if (key) {
      label = t(key, children);
    }
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] ${styles[tone]}`}
    >
      {label}
    </span>
  );
}
