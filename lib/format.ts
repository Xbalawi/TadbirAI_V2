export function getStoredDevise(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("devise") || "MAD";
  }
  return "MAD";
}

export function mad(n: any, overrideDevise?: string): string {
  const val = Number(n);
  const safeVal = isNaN(val) || val === null || val === undefined ? 0 : val;
  const d = overrideDevise || getStoredDevise();

  if (d === "EUR") {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeVal) + " €";
  }
  if (d === "USD") {
    return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeVal);
  }
  return new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeVal) + " " + d;
}

export function statusTone(statut: string): "success" | "warning" | "danger" | "info" {
  const map: Record<string, "success" | "warning" | "danger" | "info"> = {
    Payée: "success",
    Payee: "success",
    "En attente": "warning",
    Envoyée: "warning",
    Envoyee: "warning",
    "En retard": "danger",
    Annulée: "danger",
    Annulee: "danger",
    Refusé: "danger",
    Refuse: "danger",
    Expiré: "danger",
    Expire: "danger",
    Brouillon: "info",
    Vue: "info",
    Accepté: "success",
    Accepte: "success",
    Converti: "success",
  };
  return map[statut] ?? "info";
}
