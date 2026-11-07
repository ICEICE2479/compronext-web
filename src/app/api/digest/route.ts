import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";
import { verifyUnsubscribe } from "@/lib/digest";

/** สถานะรับอีเมลสรุปรายสัปดาห์ของฉัน */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // ยกเลิกจากลิงก์ในอีเมล: /api/digest?unsub=<userId>&t=<token>
  const unsub = url.searchParams.get("unsub");
  if (unsub) {
    if (!verifyUnsubscribe(unsub, url.searchParams.get("t") ?? "")) return NextResponse.redirect(new URL("/account", url), 302);
    const db = readDb();
    if (db.digestSubs[unsub]) {
      delete db.digestSubs[unsub];
      writeDb(db);
    }
    return NextResponse.redirect(new URL("/account?digest=off", url), 302);
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, on: Boolean(readDb().digestSubs[user.id]) });
}

/** เปิด/ปิดรับอีเมล */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { on } = (await request.json().catch(() => ({}))) as { on?: boolean };
  const email = user.email ?? "";
  if (on && (!email.includes("@") || email.endsWith(".compronext.app"))) return NextResponse.json({ ok: false, error: "บัญชีนี้ไม่มีอีเมลจริง" }, { status: 400 });
  const db = readDb();
  if (on) db.digestSubs = { ...db.digestSubs, [user.id]: { email, name: user.name, at: new Date().toISOString() } };
  else delete db.digestSubs[user.id];
  writeDb(db);
  return NextResponse.json({ ok: true, on: !!on });
}
