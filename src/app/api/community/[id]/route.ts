import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { AUTO_HIDE_REPORTS } from "@/lib/community";

type Ctx = { params: Promise<{ id: string }> };

/** ถูกใจ / คัดลอก / รายงาน */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  if (!rateLimit(`cm:${clientIp(request)}`, 60, 60_000).ok) return NextResponse.json({ ok: false }, { status: 429 });
  const db = readDb();
  const post = db.community.find((p) => p.id === id && p.status === "visible");
  if (!post) return NextResponse.json({ ok: false, error: "ไม่พบโพสต์" }, { status: 404 });
  if (action === "copy") {
    post.copies++;
    writeDb(db);
    return NextResponse.json({ ok: true, copies: post.copies });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อน", needLogin: true }, { status: 401 });
  if (action === "like") {
    const liked = post.likes.includes(user.id);
    post.likes = liked ? post.likes.filter((x) => x !== user.id) : [...post.likes, user.id];
    writeDb(db);
    return NextResponse.json({ ok: true, liked: !liked, likeCount: post.likes.length });
  }
  if (action === "report") {
    if (post.userId === user.id) return NextResponse.json({ ok: false, error: "รายงานโพสต์ตัวเองไม่ได้" }, { status: 400 });
    if (!post.reports.includes(user.id)) post.reports.push(user.id);
    if (post.reports.length >= AUTO_HIDE_REPORTS) post.status = "hidden";
    writeDb(db);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}

/** ลบโพสต์ของตัวเอง */
export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const db = readDb();
  const before = db.community.length;
  db.community = db.community.filter((p) => !(p.id === id && p.userId === user.id));
  if (db.community.length === before) return NextResponse.json({ ok: false, error: "ไม่พบโพสต์ของคุณ" }, { status: 404 });
  writeDb(db);
  return NextResponse.json({ ok: true });
}
