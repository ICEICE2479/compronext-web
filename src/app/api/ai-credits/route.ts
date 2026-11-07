import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";
import { creditBalance, creditPacks, newCreditOrder } from "@/lib/ai-credits";
import { boostQrSvg, promptPayEnabled } from "@/lib/boost-pay";
import { saveUpload } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_SLIP_BYTES = 4 * 1024 * 1024;

/** ยอดเครดิต + แพ็กเกจ + คำสั่งซื้อล่าสุดของฉัน */
export async function GET() {
  const user = await getCurrentUser();
  const packs = creditPacks();
  if (!user) return NextResponse.json({ ok: true, loggedIn: false, enabled: promptPayEnabled(), packs, balance: 0, orders: [] });
  const db = readDb();
  const orders = db.creditOrders
    .filter((o) => o.userId === user.id)
    .slice(0, 5)
    .map(({ id, credits, amount, status, createdAt }) => ({ id, credits, amount, status, createdAt }));
  return NextResponse.json({ ok: true, loggedIn: true, enabled: promptPayEnabled(), packs, balance: creditBalance(db, user.id), orders });
}

/**
 * JSON {action:"order", pack} → สร้างคำสั่งซื้อ + QR พร้อมเพย์
 * JSON {action:"qr", id} → เปิด QR เดิม
 * multipart action=paid, id, slip? → แจ้งโอน (รอแอดมินตรวจ)
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อนเติมเครดิต" }, { status: 401 });
  if (!rateLimit(`credits:${user.id}`, 10, 60_000).ok)
    return NextResponse.json({ ok: false, error: "ทำรายการถี่ไป รอสักครู่" }, { status: 429 });
  if (!promptPayEnabled()) return NextResponse.json({ ok: false, error: "ยังไม่เปิดรับชำระเงิน ติดต่อทีมงาน" }, { status: 503 });

  const isForm = (request.headers.get("content-type") ?? "").includes("multipart/form-data");
  const body: Record<string, unknown> = isForm
    ? Object.fromEntries((await request.formData().catch(() => new FormData())).entries())
    : await request.json().catch(() => ({}));
  const db = readDb();

  if (body.action === "order") {
    const pack = creditPacks()[Number(body.pack)];
    if (!pack) return NextResponse.json({ ok: false, error: "เลือกแพ็กเกจก่อน" }, { status: 400 });
    if (db.creditOrders.filter((o) => o.userId === user.id && o.status === "unpaid").length >= 3)
      return NextResponse.json({ ok: false, error: "มีรายการรอจ่ายอยู่แล้ว เปิด QR เดิมได้เลย" }, { status: 409 });
    const order = newCreditOrder(user.id, user.email, pack);
    db.creditOrders.unshift(order);
    db.creditOrders = db.creditOrders.slice(0, 5000);
    writeDb(db);
    return NextResponse.json({ ok: true, id: order.id, amount: order.amount, credits: order.credits, qrSvg: await boostQrSvg(order.amount) });
  }

  const order = db.creditOrders.find((o) => o.id === body.id && o.userId === user.id);
  if (!order) return NextResponse.json({ ok: false, error: "ไม่พบรายการ" }, { status: 404 });

  if (body.action === "qr") {
    if (order.status !== "unpaid") return NextResponse.json({ ok: false, error: "รายการนี้แจ้งโอนแล้ว" }, { status: 409 });
    return NextResponse.json({ ok: true, id: order.id, amount: order.amount, credits: order.credits, qrSvg: await boostQrSvg(order.amount) });
  }

  if (body.action === "paid") {
    if (order.status !== "unpaid") return NextResponse.json({ ok: false, error: "รายการนี้แจ้งโอนแล้ว" }, { status: 409 });
    const slip = body.slip;
    if (slip instanceof File && slip.size > 0) {
      if (slip.size > MAX_SLIP_BYTES || !slip.type.startsWith("image/"))
        return NextResponse.json({ ok: false, error: "สลิปต้องเป็นรูป ไม่เกิน 4MB" }, { status: 400 });
      try {
        const saved = await saveUpload(Buffer.from(await slip.arrayBuffer()), "image", `credit-slips/${user.id.replace(/[^a-zA-Z0-9_-]/g, "")}`);
        order.slipUrl = saved.url;
      } catch {
        return NextResponse.json({ ok: false, error: "อัปโหลดสลิปไม่สำเร็จ ลองใหม่" }, { status: 500 });
      }
    }
    order.status = "pending";
    order.paidAt = new Date().toISOString();
    writeDb(db);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
}
