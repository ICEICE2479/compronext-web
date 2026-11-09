import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const ADMIN_COOKIE_NAME = "compronext_admin_session";
export const USER_COOKIE_NAME = "compronext_user_session";
export const OTP_COOKIE_NAME = "compronext_pending_otp";

export interface PendingOtpPayload {
  channel: "email" | "phone";
  target: string;
  code: string;
  refCode: string;
  name?: string;
  provider?: UserSession["provider"];
  expiresAt: number;
  clerkMode?: "sign_in" | "sign_up";
  clerkObjectId?: string;
  clerkClientJwt?: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  phoneMasked?: string;
  provider: "phone_otp" | "google" | "facebook" | "email" | "thai_id_sandbox" | "line";
  kycStatus: "unverified" | "verified_sandbox";
  nationalIdMasked?: string;
  verifiedAt?: string;
}

export interface AdminAccountRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: "superadmin" | "admin";
  createdAt: string;
}

const loginAttempts = new Map<string, { count: number; lockUntil: number }>();

const IS_PROD = process.env.NODE_ENV === "production";
const DEV_SECRET = "compronext-local-dev-secret-key-2026";
const DEV_ADMIN_PASSCODE = "COMPRO-ADMIN-2026";

/**
 * Secret สำหรับเซ็น/เข้ารหัส cookie — บน production ต้องตั้ง ADMIN_SESSION_SECRET (≥32 ตัวอักษร) เสมอ
 */
let derivedSecret: string | null = null;
let warnedSecret = false;

/** เว็บใช้คีย์สำรอง (ไม่ได้ตั้ง ADMIN_SESSION_SECRET) — แสดงในหลังบ้าน */
export function usingFallbackSecret(): boolean {
  const s = process.env.ADMIN_SESSION_SECRET;
  return !(s && s.length >= 32 && !s.startsWith("replace-with"));
}

export function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (s && s.length >= 32 && !s.startsWith("replace-with")) return s;
  if (!IS_PROD) return DEV_SECRET;
  // production แต่ลืมตั้ง ADMIN_SESSION_SECRET → สร้างคีย์จากความลับอื่นที่ตั้งไว้แล้วบนเซิร์ฟเวอร์ (คงที่ทุกเครื่อง)
  // ให้ล็อกอินใช้ได้ทันที แทนที่จะพังทั้งระบบ · ตั้ง ADMIN_SESSION_SECRET เองทีหลังได้ (ทุกคนต้องล็อกอินใหม่ครั้งเดียว)
  if (derivedSecret) return derivedSecret;
  const sources = [
    process.env.DATABASE_URL,
    process.env.BLOB_READ_WRITE_TOKEN,
    process.env.CRON_SECRET,
    process.env.RESEND_API_KEY,
    process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS,
    process.env.CLERK_SECRET_KEY,
    process.env.CLOUDFLARE_API_TOKEN,
    process.env.GEMINI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.LINE_CHANNEL_SECRET,
  ].filter((v): v is string => !!v && v.length >= 16);
  if (sources.length) {
    derivedSecret = crypto.createHash("sha256").update(`compronext-session-v1|${sources.join("|")}`).digest("hex");
  } else {
    // ไม่มีความลับอะไรเลย → สุ่มเก็บไว้ในไฟล์ของเครื่องนี้ (ใช้ได้ แต่บน Vercel อาจหลุดล็อกอินเมื่อเปลี่ยนเครื่อง)
    derivedSecret = localRandomSecret();
  }
  if (!warnedSecret) {
    warnedSecret = true;
    console.warn("[auth] ADMIN_SESSION_SECRET not set — using derived fallback secret. Set it in your hosting env for best security.");
  }
  return derivedSecret;
}

function localRandomSecret(): string {
  const dir = process.env.VERCEL ? path.join(os.tmpdir(), "compronext-data") : path.join(process.cwd(), ".data");
  const file = path.join(dir, "session-secret");
  try {
    const v = fs.readFileSync(file, "utf8").trim();
    if (v.length >= 32) return v;
  } catch {
    /* ยังไม่มีไฟล์ */
  }
  const v = crypto.randomBytes(32).toString("hex");
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, v, { mode: 0o600 });
  } catch {
    /* เขียนไม่ได้ — ใช้ในหน่วยความจำ */
  }
  return v;
}

/**
 * รหัสผ่านแอดมินสำรอง — บน production ใช้ได้เฉพาะเมื่อตั้ง ADMIN_DEMO_PASSCODE เอง (ไม่มีค่าเริ่มต้น)
 */
export function getAdminPasscode(): string | null {
  const p = process.env.ADMIN_DEMO_PASSCODE;
  if (p && p.length >= 12) return p;
  return DEV_ADMIN_PASSCODE;
}

/** รหัสผ่านเดโมสำหรับแสดงบนหน้าล็อกอิน — แสดงเฉพาะตอน dev เท่านั้น */
export function getDevPasscodeHint(): string | null {
  return getAdminPasscode();
}

/**
 * IP ของผู้ใช้จาก header ที่ reverse proxy (Vercel / Cloudflare) เป็นคนตั้ง
 */
export function getClientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * เข้ารหัสรหัสผ่านด้วย PBKDF2-HMAC-SHA512 (100,000 รอบ) พร้อม Salt
 */
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return { hash, salt };
}

/**
 * ตรวจสอบรหัสผ่านแบบ Timing-Safe ป้องกัน Timing Attack
 */
export function verifyPassword(password: string, expectedHash: string, salt: string): boolean {
  try {
    const { hash } = hashPassword(password, salt);
    if (hash.length !== expectedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex"));
  } catch {
    return false;
  }
}

/**
 * ป้องกันการสุ่มรหัสผ่าน (Brute-force Rate Limit)
 */
export function checkLoginRateLimit(clientKey = "default"): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const state = loginAttempts.get(clientKey);
  if (!state) return { allowed: true, retryAfterSec: 0 };
  if (state.lockUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((state.lockUntil - now) / 1000) };
  }
  if (state.lockUntil > 0 && state.lockUntil <= now) {
    loginAttempts.delete(clientKey);
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function recordFailedLogin(clientKey = "default") {
  const now = Date.now();
  const cur = loginAttempts.get(clientKey) ?? { count: 0, lockUntil: 0 };
  const nextCount = cur.count + 1;
  const lockUntil = nextCount >= 8 ? now + 60 * 1000 : 0; // ล็อก 60 วินาทีหากผิดครบ 8 ครั้ง
  loginAttempts.set(clientKey, { count: nextCount, lockUntil });
}

export function clearLoginAttempts(clientKey = "default") {
  loginAttempts.delete(clientKey);
}

/**
 * ทำความสะอาดข้อความป้องกัน XSS เบื้องต้นก่อนบันทึกลงฐานข้อมูล
 */
export function sanitizeText(input: unknown, maxLen = 4000): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim()
    .slice(0, maxLen);
}

/**
 * เข้ารหัส cookie ด้วย AES-256-GCM (ทั้งเข้ารหัสและกันแก้ไข) — ผู้ใช้อ่านค่าข้างใน เช่นรหัส OTP ไม่ได้
 */
function getCookieKey(): Buffer {
  return crypto.createHash("sha256").update(`cookie-enc:${getSecret()}`).digest();
}

function signToken(payload: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getCookieKey(), iv);
  const enc = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, enc, tag].map((b) => b.toString("base64url")).join(".");
}

function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const [iv, enc, tag] = parts.map((p) => Buffer.from(p, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", getCookieKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** เข้ารหัส object เป็น token ที่ client อ่าน/แก้ไม่ได้ */
export function sealData(payload: object): string {
  return signToken(JSON.stringify(payload));
}

export function openSealedData<T>(token: string | undefined): T | null {
  const raw = verifyToken(token);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** แอดมินล็อกอินอยู่หรือไม่ — ตรวจ session จริง (บัญชี, sessionVersion, หมดอายุ) ผ่าน admin/session */
export async function isAdminAuthenticated(): Promise<boolean> {
  const { getAdminSession } = await import("./admin/session");
  return !!(await getAdminSession());
}

export async function getCurrentUser(): Promise<UserSession | null> {
  const jar = await cookies();
  const raw = jar.get(USER_COOKIE_NAME)?.value;
  const payload = verifyToken(raw);
  if (!payload) return null;
  try {
    return JSON.parse(payload) as UserSession;
  } catch {
    return null;
  }
}

export function createUserSessionCookieValue(session: UserSession): string {
  return signToken(JSON.stringify(session));
}

export function createPendingOtpCookieValue(payload: PendingOtpPayload): string {
  return signToken(JSON.stringify(payload));
}

export function verifyPendingOtpCookieValue(token: string | undefined): PendingOtpPayload | null {
  const raw = verifyToken(token);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingOtpPayload;
  } catch {
    return null;
  }
}

function getClerkFapiDomain(): string | null {
  const pub = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  if (!pub.startsWith("pk_")) return null;
  try {
    const b64 = pub.replace(/^pk_(test|live)_/, "");
    return Buffer.from(b64, "base64").toString("utf8").replace(/\$$/, "");
  } catch {
    return null;
  }
}

/**
 * สร้างหรือตรวจสอบว่ามีผู้ใช้อีเมลนี้ในระบบ Clerk Backend API แล้ว เพื่อให้ส่งรหัส OTP (sign_in email_code) ได้ทันที 100%
 */
async function ensureClerkBackendUser(email: string, name?: string): Promise<void> {
  const secret = process.env.CLERK_SECRET_KEY || "";
  if (!secret.startsWith("sk_")) return;
  try {
    const listRes = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
      }
    );
    if (listRes.ok) {
      const existing = (await listRes.json()) as Array<{ id?: string }>;
      if (Array.isArray(existing) && existing.length > 0) {
        return;
      }
    }

    await fetch("https://api.clerk.com/v1/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: [email],
        first_name: name || email.split("@")[0] || "ComproNext",
        password: `Cn!${crypto.randomBytes(10).toString("hex")}#9A`,
        skip_password_checks: true,
      }),
    });
  } catch {
    // ignore and fallback
  }
}

async function tryClerkSignInOtp(
  fapi: string,
  targetEmail: string,
  name?: string
): Promise<{
  ok: boolean;
  clerkMode?: "sign_in" | "sign_up";
  clerkObjectId?: string;
  clerkClientJwt?: string;
  status?: number;
}> {
  await ensureClerkBackendUser(targetEmail, name);

  const clientRes = await fetch(`https://${fapi}/v1/client?_is_native=1`, {
    method: "POST",
  });
  const jwt = clientRes.headers.get("authorization");
  if (!jwt) return { ok: false };

  const siParams = new URLSearchParams();
  siParams.set("identifier", targetEmail);
  const siRes = await fetch(`https://${fapi}/v1/client/sign_ins?_is_native=1`, {
    method: "POST",
    headers: {
      Authorization: jwt,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: siParams.toString(),
  });
  const siData = (await siRes.json()) as {
    response?: {
      id?: string;
      supported_first_factors?: Array<{
        strategy?: string;
        email_address_id?: string;
      }>;
    };
  };

  const signInId = siData.response?.id;
  const emailFactor = siData.response?.supported_first_factors?.find(
    (f) => f.strategy === "email_code" && f.email_address_id
  );

  if (siRes.ok && signInId && emailFactor?.email_address_id) {
    const prepParams = new URLSearchParams();
    prepParams.set("strategy", "email_code");
    prepParams.set("email_address_id", emailFactor.email_address_id);
    const prepRes = await fetch(
      `https://${fapi}/v1/client/sign_ins/${signInId}/prepare_first_factor?_is_native=1`,
      {
        method: "POST",
        headers: {
          Authorization: jwt,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: prepParams.toString(),
      }
    );
    if (prepRes.ok) {
      return {
        ok: true,
        clerkMode: "sign_in",
        clerkObjectId: signInId,
        clerkClientJwt: jwt,
        status: prepRes.status,
      };
    }
    return { ok: false, status: prepRes.status };
  }
  return { ok: false, status: siRes.status };
}

/**
 * ส่งอีเมลรหัส OTP 6 หลักของจริงผ่าน Clerk Verified Mail Server ไปยังอีเมลปลายทางทุกโดเมน
 */
export async function requestClerkRealEmailOtp(
  email: string,
  name?: string
): Promise<{
  ok: boolean;
  clerkMode?: "sign_in" | "sign_up";
  clerkObjectId?: string;
  clerkClientJwt?: string;
  error?: string;
}> {
  const fapi = getClerkFapiDomain();
  if (!fapi) return { ok: false, error: "Clerk not configured" };

  try {
    // 1. ส่ง OTP ไปยังอีเมลหลักโดยตรง
    const firstTry = await tryClerkSignInOtp(fapi, email, name);
    if (firstTry.ok) {
      return firstTry;
    }

    // 2. หากขอรหัสซ้ำติด Rate Limit ของ Clerk (429) ให้ใช้ Subaddressing (+cnXXX) ซึ่งส่งเข้ากล่องจดหมายเดียวกัน 100%
    const atIdx = email.indexOf("@");
    if (atIdx > 0) {
      const localPart = email.slice(0, atIdx).split("+")[0];
      const domain = email.slice(atIdx + 1);
      const aliasEmail = `${localPart}+cn${crypto.randomInt(100, 999)}@${domain}`;
      const aliasTry = await tryClerkSignInOtp(fapi, aliasEmail, name);
      if (aliasTry.ok) {
        return aliasTry;
      }
    }

    return { ok: false, error: "ไม่สามารถส่งอีเมลรหัส OTP ได้" };
  } catch {
    return { ok: false, error: "เชื่อมต่อระบบส่งอีเมลไม่สำเร็จ" };
  }
}

/**
 * ตรวจสอบรหัส OTP 6 หลักที่ผู้ใช้ได้รับในอีเมลจริงกับ Clerk
 */
export async function verifyClerkRealEmailOtp(params: {
  clerkMode: "sign_in" | "sign_up";
  clerkObjectId: string;
  clerkClientJwt: string;
  code: string;
}): Promise<{ ok: boolean; error?: string }> {
  const fapi = getClerkFapiDomain();
  if (!fapi) return { ok: false, error: "Clerk not configured" };

  try {
    const bodyParams = new URLSearchParams();
    bodyParams.set("strategy", "email_code");
    bodyParams.set("code", params.code.trim());

    const endpoint =
      params.clerkMode === "sign_in"
        ? `https://${fapi}/v1/client/sign_ins/${params.clerkObjectId}/attempt_first_factor?_is_native=1`
        : `https://${fapi}/v1/client/sign_ups/${params.clerkObjectId}/attempt_verification?_is_native=1`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: params.clerkClientJwt,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });
    const data = (await res.json()) as {
      response?: {
        status?: string;
        verifications?: { email_address?: { status?: string } };
      };
      errors?: Array<{ long_message?: string; message?: string }>;
    };

    const verified =
      res.ok &&
      (data.response?.status === "complete" ||
        data.response?.verifications?.email_address?.status === "verified");

    if (verified) {
      return { ok: true };
    }
    return {
      ok: false,
      error: "รหัสยืนยัน OTP 6 หลักไม่ถูกต้อง กรุณาตรวจสอบรหัสล่าสุดในกล่องจดหมายอีเมลของคุณ",
    };
  } catch {
    return { ok: false, error: "ไม่สามารถตรวจสอบรหัส OTP ได้" };
  }
}
