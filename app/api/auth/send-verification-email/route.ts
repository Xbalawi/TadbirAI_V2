import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getBrevoApiKey, getSmtpCredentials, getBrevoSenderEmail, getBrevoSenderName, getOauth2Credentials } from '@/lib/email-config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let otp = '';
  try {
    const body = await req.json();
    const { email, otp: bodyOtp, name } = body;
    otp = bodyOtp || '';

    if (!email || !otp) {
      return NextResponse.json({ error: "Adresse email et code OTP requis" }, { status: 400 });
    }

    const recipientName = name || email.split('@')[0];

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 30px; }
            .card { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 20px; border: 1px solid #334155; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
            .logo { font-size: 22px; font-weight: 900; color: #ffffff; text-transform: uppercase; margin-bottom: 20px; text-align: center; }
            .logo span { color: #6366f1; }
            .title { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px; text-align: center; }
            .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 24px; text-align: center; line-height: 1.5; }
            .otp-box { background: #0f172a; border: 2px solid #6366f1; border-radius: 16px; padding: 18px; text-align: center; margin-bottom: 24px; }
            .otp-code { font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #818cf8; }
            .footer { font-size: 11px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">Tadbir <span>AI</span></div>
            <div class="title">Vérification de votre compte</div>
            <div class="subtitle">Bonjour ${recipientName},<br/>Voici votre code de sécurité unique pour valider votre inscription sur la plateforme <strong>Tadbir AI</strong>.</div>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>

            <p style="font-size: 12px; color: #cbd5e1; text-align: center;">Ce code est valable pendant 10 minutes. Si vous n'avez pas demandé ce code, ignorez cet e-mail.</p>

            <div class="footer">
              © 2026 Tadbir AI OS · Système de Gestion Financière Intelligente
            </div>
          </div>
        </body>
      </html>
    `;

    const plainText = `Bonjour ${recipientName},\n\nVotre code de sécurité Tadbir AI est : ${otp}\n\nCe code est valable pendant 10 minutes.\n\n© 2026 Tadbir AI OS`;

    const brevoKey = getBrevoApiKey();
    const senderEmail = getBrevoSenderEmail();
    const senderName = getBrevoSenderName();

    if (!brevoKey) {
       console.error("[EMAIL] Missing Brevo API credentials");
       // fallback for dev mode
       return NextResponse.json({
         success: true,
         message: "Configuration manquante (mode dev)",
         isRealSmtp: false,
         otp: otp,
       });
    }

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "api-key": brevoKey,
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: email }],
          subject: `Votre code Tadbir AI : ${otp}`,
          htmlContent: htmlTemplate,
          textContent: plainText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[EMAIL] ❌ Brevo API failed:`, errorData);
        return NextResponse.json({
          success: true,
          message: `Code prêt (échec de l'envoi email)`,
          isRealSmtp: false,
          otp: otp,
          errors: [errorData],
          fallback: true,
        });
      }

      const responseData = await response.json();
      return NextResponse.json({
        success: true,
        message: `Code de vérification expédié à ${email}`,
        isRealSmtp: true,
        otp: otp,
        messageId: responseData.messageId,
        method: 'rest-brevo',
      });

    } catch (apiErr: any) {
      console.error(`[EMAIL] ❌ API request failed: ${apiErr.message}`);
      return NextResponse.json({
        success: true,
        message: `Code prêt (échec de l'envoi email)`,
        isRealSmtp: false,
        otp: otp,
        errors: [apiErr.message],
        fallback: true,
      });
    }

  } catch (error: any) {
    console.error("[EMAIL] CRITICAL ERROR:", error.message, error.stack);
    return NextResponse.json({
      success: true,
      message: "Code prêt pour validation",
      isRealSmtp: false,
      otp: otp,
      debugError: error.message,
      debugStack: error.stack
    });
  }
}
