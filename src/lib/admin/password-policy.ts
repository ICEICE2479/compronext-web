/** เกณฑ์รหัสผ่านแอดมิน — ใช้ได้ทั้งฝั่ง UI และเซิร์ฟเวอร์ (ไม่มีการเรียกเครือข่าย) */

export const PASSWORD_MIN_LENGTH = 12;

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+?";

/** A–Z a–z 2–9 + สัญลักษณ์ ไม่มีตัวที่สับสนง่าย (O 0 I l 1) */
export const GENERATOR_ALPHABET = UPPER + LOWER + DIGITS + SYMBOLS;

export interface PasswordPolicyResult {
  ok: boolean;
  errors: string[];
  score: 0 | 1 | 2 | 3 | 4;
}

function identityParts(ctx?: { username?: string; email?: string }): string[] {
  const parts: string[] = [];
  const u = ctx?.username?.trim().toLowerCase();
  if (u && u.length >= 3) parts.push(u);
  const local = ctx?.email?.trim().toLowerCase().split("@")[0];
  if (local && local.length >= 3) parts.push(local);
  return parts;
}

export function checkPasswordPolicy(
  pw: string,
  ctx?: { username?: string; email?: string }
): PasswordPolicyResult {
  const value = typeof pw === "string" ? pw : "";
  const errors: string[] = [];
  const longEnough = value.length >= PASSWORD_MIN_LENGTH;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /[0-9]/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  const lower = value.toLowerCase();
  const containsIdentity = identityParts(ctx).some((p) => lower.includes(p));

  if (!longEnough) errors.push(`ต้องยาวอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`);
  if (!hasUpper) errors.push("ต้องมีตัวพิมพ์ใหญ่ (A–Z) อย่างน้อย 1 ตัว");
  if (!hasLower) errors.push("ต้องมีตัวพิมพ์เล็ก (a–z) อย่างน้อย 1 ตัว");
  if (!hasDigit) errors.push("ต้องมีตัวเลข (0–9) อย่างน้อย 1 ตัว");
  if (!hasSymbol) errors.push("ต้องมีสัญลักษณ์ เช่น ! @ # $ อย่างน้อย 1 ตัว");
  if (containsIdentity) errors.push("ห้ามมีชื่อผู้ใช้หรือชื่ออีเมลอยู่ในรหัสผ่าน");

  const ok = errors.length === 0;
  const classes = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
  let score: PasswordPolicyResult["score"];
  if (!value) score = 0;
  else if (ok) score = value.length >= 16 ? 4 : 3;
  else if (longEnough && classes >= 3 && !containsIdentity) score = 2;
  else if (value.length >= 8 && classes >= 2) score = 1;
  else score = 0;

  return { ok, errors, score };
}

/** สุ่มดัชนี 0..max-1 แบบไม่ลำเอียง (rejection sampling) */
function randomIndex(max: number): number {
  const limit = Math.floor(256 / max) * max;
  const buf = new Uint8Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

function pick(set: string): string {
  return set[randomIndex(set.length)];
}

/** สร้างรหัสผ่านสุ่มที่ผ่านเกณฑ์เสมอ (มีครบทุกประเภทอย่างน้อย 1 ตัว) */
export function generatePassword(length = 20): string {
  const len = Math.max(PASSWORD_MIN_LENGTH, Math.floor(length) || 20);
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < len) chars.push(pick(GENERATOR_ALPHABET));
  // Fisher–Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
