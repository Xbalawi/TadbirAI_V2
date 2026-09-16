/**
 * Mock Brevo REST API v3 Server for Opaque-Box E2E Testing.
 * Validates HTTP protocol contracts, headers, DMARC sender restrictions,
 * error conditions (400, 401, 402, 500), and latency timeouts.
 */

import http from 'node:http';
import crypto from 'node:crypto';

export class MockBrevoServer {
  constructor() {
    this.server = null;
    this.port = null;
    this.url = '';
    this.requests = [];
    this.statusOverride = null;
    this.bodyOverride = null;
    this.delayMs = 0;
    this.dropConnection = false;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        let bodyRaw = '';

        req.on('data', chunk => {
          bodyRaw += chunk;
        });

        req.on('end', async () => {
          if (this.dropConnection) {
            req.destroy();
            return;
          }

          if (this.delayMs > 0) {
            await new Promise(r => setTimeout(r, this.delayMs));
          }

          let bodyJson = null;
          try {
            bodyJson = JSON.parse(bodyRaw);
          } catch {
            bodyJson = bodyRaw;
          }

          const record = {
            method: req.method,
            path: req.url,
            headers: req.headers,
            body: bodyJson,
            timestamp: Date.now(),
          };
          this.requests.push(record);

          // Apply manual override if set
          if (this.statusOverride !== null) {
            res.writeHead(this.statusOverride, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.bodyOverride || { error: 'Overridden error' }));
            return;
          }

          // Handle Brevo v3 Transactional Email Endpoint
          if (req.method === 'POST' && req.url === '/v3/smtp/email') {
            const apiKey = req.headers['api-key'];

            if (!apiKey || apiKey === 'invalid_api_key' || apiKey === 'empty') {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }));
              return;
            }

            const sender = bodyJson?.sender;
            const senderEmail = (sender?.email || '').trim().toLowerCase();

            // Brevo anti-spoofing and DMARC enforcement: free mailbox domains not authorized
            if (senderEmail.endsWith('@gmail.com') || senderEmail.endsWith('@yahoo.com')) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  code: 'invalid_parameter',
                  message: `Sender email '${senderEmail}' is not authorized on Brevo domain`,
                })
              );
              return;
            }

            // Normal success: 201 Created
            const messageId = `<${Date.now()}.${crypto.randomUUID()}@smtp-relay.brevo.com>`;
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ messageId }));
            return;
          }

          // Unmatched endpoint
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'not_found', message: 'Route not found' }));
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
    this.statusOverride = null;
    this.bodyOverride = null;
    this.delayMs = 0;
    this.dropConnection = false;
  }
}
