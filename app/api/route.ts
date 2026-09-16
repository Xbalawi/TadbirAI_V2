import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "Tadbir AI API Backend Service",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
}
