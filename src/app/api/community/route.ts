import { NextResponse } from "next/server";
import { getCurrentUser, sanitizeText } from "@/lib/auth";
import { readDb, writeDb, isUserBanned } from "@/lib/data/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { cleanSelection, visiblePosts } from "@/lib/community";

/** รายการโพสต์ชุมชน */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const kind = u.searchParams.get("kind") === "room" ? "room" : u.searchParams.get("kind") === "build" ? "build" : undefined;
  const posts = visiblePosts(readDb(), kind, u.searchParams.get("sort") === "top" ? "top" : "new").slice(0, 60);
  return NextResponse.json({ ok: true, posts: posts.map((p) => ({ ...p, reports: undefined, likes: undefined, likeCount: p.likes.length })) });
}

/** โพสต์สเปกคอม / ห้อง */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อนโพสต์", needLogin: true }, { status: 401 });
  if (isUserBanned(user.id)) return NextResponse.json({ ok: false, error: "บัญชีนี้ถูกระงับการโพสต์ ติดต่อทีมงาน" }, { status: 403 });
  if (!rateLimit(`post:${user.id}`, 5, 60 * 60_000).ok || !rateLimit(`post-ip:${clientIp(request)}`, 15, 60 * 60_000).ok)
    return NextResponse.json({ ok: false, error: "โพสต์ถี่เกินไป ลองใหม่ภายหลัง" }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { kind?: string; title?: unknown; text?: unknown; selection?: unknown; designId?: unknown };
  const title = sanitizeText(body.title, 80);
  const text = sanitizeText(body.text, 500);
  if (title.length < 3) return NextResponse.json({ ok: false, error: "ตั้งชื่อโพสต์อย่างน้อย 3 ตัวอักษร" }, { status: 400 });
  const db = readDb();
  const base = { id: `post-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, userId: user.id, userName: user.name.slice(0, 60), title, text, likes: [], copies: 0, status: "visible" as const, reports: [], createdAt: new Date().toISOString() };
  if (body.kind === "build") {
    const selection = cleanSelection(body.selection);
    if (!selection) return NextResponse.json({ ok: false, error: "สเปกต้องมีชิ้นส่วนอย่างน้อย 2 ชิ้น" }, { status: 400 });
    db.community.unshift({ ...base, kind: "build", selection });
  } else if (body.kind === "room") {
    // ห้องที่ AI จัดของตัวเอง (ใช้รูปผลลัพธ์ + รายการสินค้า)
    const design = db.designs.find((d) => d.id === body.designId && d.userId === user.id);
    if (!design) return NextResponse.json({ ok: false, error: "ไม่พบห้องของคุณ" }, { status: 404 });
    db.community.unshift({ ...base, kind: "room", productIds: design.productIds.slice(0, 30), imageUrl: design.imageUrl });
  } else return NextResponse.json({ ok: false, error: "ประเภทไม่ถูกต้อง" }, { status: 400 });
  if (db.community.length > 2000) db.community = db.community.slice(0, 2000);
  writeDb(db);
  return NextResponse.json({ ok: true, id: base.id });
}
