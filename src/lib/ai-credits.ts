import "server-only";
import crypto from "node:crypto";
import { readDb, writeDb, type CreditOrderRecord, type RuntimeDatabase } from "@/lib/data/store";

/**
 * เครดิต AI แบบเติมเงิน — ใช้หลังโควตาฟรีรายวันหมด (1 เครดิต = 1 ภาพ ไม่มีวันหมดอายุ)
 * แพ็กเกจตั้งที่ AI_CREDIT_PACKS="ราคา:เครดิต,..." (ค่าเริ่มต้น 49:20,99:50,199:120)
 */
export interface CreditPack {
  amount: number;
  credits: number;
}

export function creditPacks(raw = process.env.AI_CREDIT_PACKS): CreditPack[] {
  const out: CreditPack[] = [];
  for (const part of (raw ?? "").split(",")) {
    const [a, c] = part.split(":").map((x) => Number(x.trim()));
    if (Number.isInteger(a) && Number.isInteger(c) && a > 0 && c > 0 && a <= 100_000 && c <= 100_000) out.push({ amount: a, credits: c });
  }
  return out.length
    ? out.slice(0, 6)
    : [
        { amount: 49, credits: 20 },
        { amount: 99, credits: 50 },
        { amount: 199, credits: 120 },
      ];
}

export function creditBalance(db: Pick<RuntimeDatabase, "aiCredits">, userId: string): number {
  const v = db.aiCredits?.[userId];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** หักเครดิต n หน่วย ถ้าพอ — คืนยอดคงเหลือ หรือ null ถ้าไม่พอ/บันทึกไม่ได้ */
export function spendCredits(userId: string, n: number): number | null {
  try {
    const db = readDb();
    const bal = creditBalance(db, userId);
    if (n <= 0 || bal < n) return null;
    db.aiCredits = { ...db.aiCredits, [userId]: bal - n };
    writeDb(db);
    return bal - n;
  } catch {
    return null;
  }
}

export function addCredits(db: RuntimeDatabase, userId: string, n: number): number {
  const next = creditBalance(db, userId) + Math.max(0, Math.floor(n));
  db.aiCredits = { ...db.aiCredits, [userId]: next };
  return next;
}

/** คืนเครดิตเมื่อสร้างภาพไม่สำเร็จ */
export function refundCredits(userId: string, n: number) {
  try {
    const db = readDb();
    addCredits(db, userId, n);
    writeDb(db);
  } catch {
    /* ignore */
  }
}

export function newCreditOrder(userId: string, email: string, pack: CreditPack): CreditOrderRecord {
  return {
    id: `cr-${crypto.randomBytes(5).toString("hex")}`,
    userId,
    email,
    credits: pack.credits,
    amount: pack.amount,
    status: "unpaid",
    createdAt: new Date().toISOString(),
  };
}
