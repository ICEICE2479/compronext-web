import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getClientIp, getCurrentUser } from "@/lib/auth";
import { logAudit, ownerAdmin, shortIp } from "@/lib/admin/accounts";
import { ADMIN_SESSION_COOKIE_OPTIONS, createAdminSessionValue } from "@/lib/admin/session";

/** เจ้าของเว็บ (อีเมลใน ADMIN_EMAILS ที่ล็อกอินด้วย OTP แล้ว) กดเข้าหลังบ้านได้เลย */
export async function POST(request: Request) {
  const back = (q: string) => NextResponse.redirect(new URL(`/admin/login${q}`, request.url), 303);
  const user = await getCurrentUser();
  if (!user?.email) return back("?owner=login");
  try {
    const admin = await ownerAdmin(user.email);
    await logAudit({ action: "login_success", actor: admin.username, ip: shortIp(getClientIp(request)), target: admin.id, ok: true, detail: "owner-email" });
    const jar = await cookies();
    jar.set(ADMIN_COOKIE_NAME, createAdminSessionValue(admin), ADMIN_SESSION_COOKIE_OPTIONS);
    return NextResponse.redirect(new URL("/admin/ops", request.url), 303);
  } catch {
    return back("?owner=denied");
  }
}
