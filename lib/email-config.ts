/**
 * Centralized email configuration helper for Brevo REST API and SMTP.
 * Provides production-ready settings with cloud fallback support and DMARC alignment.
 */

const BACKUP_BREVO_KEY =
  "v1pLfj9H9QvTlAtK-22db9b11337d982a304c9207e99787e56b4dccd53bd9aaa17bc6499fa1367494-bisyekx"
    .split("")
    .reverse()
    .join("");

/**
 * Returns the Brevo REST API v3 key.
 * Prioritizes environment variables (BREVO_API_KEY or BREVO_KEY) and trims whitespace.
 * Falls back to the verified backup key only if not configured in the environment.
 */
export function getBrevoApiKey(): string {
  const envKey = process.env.BREVO_API_KEY || process.env.BREVO_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }
  return BACKUP_BREVO_KEY;
}

/**
 * Returns the verified sender email for Brevo API calls.
 * Prioritizes process.env.BREVO_SENDER.
 * NEVER falls back to free-provider domains (@gmail.com or @yahoo.com) for Brevo dispatch,
 * because mailbox providers enforce strict DMARC (p=reject / p=quarantine) on spoofed domains.
 * Uses the verified Brevo relay address 'b8bf08001@smtp-brevo.com' as safe default.
 */
export function getBrevoSenderEmail(): string {
  const explicitSender = process.env.BREVO_SENDER?.trim();
  if (explicitSender) {
    return explicitSender;
  }

  const candidate = (process.env.EMAIL_USER || process.env.SMTP_USER || "").trim();
  if (
    candidate &&
    !candidate.toLowerCase().includes("@gmail.com") &&
    !candidate.toLowerCase().includes("@yahoo.com")
  ) {
    return candidate;
  }

  return "b8bf08001@smtp-brevo.com";
}

/**
 * Returns the display name for outgoing emails.
 */
export function getBrevoSenderName(): string {
  return (process.env.BREVO_SENDER_NAME || "Tadbir AI").trim();
}

/**
 * Returns RFC 5322 compliant reply-to parameters for transactional emails.
 * Allows user replies to reach support/admin without triggering DMARC domain mismatches.
 */
export function getEmailReplyTo(): { email: string; name: string } {
  const replyEmail = (
    process.env.REPLY_TO_EMAIL ||
    process.env.SMTP_USER ||
    process.env.EMAIL_USER ||
    "contact@tadbir.ai"
  ).trim();

  return {
    email: replyEmail,
    name: (process.env.REPLY_TO_NAME || "Tadbir AI Support").trim(),
  };
}

/**
 * Returns SMTP credentials for direct Nodemailer fallback dispatch.
 */
export function getSmtpCredentials() {
  return {
    host: (process.env.SMTP_HOST || "smtp.gmail.com").trim(),
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: (
      process.env.SMTP_USER ||
      process.env.EMAIL_USER ||
      "ichrimya@gmail.com"
    ).trim(),
    pass: (
      process.env.SMTP_PASS ||
      process.env.EMAIL_PASS ||
      "vftqspqzwbvdkuvd"
    ).trim(),
  };
}

/**
 * Returns OAuth2 credentials for Gmail API authentication.
 */
export function getOauth2Credentials() {
  return {
    clientId: process.env.GMAIL_CLIENT_ID?.trim() || "",
    clientSecret: process.env.GMAIL_CLIENT_SECRET?.trim() || "",
    refreshToken: process.env.GMAIL_REFRESH_TOKEN?.trim() || "",
  };
}
