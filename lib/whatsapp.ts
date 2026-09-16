// WhatsApp integration helper utilities for Tadbir AI

export interface WhatsAppConfig {
  phoneNumber: string;
  defaultCountryCode: string; // e.g. '212' for Morocco
  sendMode: 'web' | 'app' | 'api';
  factureTemplate: string;
  relanceTemplate: string;
  devisTemplate: string;
  recuTemplate: string;
}

export const DEFAULT_WHATSAPP_CONFIG: WhatsAppConfig = {
  phoneNumber: "+212 684 836 656",
  defaultCountryCode: "212",
  sendMode: "web",
  factureTemplate: "Bonjour *{client}*,\n\nVoici votre facture *{numero}* d'un montant de *{montant} MAD*.\n📅 Date d'échéance : {echeance}\n\nMerci pour votre confiance !\n_Tadbir AI_",
  relanceTemplate: "Rappel : Bonjour *{client}*,\n\nSauf erreur de notre part, la facture *{numero}* d'un montant de *{montant} MAD* venant à échéance le {echeance} est toujours en attente de règlement.\n\nMerci de procéder au virement dès que possible.",
  devisTemplate: "Bonjour *{client}*,\n\nVeuillez trouver ci-joint votre devis *{numero}* d'un montant de *{montant} MAD* (Valable jusqu'au {echeance}).\n\nN'hésitez pas à nous contacter pour toute question !",
  recuTemplate: "Bonjour *{client}*,\n\nNous confirmons la réception de votre règlement pour la facture *{numero}* ({montant} MAD).\n\nMerci beaucoup pour votre fidélité !"
};

export function getWhatsAppConfig(): WhatsAppConfig {
  return DEFAULT_WHATSAPP_CONFIG;
}

export function saveWhatsAppConfig(config: WhatsAppConfig): void {
  // Now handled by the API in page components
}

/**
 * Formats a phone number for WhatsApp (e.g. +212 661-111222 -> 212661111222)
 */
export function formatPhoneForWhatsApp(rawPhone: string, countryCode = "212"): string {
  if (!rawPhone) return "";
  // Remove spaces, dashes, brackets, plus signs
  let digits = rawPhone.replace(/[\s\-\(\)\+]/g, "");

  // If phone starts with 0 (e.g. 0661111222 in Morocco/France), replace leading 0 with country code
  if (digits.startsWith("0")) {
    digits = countryCode + digits.substring(1);
  }

  // If no country code attached yet and number is 9 digits (e.g., 661111222)
  if (digits.length === 9 && !digits.startsWith(countryCode)) {
    digits = countryCode + digits;
  }

  return digits;
}

/**
 * Replaces placeholders in template
 */
export function renderTemplate(template: string, data: Record<string, string>): string {
  let result = template;
  Object.keys(data).forEach((key) => {
    const placeholder = `{${key}}`;
    result = result.replaceAll(placeholder, data[key] || "");
  });
  return result;
}

/**
 * Build direct WhatsApp Web link (web.whatsapp.com)
 */
export function buildWhatsAppWebUrl(phone: string, message: string): string {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(message);
  if (cleanPhone) {
    return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://web.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Build universal WhatsApp link (wa.me for mobile & desktop app)
 */
export function buildWhatsAppWaMeUrl(phone: string, message: string): string {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(message);
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Build direct WhatsApp Desktop/Mobile app link (whatsapp:// protocol)
 */
export function buildWhatsAppAppUrl(phone: string, message: string): string {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(message);
  if (cleanPhone) {
    return `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `whatsapp://send?text=${encodedText}`;
}

/**
 * Build WhatsApp Link according to preferred mode
 */
export function buildWhatsAppUrl(phone: string, message: string, useWebVersion = true): string {
  if (useWebVersion) {
    return buildWhatsAppWebUrl(phone, message);
  }
  return buildWhatsAppAppUrl(phone, message);
}

/**
 * Safely opens WhatsApp window
 */
export function openWhatsAppMessage(phone: string, message: string, useWebVersion = true): boolean {
  const url = buildWhatsAppUrl(phone, message, useWebVersion);
  if (typeof window !== "undefined") {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win || win.closed || typeof win.closed === "undefined") {
      window.location.href = url;
    }
    return true;
  }
  return false;
}
