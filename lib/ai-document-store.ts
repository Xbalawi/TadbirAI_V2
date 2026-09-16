// Global in-memory AI Document extraction store

export type AIDocumentData = {
  id: string;
  status: string;
  extracted_data: {
    fournisseur: string;
    client: string;
    type: "devis" | "facture";
    numero_facture: string;
    date: string;
    montant_ht: number;
    montant_ttc: number;
    taux_tva: number;
    lignes: Array<{
      description: string;
      quantite: number;
      prix_unitaire: number;
      montant: number;
    }>;
  };
};

const g = global as unknown as { __aiDocStore?: Map<string, AIDocumentData> };

if (!g.__aiDocStore) {
  g.__aiDocStore = new Map<string, AIDocumentData>();
}

export const aiDocumentStore = g.__aiDocStore;

export function saveAIDocument(data: AIDocumentData) {
  aiDocumentStore.set(data.id, data);
}

export function getAIDocument(id: string): AIDocumentData | undefined {
  return aiDocumentStore.get(id);
}
