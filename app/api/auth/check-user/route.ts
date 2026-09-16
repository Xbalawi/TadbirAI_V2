import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/data-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ user: null }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = findUserByEmail(cleanEmail);

    if (!user) {
      return NextResponse.json({ user: null }, { status: 404 });
    }

    // Return only safe fields — never expose password hashes
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        company: user.company,
        emailVerified: user.emailVerified === true,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
