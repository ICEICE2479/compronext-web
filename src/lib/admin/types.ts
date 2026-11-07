export type AdminRole = "superadmin" | "admin";

/** ข้อมูลแอดมินที่ส่งออกได้ — ไม่มี hash/salt */
export interface PublicAdmin {
  id: string;
  username: string;
  email: string;
  role: AdminRole;
  disabled: boolean;
  sessionVersion: number;
  createdAt: string;
  lastLoginAt: string | null;
}

export type AuditAction =
  | "setup"
  | "login_success"
  | "login_failed"
  | "login_locked"
  | "logout_all"
  | "password_change"
  | "admin_create"
  | "admin_update"
  | "admin_delete"
  | "product_delete"
  | "room_delete"
  | "settings_change";

export interface AuditEntry {
  id: string;
  /** ISO */
  at: string;
  action: AuditAction;
  /** username หรือ "-" */
  actor: string;
  /** IP แบบย่อ */
  ip: string;
  target?: string;
  ok: boolean;
  detail?: string;
}

export type AdminErrorCode =
  | "exists"
  | "weak_password"
  | "last_superadmin"
  | "self"
  | "not_found"
  | "setup_closed"
  | "bad_token"
  | "wrong_password"
  | "invalid";

const DEFAULT_MESSAGES: Record<AdminErrorCode, string> = {
  exists: "ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้แล้ว",
  weak_password: "รหัสผ่านไม่ผ่านเกณฑ์ความปลอดภัย",
  last_superadmin: "ต้องมีซูเปอร์แอดมินที่ใช้งานได้อย่างน้อย 1 บัญชี",
  self: "ไม่สามารถทำรายการนี้กับบัญชีของตัวเองได้",
  not_found: "ไม่พบบัญชีแอดมิน",
  setup_closed: "ตั้งค่าระบบครั้งแรกไปแล้ว",
  bad_token: "โทเคนตั้งค่าไม่ถูกต้อง",
  wrong_password: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
  invalid: "ข้อมูลไม่ถูกต้อง",
};

/** ข้อผิดพลาดที่ปลอดภัยต่อการแสดงผู้ใช้ (ข้อความภาษาไทย) */
export class AdminError extends Error {
  code: AdminErrorCode;
  /** รายการเหตุผลเพิ่มเติม (เช่น เกณฑ์รหัสผ่านที่ไม่ผ่าน) */
  errors?: string[];

  constructor(code: AdminErrorCode, message?: string, errors?: string[]) {
    super(message || DEFAULT_MESSAGES[code]);
    this.name = "AdminError";
    this.code = code;
    if (errors) this.errors = errors;
  }
}
