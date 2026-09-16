import { NextResponse } from "next/server";
import { findUserByEmail, addUser, getEquipe, updateEquipe } from "@/lib/data-store";

export const dynamic = 'force-dynamic';
const DJANGO_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, nom } = body;
    const cleanEmail = (email || "").trim().toLowerCase();

    // Try remote Django if explicitly configured to an external host
    const isRemote = process.env.NEXT_PUBLIC_API_URL && 
      !process.env.NEXT_PUBLIC_API_URL.includes("localhost") && 
      !process.env.NEXT_PUBLIC_API_URL.includes("127.0.0.1");

    if (isRemote) {
      try {
        const targetUrl = new URL("/api/auth/register/", DJANGO_URL).toString();
        const headers = new Headers(req.headers);
        headers.set('host', new URL(DJANGO_URL).host);
        headers.delete('content-length');
        headers.delete('transfer-encoding');
        headers.delete('connection');
        headers.set('content-type', 'application/json');

        const response = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(4000),
        });
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
      } catch (err) {
        console.warn("[Register] Remote Django failed, using local registration:", err);
      }
    }

    // Local registration fallback
    if (!cleanEmail) {
      return NextResponse.json({ error: "L'adresse email est requise." }, { status: 400 });
    }

    const existingUser = findUserByEmail(cleanEmail);
    const equipeList = getEquipe();
    const invitedMember = equipeList.find((m: any) => m.email?.trim().toLowerCase() === cleanEmail);

    let assignedRole = "Comptable";
    if (invitedMember) {
      assignedRole = invitedMember.role || "Comptable";
      updateEquipe(invitedMember.id, { statut: "Actif" });
    }

    if (existingUser && existingUser.password) {
      return NextResponse.json({ error: "Un compte avec cette adresse email existe déjà. Veuillez vous connecter." }, { status: 400 });
    }

    const createdUser = addUser({
      email: cleanEmail,
      password: password || "admin123",
      nom: nom || cleanEmail.split("@")[0],
      role: assignedRole,
      company: "Tadbir AI Enterprise",
      emailVerified: true,
    });

    const access = `sess_${Date.now()}_${Buffer.from(cleanEmail).toString('base64url')}`;
    const refresh = `refr_${Date.now()}`;

    return NextResponse.json({
      success: true,
      message: "Inscription réussie.",
      user: {
        id: createdUser.id,
        email: createdUser.email,
        nom: createdUser.nom,
        role: createdUser.role,
      },
      access,
      refresh,
    }, { status: 201 });
  } catch (error: any) {
    console.error("[Next.js API Register] Error during registration:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de l'utilisateur." },
      { status: 500 }
    );
  }
}

