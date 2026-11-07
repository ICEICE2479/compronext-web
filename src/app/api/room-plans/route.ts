import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getCurrentUser, sanitizeText } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";
import { decodePlan } from "@/lib/room-planner";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_PLANS = 20;
const MAX_CODE = 20_000;

/** ห้อง 3D ที่บันทึกในบัญชี (ซิงก์ข้ามเครื่อง) — id "current" = ห้องที่กำลังจัดอยู่ (บันทึกอัตโนมัติ) */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อน" }, { status: 401 });
  return NextResponse.json({ ok: true, plans: readDb().roomPlans[user.id] ?? [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อน" }, { status: 401 });
  if (!rateLimit(`room-plans:${user.id}`, 30, 60_000).ok) return NextResponse.json({ ok: false, error: "บันทึกถี่ไป รอสักครู่" }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; name?: unknown; code?: unknown };
  const code = typeof body.code === "string" ? body.code : "";
  if (!code || code.length > MAX_CODE || !decodePlan(code)) return NextResponse.json({ ok: false, error: "ข้อมูลห้องไม่ถูกต้อง" }, { status: 400 });
  const rawId = typeof body.id === "string" ? body.id : "";
  const id = rawId === "current" || /^rp-[a-f0-9]{10}$/.test(rawId) ? rawId : `rp-${crypto.randomBytes(5).toString("hex")}`;
  const name = sanitizeText(typeof body.name === "string" ? body.name : "", 60) || (id === "current" ? "ห้องล่าสุด" : "ห้องของฉัน");

  const db = readDb();
  const list = (db.roomPlans[user.id] ?? []).filter((p) => p.id !== id);
  const rec = { id, name, code, updatedAt: new Date().toISOString() };
  db.roomPlans = { ...db.roomPlans, [user.id]: [rec, ...list].slice(0, MAX_PLANS) };
  writeDb(db);
  return NextResponse.json({ ok: true, plan: rec });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อน" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const db = readDb();
  db.roomPlans = { ...db.roomPlans, [user.id]: (db.roomPlans[user.id] ?? []).filter((p) => p.id !== id) };
  writeDb(db);
  return NextResponse.json({ ok: true });
}
