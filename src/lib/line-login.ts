import "server-only";
import { siteUrl } from "@/lib/seo";

/** LINE Login (OAuth 2.1 / OpenID) — ตั้ง LINE_CHANNEL_ID และ LINE_CHANNEL_SECRET */
export const LINE_STATE_COOKIE = "compronext_line_state";

export function isLineConfigured(): boolean {
  return Boolean(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET);
}

export function lineRedirectUri(request: Request): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ? siteUrl() : new URL(request.url).origin;
  return `${base.replace(/\/$/, "")}/api/auth/line/callback`;
}

/** ปลายทางหลังล็อกอิน — รับเฉพาะ path ภายในเว็บ กัน open redirect */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw.slice(0, 200);
}

export interface LineProfile {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

export async function exchangeLineCode(code: string, redirectUri: string, nonce: string): Promise<LineProfile | null> {
  const clientId = process.env.LINE_CHANNEL_ID!;
  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: process.env.LINE_CHANNEL_SECRET!,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenRes.ok) {
    console.error("[line] token error", tokenRes.status, (await tokenRes.text()).slice(0, 200));
    return null;
  }
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  if (!id_token) return null;

  // ให้ LINE ตรวจลายเซ็น/อายุ/nonce ของ id_token
  const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token, client_id: clientId, nonce }),
    signal: AbortSignal.timeout(15000),
  });
  if (!verifyRes.ok) {
    console.error("[line] verify error", verifyRes.status, (await verifyRes.text()).slice(0, 200));
    return null;
  }
  const profile = (await verifyRes.json()) as LineProfile & { nonce?: string };
  if (!profile.sub || profile.nonce !== nonce) return null;
  return profile;
}
