import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { confirmSpreadsheetImport } from '@/lib/spreadsheet-store';

export const dynamic = 'force-dynamic';
const DJANGO_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id;
    const result = confirmSpreadsheetImport(sessionId) as any;

    const cookieStore = cookies();
    const token = cookieStore.get('access_token')?.value;
    const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;
    const organizationId = cookieStore.get('x-organization-id')?.value;
    if (organizationId) authHeaders['x-organization-id'] = organizationId;

    const cleanDjangoUrl = DJANGO_URL.replace(/\/$/, '');
    let endpoint = "";
    if (result.data_type === "suppliers") endpoint = `${cleanDjangoUrl}/api/suppliers/`;
    else if (result.data_type === "clients") endpoint = `${cleanDjangoUrl}/api/clients/`;
    else if (result.data_type === "stock") endpoint = `${cleanDjangoUrl}/api/products/`;

    let successCount = 0;
    const errors: string[] = [];
    if (endpoint && result.parsed_rows && result.parsed_rows.length > 0) {
      for (const [index, row] of result.parsed_rows.entries()) {
        try {
          const postRes = await fetch(endpoint, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(row)
          });
          if (postRes.ok) successCount++;
          else errors.push(`Ligne ${index + 1}: ${await postRes.text()}`);
        } catch (e) {
          console.error("Failed to POST row to Django", e);
          errors.push(`Ligne ${index + 1}: serveur backend inaccessible`);
        }
      }
    }

    return NextResponse.json({
      id: sessionId,
      status: "confirmed",
      data_type: result.data_type,
      inserted_rows: successCount,
      attempted_rows: result.parsed_rows?.length || 0,
      errors
    });
  } catch (error) {
    console.error("Confirm spreadsheet error:", error);
    return NextResponse.json({ error: "Erreur lors de la confirmation d'importation." }, { status: 500 });
  }
}
