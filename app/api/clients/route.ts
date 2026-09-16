import { proxyOrLocal } from '@/lib/proxy-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) { return proxyOrLocal(req); }
export async function POST(req: Request) { return proxyOrLocal(req); }
export async function PUT(req: Request) { return proxyOrLocal(req); }
export async function PATCH(req: Request) { return proxyOrLocal(req); }
export async function DELETE(req: Request) { return proxyOrLocal(req); }

