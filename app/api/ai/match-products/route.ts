import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { lineItems, products } = await req.json();

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ error: "Aucune ligne à analyser." }, { status: 400 });
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      // If no products exist, just return no matches
      const emptyMatches = lineItems.map((_, index) => ({ index, product_id: null, confidence: 0 }));
      return NextResponse.json({ matches: emptyMatches });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        error: "La clé API Gemini (GEMINI_API_KEY) n'est pas configurée."
      }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Format products for AI (to save tokens, only send relevant info)
    const catalogForAI = products.map((p: any) => ({
      id: p.id,
      name: p.name || p.nom,
      sku: p.sku
    }));

    const promptText = `Tu es un expert en rapprochement de données (Data Matching).
Ta tâche est de trouver le produit existant qui correspond le mieux à chaque ligne extraite d'une facture/devis.

Voici la liste de nos produits existants dans la base de données :
${JSON.stringify(catalogForAI)}

Voici les lignes extraites du document :
${JSON.stringify(lineItems)}

RÈGLES STRICTES :
1. Analyse sémantiquement la description de chaque ligne et compare-la aux noms et SKU des produits existants.
2. Si un produit existant est clairement le même article (même si la description est légèrement différente, abrégée, ou contient des informations supplémentaires comme "(x2)" ou "rack 2U"), renvoie l'ID de ce produit et un score de confiance (de 0.0 à 1.0).
3. Sois TRÈS tolérant sur les espaces, la casse, et les ajouts. Par exemple, "ServerNode X200" correspond parfaitement à "Server Node X200". N'hésite pas à matcher si c'est de toute évidence le même article.
4. Si la ligne est un produit totalement nouveau qui ne ressemble à rien dans la base, renvoie "null" pour l'ID.
5. Tu DOIS renvoyer un tableau JSON contenant EXACTEMENT un objet pour chaque ligne fournie, dans le MÊME ORDRE.

Format JSON strict attendu :
[
  {
    "index": 0,
    "product_id": "id-du-produit-ou-null",
    "confidence": 0.95,
    "extracted_quantity": 2 // Si "x2" ou "2 pièces" est détecté dans la description, sinon renvoie 1
  }
]
`;

    let response: any = null;
    let lastError: any = null;

    const candidateModels = [
      "gemini-3.6-flash",
      "gemini-2.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-pro"
    ];

    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: promptText,
          config: {
            responseMimeType: "application/json"
          }
        });
        if (response && response.text) break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!response || !response.text) {
      for (const ep of candidateModels) {
        try {
          const restRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ep}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }]
            })
          });
          if (restRes.ok) {
            const data = await restRes.json();
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              response = { text: data.candidates[0].content.parts[0].text };
              lastError = null;
              break;
            }
          } else {
             const errorData = await restRes.json();
             lastError = new Error(errorData?.error?.message || "REST API Error");
          }
        } catch (e: any) {
          lastError = e;
        }
      }
    }

    if (response && response.text) {
      console.log("[AI MATCH] AI Response:", response.text);
      let cleanText = response.text.replace(/```json/gi, "").replace(/```/gi, "").trim();
      const firstBrace = cleanText.indexOf('[');
      const lastBrace = cleanText.lastIndexOf(']');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
      }

      try {
        const matches = JSON.parse(cleanText);
        console.log("[AI MATCH] Parsed Matches:", matches);
        return NextResponse.json({ matches });
      } catch (e) {
        console.warn("JSON parsing error from Gemini mapping:", e, cleanText);
      }
    }

    // Fallback: If AI fails or returns invalid JSON, return no matches so it doesn't break the UI
    console.error("AI product matching failed:", lastError?.message);
    const emptyMatches = lineItems.map((_, index) => ({ index, product_id: null, confidence: 0 }));
    return NextResponse.json({ matches: emptyMatches });

  } catch (error: any) {
    console.error("Error matching products via AI:", error);
    return NextResponse.json({ error: "Erreur serveur lors du matching AI." }, { status: 500 });
  }
}
