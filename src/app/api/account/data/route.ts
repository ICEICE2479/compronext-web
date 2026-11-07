import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, USER_COOKIE_NAME } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { deleteUserData, exportUserData } from "@/lib/user-data";

/** ดาวน์โหลดข้อมูลของฉัน (JSON) */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!rateLimit(`export:${user.id}:${clientIp(request)}`, 5, 60 * 60_000).ok) return NextResponse.json({ ok: false, error: "ขอถี่เกินไป" }, { status: 429 });
  const data = exportUserData(readDb(), user.id, user.email ?? null);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="compronext-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

/** ลบบัญชีถาวร — ต้องส่ง confirm: "ลบบัญชี" */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { confirm } = (await request.json().catch(() => ({}))) as { confirm?: string };
  if (confirm !== "ลบบัญชี") return NextResponse.json({ ok: false, error: "พิมพ์คำว่า ลบบัญชี เพื่อยืนยัน" }, { status: 400 });
  const db = readDb();
  const removed = deleteUserData(db, user.id, user.email ?? null);
  writeDb(db);
  const jar = await cookies();
  jar.delete(USER_COOKIE_NAME);
  return NextResponse.json({ ok: true, removed });
}
