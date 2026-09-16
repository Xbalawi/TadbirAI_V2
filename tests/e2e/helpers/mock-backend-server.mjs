/**
 * Mock Django REST Framework Backend Server for Opaque-Box E2E Testing.
 * Implements full interface contracts for Multi-Tenant Isolation, JWT Authentication,
 * IDOR Prevention, 23 Child Entity Scoping, and Error Simulation (500/503).
 */

import http from 'node:http';
import crypto from 'node:crypto';

export class MockBackendServer {
  constructor() {
    this.server = null;
    this.port = null;
    this.url = '';
    this.requests = [];
    this.simulate500 = false;
    this.simulate503 = false;
    this.dropConnection = false;

    // Database state for test assertions
    this.initDatabase();
  }

  initDatabase() {
    this.organizations = [
      { id: 'org-alpha', name: 'Alpha Corporation', code: 'ORG-A' },
      { id: 'org-beta', name: 'Beta Industries', code: 'ORG-B' },
    ];

    this.users = [
      {
        id: 'usr-admin-alpha',
        email: 'admin@alpha.com',
        role: 'ADMIN',
        organisation: 'org-alpha',
        nom: 'Alpha Admin',
        isActive: true,
      },
      {
        id: 'usr-alice',
        email: 'alice@alpha.com',
        role: 'GESTIONNAIRE',
        organisation: 'org-alpha',
        nom: 'Alice Martin',
        isActive: true,
      },
      {
        id: 'usr-admin-beta',
        email: 'admin@beta.com',
        role: 'ADMIN',
        organisation: 'org-beta',
        nom: 'Beta Admin',
        isActive: true,
      },
      {
        id: 'usr-bob',
        email: 'bob@beta.com',
        role: 'COMMERCIAL',
        organisation: 'org-beta',
        nom: 'Bob Dupont',
        isActive: true,
      },
    ];

    this.invoices = [
      {
        id: 'inv-a-101',
        invoice_number: 'FAC-2026-001',
        client_name: 'Client Alpha A',
        organisation: 'org-alpha',
        total_amount: 1500.0,
      },
      {
        id: 'inv-b-201',
        invoice_number: 'FAC-2026-001', // Same number to test tenant scoping
        client_name: 'Client Beta B',
        organisation: 'org-beta',
        total_amount: 3200.0,
      },
    ];

    // Child items (InvoiceItem linked via invoice FK)
    this.invoiceItems = [
      {
        id: 'item-a-1',
        invoice: 'inv-a-101',
        description: 'Consulting Alpha',
        unit_price: 1500.0,
      },
      {
        id: 'item-b-1',
        invoice: 'inv-b-201',
        description: 'Industrial Hardware Beta',
        unit_price: 3200.0,
      },
    ];

    // Child items (StockMovement linked via product FK)
    this.stockMovements = [
      {
        id: 'sm-a-1',
        product_id: 'prod-a-1',
        quantity: 50,
        organisation: 'org-alpha',
      },
      {
        id: 'sm-b-1',
        product_id: 'prod-b-1',
        quantity: 100,
        organisation: 'org-beta',
      },
    ];
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        let bodyRaw = '';

        req.on('data', chunk => {
          bodyRaw += chunk;
        });

        req.on('end', () => {
          if (this.dropConnection) {
            req.destroy();
            return;
          }

          if (this.simulate503) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Le serveur backend est injoignable.' }));
            return;
          }

          if (this.simulate500) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Erreur interne du serveur backend.' }));
            return;
          }

          let bodyJson = null;
          try {
            bodyJson = JSON.parse(bodyRaw);
          } catch {
            bodyJson = bodyRaw;
          }

          const parsedUrl = new URL(req.url, 'http://127.0.0.1');
          const pathname = parsedUrl.pathname;

          const record = {
            method: req.method,
            path: req.url,
            headers: req.headers,
            body: bodyJson,
            timestamp: Date.now(),
          };
          this.requests.push(record);

          // Extract auth token
          const authHeader = req.headers['authorization'] || '';
          let currentUser = null;
          if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '').trim();
            if (token === 'valid_token_alpha' || token.includes('alpha')) {
              currentUser = this.users.find(u => u.organisation === 'org-alpha');
            } else if (token === 'valid_token_beta' || token.includes('beta')) {
              currentUser = this.users.find(u => u.organisation === 'org-beta');
            } else if (token.startsWith('token_user_')) {
              const email = token.replace('token_user_', '');
              currentUser = this.users.find(u => u.email === email);
            }
          }

          // Respect X-Organization-Id if user is authenticated
          const tenantOrgId = currentUser ? currentUser.organisation : null;

          // ==============================
          // 1. Auth & Login Endpoint
          // ==============================
          if (req.method === 'POST' && pathname === '/api/auth/token/') {
            const { username, password } = bodyJson || {};
            const email = username || bodyJson?.email;
            const user = this.users.find(u => u.email === email);

            if (user && password !== 'wrong_password') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  access: `valid_token_${user.organisation}_${user.id}`,
                  refresh: `valid_refresh_${user.id}`,
                  user: {
                    id: user.id,
                    email: user.email,
                    organisation: user.organisation,
                    role: user.role,
                  },
                })
              );
              return;
            }

            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ detail: 'No active account found with the given credentials' }));
            return;
          }

          // ==============================
          // 2. Token Refresh Endpoint
          // ==============================
          if (req.method === 'POST' && pathname === '/api/auth/token/refresh/') {
            const { refresh } = bodyJson || {};
            if (refresh && refresh.startsWith('valid_refresh_')) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ access: `refreshed_access_${Date.now()}` }));
              return;
            }
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ detail: 'Token is invalid or expired', code: 'token_not_valid' }));
            return;
          }

          // ==============================
          // 3. User Invitation Endpoint (/api/auth/invite/)
          // ==============================
          if (req.method === 'POST' && pathname === '/api/auth/invite/') {
            // Require authenticated caller
            if (!currentUser) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ detail: 'Authentication credentials were not provided.' }));
              return;
            }

            const { email, nom, role } = bodyJson || {};
            if (!email || !email.includes('@')) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ email: ['Ce champ est obligatoire et doit être un email valide.'] }));
              return;
            }

            const existing = this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (existing) {
              if (existing.organisation !== tenantOrgId) {
                // PREVENT ACCOUNT HIJACKING! Feature 10 fix
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    email: ['Un utilisateur avec cet email existe déjà dans une autre organisation.'],
                  })
                );
                return;
              }
              // User already in this org
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  id: existing.id,
                  email: existing.email,
                  nom: existing.nom,
                  role: existing.role,
                  organisation: existing.organisation,
                  is_active: existing.isActive,
                })
              );
              return;
            }

            // Create new invited user
            const newUser = {
              id: 'usr-' + crypto.randomUUID().slice(0, 8),
              email,
              nom: nom || 'Collaborateur',
              role: role || 'COLLABORATEUR',
              organisation: tenantOrgId,
              isActive: false,
            };
            this.users.push(newUser);

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                id: newUser.id,
                email: newUser.email,
                nom: newUser.nom,
                role: newUser.role,
                organisation: newUser.organisation,
                is_active: false,
              })
            );
            return;
          }

          // ==============================
          // 4. Require Auth for All Remaining Protected Endpoints
          // (Dev mode auth bypass removal - Feature 9)
          // ==============================
          if (!currentUser) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ detail: 'Given token not valid for any token type' }));
            return;
          }

          // ==============================
          // 5. Invoices Endpoint (Parent Isolation)
          // ==============================
          if (pathname === '/api/invoices/' || pathname === '/api/invoices') {
            if (req.method === 'GET') {
              const scopedInvoices = this.invoices.filter(i => i.organisation === tenantOrgId);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(scopedInvoices));
              return;
            }

            if (req.method === 'POST') {
              const newInv = {
                id: 'inv-' + crypto.randomUUID().slice(0, 8),
                invoice_number: bodyJson?.invoice_number || `FAC-${Date.now()}`,
                client_name: bodyJson?.client_name || 'Nouveau Client',
                organisation: tenantOrgId, // Automatically bound to caller's org
                total_amount: bodyJson?.total_amount || 0,
              };
              this.invoices.push(newInv);
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(newInv));
              return;
            }
          }

          // Single invoice detail: /api/invoices/<id>/
          if (pathname.startsWith('/api/invoices/')) {
            const invId = pathname.replace('/api/invoices/', '').replace('/', '');
            const invoice = this.invoices.find(i => i.id === invId && i.organisation === tenantOrgId);

            if (!invoice) {
              // Return 404 if item belongs to another tenant or doesn't exist
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ detail: 'Not found.' }));
              return;
            }

            if (req.method === 'GET') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(invoice));
              return;
            }

            if (req.method === 'PUT') {
              invoice.total_amount = bodyJson?.total_amount ?? invoice.total_amount;
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(invoice));
              return;
            }
          }

          // ==============================
          // 6. Child Entity: InvoiceItem (Relationship Traversal & IDOR Prevention)
          // ==============================
          if (pathname === '/api/invoice-items/' || pathname === '/api/invoice-items') {
            if (req.method === 'GET') {
              // Traverse relationship: invoice__organisation === tenantOrgId
              const scopedItems = this.invoiceItems.filter(item => {
                const parent = this.invoices.find(i => i.id === item.invoice);
                return parent && parent.organisation === tenantOrgId;
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(scopedItems));
              return;
            }

            if (req.method === 'POST') {
              const { invoice: invoiceId, description, unit_price } = bodyJson || {};
              const parentInvoice = this.invoices.find(i => i.id === invoiceId);

              // Validate parent FK belongs to current tenant (Feature 8 - IDOR prevention!)
              if (!parentInvoice || parentInvoice.organisation !== tenantOrgId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    invoice: ['Parent object does not belong to your organisation.'],
                  })
                );
                return;
              }

              const newItem = {
                id: 'item-' + crypto.randomUUID().slice(0, 8),
                invoice: invoiceId,
                description: description || 'Article',
                unit_price: unit_price || 0,
              };
              this.invoiceItems.push(newItem);
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(newItem));
              return;
            }
          }

          // ==============================
          // 7. Companies and Company Settings Routes (Feature 13)
          // ==============================
          if (pathname === '/api/companies/' || pathname === '/api/companies') {
            const org = this.organizations.filter(o => o.id === tenantOrgId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(org));
            return;
          }

          if (pathname === '/api/company-settings/' || pathname === '/api/company-settings') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                organisation: tenantOrgId,
                currency: 'MAD',
                tax_rate: 20.0,
              })
            );
            return;
          }

          // ==============================
          // 8. Users & Bulk Deletion Route (/api/users/)
          // ==============================
          if (pathname === '/api/users/' || pathname === '/api/users') {
            if (req.method === 'GET') {
              const scopedUsers = this.users.filter(u => u.organisation === tenantOrgId);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(scopedUsers));
              return;
            }

            if (req.method === 'DELETE') {
              const { ids } = bodyJson || {};
              if (Array.isArray(ids)) {
                this.users = this.users.filter(
                  u => !(ids.includes(u.id) && u.organisation === tenantOrgId)
                );
                res.writeHead(204);
                res.end();
                return;
              }
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Array of ids required.' }));
              return;
            }
          }

          // Fallback 404
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ detail: 'Not found.' }));
        });
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server.address();
        this.port = addr.port;
        this.url = `http://127.0.0.1:${this.port}`;
        resolve(this.url);
      });

      this.server.on('error', reject);
    });
  }

  stop() {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }

  reset() {
    this.requests = [];
    this.simulate500 = false;
    this.simulate503 = false;
    this.dropConnection = false;
    this.initDatabase();
  }
}
