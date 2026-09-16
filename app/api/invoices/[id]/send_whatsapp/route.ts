import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DJANGO_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(`${DJANGO_URL}/api/invoices/${params.id}/send_whatsapp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Erreur de connexion au vrai backend" }, { status: 500 });
  }
}
