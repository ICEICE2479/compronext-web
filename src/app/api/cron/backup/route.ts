import { NextResponse } from "next/server";
import { createBackup } from "@/lib/backup";
import { cronAuthorized } from "@/lib/cron-auth";
import { logOps } from "@/lib/ops-log";
import { readDb, writeDb } from "@/lib/data/store";
import { expireBoosts } from "@/lib/boosts";
import { mirrorBatch } from "@/lib/image-mirror";
import { findRealImagesBatch } from "@/lib/real-image";
import { detectRoomPins } from "@/lib/room-pins";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** สำรองข้อมูลรายวัน (Vercel Cron) */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const info = await createBackup("อัตโนมัติรายวัน");
    const db = readDb();
    if (expireBoosts(db)) writeDb(db);
    await logOps({ kind: "cron", title: `สำรองข้อมูล ${info.sizeKb} KB`, ok: true });
    // เวลาที่เหลือ: เปลี่ยนรูปวาดเป็นรูปจริง แล้วเก็บรูปสินค้าเข้าระบบทีละนิด
    const real = await findRealImagesBatch({ limit: 25, budgetMs: 15_000 }).catch(() => null);
    if (real?.done) await logOps({ kind: "cron", title: `หารูปจริงจากหน้าร้านได้ ${real.done} ชิ้น (เหลือ ${real.left})`, ok: true });
    const pins = await detectRoomPins({ limit: 10, budgetMs: 10_000 }).catch(() => null);
    if (pins?.done) await logOps({ kind: "cron", title: `วางจุดสินค้าบนรูปห้อง ${pins.done} ห้อง (เหลือ ${pins.left})`, ok: true });
    const img = await mirrorBatch({ limit: 40, budgetMs: 20_000 }).catch(() => null);
    if (img?.done) await logOps({ kind: "cron", title: `เก็บรูปสินค้าเข้าระบบ ${img.done} รูป (เหลือ ${img.left})`, ok: true });
    return NextResponse.json({ ok: true, ...info, images: img });
  } catch (e) {
    await logOps({ kind: "cron", title: "สำรองข้อมูลล้มเหลว", detail: String(e), ok: false });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
