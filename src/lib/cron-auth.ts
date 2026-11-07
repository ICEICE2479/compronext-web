import "server-only";
import crypto from "node:crypto";

/** cron ต้องส่ง Authorization: Bearer <CRON_SECRET> (Vercel Cron ส่งให้เอง) */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
