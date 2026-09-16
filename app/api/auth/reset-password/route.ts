import { NextResponse } from 'next/server';
import { updateUserPassword } from '@/lib/data-store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { email, newPassword } = await req.json();

    if (!email || !newPassword) {
      return NextResponse.json({ error: "Email et nouveau mot de passe requis." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const success = updateUserPassword(cleanEmail, newPassword);

    if (!success) {
      return NextResponse.json({ error: "Utilisateur non trouvé ou erreur de réinitialisation." }, { status: 404 });
    }

    // Forward to Django backend for persistent storage
    try {
      const djangoUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${djangoUrl}/api/auth/reset-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, new_password: newPassword }),
      });
    } catch {
      // Backend optional fallback
    }

    return NextResponse.json({ success: true, message: "Mot de passe réinitialisé avec succès." });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Erreur interne lors de la réinitialisation du mot de passe." },
      { status: 500 }
    );
  }
}
