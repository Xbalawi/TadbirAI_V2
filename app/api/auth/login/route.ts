import { NextResponse } from "next/server";
import { findUserByEmail, findEquipeMemberByEmail, getEquipe, upsertUser, addUser } from "@/lib/data-store";
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Veuillez fournir une adresse e-mail et un mot de passe." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const hashedInputPassword = crypto.createHash('sha256').update(password).digest('hex');
    const djangoUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    let user = findUserByEmail(cleanEmail);
    let access: string | null = null;
    let refresh: string | null = null;

    // 1. If user not found locally, attempt verification via Django Backend
    if (!user) {
      try {
        const tokenRes = await fetch(`${djangoUrl}/api/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, password }),
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          access = tokenData.access;
          refresh = tokenData.refresh;

          // Reconcile user locally in data store
          user = upsertUser({
            email: cleanEmail,
            password: password,
            nom: tokenData.user?.nom || cleanEmail.split('@')[0],
            role: tokenData.user?.role || "Administrateur",
            company: tokenData.user?.company || "Tadbir AI Enterprise",
            emailVerified: true,
          });
        }
      } catch (backendErr) {
        // Django unreachable or failed
      }
    }

    // 2. Check if user was pre-invited in equipeStore
    if (!user) {
      const memberInEquipe = findEquipeMemberByEmail(cleanEmail);
      if (memberInEquipe) {
        if (memberInEquipe.statut === "Suspendu") {
          return NextResponse.json(
            { error: "Votre compte a été suspendu par l'administrateur." },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { 
            error: `Bienvenue ! Vous avez été invité(e) avec le rôle "${memberInEquipe.role}". Veuillez créer votre mot de passe personnel sur la page d'inscription pour activer votre compte.`,
            invited: true,
            role: memberInEquipe.role
          },
          { status: 401 }
        );
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "Aucun compte trouvé avec cette adresse e-mail. Veuillez vous inscrire d'abord." },
        { status: 401 }
      );
    }

    // 3. Verify Password locally (supports account password and master demo password admin123)
    const isPasswordValid = 
      user.password === hashedInputPassword || 
      password === "admin123";

    if (!isPasswordValid) {
      // Check if Django validates this password (in case of PBKDF2 hash)
      let djangoValidated = false;
      try {
        const tokenRes = await fetch(`${djangoUrl}/api/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, password }),
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          access = tokenData.access;
          refresh = tokenData.refresh;
          djangoValidated = true;
          // Update local SHA-256 hash
          user.password = hashedInputPassword;
        }
      } catch {}

      if (!djangoValidated) {
        return NextResponse.json(
          { error: "Mot de passe incorrect. Veuillez vérifier votre saisie." },
          { status: 401 }
        );
      }
    }

    // 4. Verify if suspended in equipe
    const equipeList = getEquipe();
    const memberInEquipe = equipeList.find(
      (m: any) => m.email?.trim().toLowerCase() === cleanEmail
    );

    if (memberInEquipe && memberInEquipe.statut === "Suspendu") {
      return NextResponse.json(
        { error: "Votre compte a été suspendu par l'administrateur." },
        { status: 403 }
      );
    }

    // 5. Fetch JWT tokens if not already obtained
    if (!access) {
      try {
        const tokenRes = await fetch(`${djangoUrl}/api/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, password }),
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          access = tokenData.access;
          refresh = tokenData.refresh;
        }
      } catch {
        // Fallback session token
      }
    }

    if (!access) {
      // Fallback local session token for seamless offline/standalone operation
      access = `sess_${Date.now()}_${Buffer.from(cleanEmail).toString('base64url')}`;
      refresh = `refr_${Date.now()}`;
    }

    return NextResponse.json({
      success: true,
      access: access,
      refresh: refresh || "session_refresh_app",
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        role: user.role,
        company: user.company || "Tadbir AI Enterprise",
        emailVerified: user.emailVerified !== false,
      }
    });
  } catch (err: any) {
    console.error("[LOGIN] Error during authentication:", err);
    return NextResponse.json(
      { error: "Erreur serveur lors de la connexion." },
      { status: 500 }
    );
  }
}
