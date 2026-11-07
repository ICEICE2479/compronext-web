import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  checkLoginRateLimit,
  clearLoginAttempts,
  getClientIp,
  recordFailedLogin,
  sanitizeText,
} from "@/lib/auth";
import { completeSetup, logAudit, shortIp } from "@/lib/admin/accounts";
import { ADMIN_SESSION_COOKIE_OPTIONS, createAdminSessionValue } from "@/lib/admin/session";
import { AdminError } from "@/lib/admin/types";
import { adminErrorResponse } from "../_errors";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    username?: string;
    email?: string;
    password?: string;
  };

  const clientIp = getClientIp(request);
  const ip = shortIp(clientIp);
  const rateKey = `admin_setup_${clientIp}`;
  const rate = checkLoginRateLimit(rateKey);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: `พยายามหลายครั้งเกินไป กรุณารอ ${rate.retryAfterSec} วินาที` },
      { status: 429 }
    );
  }

  const username = sanitizeText(body.username, 64).trim();
  const email = sanitizeText(body.email, 160).trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const token = typeof body.token === "string" ? body.token : "";

  try {
    const admin = await completeSetup({ token, username, email, password });
    clearLoginAttempts(rateKey);
    await logAudit({ action: "setup", actor: admin.username, ip, target: admin.id, ok: true });
    const jar = await cookies();
    jar.set(ADMIN_COOKIE_NAME, createAdminSessionValue(admin), ADMIN_SESSION_COOKIE_OPTIONS);
    return NextResponse.json({ ok: true, admin });
  } catch (err) {
    if (err instanceof AdminError) {
      if (err.code === "bad_token") recordFailedLogin(rateKey);
      await logAudit({ action: "setup", actor: "-", ip, ok: false, detail: err.code });
    }
    return adminErrorResponse(err, { password, username, email });
  }
}
