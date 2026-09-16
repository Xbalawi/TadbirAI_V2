import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const DJANGO_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const cleanDjangoUrl = DJANGO_URL.replace(/\/$/, '');
    
    const cookieStore = cookies();
    const token = cookieStore.get('access_token')?.value;

    const results: any = {
      djangoUrl: cleanDjangoUrl,
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 10) + '...' : null,
      steps: []
    };

    // Step 1: Try GET
    try {
      const getRes = await fetch(`${cleanDjangoUrl}/api/suppliers/`, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Accept': 'application/json'
        }
      });
      const getText = await getRes.text();
      results.steps.push({
        name: "GET /api/suppliers/",
        status: getRes.status,
        response: getText.substring(0, 500)
      });
    } catch (e: any) {
      results.steps.push({ name: "GET /api/suppliers/", error: e.message });
    }

    // Step 2: Try POST
    try {
      const postRes = await fetch(`${cleanDjangoUrl}/api/suppliers/`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ company_name: "DIAGNOSTIC_TEST_COMPANY" })
      });
      const postText = await postRes.text();
      results.steps.push({
        name: "POST /api/suppliers/",
        status: postRes.status,
        response: postText.substring(0, 500)
      });
    } catch (e: any) {
      results.steps.push({ name: "POST /api/suppliers/", error: e.message });
    }

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
