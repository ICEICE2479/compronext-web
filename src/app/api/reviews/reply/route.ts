import { NextResponse } from "next/server";
import { getCurrentUser, sanitizeText } from "@/lib/auth";
import { getActivePartnerByEmail, readDb, writeDb } from "@/lib/data/store";
import { partnerStoreKey } from "@/lib/stores";

/** ร้านตอบรีวิว (เฉพาะร้านเจ้าของรีวิวนั้น) */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const partner = getActivePartnerByEmail(user);
  if (!partner) return NextResponse.json({ ok: false, error: "เฉพาะร้านพาร์ตเนอร์" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { reviewId?: string; text?: string };
  const db = readDb();
  const review = db.reviews.find((r) => r.id === body.reviewId);
  if (!review || review.storeKey !== partnerStoreKey(partner)) {
    return NextResponse.json({ ok: false, error: "ไม่พบรีวิว" }, { status: 404 });
  }
  const text = sanitizeText(body.text, 600);
  review.reply = text ? { text, at: new Date().toISOString() } : null;
  writeDb(db);
  return NextResponse.json({ ok: true, reply: review.reply });
}
