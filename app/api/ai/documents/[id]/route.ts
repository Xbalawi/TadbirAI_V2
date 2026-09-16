import { NextResponse } from "next/server";
import { getAIDocument } from "@/lib/ai-document-store";

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const doc = getAIDocument(params.id);
  
  if (doc) {
    return NextResponse.json(doc);
  }

  // Fallback demo document if id not found in memory
  return NextResponse.json({
    id: params.id,
    status: "completed",
    extracted_data: {
      fournisseur: "Société Marocaine de Service SARL",
      client: "Client Démo",
      type: "devis",
      numero_facture: `DEV-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split("T")[0],
      montant_ht: 2500,
      montant_ttc: 3000,
      taux_tva: 20,
      lignes: [
        {
          description: "Prestation de Développement & Service Technique (IA)",
          quantite: 1,
          prix_unitaire: 2500,
          montant: 2500
        }
      ]
    }
  });
}
