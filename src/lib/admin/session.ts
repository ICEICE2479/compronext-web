import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, openSealedData, sealData } from "../auth";
import { countAdmins, getAdminById } from "./accounts";
import type { AdminRole, PublicAdmin } from "./types";

export interface AdminSession {
  uid: string;
  username: string;
  role: AdminRole;
  /** sessionVersion ของบัญชี ณ ตอนออก session */
  sv: number;
  iat: number;
  /** ใช้งานล่าสุด (epoch ms) — idle timeout */
  seen: number;
  /** หมดอายุแน่นอน (epoch ms) */
  exp: number;
}

const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;

export const ADMIN_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 43200,
};

export function createAdminSessionValue(a: Pick<PublicAdmin, "id" | "username" | "role" | "sessionVersion">): string {
  const now = Date.now();
  const s: AdminSession = {
    uid: a.id,
    username: a.username,
    role: a.role,
    sv: a.sessionVersion,
    iat: now,
    seen: now,
    exp: now + ABSOLUTE_MS,
  };
  return sealData(s);
}

/** ต่ออายุ idle (seen ใหม่) โดยไม่ขยายเวลาหมดอายุแน่นอน */
export function refreshAdminSessionValue(s: AdminSession): string {
  const next: AdminSession = {
    uid: s.uid,
    username: s.username,
    role: s.role,
    sv: s.sv,
    iat: s.iat,
    seen: Date.now(),
    exp: s.exp,
  };
  return sealData(next);
}

function isSessionShape(v: unknown): v is AdminSession {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.uid === "string" &&
    typeof s.username === "string" &&
    (s.role === "superadmin" || s.role === "admin") &&
    typeof s.sv === "number" &&
    typeof s.iat === "number" &&
    typeof s.seen === "number" &&
    typeof s.exp === "number"
  );
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const data = openSealedData<unknown>(jar.get(ADMIN_COOKIE_NAME)?.value);
  if (!isSessionShape(data)) return null;
  const now = Date.now();
  if (data.exp <= now || data.exp - data.iat > ABSOLUTE_MS || now - data.seen > IDLE_MS) return null;
  try {
    if (data.uid === "bootstrap") {
      if (data.sv !== 0 || (await countAdmins()) > 0) return null;
      return { ...data, username: "admin", role: "superadmin" };
    }
    const account = await getAdminById(data.uid);
    if (!account || account.disabled || account.sessionVersion !== data.sv) return null;
    return { ...data, username: account.username, role: account.role };
  } catch {
    return null;
  }
}

/** คืน session เมื่อมีสิทธิ์ตามที่ขอ (role "superadmin" = เฉพาะซูเปอร์แอดมิน) */
export async function requireAdmin(role?: AdminRole): Promise<AdminSession | null> {
  const s = await getAdminSession();
  if (!s) return null;
  if (role === "superadmin" && s.role !== "superadmin") return null;
  return s;
}
