import { NextResponse } from "next/server";
import { getCurrentUser, isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** สถานะล็อกอิน (ให้หน้าเว็บที่แคชไว้ดึงไปแสดงชื่อ/ไอคอนบัญชี) */
export async function GET() {
  const [user, isAdmin] = await Promise.all([getCurrentUser(), isAdminAuthenticated()]);
  return NextResponse.json(
    { user: user ? { id: user.id, name: user.name, email: user.email, provider: user.provider, emailVerified: user.emailVerified, kycStatus: user.kycStatus } : null, isAdmin },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
