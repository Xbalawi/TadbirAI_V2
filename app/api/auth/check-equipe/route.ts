import { NextResponse } from "next/server";
import { getEquipe } from "@/lib/data-store";

export const dynamic = "force-dynamic";

const VALID_ROLES = ["Administrateur", "Comptable", "Commercial", "Lecteur"];

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ allowed: false, reason: "Email requis." }, { status: 400 });
    }

    const cleanEmail = (email as string).trim().toLowerCase();
    const equipeList = getEquipe();

    const member = equipeList.find(
      (m: any) => m.email?.trim().toLowerCase() === cleanEmail
    );

    if (!member) {
      return NextResponse.json({
        allowed: false,
        reason:
          "Votre adresse e-mail n'a pas été invitée par un administrateur. Contactez votre administrateur pour obtenir un accès.",
      });
    }

    if (member.statut === "Suspendu") {
      return NextResponse.json({
        allowed: false,
        reason: "Votre compte a été suspendu. Contactez votre administrateur.",
      });
    }

    // Normalize role — only one canonical form exists: "Administrateur"
    const rawRole: string = member.role || "Lecteur";
    const role = rawRole.toLowerCase().includes("admin")
      ? "Administrateur"
      : VALID_ROLES.includes(rawRole)
      ? rawRole
      : "Lecteur";

    return NextResponse.json({
      allowed: true,
      role,
      nom: member.nom || "",
      statut: member.statut,
    });
  } catch {
    return NextResponse.json({ allowed: false, reason: "Erreur serveur." }, { status: 500 });
  }
}
