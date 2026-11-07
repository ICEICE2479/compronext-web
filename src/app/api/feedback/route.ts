import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, sanitizeText } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const Schema = z.object({ stars: z.number().int().min(1).max(5), text: z.string().max(800).default(""), page: z.string().max(120).default("") });

/** ความเห็นผู้ใช้: ใช้ง่ายไหม 1–5 ดาว + บอกสิ่งที่ติด */
export async function POST(request: Request) {
  if (!rateLimit(`fb:${clientIp(request)}`, 5, 60 * 60_000).ok) return NextResponse.json({ ok: false, error: "ขอบคุณครับ ส่งได้อีกทีภายหลัง" }, { status: 429 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "เลือกดาวก่อนนะ" }, { status: 400 });
  const user = await getCurrentUser();
  const db = readDb();
  db.feedback = [
    { id: `fb-${Date.now().toString(36)}`, stars: parsed.data.stars, text: sanitizeText(parsed.data.text, 800), page: sanitizeText(parsed.data.page, 120), userId: user?.id ?? null, at: new Date().toISOString() },
    ...db.feedback,
  ].slice(0, 2000);
  writeDb(db);
  return NextResponse.json({ ok: true });
}
