import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { getCurrentUser, sanitizeText } from "@/lib/auth";
import { getActivePartnerByEmail, readDb, writeDb } from "@/lib/data/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { CASE_TYPES, CASE_WISHES, caseCode, caseForViewer, type SupportCaseRecord } from "@/lib/returns";
import { notifyCaseEmail } from "@/lib/returns-server";

const evidenceUrl = z.string().max(1000).refine((v) => v.startsWith("/api/files/") || v.startsWith("https://"), "ลิงก์ไฟล์ไม่ถูกต้อง");

const CreateSchema = z.object({
  partnerId: z.string().min(1).max(100),
  productId: z.string().max(200).nullable().optional(),
  productName: z.string().max(200).optional(),
  orderRef: z.string().max(80).optional(),
  type: z.enum(Object.keys(CASE_TYPES) as [keyof typeof CASE_TYPES, ...Array<keyof typeof CASE_TYPES>]),
  wish: z.enum(Object.keys(CASE_WISHES) as [keyof typeof CASE_WISHES, ...Array<keyof typeof CASE_WISHES>]),
  description: z.string().min(10, "เล่าปัญหาอย่างน้อย 10 ตัวอักษร").max(2000),
  evidence: z.array(evidenceUrl).max(6).default([]),
});

/** ลูกค้า: เคสของฉัน · ร้านพาร์ตเนอร์: เคสของร้าน (?as=store) */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อน" }, { status: 401 });
  const db = readDb();
  if (new URL(request.url).searchParams.get("as") === "store") {
    const partner = getActivePartnerByEmail(user);
    if (!partner) return NextResponse.json({ ok: false, error: "ไม่ใช่บัญชีร้านพาร์ตเนอร์" }, { status: 403 });
    return NextResponse.json({ ok: true, cases: db.cases.filter((c) => c.partnerId === partner.id).map(caseForViewer) });
  }
  return NextResponse.json({ ok: true, cases: db.cases.filter((c) => c.userId === user.id).map(caseForViewer) });
}

/** ระบบแจ้งปัญหา: ลูกค้าเปิดเคสใหม่ */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อนแจ้งปัญหา" }, { status: 401 });
  if (!rateLimit(`case:${user.id}:${clientIp(request)}`, 5, 60 * 60_000).ok)
    return NextResponse.json({ ok: false, error: "แจ้งปัญหาบ่อยเกินไป ลองใหม่ภายหลัง" }, { status: 429 });
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ" }, { status: 400 });
  const input = parsed.data;
  const db = readDb();
  const partner = db.partners.find((p) => p.id === input.partnerId && p.active);
  if (!partner) return NextResponse.json({ ok: false, error: "ไม่พบร้านนี้" }, { status: 404 });
  const product = input.productId ? db.products.find((p) => p.id === input.productId && p.partnerId === partner.id) : undefined;
  const productName = product?.name ?? sanitizeText(input.productName, 200);
  if (!productName) return NextResponse.json({ ok: false, error: "ระบุสินค้าที่มีปัญหา" }, { status: 400 });

  let code = caseCode();
  while (db.cases.some((c) => c.code === code)) code = caseCode();
  const now = new Date().toISOString();
  const rec: SupportCaseRecord = {
    id: `case-${crypto.randomBytes(6).toString("hex")}`,
    code,
    userId: user.id,
    userName: user.name,
    email: user.email,
    partnerId: partner.id,
    storeName: partner.name,
    productId: product?.id ?? null,
    productName,
    orderRef: sanitizeText(input.orderRef, 80),
    type: input.type,
    wish: input.wish,
    description: sanitizeText(input.description, 2000),
    evidence: input.evidence,
    status: "submitted",
    events: [{ at: now, by: "customer", name: user.name, status: "submitted", note: "ส่งเรื่องแจ้งปัญหา", files: input.evidence }],
    createdAt: now,
    updatedAt: now,
  };
  db.cases.unshift(rec);
  writeDb(db);
  notifyCaseEmail(rec, "store", "มีลูกค้าแจ้งปัญหาสินค้าใหม่", rec.description.slice(0, 300));
  return NextResponse.json({ ok: true, case: caseForViewer(rec) });
}
