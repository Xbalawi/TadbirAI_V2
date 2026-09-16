import { NextResponse } from 'next/server';
import { updateSpreadsheetMapping, getSpreadsheetSession } from '@/lib/spreadsheet-store';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const sessionId = params.id;

    if (body.column_mapping && Array.isArray(body.column_mapping)) {
      updateSpreadsheetMapping(sessionId, body.column_mapping);
    }

    const session = getSpreadsheetSession(sessionId);

    return NextResponse.json({
      id: sessionId,
      status: "updated",
      column_mapping: session?.column_mapping || body.column_mapping
    });
  } catch (error) {
    return NextResponse.json({ error: "Erreur lors de la mise à jour du mapping." }, { status: 500 });
  }
}
