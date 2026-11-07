import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { sealData } from "@/lib/auth";
import { GOOGLE_STATE_COOKIE, googleRedirectUri, isGoogleConfigured } from "@/lib/google-login";
import { safeNextPath } from "@/lib/line-login";

/** เริ่มล็อกอินด้วย Google: สร้าง state/nonce แล้วพาไปหน้า Google */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!isGoogleConfigured()) return NextResponse.redirect(new URL("/login?error=google_not_configured", url), 302);
  const state = crypto.randomBytes(16).toString("hex");
  const nonce = crypto.randomBytes(16).toString("hex");
  const next = safeNextPath(url.searchParams.get("next"));
  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(request),
    scope: "openid email profile",
    state,
    nonce,
    prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(authorize, 302);
  res.cookies.set(GOOGLE_STATE_COOKIE, sealData({ state, nonce, next, exp: Date.now() + 10 * 60 * 1000 }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
