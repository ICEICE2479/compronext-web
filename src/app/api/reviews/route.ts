import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import crypto from "node:crypto";
import { getCurrentUser, sanitizeText } from "@/lib/auth";
import { getActivePartnerByEmail, readDb, writeDb, isUserBanned } from "@/lib/data/store";
import { getStore, partnerStoreKey, ratingSummary } from "@/lib/stores";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("store") ?? "";
  const db = readDb();
  const user = await getCurrentUser();
  const reviews = db.reviews
    .filter((r) => r.storeKey === key)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 200)
    .map(({ userId, ...r }) => ({ ...r, mine: !!user && userId === user.id }));
  const partner = getActivePartnerByEmail(user);
  return NextResponse.json({
    ok: true,
    summary: ratingSummary(key, db),
    reviews,
    loggedIn: !!user,
    isOwner: partnerStoreKey(partner) === key,
  });
}

/** เขียน/แก้รีวิว — คนละ 1 รีวิวต่อร้าน */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อนรีวิว", needLogin: true }, { status: 401 });
  if (isUserBanned(user.id)) return NextResponse.json({ ok: false, error: "บัญชีนี้ถูกระงับการโพสต์ ติดต่อทีมงาน" }, { status: 403 });
  if (!rateLimit(`review:${user.id}`, 5, 10 * 60_000).ok || !rateLimit(`review-ip:${clientIp(request)}`, 15, 60 * 60_000).ok)
    return NextResponse.json({ ok: false, error: "ส่งรีวิวถี่เกินไป ลองใหม่ภายหลัง" }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { store?: string; rating?: number; text?: string };
  const db = readDb();
  const store = getStore(String(body.store ?? ""), db);
  if (!store) return NextResponse.json({ ok: false, error: "ไม่พบร้านค้า" }, { status: 404 });
  const partner = getActivePartnerByEmail(user);
  if (partnerStoreKey(partner) === store.key) {
    return NextResponse.json({ ok: false, error: "รีวิวร้านของตัวเองไม่ได้" }, { status: 403 });
  }
  const rating = Math.round(Number(body.rating));
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ ok: false, error: "เลือกดาว 1–5" }, { status: 400 });
  const text = sanitizeText(body.text, 1000);
  if (text.length < 5) return NextResponse.json({ ok: false, error: "เขียนรีวิวอย่างน้อย 5 ตัวอักษร" }, { status: 400 });

  const now = new Date().toISOString();
  const mine = db.reviews.find((r) => r.storeKey === store.key && r.userId === user.id);
  if (mine) {
    mine.rating = rating;
    mine.text = text;
    mine.updatedAt = now;
  } else {
    db.reviews.push({
      id: `rv-${crypto.randomBytes(6).toString("hex")}`,
      storeKey: store.key,
      storeName: store.name,
      userId: user.id,
      userName: (user.name || "ลูกค้า").slice(0, 40),
      rating,
      text,
      createdAt: now,
      reply: null,
    });
  }
  writeDb(db);
  return NextResponse.json({ ok: true, summary: ratingSummary(store.key, db) });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อน" }, { status: 401 });
  const key = new URL(request.url).searchParams.get("store") ?? "";
  const db = readDb();
  const before = db.reviews.length;
  db.reviews = db.reviews.filter((r) => !(r.storeKey === key && r.userId === user.id));
  if (db.reviews.length !== before) writeDb(db);
  return NextResponse.json({ ok: true, summary: ratingSummary(key, db) });
}
