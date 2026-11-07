import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getCurrentUser, sanitizeText } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";
import { saveUpload } from "@/lib/storage";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** บันทึกห้องที่ AI จัดไว้ในบัญชี และได้ลิงก์ไปแชร์ */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อนบันทึกห้อง", needLogin: true }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { image?: string; prompt?: string; productIds?: string[] };
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(body.image ?? "");
  if (!m) return NextResponse.json({ ok: false, error: "ไม่พบภาพที่จะบันทึก" }, { status: 400 });
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > MAX_IMAGE_BYTES) return NextResponse.json({ ok: false, error: "ภาพใหญ่เกินไป" }, { status: 400 });

  const db = readDb();
  const valid = new Set(db.products.map((p) => p.id));
  if (db.designs.filter((d) => d.userId === user.id).length >= 50) {
    return NextResponse.json({ ok: false, error: "บันทึกได้สูงสุด 50 ห้อง ลบห้องเก่าก่อนนะ" }, { status: 400 });
  }

  let imageUrl: string;
  try {
    imageUrl = (await saveUpload(bytes, "image", "designs")).url;
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }

  const design = {
    id: crypto.randomBytes(6).toString("base64url"),
    userId: user.id,
    userName: user.name,
    imageUrl,
    prompt: sanitizeText(body.prompt, 300),
    productIds: (body.productIds ?? []).filter((id) => typeof id === "string" && valid.has(id)).slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  db.designs.unshift(design);
  writeDb(db);
  return NextResponse.json({ ok: true, design, shareUrl: `/d/${design.id}` });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  const db = readDb();
  const before = db.designs.length;
  db.designs = db.designs.filter((d) => !(d.id === id && d.userId === user.id));
  if (db.designs.length === before) return NextResponse.json({ ok: false }, { status: 404 });
  writeDb(db);
  return NextResponse.json({ ok: true });
}
