import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createSpreadsheetSession, ColumnMapping } from "@/lib/spreadsheet-store";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const expectedType = (formData.get("expected_type") as string) || "stock";

    if (!file) {
      return NextResponse.json({ error: "Veuillez fournir un fichier Excel ou CSV." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer", codepage: 65001 });
    } catch (e) {
      return NextResponse.json({ error: "Format de fichier non valide. Utilisez un fichier .xlsx ou .csv." }, { status: 400 });
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: "Le fichier Excel ne contient aucune feuille." }, { status: 400 });
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: "Le fichier est vide." }, { status: 400 });
    }

    const headers: string[] = (rawData[0] || []).map((h: any, i: number) => String(h || "").trim() || `Colonne_${i + 1}`);
    const dataRows = rawData.slice(1).filter((row) => Array.isArray(row) && row.some((cell) => cell !== null && cell !== "" && String(cell).trim() !== ""));

    const manualMapping = headers.map((header) => {
      const lower = header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let mapped = "UNMAPPED";

      if (expectedType === "stock") {
        if (lower.includes("nom") || lower.includes("produit") || lower.includes("designation") || lower.includes("article") || lower.includes("title")) mapped = "name";
        else if (lower.includes("sku") || lower.includes("ref") || lower.includes("code")) mapped = "sku";
        else if (lower.includes("prix") || lower.includes("price") || lower.includes("tarif") || lower.includes("ht")) mapped = "selling_price";
        else if (lower.includes("quant") || lower.includes("stock") || lower.includes("qte") || lower.includes("qty")) mapped = "quantity";
        else if (lower.includes("categ") || lower.includes("famille")) mapped = "category_name";
        else if (lower.includes("unit")) mapped = "unit";
        else if (lower.includes("desc") || lower.includes("detail")) mapped = "description";
        else if (lower.includes("tva") || lower.includes("tax")) mapped = "tax_rate";
      } else if (expectedType === "clients") {
        if (lower.includes("code") || lower.includes("id_client")) mapped = "customer_code";
        else if (lower.includes("mail") || lower.includes("courriel")) mapped = "email";
        else if (lower.includes("tel") || lower.includes("phone") || lower.includes("mobile") || lower.includes("gsm")) mapped = "phone";
        else if (lower.includes("ville") || lower.includes("city")) mapped = "city";
        else if (lower.includes("contact") || lower.includes("prenom") || lower.includes("responsable")) mapped = "contact_name";
        else if (lower.includes("societe") || lower.includes("entreprise") || lower.includes("client") || lower.includes("company") || lower.includes("raison") || lower.includes("nom")) mapped = "company_name";
      } else if (expectedType === "suppliers") {
        if (lower.includes("code")) mapped = "supplier_code";
        else if (lower.includes("mail") || lower.includes("courriel")) mapped = "email";
        else if (lower.includes("tel") || lower.includes("phone") || lower.includes("mobile") || lower.includes("gsm")) mapped = "phone";
        else if (lower.includes("ville") || lower.includes("city")) mapped = "city";
        else if (lower.includes("contact") || lower.includes("prenom")) mapped = "contact_name";
        else if (lower.includes("fournisseur") || lower.includes("societe") || lower.includes("company") || lower.includes("entreprise") || lower.includes("nom")) mapped = "company_name";
      }

      return {
        source_header: header,
        mapped_column: mapped
      };
    });

    let columnMapping: ColumnMapping[] = manualMapping;
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && headers.length > 0) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const targetFieldsMap: Record<string, string> = {
          stock: "- name (nom produit)\n- sku (référence/code)\n- selling_price (prix vente HT/TTC)\n- quantity (quantité/stock/stock disponible)\n- unit (unité)\n- category_name (catégorie)\n- description\n- barcode (code-barres)\n- min_stock (stock minimum)\n- brand (marque)\n- supplier_name (fournisseur)",
          clients: "- company_name (entreprise/client)\n- customer_code (code client)\n- contact_name (nom contact)\n- email (e-mail)\n- phone (téléphone)\n- city (ville)\n- address (adresse)\n- ice (ICE)\n- tax_identifier (IF/Matricule fiscal)",
          suppliers: "- company_name (fournisseur/entreprise)\n- supplier_code (code fournisseur)\n- contact_name (nom contact)\n- email (e-mail)\n- phone (téléphone)\n- city (ville)\n- address (adresse)\n- ice (ICE)\n- tax_identifier (IF)"
        };

        const targetFieldsText = targetFieldsMap[expectedType] || targetFieldsMap.stock;

        const sampleRows = dataRows.slice(0, 3);
        const promptText = `Tu es un assistant IA d'importation de données. Associe chaque en-tête à une clé cible en analysant son contenu.

En-têtes du fichier utilisateur :
${JSON.stringify(headers)}

Exemples de données pour t'aider à comprendre le contexte :
${JSON.stringify(sampleRows)}

Clés cibles autorisées pour le type "${expectedType}" :
${targetFieldsText}

Règles STRICTES et OBLIGATOIRES :
1. Pour mapper à un champ standard, tu DOIS utiliser EXACTEMENT l'une des clés en anglais de la liste ci-dessus (ex: 'quantity', 'selling_price', 'name', etc.). N'utilise JAMAIS de termes français ou modifiés pour les clés cibles. Traduis le sens de l'en-tête pour trouver la meilleure clé anglaise correspondante.
2. Si une colonne contient des informations pertinentes mais qui ne correspondent VRAIMENT à aucune clé standard (ex: 'Couleur', 'Taille', 'Origine'), mappe-la en tant que métadonnée dynamique en utilisant le préfixe 'metadata.' suivi du nom simplifié (ex: 'metadata.couleur', 'metadata.taille').
3. Si la colonne est totalement inutile, vide ou incompréhensible, utilise "UNMAPPED".

Réponds UNIQUEMENT avec un tableau JSON strict au format :
[
  { "source_header": "En-tête source", "mapped_column": "cle_cible_ou_metadata" }
]`;

        let response: any = null;
        let lastError: any = null;
        const candidateModels = ["gemini-3.6-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-2.5-flash", "gemini-1.5-pro"];
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
          } catch (e: any) {
            console.error(`Erreur Gemini avec ${modelName}:`, e.message);
            lastError = e;
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
              const restJson = await restRes.json();
              if (restJson.candidates?.[0]?.content?.parts?.[0]?.text) {
                response = { text: restJson.candidates[0].content.parts[0].text };
                lastError = null;
                break;
              } else if (restJson.error) {
                lastError = restJson.error;
              }
            } catch (restErr: any) {
              console.warn(`Direct REST API fallback error for ${ep}:`, restErr);
            }
          }
        }

        if (response && response.text) {
          try {
            const match = response.text.match(/\[[\s\S]*\]/);
            const cleanText = match ? match[0] : response.text.trim();
            const parsed = JSON.parse(cleanText);
            
            if (Array.isArray(parsed) && parsed.length > 0) {
              columnMapping = manualMapping.map((manualItem) => {
                const aiMatch = parsed.find((p: any) => 
                  p.source_header && p.source_header.trim().toLowerCase() === manualItem.source_header.trim().toLowerCase()
                );
                if (aiMatch && aiMatch.mapped_column && aiMatch.mapped_column !== "UNMAPPED") {
                  return { source_header: manualItem.source_header, mapped_column: aiMatch.mapped_column };
                }
                return manualItem;
              });
            }
          } catch (parseError: any) {
             console.error("Erreur de parsing du JSON de Gemini:", parseError.message, "Texte reçu:", response.text);
          }
        }
      } catch (err: any) {
        console.warn("Gemini spreadsheet mapping warning:", err?.message);
      }
    }

    const sessionId = `sheet-${Date.now()}`;
    const session = createSpreadsheetSession(sessionId, expectedType, headers, dataRows, columnMapping);

    return NextResponse.json({
      id: session.id,
      data_type: session.data_type,
      row_count: dataRows.length,
      column_mapping: session.column_mapping
    });

  } catch (error: any) {
    console.error("Spreadsheet AI API Error:", error);
    return NextResponse.json({ error: "Erreur lors de l'analyse du fichier Excel." }, { status: 500 });
  }
}
