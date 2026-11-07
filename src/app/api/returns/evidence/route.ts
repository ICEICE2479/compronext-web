import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { saveUpload, UPLOAD_KINDS } from "@/lib/storage";

/** แนบรูปหลักฐาน (สมาชิกที่ล็อกอินแล้วเท่านั้น · รูป JPG/PNG/WEBP) */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "เข้าสู่ระบบก่อน" }, { status: 401 });
  if (!rateLimit(`evidence:${user.id}:${clientIp(request)}`, 30, 60 * 60_000).ok)
    return NextResponse.json({ ok: false, error: "อัปโหลดบ่อยเกินไป ลองใหม่ภายหลัง" }, { status: 429 });
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > UPLOAD_KINDS.image.maxBytes + 64 * 1024) return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกินไป" }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "เลือกไฟล์รูป" }, { status: 400 });
  try {
    const saved = await saveUpload(Buffer.from(await file.arrayBuffer()), "image", `returns/${user.id.replace(/[^a-zA-Z0-9_-]/g, "")}`);
    return NextResponse.json({ ok: true, url: saved.url });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "อัปโหลดไม่สำเร็จ" }, { status: 400 });
  }
}
