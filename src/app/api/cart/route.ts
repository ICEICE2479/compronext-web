import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";

/** ตะกร้าของสมาชิก — ใช้ซิงก์ข้ามเครื่อง (เก็บแค่รหัสสินค้า + จำนวน) */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const db = readDb();
  const byId = new Map(db.products.map((p) => [p.id, p]));
  const items = (db.carts[user.id] ?? [])
    .map(({ id, quantity }) => {
      const p = byId.get(id);
      return p
        ? { id, name: p.name, price: p.price, imageUrl: p.imageUrl, buyUrl: p.buyUrl, storeName: p.storeName || p.platform, quantity }
        : null;
    })
    .filter(Boolean);
  return NextResponse.json({ ok: true, items });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { items?: Array<{ id?: unknown; quantity?: unknown }> };
  const db = readDb();
  const valid = new Set(db.products.map((p) => p.id));
  const items = (body.items ?? [])
    .filter((x) => typeof x.id === "string" && valid.has(x.id))
    .slice(0, 100)
    .map((x) => ({ id: x.id as string, quantity: Math.min(99, Math.max(1, Math.round(Number(x.quantity) || 1))) }));
  const prev = JSON.stringify(db.carts[user.id] ?? []);
  if (prev !== JSON.stringify(items)) {
    db.carts = { ...db.carts, [user.id]: items };
    writeDb(db);
  }
  return NextResponse.json({ ok: true });
}
