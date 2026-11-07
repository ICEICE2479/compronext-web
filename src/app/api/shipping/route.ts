import { NextResponse } from "next/server";
import { getShippingRules } from "@/lib/data/store";

export async function GET() {
  return NextResponse.json(
    { ok: true, rules: getShippingRules() },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
