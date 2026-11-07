import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";

/** ติดตามราคาสินค้า — แจ้งเตือนทางอีเมลเมื่อราคาลด */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const productId = new URL(request.url).searchParams.get("productId");
  if (!user || !productId) return NextResponse.json({ ok: true, watching: false, loggedIn: !!user });
  const watching = readDb().priceWatches.some((w) => w.userId === user.id && w.productId === productId);
  return NextResponse.json({ ok: true, watching, loggedIn: true });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อน", needLogin: true }, { status: 401 });
  if (!rateLimit(`watch:${user.id}`, 30, 60_000).ok) return NextResponse.json({ ok: false, error: "กดถี่เกินไป รอสักครู่" }, { status: 429 });
  const { productId } = (await request.json().catch(() => ({}))) as { productId?: string };
  const db = readDb();
  const product = db.products.find((p) => p.id === productId);
  if (!product) return NextResponse.json({ ok: false, error: "ไม่พบสินค้า" }, { status: 404 });

  const exists = db.priceWatches.some((w) => w.userId === user.id && w.productId === product.id);
  if (exists) {
    db.priceWatches = db.priceWatches.filter((w) => !(w.userId === user.id && w.productId === product.id));
  } else {
    if (db.priceWatches.filter((w) => w.userId === user.id).length >= 100) {
      return NextResponse.json({ ok: false, error: "ติดตามได้สูงสุด 100 ชิ้น" }, { status: 400 });
    }
    db.priceWatches.push({
      userId: user.id,
      email: user.email,
      productId: product.id,
      priceAtSave: product.price,
      createdAt: new Date().toISOString(),
    });
  }
  writeDb(db);
  return NextResponse.json({ ok: true, watching: !exists });
}
