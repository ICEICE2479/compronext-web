import { NextResponse } from "next/server";
import { buildCompareItems } from "@/lib/compare-items";

export const revalidate = 300;

export function GET() {
  return NextResponse.json(
    { items: buildCompareItems() },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } }
  );
}
