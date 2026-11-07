import "server-only";
import { siteUrl } from "@/lib/seo";

/** Google Login (OpenID Connect) — ตั้ง GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET */
export const GOOGLE_STATE_COOKIE = "compronext_google_state";

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(request: Request): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ? siteUrl() : new URL(request.url).origin;
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}

export interface GoogleProfile {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

/** แลก code เป็น id_token แล้วให้ Google ตรวจ (tokeninfo) — เช็ก aud/iss/nonce/อายุ */
export async function exchangeGoogleCode(code: string, redirectUri: string, nonce: string): Promise<GoogleProfile | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenRes.ok) {
    console.error("[google] token error", tokenRes.status, (await tokenRes.text()).slice(0, 200));
    return null;
  }
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  if (!id_token) return null;
  const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`, { signal: AbortSignal.timeout(15000) });
  if (!infoRes.ok) return null;
  const info = (await infoRes.json()) as Omit<GoogleProfile, "email_verified"> & { aud?: string; iss?: string; nonce?: string; exp?: string; email_verified?: boolean | string };
  const issOk = info.iss === "https://accounts.google.com" || info.iss === "accounts.google.com";
  if (!info.sub || info.aud !== clientId || !issOk || info.nonce !== nonce || Number(info.exp) * 1000 < Date.now()) return null;
  return { sub: info.sub, email: info.email, name: info.name, email_verified: info.email_verified === true || info.email_verified === "true" };
}
