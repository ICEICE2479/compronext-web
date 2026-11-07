import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";
import { pushPublicKey } from "@/lib/push";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** รับเฉพาะเซิร์ฟเวอร์แจ้งเตือนของเบราว์เซอร์จริง — กันใช้เว็บเรายิงคำขอไปที่อื่น (SSRF) */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];
function isPushService(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/** คีย์สาธารณะสำหรับสมัครรับแจ้งเตือน (null = ยังไม่ได้ตั้งค่า) */
export async function GET() {
  return NextResponse.json({ ok: true, publicKey: pushPublicKey() });
}

/** สมัครรับแจ้งเตือนในเครื่องนี้ */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, needLogin: true }, { status: 401 });
  if (!pushPublicKey()) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่าแจ้งเตือน" }, { status: 503 });
  if (!rateLimit(`push:${clientIp(request)}`, 10, 60_000).ok) return NextResponse.json({ ok: false }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!isPushService(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100)
    return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const db = readDb();
  const list = (db.pushSubs[user.id] ?? []).filter((s) => s.endpoint !== endpoint);
  list.unshift({ endpoint, keys: { p256dh, auth }, email: user.email ?? "", at: new Date().toISOString() });
  db.pushSubs = { ...db.pushSubs, [user.id]: list.slice(0, 5) };
  writeDb(db);
  return NextResponse.json({ ok: true });
}

/** ยกเลิกแจ้งเตือนในเครื่องนี้ */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
  const db = readDb();
  db.pushSubs = { ...db.pushSubs, [user.id]: (db.pushSubs[user.id] ?? []).filter((s) => s.endpoint !== endpoint) };
  writeDb(db);
  return NextResponse.json({ ok: true });
}
