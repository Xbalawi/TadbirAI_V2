import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { saveAIDocument } from "@/lib/ai-document-store";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const text = formData.get("text") as string | null;
    const docType = (formData.get("doc_type") as string) || "devis";

    if (!file && !text) {
      return NextResponse.json({ status: "failed", error_message: "Aucun document ou texte fourni" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        status: "failed",
        error_message: "La clé API Gemini (GEMINI_API_KEY) n'est pas configurée dans les variables d'environnement Railway."
      }, { status: 400 });
    }

    let response: any = null;
    let lastError: any = null;

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const promptText = `Tu es un assistant comptable IA et un expert OCR de haute précision.
Ton rôle est de lire ce document (${file ? file.name : "texte"}) et d'extraire les informations EXACTES qui y sont écrites.

RÈGLES STRICTES :
1. N'INVENTE OU NE DEVINER AUCUNE INFORMATION. N'UTILISE AUCUNE DONNÉE FACTICE.
2. Si une information (client, fournisseur, numéro, etc.) n'apparaît pas sur le document, laisse une chaîne vide "".
3. Extrais TOUS les articles/prestations présents dans le tableau du document sous le champ "lignes".

Consignes d'extraction JSON :
- "type": "${docType === "devis" ? "devis" : "facture"}"
- "fournisseur": Nom exact du fournisseur / émetteur tel qu'écrit sur le document.
- "client": Nom exact du client / destinataire tel qu'écrit sur le document.
- "numero_facture": Numéro exact du devis ou de la facture.
- "date": Date au format YYYY-MM-DD (ou "" si absente).
- "montant_ht": Total HT numérique exact.
- "montant_ttc": Total TTC numérique exact.
- "taux_tva": Taux de TVA en % (numérique).
- "lignes": Array d'objets [{ "description": "", "quantite": 1, "prix_unitaire": 0, "montant": 0 }]

Renvoie STRICTEMENT un objet JSON valide sans texte supplémentaire.`;

      let contentsParts: any[] = [];

      if (text) {
        contentsParts.push({ text: `Document à analyser :\n"${text}"\n\n${promptText}` });
      } else {
        contentsParts.push({ text: promptText });
      }

      let restParts: any[] = [];
      if (file) {
        const fileName = file.name || "document.pdf";
        const mimeType = file.type || "image/png";
        const bytes = await file.arrayBuffer();
        const base64Data = Buffer.from(bytes).toString("base64");

        let effectiveMimeType = mimeType;
        if (!effectiveMimeType || effectiveMimeType === "application/octet-stream") {
          if (fileName.endsWith(".pdf")) effectiveMimeType = "application/pdf";
          else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) effectiveMimeType = "image/jpeg";
          else effectiveMimeType = "image/png";
        }

        contentsParts.unshift({
          inlineData: {
            mimeType: effectiveMimeType,
            data: base64Data
          }
        });

        restParts.push({
          inline_data: {
            mime_type: effectiveMimeType,
            data: base64Data
          }
        });
      }

      if (text) {
        restParts.push({ text: `Document à analyser :\n"${text}"\n\n${promptText}` });
      } else {
        restParts.push({ text: promptText });
      }

      const candidateModels = [
        "gemini-3.6-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
      ];

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: contentsParts,
            config: {
              responseMimeType: "application/json"
            }
          });
          if (response && response.text) break;
        } catch (err: any) {
          try {
            response = await ai.models.generateContent({
              model: modelName,
              contents: contentsParts
            });
            if (response && response.text) break;
          } catch (e: any) {
            lastError = err;
          }
        }
      }

      // Direct REST API Fallback with snake_case payload for v1beta REST API
      if (!response || !response.text) {
        const restEndpoints = [
          "gemini-3.6-flash",
          "gemini-1.5-flash-latest",
          "gemini-1.5-flash",
          "gemini-1.5-pro"
        ];

        for (const ep of restEndpoints) {
          try {
            const restRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ep}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: restParts }]
              })
            });
            const restJson = await restRes.json();
            if (restJson.candidates?.[0]?.content?.parts?.[0]?.text) {
              response = { text: restJson.candidates[0].content.parts[0].text };
              break;
            } else if (restJson.error) {
              lastError = restJson.error;
            }
          } catch (restErr: any) {
            console.warn(`Direct REST API fallback error for ${ep}:`, restErr);
          }
        }
      }
    } catch (geminiInitErr: any) {
      lastError = geminiInitErr;
      console.warn("Gemini initialization warning:", geminiInitErr?.message || geminiInitErr);
    }

    if (response && response.text) {
      let cleanText = response.text.replace(/```json/gi, "").replace(/```/gi, "").trim();
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
      }

      try {
        const extracted = JSON.parse(cleanText);
        const docResult = {
          id: `doc-${Date.now()}`,
          status: "completed",
          extracted_data: {
            fournisseur: extracted.fournisseur || extracted.supplier || "",
            client: extracted.client || extracted.customer || "",
            type: (extracted.type === "devis" || docType === "devis" ? "devis" : "facture") as "devis" | "facture",
            numero_facture: extracted.numero_facture || extracted.numero || extracted.devis_number || "",
            date: extracted.date || new Date().toISOString().split("T")[0],
            montant_ht: Number(extracted.montant_ht) || Number(extracted.total_ht) || 0,
            montant_ttc: Number(extracted.montant_ttc) || Number(extracted.total_ttc) || 0,
            taux_tva: Number(extracted.taux_tva) || 20,
            lignes: Array.isArray(extracted.lignes) && extracted.lignes.length > 0 
              ? extracted.lignes.map((l: any) => ({
                  description: l.description || l.nom || l.article || "",
                  quantite: Number(l.quantite || l.qte || l.quantity || 1),
                  prix_unitaire: Number(l.prix_unitaire || l.prix || l.unit_price || 0),
                  montant: Number(l.montant || (Number(l.quantite || 1) * Number(l.prix_unitaire || 0)))
                }))
              : []
          }
        };
        saveAIDocument(docResult);
        return NextResponse.json(docResult);
      } catch (e) {
        console.warn("JSON parsing error from Gemini:", e);
      }
    }

    return NextResponse.json({
      status: "failed",
      error_message: lastError?.message || "Échec de l'extraction par l'IA Gemini. Veuillez vérifier votre clé API ou le format du fichier."
    }, { status: 500 });

  } catch (error: any) {
    console.error("Error processing document AI:", error);
    return NextResponse.json({
      status: "failed",
      error_message: error?.message || "Une erreur est survenue lors du traitement du document."
    }, { status: 500 });
  }
}
