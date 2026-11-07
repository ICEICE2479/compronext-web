import { NextResponse } from "next/server";
import { readDb } from "@/lib/data/store";
import { cronAuthorized } from "@/lib/cron-auth";
import { buildDigest, unsubscribeToken } from "@/lib/digest";
import { logOps } from "@/lib/ops-log";
import { siteUrl } from "@/lib/seo";
import { sendComproNextEmail } from "@/lib/serverless-stack";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** ส่งอีเมลสรุปรายสัปดาห์ (ทุกวันจันทร์) — เฉพาะคนที่สมัคร และมีเรื่องใหม่จริง */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const db = readDb();
  let sent = 0;
  let skipped = 0;
  for (const [userId, sub] of Object.entries(db.digestSubs)) {
    const lines = buildDigest(db, userId);
    if (!lines) {
      skipped++;
      continue;
    }
    const r = await sendComproNextEmail({
      to: sub.email,
      subject: "[ComproNext] สรุปประจำสัปดาห์ของคุณ",
      roomOrBuildTitle: "อัปเดตประจำสัปดาห์",
      totalLabel: "",
      totalPriceFormatted: `เลิกรับอีเมลนี้: ${siteUrl()}/api/digest?unsub=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`,
      itemsSummary: lines,
    }).catch(() => null);
    if (r?.ok) sent++;
  }
  await logOps({ kind: "cron", title: `อีเมลรายสัปดาห์: ส่ง ${sent} · ไม่มีเรื่องใหม่ ${skipped}`, ok: true });
  return NextResponse.json({ ok: true, sent, skipped });
}
