import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { sealData } from "@/lib/auth";
import { isLineConfigured, LINE_STATE_COOKIE, lineRedirectUri, safeNextPath } from "@/lib/line-login";

/** เริ่มล็อกอินด้วย LINE: สร้าง state/nonce แล้วพาไปหน้า LINE */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!isLineConfigured()) {
    return NextResponse.redirect(new URL("/login?error=line_not_configured", url), 302);
  }
  const state = crypto.randomBytes(16).toString("hex");
  const nonce = crypto.randomBytes(16).toString("hex");
  const next = safeNextPath(url.searchParams.get("next"));

  const authorize = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINE_CHANNEL_ID!,
    redirect_uri: lineRedirectUri(request),
    state,
    nonce,
    scope: "profile openid email",
    // ชวนแอดเพื่อน LINE OA ตอนล็อกอิน (ไว้แจ้งเตือนลดราคา)
    ...(process.env.LINE_MESSAGING_TOKEN ? { bot_prompt: "aggressive" } : {}),
  }).toString();

  const res = NextResponse.redirect(authorize, 302);
  res.cookies.set(LINE_STATE_COOKIE, sealData({ state, nonce, next, exp: Date.now() + 10 * 60 * 1000 }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
