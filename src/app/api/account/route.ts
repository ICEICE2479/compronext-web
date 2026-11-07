import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  createPendingOtpCookieValue,
  createUserSessionCookieValue,
  getClientIp,
  getCurrentUser,
  OTP_COOKIE_NAME,
  recordFailedLogin,
  requestClerkRealEmailOtp,
  sanitizeText,
  USER_COOKIE_NAME,
  verifyClerkRealEmailOtp,
  verifyPendingOtpCookieValue,
  type UserSession,
} from "@/lib/auth";
import { HUMAN_COOKIE_NAME, verifySignedData } from "@/app/api/bot-challenge/route";
import { readDb, writeDb, type AdminClerkKycUser } from "@/lib/data/store";
import { sendComproNextEmail } from "@/lib/serverless-stack";
import { logOps } from "@/lib/ops-log";

const OTP_TTL_MS = 10 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IS_PROD = process.env.NODE_ENV === "production";

function generateRefCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "CN";
  for (let i = 0; i < 4; i++) ref += chars[crypto.randomInt(chars.length)];
  return ref;
}

/** บันทึก/อัปเดตสมาชิกในฐานข้อมูล (ใช้อีเมลเป็นตัวระบุ) */
function syncUserToDatabase(session: UserSession): UserSession {
  try {
    const db = readDb();
    const idx = db.users.findIndex((u) => u.email.toLowerCase() === session.email.toLowerCase());
    if (idx >= 0) {
      const prev = db.users[idx];
      db.users[idx] = { ...prev, fullName: session.name || prev.fullName };
      writeDb(db);
      return { ...session, id: prev.id, name: db.users[idx].fullName };
    }
    const record: AdminClerkKycUser = {
      id: session.id,
      clerkUserId: `user_${Date.now().toString(36)}`,
      fullName: session.name,
      email: session.email,
      phone: "-",
      authProvider: "Email + 2FA",
      nationalIdMasked: "-",
      kycStatus: "pending_review",
      creatorTier: "Starter (40%)",
      walletBalanceTHB: 0,
      pendingPayoutTHB: 0,
      joinedAt: new Date().toISOString().slice(0, 10),
    };
    db.users.unshift(record);
    writeDb(db);
    return session;
  } catch {
    return session;
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: "email_request_verification" | "email_verify_code" | "logout";
    otp?: string;
    name?: string;
    email?: string;
    botPassToken?: string;
    honeypot?: string;
  };

  const jar = await cookies();
  const clientIp = getClientIp(request);

  if (body.action === "logout") {
    jar.delete(USER_COOKIE_NAME);
    jar.delete(OTP_COOKIE_NAME);
    return NextResponse.json({ ok: true, user: null });
  }

  if (body.honeypot && body.honeypot.trim().length > 0) {
    recordFailedLogin(`acct_${clientIp}`);
    return NextResponse.json({ ok: false, error: "ระบบป้องกันบอทบล็อกคำขอนี้" }, { status: 403 });
  }

  // ขั้นที่ 1: ส่งรหัส OTP 6 หลักไปที่อีเมล
  if (body.action === "email_request_verification") {
    const rate = checkLoginRateLimit(`acct_req_${clientIp}`);
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, error: `ขอรหัสถี่เกินไป กรุณารอ ${rate.retryAfterSec} วินาที` },
        { status: 429 }
      );
    }

    const human = verifySignedData<{ humanVerified: boolean; expiresAt: number }>(
      body.botPassToken || jar.get(HUMAN_COOKIE_NAME)?.value
    );
    if (!human?.humanVerified || Date.now() > human.expiresAt) {
      return NextResponse.json(
        { ok: false, error: "กรุณากดยืนยันว่าไม่ใช่บอทก่อนขอรับรหัส OTP" },
        { status: 403 }
      );
    }

    const email = sanitizeText(body.email, 160).toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, error: "กรุณากรอกรูปแบบอีเมลให้ถูกต้อง เช่น name@example.com" },
        { status: 400 }
      );
    }

    recordFailedLogin(`acct_req_${clientIp}`);
    const name = sanitizeText(body.name, 120) || email.split("@")[0];
    const code = String(crypto.randomInt(100000, 1000000));
    const refCode = generateRefCode();
    const clerk = await requestClerkRealEmailOtp(email);

    if (!clerk.ok) {
      const sent = await sendComproNextEmail({
        to: email,
        subject: `[ComproNext] รหัสยืนยัน OTP ของคุณคือ ${code} (Ref: ${refCode})`,
        roomOrBuildTitle: `รหัสยืนยันเข้าสู่ระบบสำหรับคุณ ${name}`,
        totalLabel: "",
        totalPriceFormatted: `รหัส OTP 6 หลัก: ${code} (Ref: ${refCode})`,
        itemsSummary: [
          `บัญชีอีเมล: ${email}`,
          `รหัส OTP 6 หลัก: ${code}`,
          `รหัสอ้างอิง: ${refCode}`,
          `รหัสนี้ใช้ได้ 10 นาที`,
        ],
      });
      if (!sent.ok || sent.mode === "resend_sandbox") {
        if (IS_PROD) {
          await logOps({
            kind: "error",
            title: "ส่งอีเมล OTP ไม่ได้ — ลูกค้าล็อกอินไม่ได้",
            detail: "ตั้ง GMAIL_USER + GMAIL_APP_PASSWORD หรือ Clerk ใน Vercel แล้ว Redeploy",
            ok: false,
          }).catch(() => {});
          return NextResponse.json({ ok: false, error: "ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ภายหลัง" }, { status: 502 });
        }
        console.info(`[dev] OTP for ${email}: ${code}`);
      }
    }

    const pendingToken = createPendingOtpCookieValue({
      channel: "email",
      target: email,
      code,
      refCode,
      name,
      provider: "email",
      expiresAt: Date.now() + OTP_TTL_MS,
      clerkMode: clerk.ok ? clerk.clerkMode : undefined,
      clerkObjectId: clerk.ok ? clerk.clerkObjectId : undefined,
      clerkClientJwt: clerk.ok ? clerk.clerkClientJwt : undefined,
    });

    jar.set(OTP_COOKIE_NAME, pendingToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD,
      path: "/",
      maxAge: OTP_TTL_MS / 1000,
    });

    return NextResponse.json({
      ok: true,
      channel: "email",
      email,
      name,
      refCode,
      pendingToken,
      expiresInSec: OTP_TTL_MS / 1000,
    });
  }

  // ขั้นที่ 2: ตรวจรหัส OTP
  if (body.action === "email_verify_code") {
    const rate = checkLoginRateLimit(`acct_verify_${clientIp}`);
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, error: `กรอกรหัสผิดหลายครั้ง กรุณารอ ${rate.retryAfterSec} วินาที` },
        { status: 429 }
      );
    }

    const rawToken =
      jar.get(OTP_COOKIE_NAME)?.value ||
      (typeof (body as { pendingToken?: unknown }).pendingToken === "string"
        ? (body as { pendingToken: string }).pendingToken
        : undefined);
    const pending = verifyPendingOtpCookieValue(rawToken);
    // อีเมลที่ล็อกอินได้ = อีเมลที่ส่งรหัสไปเท่านั้น (กันขอรหัสอีเมลตัวเองแล้วสวมอีเมลคนอื่น)
    const email = (pending?.target ?? "").toLowerCase();
    const askedEmail = sanitizeText(body.email, 160).toLowerCase();
    const otp = (body.otp || "").replace(/\D/g, "");
    if (otp.length !== 6) {
      return NextResponse.json({ ok: false, error: "กรุณากรอกรหัส OTP 6 หลักให้ครบ" }, { status: 400 });
    }

    if (!pending || pending.channel !== "email" || (askedEmail && askedEmail !== email) || Date.now() > pending.expiresAt) {
      jar.delete(OTP_COOKIE_NAME);
      return NextResponse.json(
        { ok: false, error: "รหัส OTP หมดอายุหรือไม่พบรายการขอรหัส กรุณากดส่งรหัส OTP อีกครั้ง" },
        { status: 400 }
      );
    }
    let valid = false;
    if (pending.channel === "email") {
      if (pending.clerkMode && pending.clerkObjectId && pending.clerkClientJwt) {
        const res = await verifyClerkRealEmailOtp({
          clerkMode: pending.clerkMode,
          clerkObjectId: pending.clerkObjectId,
          clerkClientJwt: pending.clerkClientJwt,
          code: otp,
        });
        valid = res.ok;
      } else {
        valid =
          otp.length === pending.code.length &&
          crypto.timingSafeEqual(Buffer.from(otp), Buffer.from(pending.code));
      }
    }
    if (!valid) {
      recordFailedLogin(`acct_verify_${clientIp}`);
      return NextResponse.json(
        { ok: false, error: "รหัส OTP 6 หลักไม่ถูกต้อง กรุณาตรวจสอบรหัสจากอีเมลของคุณอีกครั้ง" },
        { status: 400 }
      );
    }

    clearLoginAttempts(`acct_verify_${clientIp}`);
    jar.delete(OTP_COOKIE_NAME);

    const existing = await getCurrentUser();
    const session = syncUserToDatabase({
      id: existing?.email === email ? existing.id : `usr-${crypto.randomUUID()}`,
      name: sanitizeText(body.name, 120) || pending?.name || email.split("@")[0],
      email,
      emailVerified: true,
      provider: "email",
      kycStatus: "unverified",
    });

    jar.set(USER_COOKIE_NAME, createUserSessionCookieValue(session), {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return NextResponse.json({ ok: true, user: session });
  }

  return NextResponse.json({ ok: false, error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
}
