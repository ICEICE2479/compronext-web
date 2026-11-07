import { NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeText } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logOps } from "@/lib/ops-log";
import { sendComproNextEmail } from "@/lib/serverless-stack";

const Schema = z.object({
  storeName: z.string().min(2, "ใส่ชื่อร้าน").max(120),
  contactName: z.string().min(2, "ใส่ชื่อผู้ติดต่อ").max(120),
  email: z.string().email("อีเมลไม่ถูกต้อง").max(160),
  phone: z.string().min(9, "ใส่เบอร์โทร").max(20),
  line: z.string().max(60).default(""),
  shopUrl: z.string().max(300).default(""),
  categories: z.array(z.string().max(40)).max(12).default([]),
  productCount: z.string().max(20).default(""),
  message: z.string().max(1000).default(""),
  website: z.string().max(0).optional(), // ช่องดักบอท (คนจริงไม่เห็น)
});

/** ร้านสมัครเป็นพาร์ตเนอร์ → รอแอดมินอนุมัติในหลังบ้าน */
export async function POST(request: Request) {
  if (!rateLimit(`apply:${clientIp(request)}`, 3, 60 * 60_000).ok) return NextResponse.json({ ok: false, error: "ส่งบ่อยเกินไป ลองใหม่ภายหลัง" }, { status: 429 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ" }, { status: 400 });
  const v = parsed.data;
  const db = readDb();
  const email = v.email.trim().toLowerCase();
  if (db.partners.some((p) => p.email.toLowerCase() === email)) return NextResponse.json({ ok: false, error: "อีเมลนี้เป็นร้านพาร์ตเนอร์อยู่แล้ว ล็อกอินที่หน้า หลังร้าน ได้เลย" }, { status: 409 });
  if (db.partnerApplications.some((a) => a.email === email && a.status === "pending")) return NextResponse.json({ ok: true, already: true });
  const rec = {
    id: `app-${Date.now().toString(36)}`,
    storeName: sanitizeText(v.storeName, 120),
    contactName: sanitizeText(v.contactName, 120),
    email,
    phone: sanitizeText(v.phone, 20),
    line: sanitizeText(v.line, 60),
    shopUrl: /^https?:\/\//.test(v.shopUrl) ? sanitizeText(v.shopUrl, 300) : "",
    categories: v.categories.map((c) => sanitizeText(c, 40)),
    productCount: sanitizeText(v.productCount, 20),
    message: sanitizeText(v.message, 1000),
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  db.partnerApplications.unshift(rec);
  writeDb(db);
  await logOps({ kind: "admin", title: `ร้านสมัครใหม่: ${rec.storeName}`, detail: `${rec.email} · ${rec.phone}`, ok: true }).catch(() => {});
  // แจ้งแอดมิน (ถ้าตั้ง ADMIN_EMAILS ไว้)
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  for (const to of admins.slice(0, 3))
    await sendComproNextEmail({
      to,
      subject: `[ComproNext] ร้านสมัครใหม่: ${rec.storeName}`,
      roomOrBuildTitle: "มีร้านสมัครเป็นพาร์ตเนอร์",
      totalLabel: "ร้าน: ",
      totalPriceFormatted: rec.storeName,
      itemsSummary: [`ผู้ติดต่อ ${rec.contactName} · ${rec.phone}`, `อีเมล ${rec.email}`, "อนุมัติได้ที่ หลังบ้าน → ศูนย์ควบคุม → ร้านพาร์ตเนอร์"],
    }).catch(() => {});
  return NextResponse.json({ ok: true });
}
