import { NextResponse } from "next/server";
import { queuePush } from "@/lib/push";
import crypto from "node:crypto";
import { sanitizeText } from "@/lib/auth";
import { readDb, writeDb, isUserBanned } from "@/lib/data/store";
import { allowSend, getChatViewer, sideOf } from "@/lib/chat-access";

type Ctx = { params: Promise<{ id: string }> };

/** ข้อความในห้อง (ส่ง ?after=เวลา เพื่อดึงเฉพาะข้อความใหม่) แล้วถือว่าอ่านแล้ว */
export async function GET(request: Request, { params }: Ctx) {
  const viewer = await getChatViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อน" }, { status: 401 });
  const { id } = await params;
  const db = readDb();
  const thread = db.chats.find((t) => t.id === id);
  const side = thread ? sideOf(thread, viewer) : null;
  if (!thread || !side) return NextResponse.json({ ok: false, error: "ไม่พบห้องแชท" }, { status: 404 });

  const after = new URL(request.url).searchParams.get("after") ?? "";
  const messages = after ? thread.messages.filter((m) => m.at > after) : thread.messages.slice(-100);
  const last = thread.messages[thread.messages.length - 1]?.at ?? "";
  const readKey = side === "user" ? "userLastRead" : "storeLastRead";
  if (last && thread[readKey] < last) {
    thread[readKey] = last;
    writeDb(db);
  }
  const products = Object.fromEntries(
    [...new Set(messages.map((m) => m.productId).filter((x): x is string => !!x))].map((pid) => {
      const p = db.products.find((x) => x.id === pid);
      return [pid, p ? { id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl } : null];
    })
  );
  return NextResponse.json({
    ok: true,
    side,
    title: side === "user" ? thread.storeName : thread.userName,
    storeKey: thread.storeKey,
    messages,
    products,
    otherLastRead: side === "user" ? thread.storeLastRead : thread.userLastRead,
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const viewer = await getChatViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อน" }, { status: 401 });
  if (isUserBanned(viewer.user.id)) return NextResponse.json({ ok: false, error: "บัญชีนี้ถูกระงับการโพสต์ ติดต่อทีมงาน" }, { status: 403 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = sanitizeText(body.text, 1000);
  if (!text) return NextResponse.json({ ok: false, error: "พิมพ์ข้อความก่อน" }, { status: 400 });
  if (!allowSend(viewer.user.id)) return NextResponse.json({ ok: false, error: "ส่งถี่เกินไป รอสักครู่" }, { status: 429 });
  const db = readDb();
  const thread = db.chats.find((t) => t.id === id);
  const side = thread ? sideOf(thread, viewer) : null;
  if (!thread || !side) return NextResponse.json({ ok: false, error: "ไม่พบห้องแชท" }, { status: 404 });
  const now = new Date().toISOString();
  const message = { id: crypto.randomBytes(6).toString("hex"), from: side, text, at: now, productId: null };
  thread.messages.push(message);
  if (thread.messages.length > 500) thread.messages = thread.messages.slice(-500);
  thread.updatedAt = now;
  if (side === "user") thread.userLastRead = now;
  else thread.storeLastRead = now;
  writeDb(db);
  // แจ้งเตือนอีกฝั่ง (ลูกค้า ↔ ร้าน)
  const partner = db.partners.find((p) => p.id === thread.partnerId);
  queuePush(
    db,
    side === "user" ? { email: partner?.email } : { userIds: [thread.userId] },
    { title: side === "user" ? `ข้อความใหม่จาก ${thread.userName}` : `ร้าน ${thread.storeName} ตอบกลับ`, body: text.slice(0, 120), url: `/messages?t=${encodeURIComponent(thread.id)}`, tag: `chat-${thread.id}` }
  );
  return NextResponse.json({ ok: true, message });
}
