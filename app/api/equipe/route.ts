import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import {
  getBrevoApiKey,
  getBrevoSenderEmail,
  getBrevoSenderName,
  getEmailReplyTo,
  getSmtpCredentials,
  getOauth2Credentials,
} from '@/lib/email-config';
import { fetchAPI } from '@/lib/api';
import { handleLocalApi } from '@/lib/local-api';

export const dynamic = 'force-dynamic';
const DJANGO_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function proxyToDjango(req: Request, endpoint: string, method: string = 'GET', customBody?: any) {
  try {
    const url = new URL(req.url);
    const targetUrl = DJANGO_URL + endpoint + url.search;

    const headers = new Headers(req.headers);
    headers.set('host', new URL(DJANGO_URL).host);
    headers.delete('content-length');
    headers.delete('transfer-encoding');
    headers.delete('connection');

    const options: RequestInit = {
      method,
      headers,
      cache: 'no-store',
    };

    if (customBody) {
      options.body = JSON.stringify(customBody);
    } else if (method !== 'GET' && method !== 'HEAD') {
      const clonedReq = req.clone();
      options.body = Buffer.from(await clonedReq.arrayBuffer());
    }

    const response = await fetch(targetUrl, options);
    if (response.status < 500) {
      const responseHeaders = new Headers(response.headers);
      responseHeaders.delete('content-encoding');
      return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders
      });
    }
  } catch (error: any) {
    console.warn(`[Next.js API Proxy] Remote Django unavailable for ${endpoint}, using local handler:`, error?.message);
  }

  return handleLocalApi(req);
}

export async function GET(req: Request) {
  return proxyToDjango(req, '/api/users/');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. Call Django to create the invited user
    let targetUrl = "";
    try {
      targetUrl = new URL("/api/auth/invite/", DJANGO_URL).toString();
    } catch(e) {
      console.error("[EQUIPE] Configuration URL invalide:", DJANGO_URL);
      return NextResponse.json({error: "Vérifiez la variable NEXT_PUBLIC_API_URL: " + DJANGO_URL}, {status:500});
    }
    const headers = new Headers(req.headers);
    headers.set('host', new URL(DJANGO_URL).host);
    headers.delete('content-length');
    headers.delete('transfer-encoding');
    headers.delete('connection');
    headers.set('content-type', 'application/json');

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    // 2. Send invitation email via Brevo REST API or fallback to Nodemailer SMTP
    try {
      const brevoApiKey = getBrevoApiKey();
      const senderEmail = getBrevoSenderEmail();
      const senderName = getBrevoSenderName();
      const replyTo = getEmailReplyTo();
      const memberName = body.nom || body.name || "Collaborateur";
      const memberRole = body.role || "Membre";

      const reqUrl = new URL(req.url);
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || reqUrl.host;
      const proto = req.headers.get("x-forwarded-proto") || (reqUrl.protocol ? reqUrl.protocol.replace(":", "") : "https");
      const baseUrl = req.headers.get("origin") || `${proto}://${host}`;
      const registerUrl = `${baseUrl.replace(/\/$/, "")}/register?email=${encodeURIComponent(body.email)}`;

      if (body.email) {
        const htmlTemplate = `
          <!DOCTYPE html>
          <html lang="fr">
            <head>
              <meta charset="utf-8"/>
              <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
              <title>Invitation à rejoindre Tadbir AI</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
                .card { max-width: 550px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
                .logo { font-size: 22px; font-weight: 900; color: #ffffff; text-transform: uppercase; margin-bottom: 20px; text-align: center; }
                .logo span { color: #6366f1; }
                .title { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 16px; text-align: center; }
                .text { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 16px; }
                .btn-container { text-align: center; margin: 30px 0; }
                .btn { background: #6366f1; color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block; }
                .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="logo">Tadbir <span>AI</span></div>
                <div class="title">Invitation à rejoindre l'équipe</div>
                <p class="text">Bonjour <strong>${memberName}</strong>,</p>
                <p class="text">
                  Vous avez été invité(e) à rejoindre la plateforme <strong>Tadbir AI</strong> avec le rôle de <strong>${memberRole}</strong>.
                </p>
                <p class="text">
                  Pour activer votre compte et définir votre mot de passe personnel, rendez-vous dès maintenant sur la page d'inscription :
                </p>
                <div class="btn-container">
                  <a href="${registerUrl}" class="btn">Créer mon mot de passe</a>
                </div>
                <p style="font-size: 12px; color: #64748b; word-break: break-all;">
                  Lien direct : <a href="${registerUrl}" style="color: #818cf8;">${registerUrl}</a>
                </p>
                <div class="footer">
                  © 2026 Tadbir AI OS · Système de Gestion Financière Intelligente
                </div>
              </div>
            </body>
          </html>
        `;

        const plainText = `Bonjour ${memberName},\n\nVous avez été invité(e) à rejoindre Tadbir AI avec le rôle : ${memberRole}.\n\nVeuillez créer votre compte sur le lien suivant pour définir votre mot de passe personnel :\n${registerUrl}\n\n© 2026 Tadbir AI OS`;

        const brevoKey = getBrevoApiKey();
        const senderEmail = getBrevoSenderEmail();
        const senderName = getBrevoSenderName();
        
        if (!brevoKey) {
          console.error("[EQUIPE EMAIL] Missing Brevo API key");
          data.email_sent = false;
          data.email_error = "Configuration API manquante sur le serveur.";
          return NextResponse.json(data, { status: 201 });
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
              to: [{ email: body.email }],
              subject: `Invitation à rejoindre l'équipe Tadbir AI`,
              htmlContent: htmlTemplate,
              textContent: plainText,
            }),
          });

          if (!response.ok) {
            const errorData = await response.text();
            console.error(`[EQUIPE EMAIL] ❌ Brevo API failed:`, errorData);
            data.email_sent = false;
            data.email_error = `Échec de l'envoi API: ${errorData}`;
          } else {
            const responseData = await response.json();
            data.email_sent = true;
            data.messageId = responseData.messageId;
          }
        } catch (apiErr: any) {
          console.error(`[EQUIPE EMAIL] ❌ API request failed:`, apiErr.message);
          data.email_sent = false;
          data.email_error = apiErr.message;
        }
      }
    } catch (emailErr: any) {
      console.error("[EQUIPE EMAIL] Unexpected error sending invitation email:", emailErr);
      data.email_sent = false;
      data.email_error =
        "Erreur inattendue lors de l'expédition de l'e-mail d'invitation.";
      data.email_details = [emailErr.message || String(emailErr)];
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de l'invitation" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    return proxyToDjango(req, `/api/users/${id}/`, 'PUT');
  } else {
    // If ID is in body
    try {
      const clonedReq = req.clone();
      const body = await clonedReq.json();
      if (body.id) {
        return proxyToDjango(req, `/api/users/${body.id}/`, 'PUT', body);
      }
    } catch (e) {}
  }
  return proxyToDjango(req, '/api/users/', 'PUT');
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    return proxyToDjango(req, `/api/users/${id}/`, 'DELETE');
  }
  return NextResponse.json({ error: "ID manquant" }, { status: 400 });
}
