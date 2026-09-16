import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { handleLocalApi } from './local-api';

const DJANGO_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Determines whether remote Django is configured and likely active
 */
function isRemoteDjangoConfigured(): boolean {
  if (!process.env.NEXT_PUBLIC_API_URL) return false;
  const url = process.env.NEXT_PUBLIC_API_URL.toLowerCase();
  return !url.includes("localhost") && !url.includes("127.0.0.1");
}

/**
 * Universal proxy-or-local handler for Next.js API routes.
 * If remote Django is explicitly configured, it attempts remote dispatch.
 * Otherwise (or if remote is unreachable), it gracefully serves from the local JSON data store.
 */
export async function proxyOrLocal(req: Request): Promise<NextResponse> {
  // If remote Django is explicitly set to an external domain
  if (isRemoteDjangoConfigured()) {
    try {
      const url = new URL(req.url);
      let targetPath = url.pathname;
      if (!targetPath.endsWith('/')) targetPath += '/';
      const cleanDjangoUrl = DJANGO_URL.replace(/\/$/, '');
      const targetUrl = cleanDjangoUrl + targetPath + url.search;

      const headers = new Headers(req.headers);
      headers.set('host', new URL(DJANGO_URL).host);
      headers.delete('content-length');
      headers.delete('transfer-encoding');
      headers.delete('connection');

      try {
        const cookieStore = cookies();
        const token = cookieStore.get('access_token')?.value;
        if (token) headers.set('Authorization', `Bearer ${token}`);

        const orgId = cookieStore.get('x-organization-id')?.value;
        if (orgId && !headers.has('x-organization-id')) {
          headers.set('x-organization-id', orgId);
        }
      } catch {}

      const options: RequestInit = {
        method: req.method,
        headers: headers,
        signal: AbortSignal.timeout(4000), // 4s timeout for remote
      };

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const clonedReq = req.clone();
        options.body = Buffer.from(await clonedReq.arrayBuffer());
      }

      const response = await fetch(targetUrl, options);
      if (response.status < 500) {
        const responseHeaders = new Headers(response.headers);
        responseHeaders.delete('content-encoding');
        return new NextResponse(response.body, {
          status: response.status,
          headers: responseHeaders,
        });
      }
    } catch (error) {
      console.warn("[API Proxy] Remote Django failed, falling back to local data store:", error);
    }
  }

  // Fallback to local data-store handler
  return handleLocalApi(req);
}
