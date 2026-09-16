export interface UnitOption {
  value: string;
  label: string;
  category: "mass" | "volume" | "dimension" | "packaging" | "service";
  symbol: string;
}

export const UNIVERSAL_UNITS: UnitOption[] = [
  // Conditionnement & Pièces
  { value: "unité", label: "Unité (Pièce)", symbol: "u", category: "packaging" },
  { value: "boîte", label: "Boîte (Bte)", symbol: "bte", category: "packaging" },
  { value: "carton", label: "Carton (Ctn)", symbol: "ctn", category: "packaging" },
  { value: "palette", label: "Palette (Pal)", symbol: "pal", category: "packaging" },
  { value: "paquet", label: "Paquet (Pqt)", symbol: "pqt", category: "packaging" },
  { value: "lot", label: "Lot", symbol: "lot", category: "packaging" },
  { value: "sac", label: "Sac", symbol: "sac", category: "packaging" },
  { value: "sachet", label: "Sachet", symbol: "sachet", category: "packaging" },
  { value: "bouteille", label: "Bouteille (Btl)", symbol: "btl", category: "packaging" },
  { value: "rouleau", label: "Rouleau (Rlx)", symbol: "rlx", category: "packaging" },
  { value: "pack", label: "Pack", symbol: "pack", category: "packaging" },
  { value: "baril", label: "Baril / Fût", symbol: "fût", category: "packaging" },

  // Masse / Poids
  { value: "kg", label: "Kilogramme (kg)", symbol: "kg", category: "mass" },
  { value: "g", label: "Gramme (g)", symbol: "g", category: "mass" },
  { value: "t", label: "Tonne (t)", symbol: "t", category: "mass" },
  { value: "mg", label: "Milligramme (mg)", symbol: "mg", category: "mass" },
  { value: "lb", label: "Livre (lb)", symbol: "lb", category: "mass" },
  { value: "oz", label: "Once (oz)", symbol: "oz", category: "mass" },

  // Volume & Liquides
  { value: "L", label: "Litre (L)", symbol: "L", category: "volume" },
  { value: "cL", label: "Centilitre (cL)", symbol: "cL", category: "volume" },
  { value: "mL", label: "Millilitre (mL)", symbol: "mL", category: "volume" },
  { value: "m³", label: "Mètre cube (m³)", symbol: "m³", category: "volume" },
  { value: "gal", label: "Gallon (gal)", symbol: "gal", category: "volume" },

  // Longueur & Surface
  { value: "m", label: "Mètre (m)", symbol: "m", category: "dimension" },
  { value: "cm", label: "Centimètre (cm)", symbol: "cm", category: "dimension" },
  { value: "mm", label: "Millimètre (mm)", symbol: "mm", category: "dimension" },
  { value: "km", label: "Kilomètre (km)", symbol: "km", category: "dimension" },
  { value: "m²", label: "Mètre carré (m²)", symbol: "m²", category: "dimension" },

  // Temps & Services
  { value: "heure", label: "Heure (h)", symbol: "h", category: "service" },
  { value: "jour", label: "Jour (j)", symbol: "j", category: "service" },
  { value: "mois", label: "Mois", symbol: "mois", category: "service" },
  { value: "forfait", label: "Forfait", symbol: "forfait", category: "service" },
  { value: "prestation", label: "Prestation", symbol: "prest", category: "service" },
  { value: "projet", label: "Projet", symbol: "proj", category: "service" },
];

export const UNIT_CATEGORIES = [
  { id: "packaging", label: "Conditionnement & Pièces" },
  { id: "mass", label: "Masse & Poids" },
  { id: "volume", label: "Volume & Liquides" },
  { id: "dimension", label: "Longueur & Surface" },
  { id: "service", label: "Temps & Services" },
];

export const formatUnit = (unitStr: string | undefined | null): string => {
  if (!unitStr) return "unité";
  const found = UNIVERSAL_UNITS.find(
    (u) => u.value.toLowerCase() === unitStr.toLowerCase() || u.symbol.toLowerCase() === unitStr.toLowerCase()
  );
  return found ? found.value : unitStr;
};
