import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/data/store";
import { refreshPrices } from "@/lib/price-refresh";
import { cronAuthorized } from "@/lib/cron-auth";
import { logOps } from "@/lib/ops-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * เช็กราคาสินค้ากับร้าน — เรียกวันละครั้ง (Vercel Cron / cron-job.org)
 * ต้องส่ง Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 40));
  try {
    const db = readDb();
    const summary = await refreshPrices(db, limit);
    writeDb(db);
    await logOps({ kind: "cron", title: `เช็กราคา: ${JSON.stringify({ ...summary, ids: undefined }).slice(0, 200)}`, ok: true });
    return NextResponse.json({ ok: true, ...summary, ids: undefined });
  } catch (e) {
    await logOps({ kind: "cron", title: "เช็กราคาล้มเหลว", detail: String(e), ok: false });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
