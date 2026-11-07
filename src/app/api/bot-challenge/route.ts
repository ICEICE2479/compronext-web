import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import {
  checkLoginRateLimit,
  getClientIp,
  openSealedData,
  recordFailedLogin,
  sealData,
} from "@/lib/auth";

export const HUMAN_COOKIE_NAME = "compronext_human_verified";

const signData = sealData;

export function verifySignedData<T>(token: string | undefined): T | null {
  return openSealedData<T>(token);
}

const CHALLENGE_ITEMS = [
  { id: "shield", labelTh: "โล่ป้องกันความปลอดภัย" },
  { id: "lock", labelTh: "แม่กุญแจนิรภัย" },
  { id: "cpu", labelTh: "ชิปซีพียูคอมพิวเตอร์" },
  { id: "key", labelTh: "กุญแจรหัสยืนยัน" },
] as const;

export async function GET() {
  try {
    const target =
      CHALLENGE_ITEMS[Math.floor(Math.random() * CHALLENGE_ITEMS.length)];
    const issuedAt = Date.now();
    const nonce = crypto.randomBytes(8).toString("hex");

    // สลับลำดับตัวเลือกทุกครั้งเพื่อป้องกันบอทจำตำแหน่งปุ่ม
    const options = [...CHALLENGE_ITEMS].sort(() => Math.random() - 0.5);

    const challengeToken = signData({
      targetId: target.id,
      issuedAt,
      expiresAt: issuedAt + 5 * 60 * 1000,
      nonce,
    });

    return NextResponse.json({
      ok: true,
      targetLabelTh: target.labelTh,
      options: options.map((o) => ({ id: o.id, labelTh: o.labelTh })),
      challengeToken,
    });
  } catch (e) {
    // ส่วนใหญ่ = ยังไม่ได้ตั้ง ADMIN_SESSION_SECRET บนเซิร์ฟเวอร์ (ดูหลังบ้าน → ระบบ)
    console.error("[bot-challenge]", (e as Error).message);
    return NextResponse.json({ ok: false, error: "ระบบล็อกอินยังตั้งค่าไม่ครบ ลองใหม่ภายหลัง" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rate = checkLoginRateLimit(`bot_${clientIp}`);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `ตรวจพบการส่งคำขอถี่ผิดปกติ (Anti-DDoS) กรุณารอ ${rate.retryAfterSec} วินาที`,
      },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    challengeToken?: string;
    selectedId?: string;
    solveDurationMs?: number;
    honeypot?: string;
  };

  // 1. ตรวจจับบอทด้วย Honeypot (ช่องซ่อนที่คนทั่วไปมองไม่เห็น แต่บอทจะกรอกอัตโนมัติ)
  if (body.honeypot && body.honeypot.trim().length > 0) {
    recordFailedLogin(`bot_${clientIp}`);
    return NextResponse.json(
      { ok: false, error: "ระบบตรวจพบการทำงานของบอทอัตโนมัติ (Honeypot Triggered)" },
      { status: 403 }
    );
  }

  // 2. ตรวจจับบอทที่กดเร็วเกินมนุษย์ (< 150ms)
  if (typeof body.solveDurationMs === "number" && body.solveDurationMs < 150) {
    recordFailedLogin(`bot_${clientIp}`);
    return NextResponse.json(
      { ok: false, error: "ตรวจพบการคลิกเร็วผิดปกติ กรุณายืนยันตัวตนใหม่อีกครั้ง" },
      { status: 403 }
    );
  }

  const decoded = verifySignedData<{
    targetId: string;
    issuedAt: number;
    expiresAt: number;
    nonce: string;
  }>(body.challengeToken);

  if (!decoded || Date.now() > decoded.expiresAt) {
    return NextResponse.json(
      { ok: false, error: "คำถามยืนยันตัวตนหมดอายุ กรุณากดโหลดคำถามใหม่" },
      { status: 400 }
    );
  }

  if (body.selectedId !== decoded.targetId) {
    recordFailedLogin(`bot_${clientIp}`);
    return NextResponse.json(
      { ok: false, error: "เลือกรูปสัญลักษณ์ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" },
      { status: 400 }
    );
  }

  const botPassToken = signData({
    humanVerified: true,
    verifiedAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
    nonce: decoded.nonce,
  });

  const jar = await cookies();
  jar.set(HUMAN_COOKIE_NAME, botPassToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return NextResponse.json({
    ok: true,
    botPassToken,
  });
}
