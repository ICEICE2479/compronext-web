import { NextResponse } from "next/server";
import { getServerlessStackStatus } from "@/lib/serverless-stack";

export const dynamic = "force-dynamic";

export async function GET() {
  const stack = getServerlessStackStatus();
  return NextResponse.json({
    ok: true,
    status: "healthy",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    services: stack.map((s) => ({
      id: s.id,
      name: s.name,
      mode: s.modeLabel,
      configured: s.configured,
    })),
  });
}
