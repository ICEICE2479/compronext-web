import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { createUserSessionCookieValue, openSealedData, USER_COOKIE_NAME, type UserSession } from "@/lib/auth";
import { exchangeLineCode, LINE_STATE_COOKIE, lineRedirectUri, safeNextPath } from "@/lib/line-login";
import { readDb, writeDb } from "@/lib/data/store";

/** LINE ส่งผู้ใช้กลับมาที่นี่พร้อม code → แลก token → ตรวจ id_token → สร้าง session */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const saved = openSealedData<{ state: string; nonce: string; next: string; exp: number }>(jar.get(LINE_STATE_COOKIE)?.value);
  const fail = (reason: string) => {
    const r = NextResponse.redirect(new URL(`/login?error=${reason}`, url), 302);
    r.cookies.delete(LINE_STATE_COOKIE);
    return r;
  };
  if (url.searchParams.get("error")) return fail("line_cancelled");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!saved || !code || !state || saved.state !== state || Date.now() > saved.exp) return fail("line_state");

  const profile = await exchangeLineCode(code, lineRedirectUri(request), saved.nonce).catch(() => null);
  if (!profile) return fail("line_failed");

  const email = profile.email?.toLowerCase() || `${profile.sub}@line.compronext.app`;
  const db = readDb();
  const existing = db.users.find((u) => u.clerkUserId === `line:${profile.sub}`) ?? (profile.email ? db.users.find((u) => u.email === email) : undefined);
  const id = existing?.id ?? `usr-${crypto.randomUUID()}`;
  const name = (profile.name || existing?.fullName || "สมาชิก LINE").slice(0, 120);
  if (existing) {
    existing.fullName = name;
    existing.clerkUserId = `line:${profile.sub}`;
  } else {
    db.users.unshift({
      id,
      clerkUserId: `line:${profile.sub}`,
      fullName: name,
      email,
      phone: "-",
      authProvider: "LINE Login (Clerk)",
      nationalIdMasked: "-",
      kycStatus: "pending_review",
      creatorTier: "Starter (40%)",
      walletBalanceTHB: 0,
      pendingPayoutTHB: 0,
      joinedAt: new Date().toISOString().slice(0, 10),
    });
  }
  writeDb(db);

  const session: UserSession = {
    id,
    name,
    email,
    emailVerified: Boolean(profile.email),
    provider: "line",
    kycStatus: "unverified",
  };
  const res = NextResponse.redirect(new URL(safeNextPath(saved.next), url), 302);
  res.cookies.delete(LINE_STATE_COOKIE);
  res.cookies.set(USER_COOKIE_NAME, createUserSessionCookieValue(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
