import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getClients,
  getClientsByOrg,
  getClientById,
  addClient,
  updateClient,
  deleteClient,
  clearClients,
  getProducts,
  getProductsByOrg,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  bulkDeleteProducts,
  clearProducts,
  getSuppliers,
  getSuppliersByOrg,
  getSupplierById,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  clearSuppliers,
  getInvoices,
  getInvoicesByOrg,
  getInvoiceById,
  addInvoice,
  updateInvoice,
  deleteInvoice,
  clearInvoices,
  getQuotations,
  getQuotationsByOrg,
  getQuotationById,
  addQuotation,
  updateQuotation,
  deleteQuotation,
  clearQuotations,
  getStockMovements,
  getStockMovementsByOrg,
  adjustProductStock,
  getEmployees,
  getEmployeesByOrg,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  clearEmployees,
  getAvoirs,
  getAvoirsByOrg,
  addAvoir,
  updateAvoir,
  deleteAvoir,
  getDepenses,
  getDepensesByOrg,
  addDepense,
  updateDepense,
  deleteDepense,
  clearDepenses,
  getBulletins,
  getBulletinsByOrg,
  addBulletin,
  getBonsCommande,
  getBonsCommandeByOrg,
  getBonCommandeById,
  addBonCommande,
  updateBonCommande,
  deleteBonCommande,
  clearBonsCommande,
  getCompanies,
  addCompany,
  updateCompany,
  deleteCompany,
  getCompanySettings,
  updateCompanySettings,
  getEquipe,
  addEquipe,
  updateEquipe,
  deleteEquipe,
  bulkDeleteEquipe,
  getUsers,
  findUserByEmail,
  addUser,
  getSupportTickets,
  addSupportTicket,
  updateSupportTicket,
  deleteSupportTicket,
} from './data-store';

/**
 * Parses request body safely as JSON
 */
async function parseBody(req: Request): Promise<any> {
  try {
    const text = await req.text();
    if (!text || text.trim() === '') return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * Resolves organization ID from cookies, headers, or query params
 */
function getOrgId(req: Request): string | null {
  const orgFromHeader = req.headers.get('x-organization-id');
  if (orgFromHeader) return decodeURIComponent(orgFromHeader);

  try {
    const url = new URL(req.url);
    const orgFromQuery = url.searchParams.get('organization') || url.searchParams.get('org') || url.searchParams.get('orgId');
    if (orgFromQuery) return orgFromQuery;
  } catch {}

  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)x-organization-id=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);

  try {
    const cookieStore = cookies();
    const orgFromCookie = (cookieStore as any)?.get?.('x-organization-id')?.value;
    if (orgFromCookie) return decodeURIComponent(orgFromCookie);
  } catch {}

  return null;
}

/**
 * Handles API routes using the in-memory/JSON data-store.
 * Provides instant responses and zero 503s for all modules.
 */
export async function handleLocalApi(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const pathname = url.pathname.replace(/\/$/, ""); // Strip trailing slash for uniform matching
  const method = req.method.toUpperCase();
  const orgId = getOrgId(req);

  // Split path into segments: e.g. ["api", "products", "prod-123"]
  const segments = pathname.split("/").filter(Boolean);
  const resource = segments[1]; // e.g. "clients", "products"
  const subSegment = segments[2]; // e.g. id or "clear"

  // 1. CLIENTS
  if (resource === "clients") {
    if (subSegment === "clear") {
      clearClients();
      return NextResponse.json({ success: true, message: "Clients effacés" });
    }
    if (subSegment) {
      // /api/clients/:id
      if (method === "GET") {
        const item = getClientById(subSegment);
        if (!item) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await parseBody(req);
        const updated = updateClient(subSegment, body);
        return NextResponse.json(updated || { id: subSegment, ...body });
      }
      if (method === "DELETE") {
        deleteClient(subSegment);
        return NextResponse.json({ success: true, deleted: subSegment });
      }
    } else {
      // /api/clients
      if (method === "GET") {
        const list = getClientsByOrg(orgId);
        return NextResponse.json(list);
      }
      if (method === "POST") {
        const body = await parseBody(req);
        const created = addClient(body, orgId || undefined);
        return NextResponse.json(created, { status: 201 });
      }
    }
  }

  // 2. PRODUCTS
  if (resource === "products") {
    if (subSegment === "clear") {
      clearProducts();
      return NextResponse.json({ success: true, message: "Produits effacés" });
    }
    if (subSegment) {
      // /api/products/:id
      if (method === "GET") {
        const item = getProductById(subSegment);
        if (!item) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await parseBody(req);
        const updated = updateProduct(subSegment, body);
        return NextResponse.json(updated || { id: subSegment, ...body });
      }
      if (method === "DELETE") {
        deleteProduct(subSegment);
        return NextResponse.json({ success: true, deleted: subSegment });
      }
    } else {
      // /api/products
      if (method === "GET") {
        const list = getProductsByOrg(orgId);
        return NextResponse.json(list);
      }
      if (method === "POST") {
        const body = await parseBody(req);
        const created = addProduct(body, orgId || undefined);
        return NextResponse.json(created, { status: 201 });
      }
      if (method === "DELETE") {
        const body = await parseBody(req);
        if (body && Array.isArray(body.ids)) {
          const count = bulkDeleteProducts(body.ids);
          return NextResponse.json({ success: true, deleted: count });
        }
        return NextResponse.json({ success: true });
      }
    }
  }

  // 3. SUPPLIERS
  if (resource === "suppliers") {
    if (subSegment === "clear") {
      clearSuppliers();
      return NextResponse.json({ success: true, message: "Fournisseurs effacés" });
    }
    if (subSegment) {
      if (method === "GET") {
        const item = getSupplierById(subSegment);
        if (!item) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await parseBody(req);
        const updated = updateSupplier(subSegment, body);
        return NextResponse.json(updated || { id: subSegment, ...body });
      }
      if (method === "DELETE") {
        deleteSupplier(subSegment);
        return NextResponse.json({ success: true, deleted: subSegment });
      }
    } else {
      if (method === "GET") {
        return NextResponse.json(getSuppliersByOrg(orgId));
      }
      if (method === "POST") {
        const body = await parseBody(req);
        const created = addSupplier(body, orgId || undefined);
        return NextResponse.json(created, { status: 201 });
      }
    }
  }

  // 4. INVOICES (Factures)
  if (resource === "invoices") {
    if (subSegment === "clear") {
      clearInvoices();
      return NextResponse.json({ success: true, message: "Factures effacées" });
    }
    if (subSegment) {
      if (method === "GET") {
        const item = getInvoiceById(subSegment);
        if (!item) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await parseBody(req);
        const updated = updateInvoice(subSegment, body);
        return NextResponse.json(updated || { id: subSegment, ...body });
      }
      if (method === "DELETE") {
        deleteInvoice(subSegment);
        return NextResponse.json({ success: true, deleted: subSegment });
      }
    } else {
      if (method === "GET") {
        return NextResponse.json(getInvoicesByOrg(orgId));
      }
      if (method === "POST") {
        const body = await parseBody(req);
        const created = addInvoice(body, orgId || undefined);
        return NextResponse.json(created, { status: 201 });
      }
    }
  }

  // 5. QUOTATIONS (Devis)
  if (resource === "quotations") {
    if (subSegment === "clear") {
      clearQuotations();
      return NextResponse.json({ success: true, message: "Devis effacés" });
    }
    if (subSegment) {
      if (method === "GET") {
        const item = getQuotationById(subSegment);
        if (!item) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await parseBody(req);
        const updated = updateQuotation(subSegment, body);
        return NextResponse.json(updated || { id: subSegment, ...body });
      }
      if (method === "DELETE") {
        deleteQuotation(subSegment);
        return NextResponse.json({ success: true, deleted: subSegment });
      }
    } else {
      if (method === "GET") {
        return NextResponse.json(getQuotationsByOrg(orgId));
      }
      if (method === "POST") {
        const body = await parseBody(req);
        const created = addQuotation(body, orgId || undefined);
        return NextResponse.json(created, { status: 201 });
      }
    }
  }

  // 6. STOCK MOVEMENTS
  if (resource === "stock-movements") {
    if (method === "GET") {
      return NextResponse.json(getStockMovementsByOrg(orgId));
    }
    if (method === "POST") {
      const body = await parseBody(req);
      const res = adjustProductStock(
        body.product_id || body.productId || body.name,
        Number(body.quantityChange || body.quantity || 0),
        body.source || "Entrée de stock",
        body.supplier
      );
      return NextResponse.json(res || { success: true }, { status: 201 });
    }
  }

  // 7. EMPLOYEES
  if (resource === "employes") {
    if (subSegment === "clear") {
      clearEmployees();
      return NextResponse.json({ success: true, message: "Employés effacés" });
    }
    if (subSegment) {
      if (method === "GET") {
        const list = getEmployeesByOrg(orgId);
        const item = list.find(e => e.id === subSegment);
        if (!item) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await parseBody(req);
        const updated = updateEmployee(subSegment, body);
        return NextResponse.json(updated || { id: subSegment, ...body });
      }
      if (method === "DELETE") {
        deleteEmployee(subSegment);
        return NextResponse.json({ success: true, deleted: subSegment });
      }
    } else {
      if (method === "GET") {
        return NextResponse.json(getEmployeesByOrg(orgId));
      }
      if (method === "POST") {
        const body = await parseBody(req);
        const created = addEmployee(body, orgId || undefined);
        return NextResponse.json(created, { status: 201 });
      }
    }
  }

  // 8. AVOIRS
  if (resource === "avoirs") {
    if (subSegment) {
      if (method === "GET") {
        const item = getAvoirsByOrg(orgId).find((a: any) => a.id === subSegment);
        if (!item) return NextResponse.json({ error: "Avoir introuvable" }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await parseBody(req);
        const updated = updateAvoir(subSegment, body);
        return NextResponse.json(updated || { id: subSegment, ...body });
      }
      if (method === "DELETE") {
        deleteAvoir(subSegment);
        return NextResponse.json({ success: true, deleted: subSegment });
      }
    } else {
      if (method === "GET") {
        return NextResponse.json(getAvoirsByOrg(orgId));
      }
      if (method === "POST") {
        const body = await parseBody(req);
        const created = addAvoir(body, orgId || undefined);
        return NextResponse.json(created, { status: 201 });
      }
    }
  }

  // 9. DEPENSES
  if (resource === "depenses") {
    if (subSegment === "clear") {
      clearDepenses();
      return NextResponse.json({ success: true, message: "Dépenses effacées" });
    }
    if (subSegment) {
      if (method === "GET") {
        const item = getDepensesByOrg(orgId).find((d: any) => d.id === subSegment);
        if (!item) return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await parseBody(req);
        const updated = updateDepense(subSegment, body);
        return NextResponse.json(updated || { id: subSegment, ...body });
      }
      if (method === "DELETE") {
        deleteDepense(subSegment);
        return NextResponse.json({ success: true, deleted: subSegment });
      }
    } else {
      if (method === "GET") {
        return NextResponse.json(getDepensesByOrg(orgId));
      }
      if (method === "POST") {
        const body = await parseBody(req);
        const created = addDepense(body, orgId || undefined);
        return NextResponse.json(created, { status: 201 });
      }
    }
  }

  // 10. BULLETINS
  if (resource === "bulletins") {
    if (method === "GET") {
      return NextResponse.json(getBulletinsByOrg(orgId));
    }
    if (method === "POST") {
      const body = await parseBody(req);
      const created = addBulletin(body, orgId || undefined);
      return NextResponse.json(created, { status: 201 });
    }
  }

  // 11. BONS DE COMMANDE
  if (resource === "bons-commande") {
    if (subSegment === "clear") {
      clearBonsCommande();
      return NextResponse.json({ success: true, message: "Bons de commande effacés" });
    }
    if (subSegment) {
      if (method === "GET") {
        const item = getBonCommandeById(subSegment);
        if (!item) return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await parseBody(req);
        const updated = updateBonCommande(subSegment, body);
        return NextResponse.json(updated || { id: subSegment, ...body });
      }
      if (method === "DELETE") {
        deleteBonCommande(subSegment);
        return NextResponse.json({ success: true, deleted: subSegment });
      }
    } else {
      if (method === "GET") {
        return NextResponse.json(getBonsCommandeByOrg(orgId));
      }
      if (method === "POST") {
        const body = await parseBody(req);
        const created = addBonCommande(body, orgId || undefined);
        return NextResponse.json(created, { status: 201 });
      }
    }
  }

  // 12. COMPANIES
  if (resource === "companies") {
    if (subSegment) {
      if (method === "GET") {
        const item = getCompanies().find((c: any) => c.id === subSegment);
        if (!item) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
        return NextResponse.json(item);
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await parseBody(req);
        const updated = updateCompany(subSegment, body);
        return NextResponse.json(updated || { id: subSegment, ...body });
      }
      if (method === "DELETE") {
        const ok = deleteCompany(subSegment);
        return NextResponse.json({ success: ok, deleted: subSegment });
      }
    } else {
      if (method === "GET") {
        return NextResponse.json(getCompanies());
      }
      if (method === "POST") {
        const body = await parseBody(req);
        const created = addCompany(body);
        return NextResponse.json(created, { status: 201 });
      }
    }
  }

  // 13. SETTINGS & COMPANY-SETTINGS
  if (resource === "settings" || resource === "company-settings") {
    if (method === "GET") {
      return NextResponse.json(getCompanySettings(orgId));
    }
    if (method === "PUT" || method === "PATCH" || method === "POST") {
      const body = await parseBody(req);
      const targetOrgId = body.organization_id || orgId;
      const updated = updateCompanySettings(body, targetOrgId);
      return NextResponse.json(updated);
    }
  }

  // 14. EQUIPE & USERS
  if (resource === "equipe" || resource === "users") {
    if (method === "GET") {
      return NextResponse.json(getEquipe());
    }
    if (method === "POST") {
      const body = await parseBody(req);
      const created = addEquipe({
        id: `EQ-${Date.now()}`,
        nom: body.nom || body.name || "Nouveau Membre",
        email: body.email,
        role: body.role || "Comptable",
        statut: "Actif",
      });
      return NextResponse.json(created, { status: 201 });
    }
    if (method === "PUT" || method === "PATCH") {
      const body = await parseBody(req);
      const id = subSegment || body.id || url.searchParams.get("id");
      if (id) {
        const updated = updateEquipe(id, body);
        return NextResponse.json(updated || body);
      }
      return NextResponse.json({ success: true });
    }
    if (method === "DELETE") {
      const id = subSegment || url.searchParams.get("id");
      const body = await parseBody(req);
      if (body && Array.isArray(body.ids)) {
        bulkDeleteEquipe(body.ids);
        return NextResponse.json({ success: true, deleted: body.ids.length });
      }
      if (id) {
        deleteEquipe(id);
        return NextResponse.json({ success: true, deleted: id });
      }
      return NextResponse.json({ success: true });
    }
  }

  // 15. SUPPORT
  if (resource === "support") {
    if (method === "GET") {
      return NextResponse.json(getSupportTickets());
    }
    if (method === "POST") {
      const body = await parseBody(req);
      const created = addSupportTicket(body);
      return NextResponse.json(created, { status: 201 });
    }
    if (method === "PUT" || method === "PATCH") {
      const body = await parseBody(req);
      const id = subSegment || body.id;
      if (id) {
        const updated = updateSupportTicket(id, body);
        return NextResponse.json(updated || body);
      }
      return NextResponse.json({ success: true });
    }
    if (method === "DELETE") {
      const id = subSegment || url.searchParams.get("id");
      if (id) {
        deleteSupportTicket(id);
        return NextResponse.json({ success: true, deleted: id });
      }
    }
  }

  // Fallback default
  return NextResponse.json({
    status: "ok",
    message: `Handler local Tadbir AI pour ${pathname}`,
    timestamp: new Date().toISOString()
  });
}
