// Removed mock store imports

export interface ColumnMapping {
  source_header: string;
  mapped_column: string;
}

export interface SpreadsheetSession {
  id: string;
  data_type: "stock" | "clients" | "suppliers" | string;
  headers: string[];
  rawRows: any[][];
  column_mapping: ColumnMapping[];
  created_at: number;
}

const g = global as any;
g.spreadsheetSessionsMap = g.spreadsheetSessionsMap || new Map<string, SpreadsheetSession>();
const sessionsMap: Map<string, SpreadsheetSession> = g.spreadsheetSessionsMap;

export const createSpreadsheetSession = (
  id: string,
  dataType: string,
  headers: string[],
  rawRows: any[][],
  columnMapping: ColumnMapping[]
): SpreadsheetSession => {
  const session: SpreadsheetSession = {
    id,
    data_type: dataType,
    headers,
    rawRows,
    column_mapping: columnMapping,
    created_at: Date.now()
  };
  sessionsMap.set(id, session);
  return session;
};

export const getSpreadsheetSession = (id: string): SpreadsheetSession | undefined => {
  return sessionsMap.get(id);
};

export const updateSpreadsheetMapping = (id: string, newMapping: ColumnMapping[]) => {
  const session = sessionsMap.get(id);
  if (session) {
    session.column_mapping = newMapping;
  }
  return session;
};

const parseNumeric = (val: any, defaultVal = 0): number => {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const str = String(val).trim();
  if (!str) return defaultVal;
  const cleaned = str
    .replace(/[^\d.,-]/g, '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? defaultVal : num;
};

export const confirmSpreadsheetImport = (id: string) => {
  const session = sessionsMap.get(id);
  if (!session) {
    return { inserted_rows: 0, data_type: "stock" };
  }

  const { data_type, rawRows, headers, column_mapping } = session;
  let inserted = 0;
  const parsedRows: any[] = [];

  // Build mapping lookup: source_header -> mapped_column
  const mappingLookup: Record<string, string> = {};
  column_mapping.forEach((col) => {
    if (col.source_header && col.mapped_column && col.mapped_column !== "UNMAPPED") {
      mappingLookup[col.source_header] = col.mapped_column;
    }
  });

  for (const rowArr of rawRows) {
    if (!Array.isArray(rowArr) || rowArr.length === 0) continue;

    const rowObj: Record<string, any> = {};
    const unmappedObj: Record<string, any> = {};
    const allValues: string[] = [];

    headers.forEach((h, index) => {
      const val = rowArr[index];
      if (val === undefined || val === null || String(val).trim() === "") return;

      const strVal = String(val).trim();
      allValues.push(strVal);

      const targetCol = mappingLookup[h];
      if (targetCol && targetCol !== "UNMAPPED") {
        rowObj[targetCol] = strVal;
      } else {
        unmappedObj[h] = strVal;
      }
    });

    if (allValues.length === 0) continue;
    
    const finalMetadata: Record<string, any> = { ...unmappedObj };
    Object.keys(rowObj).forEach(k => {
      if (k.startsWith("metadata.")) {
        finalMetadata[k.replace("metadata.", "")] = rowObj[k];
        delete rowObj[k];
      }
    });
    const hasMetadata = Object.keys(finalMetadata).length > 0;

    const isStockType = data_type === "stock" || data_type === "products" || data_type === "stocks";

    if (isStockType) {
      // Find name from rowObj, unmapped, or first text value
      let nameVal = rowObj.name || rowObj.title || rowObj.product || rowObj.designation || rowObj.description || rowObj.article || rowObj.libelle;
      if (!nameVal) {
        const unmappedKey = Object.keys(unmappedObj).find(k => {
          const l = k.toLowerCase();
          return l.includes("nom") || l.includes("designation") || l.includes("article") || l.includes("produit") || l.includes("title") || l.includes("libelle");
        });
        if (unmappedKey) nameVal = unmappedObj[unmappedKey];
      }
      if (!nameVal) nameVal = allValues[0] || "Produit Importé";

      // Find SKU
      let skuVal = rowObj.sku || rowObj.ref || rowObj.code;
      if (!skuVal) {
        const unmappedKey = Object.keys(unmappedObj).find(k => {
          const l = k.toLowerCase();
          return l.includes("sku") || l.includes("ref") || l.includes("code");
        });
        if (unmappedKey) skuVal = unmappedObj[unmappedKey];
      }
      if (!skuVal) skuVal = `PRD-${Math.floor(1000 + Math.random() * 9000)}`;

      // Find price
      let priceVal = rowObj.selling_price !== undefined ? rowObj.selling_price : (rowObj.price !== undefined ? rowObj.price : (rowObj.prix !== undefined ? rowObj.prix : rowObj.prix_vente));
      if (priceVal === undefined || priceVal === null || priceVal === "") {
        const unmappedKey = Object.keys(unmappedObj).find(k => {
          const l = k.toLowerCase();
          return l.includes("prix") || l.includes("price") || l.includes("tarif") || l.includes("ht") || l.includes("ttc") || l.includes("montant");
        });
        if (unmappedKey) priceVal = unmappedObj[unmappedKey];
      }

      // Find quantity
      let qtyVal = rowObj.quantity !== undefined ? rowObj.quantity : (rowObj.qty !== undefined ? rowObj.qty : (rowObj.quantite !== undefined ? rowObj.quantite : (rowObj.stock !== undefined ? rowObj.stock : rowObj.stock_actuel)));
      if (qtyVal === undefined || qtyVal === null || qtyVal === "") {
        const unmappedKey = Object.keys(unmappedObj).find(k => {
          const l = k.toLowerCase();
          return l.includes("quant") || l.includes("qte") || l.includes("qty") || l.includes("stock");
        });
        if (unmappedKey) qtyVal = unmappedObj[unmappedKey];
      }

      // Find unit & category
      const unitVal = rowObj.unit || rowObj.unite || "unité";
      const catVal = rowObj.category_name || rowObj.category || rowObj.famille || rowObj.categorie || "Général";
      
      // Find sub-category
      let subCatVal = rowObj.sub_category || rowObj.sous_categorie || rowObj.sous_famille || rowObj.subCategory || "";
      if (!subCatVal) {
        const unmappedKey = Object.keys(unmappedObj).find(k => {
          const l = k.toLowerCase();
          return l.includes("sous_cat") || l.includes("sous-cat") || l.includes("subcat") || l.includes("sous_fam") || l.includes("sous-fam");
        });
        if (unmappedKey) subCatVal = unmappedObj[unmappedKey];
      }

      // Find min_stock
      let minStockVal = rowObj.min_stock || rowObj.minimum_stock || rowObj.seuil_alerte || rowObj.seuil || rowObj.stock_min;
      if (minStockVal === undefined || minStockVal === null || minStockVal === "") {
        const unmappedKey = Object.keys(unmappedObj).find(k => {
          const l = k.toLowerCase();
          return l.includes("seuil") || l.includes("min_stock") || l.includes("minstock") || l.includes("stock_min") || l.includes("alerte");
        });
        if (unmappedKey) minStockVal = unmappedObj[unmappedKey];
      }

      parsedRows.push({
        name: String(nameVal),
        sku: String(skuVal),
        selling_price: parseNumeric(priceVal, 0),
        quantity: parseNumeric(qtyVal, 0),
        min_stock: parseNumeric(minStockVal, 5),
        unit: String(unitVal),
        category_name: String(catVal),
        sub_category: String(subCatVal),
        metadata: hasMetadata ? finalMetadata : undefined
      });
      inserted++;
    } else if (data_type === "clients") {
      const company = rowObj.company_name || rowObj.company || rowObj.societe || rowObj.entreprise || rowObj.client || rowObj.name || allValues[0] || "Client Importé";
      const contact = rowObj.contact_name || rowObj.contact || rowObj.responsable || rowObj.prenom || (allValues[1] && allValues[1] !== company ? allValues[1] : "");
      const emailVal = rowObj.email || rowObj.mail || rowObj.courriel || (allValues.find(v => v.includes("@")) || "");
      const phoneVal = rowObj.phone || rowObj.mobile || rowObj.tel || rowObj.gsm || "";
      const cityVal = rowObj.city || rowObj.ville || "Casablanca";

      parsedRows.push({
        company_name: String(company),
        customer_code: String(rowObj.customer_code || rowObj.code || `CL-${Math.floor(1000 + Math.random() * 9000)}`),
        contact_name: String(contact),
        email: String(emailVal),
        phone: String(phoneVal),
        city: String(cityVal),
        country: String(rowObj.country || "Maroc"),
        metadata: hasMetadata ? finalMetadata : undefined
      });
      inserted++;
    } else if (data_type === "suppliers") {
      const company = rowObj.company_name || rowObj.company || rowObj.societe || rowObj.entreprise || rowObj.fournisseur || rowObj.name || allValues[0] || "Fournisseur Importé";
      const contact = rowObj.contact_name || rowObj.contact || rowObj.responsable || (allValues[1] && allValues[1] !== company ? allValues[1] : "");
      const emailVal = rowObj.email || rowObj.mail || rowObj.courriel || (allValues.find(v => v.includes("@")) || "");
      const phoneVal = rowObj.phone || rowObj.mobile || rowObj.tel || "";
      const cityVal = rowObj.city || rowObj.ville || "Casablanca";

      parsedRows.push({
        company_name: String(company),
        supplier_code: String(rowObj.supplier_code || rowObj.code || `FR-${Math.floor(1000 + Math.random() * 9000)}`),
        contact_name: String(contact),
        email: String(emailVal),
        phone: String(phoneVal),
        city: String(cityVal),
        country: String(rowObj.country || "Maroc"),
        metadata: hasMetadata ? finalMetadata : undefined
      });
      inserted++;
    }
  }

  // Clean up session
  sessionsMap.delete(id);

  return {
    inserted_rows: inserted,
    data_type,
    parsed_rows: parsedRows
  };
};
