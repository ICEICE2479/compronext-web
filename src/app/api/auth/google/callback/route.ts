import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { createUserSessionCookieValue, openSealedData, USER_COOKIE_NAME, type UserSession } from "@/lib/auth";
import { exchangeGoogleCode, GOOGLE_STATE_COOKIE, googleRedirectUri } from "@/lib/google-login";
import { safeNextPath } from "@/lib/line-login";
import { readDb, writeDb } from "@/lib/data/store";

/** Google ส่งผู้ใช้กลับมาที่นี่พร้อม code → แลก token → ตรวจ id_token → สร้าง session */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const saved = openSealedData<{ state: string; nonce: string; next: string; exp: number }>(jar.get(GOOGLE_STATE_COOKIE)?.value);
  const fail = (reason: string) => {
    const r = NextResponse.redirect(new URL(`/login?error=${reason}`, url), 302);
    r.cookies.delete(GOOGLE_STATE_COOKIE);
    return r;
  };
  if (url.searchParams.get("error")) return fail("google_cancelled");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!saved || !code || !state || saved.state !== state || Date.now() > saved.exp) return fail("google_state");

  const profile = await exchangeGoogleCode(code, googleRedirectUri(request), saved.nonce).catch(() => null);
  if (!profile) return fail("google_failed");

  const verifiedEmail = profile.email && profile.email_verified ? profile.email.toLowerCase() : null;
  const email = verifiedEmail || `${profile.sub}@google.compronext.app`;
  const db = readDb();
  // ผูกบัญชีเดิมด้วยอีเมลเฉพาะเมื่อ Google ยืนยันอีเมลแล้ว (กันยึดบัญชีคนอื่น)
  const existing = db.users.find((u) => u.clerkUserId === `google:${profile.sub}`) ?? (verifiedEmail ? db.users.find((u) => u.email === verifiedEmail) : undefined);
  const id = existing?.id ?? `usr-${crypto.randomUUID()}`;
  const name = (profile.name || existing?.fullName || "สมาชิก Google").slice(0, 120);
  if (existing) {
    existing.fullName = name;
    existing.clerkUserId = `google:${profile.sub}`;
  } else {
    db.users.unshift({
      id,
      clerkUserId: `google:${profile.sub}`,
      fullName: name,
      email,
      phone: "-",
      authProvider: "Google OAuth (Clerk)",
      nationalIdMasked: "-",
      kycStatus: "pending_review",
      creatorTier: "Starter (40%)",
      walletBalanceTHB: 0,
      pendingPayoutTHB: 0,
      joinedAt: new Date().toISOString().slice(0, 10),
    });
  }
  writeDb(db);

  const session: UserSession = { id, name, email, emailVerified: Boolean(verifiedEmail), provider: "google", kycStatus: "unverified" };
  const res = NextResponse.redirect(new URL(safeNextPath(saved.next), url), 302);
  res.cookies.delete(GOOGLE_STATE_COOKIE);
  res.cookies.set(USER_COOKIE_NAME, createUserSessionCookieValue(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
