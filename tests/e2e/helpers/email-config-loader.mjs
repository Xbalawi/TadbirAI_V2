/**
 * Dynamic loader for lib/email-config.ts that executes in standard Node ESM environments
 * without requiring pre-compilation or external TypeScript runtime dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const emailConfigTsPath = path.resolve(__dirname, '../../../lib/email-config.ts');

export function loadEmailConfig() {
  const tsContent = fs.readFileSync(emailConfigTsPath, 'utf8');

  // Strip TypeScript type annotations to produce valid vanilla JavaScript
  const jsContent = tsContent
    .replace(/:\s*string/g, '')
    .replace(/:\s*\{[^}]+\}/g, '')
    .replace(/export\s+/g, '');

  // Evaluate safely in module context
  const moduleScope = {
    process,
    parseInt,
  };

  const fn = new Function(
    'process',
    'parseInt',
    `
    ${jsContent}
    return {
      getBrevoApiKey,
      getBrevoSenderEmail,
      getBrevoSenderName,
      getEmailReplyTo,
      getSmtpCredentials,
    };
  `
  );

  return fn(process, parseInt);
}
