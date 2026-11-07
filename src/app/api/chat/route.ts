import { NextResponse } from "next/server";
import { queuePush } from "@/lib/push";
import crypto from "node:crypto";
import { sanitizeText } from "@/lib/auth";
import { readDb, writeDb, isUserBanned } from "@/lib/data/store";
import { getStore, unreadFor } from "@/lib/stores";
import { allowSend, getChatViewer, sideOf } from "@/lib/chat-access";

/** รายการห้องแชทของฉัน (ทั้งฝั่งลูกค้า และฝั่งร้านถ้าเป็นพาร์ตเนอร์) */
export async function GET() {
  const viewer = await getChatViewer();
  if (!viewer) return NextResponse.json({ ok: true, loggedIn: false, threads: [], unread: 0 });
  const db = readDb();
  const threads = db.chats
    .map((t) => ({ t, side: sideOf(t, viewer) }))
    .filter((x): x is { t: (typeof db.chats)[number]; side: "user" | "store" } => x.side !== null)
    .sort((a, b) => b.t.updatedAt.localeCompare(a.t.updatedAt))
    .map(({ t, side }) => ({
      id: t.id,
      side,
      title: side === "user" ? t.storeName : t.userName,
      storeKey: t.storeKey,
      last: t.messages[t.messages.length - 1] ?? null,
      unread: unreadFor(t, side),
      updatedAt: t.updatedAt,
    }));
  return NextResponse.json({
    ok: true,
    loggedIn: true,
    isPartner: !!viewer.partner,
    threads,
    unread: threads.reduce((s, x) => s + x.unread, 0),
  });
}

/** เริ่มคุยกับร้าน (หรือส่งต่อในห้องเดิม) */
export async function POST(request: Request) {
  const viewer = await getChatViewer();
  if (!viewer) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อนทักร้าน", needLogin: true }, { status: 401 });
  if (isUserBanned(viewer.user.id)) return NextResponse.json({ ok: false, error: "บัญชีนี้ถูกระงับการโพสต์ ติดต่อทีมงาน" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { store?: string; text?: string; productId?: string };
  const db = readDb();
  const store = getStore(String(body.store ?? ""), db);
  if (!store?.partner) return NextResponse.json({ ok: false, error: "ร้านนี้ยังไม่เปิดแชทผ่านเว็บ" }, { status: 400 });
  if (viewer.partner?.id === store.partner.id) return NextResponse.json({ ok: false, error: "นี่คือร้านของคุณเอง" }, { status: 400 });
  const text = sanitizeText(body.text, 1000);
  if (!text) return NextResponse.json({ ok: false, error: "พิมพ์ข้อความก่อน" }, { status: 400 });
  if (!allowSend(viewer.user.id)) return NextResponse.json({ ok: false, error: "ส่งถี่เกินไป รอสักครู่" }, { status: 429 });

  const productId = typeof body.productId === "string" && db.products.some((p) => p.id === body.productId) ? body.productId : null;
  const now = new Date().toISOString();
  let thread = db.chats.find((t) => t.userId === viewer.user.id && t.partnerId === store.partner!.id);
  if (!thread) {
    if (db.chats.filter((t) => t.userId === viewer.user.id).length >= 50) {
      return NextResponse.json({ ok: false, error: "ห้องแชทเยอะเกินไป" }, { status: 400 });
    }
    thread = {
      id: `ch-${crypto.randomBytes(8).toString("hex")}`,
      storeKey: store.key,
      storeName: store.name,
      partnerId: store.partner.id,
      userId: viewer.user.id,
      userName: (viewer.user.name || "ลูกค้า").slice(0, 40),
      messages: [],
      updatedAt: now,
      userLastRead: now,
      storeLastRead: "",
    };
    db.chats.push(thread);
  }
  thread.messages.push({ id: crypto.randomBytes(6).toString("hex"), from: "user", text, at: now, productId });
  if (thread.messages.length > 500) thread.messages = thread.messages.slice(-500);
  thread.updatedAt = now;
  thread.userLastRead = now;
  writeDb(db);
  queuePush(db, { email: store.partner.email }, { title: `ข้อความใหม่จาก ${thread.userName}`, body: text.slice(0, 120), url: `/messages?t=${encodeURIComponent(thread.id)}`, tag: `chat-${thread.id}` });
  return NextResponse.json({ ok: true, threadId: thread.id });
}
