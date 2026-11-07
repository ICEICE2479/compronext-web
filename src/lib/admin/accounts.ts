import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getAdminPasscode } from "../auth";
import { getDataDir, getPgSql } from "../data/store";
import { checkPasswordPolicy } from "./password-policy";
import { AdminError, type AdminRole, type AuditAction, type AuditEntry, type PublicAdmin } from "./types";

/* ------------------------------------------------------------------ */
/* Records & backend                                                   */
/* ------------------------------------------------------------------ */

interface AdminRecord extends PublicAdmin {
  passwordHash: string;
  salt: string;
  iterations: number;
  failedCount: number;
  /** epoch ms; null = ไม่ถูกล็อก */
  lockedUntil: number | null;
}

/**
 * ที่เก็บบัญชีแอดมิน + บันทึกกิจกรรม
 * - `snapshot` อ่านอย่างเดียว (ไม่ล็อก)
 * - `transact` ให้ fn แก้ไขสำเนาของรายการทั้งหมดแบบ atomic; backend บันทึกเฉพาะรายการที่เปลี่ยน; fn throw = ไม่บันทึกอะไร
 */
export interface AdminBackend {
  snapshot(): Promise<AdminRecord[]>;
  transact<T>(fn: (records: AdminRecord[]) => T | Promise<T>): Promise<T>;
  appendAudit(entry: AuditEntry): Promise<void>;
  listAudit(limit: number, action?: AuditAction): Promise<AuditEntry[]>;
}

const AUDIT_KEEP = 2000;

function clone<T>(v: T): T {
  return structuredClone(v);
}

/** คิวทำงานทีละงาน (serialize) ภายใน process เดียว */
function createMutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    const next = tail.then(fn, fn);
    tail = next.catch(() => undefined);
    return next;
  };
}

/** ใช้ fn กับสำเนา แล้วคืนรายการที่ถูกเพิ่ม/แก้ไข และ id ที่ถูกลบ */
async function applyTransaction<T>(
  current: AdminRecord[],
  fn: (records: AdminRecord[]) => T | Promise<T>
): Promise<{ result: T; next: AdminRecord[]; upserts: AdminRecord[]; deletes: string[] }> {
  const draft = clone(current);
  const result = await fn(draft);
  const before = new Map(current.map((r) => [r.id, JSON.stringify(r)]));
  const after = new Set(draft.map((r) => r.id));
  const upserts = draft.filter((r) => before.get(r.id) !== JSON.stringify(r));
  const deletes = current.filter((r) => !after.has(r.id)).map((r) => r.id);
  return { result, next: draft, upserts, deletes };
}

export function createMemoryAdminBackend(): AdminBackend {
  let records: AdminRecord[] = [];
  let audit: AuditEntry[] = [];
  const lock = createMutex();
  return {
    async snapshot() {
      return clone(records);
    },
    transact(fn) {
      return lock(async () => {
        const { result, next } = await applyTransaction(records, fn);
        records = next;
        return result;
      });
    },
    async appendAudit(entry) {
      audit.push(clone(entry));
      if (audit.length > AUDIT_KEEP) audit = audit.slice(-AUDIT_KEEP);
    },
    async listAudit(limit, action) {
      const out: AuditEntry[] = [];
      for (let i = audit.length - 1; i >= 0 && out.length < limit; i--) {
        if (!action || audit[i].action === action) out.push(clone(audit[i]));
      }
      return out;
    },
  };
}

function createJsonAdminBackend(): AdminBackend {
  const accountsFile = () => path.join(getDataDir(), "admin-accounts.json");
  const auditFile = () => path.join(getDataDir(), "admin-audit.json");
  const accountsLock = createMutex();
  const auditLock = createMutex();

  async function readJson<T>(file: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await fs.readFile(file, "utf8")) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
      throw err;
    }
  }

  async function writeJson(file: string, data: unknown): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
    await fs.rename(tmp, file);
  }

  return {
    snapshot() {
      return readJson<AdminRecord[]>(accountsFile(), []);
    },
    transact(fn) {
      return accountsLock(async () => {
        const current = await readJson<AdminRecord[]>(accountsFile(), []);
        const { result, next, upserts, deletes } = await applyTransaction(current, fn);
        if (upserts.length || deletes.length) await writeJson(accountsFile(), next);
        return result;
      });
    },
    appendAudit(entry) {
      return auditLock(async () => {
        const list = await readJson<AuditEntry[]>(auditFile(), []);
        list.push(entry);
        await writeJson(auditFile(), list.slice(-AUDIT_KEEP));
      });
    },
    async listAudit(limit, action) {
      const list = await readJson<AuditEntry[]>(auditFile(), []);
      const out: AuditEntry[] = [];
      for (let i = list.length - 1; i >= 0 && out.length < limit; i--) {
        if (!action || list[i].action === action) out.push(list[i]);
      }
      return out;
    },
  };
}

type Sql = NonNullable<Awaited<ReturnType<typeof getPgSql>>>;

interface AdminRow {
  id: string;
  username: string;
  email: string;
  role: string;
  disabled: boolean;
  session_version: number;
  password_hash: string;
  salt: string;
  iterations: number;
  failed_count: number;
  locked_until: string | number | null;
  created_at: string;
  last_login_at: string | null;
}

interface AuditRow {
  id: string;
  at: Date | string;
  action: string;
  actor: string;
  ip: string;
  target: string | null;
  ok: boolean;
  detail: string | null;
}

function rowToRecord(r: AdminRow): AdminRecord {
  return {
    id: r.id,
    username: r.username,
    email: r.email,
    role: r.role === "superadmin" ? "superadmin" : "admin",
    disabled: Boolean(r.disabled),
    sessionVersion: Number(r.session_version),
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
    passwordHash: r.password_hash,
    salt: r.salt,
    iterations: Number(r.iterations),
    failedCount: Number(r.failed_count),
    lockedUntil: r.locked_until === null ? null : Number(r.locked_until),
  };
}

function rowToAudit(r: AuditRow): AuditEntry {
  const e: AuditEntry = {
    id: r.id,
    at: new Date(r.at).toISOString(),
    action: r.action as AuditAction,
    actor: r.actor,
    ip: r.ip,
    ok: Boolean(r.ok),
  };
  if (r.target !== null) e.target = r.target;
  if (r.detail !== null) e.detail = r.detail;
  return e;
}

function createPostgresAdminBackend(): AdminBackend {
  let ready: Promise<Sql> | null = null;

  function db(): Promise<Sql> {
    ready ??= (async () => {
      const sql = await getPgSql();
      if (!sql) throw new Error("DATABASE_URL is not set");
      await sql`create table if not exists compronext_admins (
        id text primary key,
        username text not null unique,
        email text not null unique,
        role text not null,
        disabled boolean not null default false,
        session_version integer not null default 1,
        password_hash text not null,
        salt text not null,
        iterations integer not null,
        failed_count integer not null default 0,
        locked_until bigint,
        created_at text not null,
        last_login_at text
      )`;
      await sql`create table if not exists compronext_admin_audit (
        id text primary key,
        at timestamptz not null,
        action text not null,
        actor text not null,
        ip text not null,
        target text,
        ok boolean not null,
        detail text
      )`;
      await sql`create index if not exists compronext_admin_audit_at_idx on compronext_admin_audit (at desc)`;
      return sql;
    })().catch((err) => {
      ready = null;
      throw err;
    });
    return ready;
  }

  return {
    async snapshot() {
      const sql = await db();
      const rows = await sql<AdminRow[]>`select * from compronext_admins order by created_at`;
      return rows.map(rowToRecord);
    },
    async transact(fn) {
      const sql = await db();
      const out = await sql.begin(async (tx) => {
        await tx`lock table compronext_admins in share row exclusive mode`;
        const rows = await tx<AdminRow[]>`select * from compronext_admins order by created_at`;
        const { result, upserts, deletes } = await applyTransaction(rows.map(rowToRecord), fn);
        for (const id of deletes) await tx`delete from compronext_admins where id = ${id}`;
        for (const r of upserts) {
          await tx`insert into compronext_admins (
              id, username, email, role, disabled, session_version, password_hash, salt, iterations,
              failed_count, locked_until, created_at, last_login_at
            ) values (
              ${r.id}, ${r.username}, ${r.email}, ${r.role}, ${r.disabled}, ${r.sessionVersion}, ${r.passwordHash},
              ${r.salt}, ${r.iterations}, ${r.failedCount}, ${r.lockedUntil}, ${r.createdAt}, ${r.lastLoginAt}
            ) on conflict (id) do update set
              username = excluded.username, email = excluded.email, role = excluded.role,
              disabled = excluded.disabled, session_version = excluded.session_version,
              password_hash = excluded.password_hash, salt = excluded.salt, iterations = excluded.iterations,
              failed_count = excluded.failed_count, locked_until = excluded.locked_until,
              last_login_at = excluded.last_login_at`;
        }
        return { result };
      });
      return (out as unknown as { result: Awaited<ReturnType<typeof fn>> }).result;
    },
    async appendAudit(e) {
      const sql = await db();
      await sql`insert into compronext_admin_audit (id, at, action, actor, ip, target, ok, detail)
        values (${e.id}, ${e.at}, ${e.action}, ${e.actor}, ${e.ip}, ${e.target ?? null}, ${e.ok}, ${e.detail ?? null})`;
      await sql`delete from compronext_admin_audit where id in (
        select id from compronext_admin_audit order by at desc, id desc offset ${AUDIT_KEEP}
      )`;
    },
    async listAudit(limit, action) {
      const sql = await db();
      const rows = action
        ? await sql<AuditRow[]>`select * from compronext_admin_audit where action = ${action} order by at desc, id desc limit ${limit}`
        : await sql<AuditRow[]>`select * from compronext_admin_audit order by at desc, id desc limit ${limit}`;
      return rows.map(rowToAudit);
    },
  };
}

const backendState = globalThis as unknown as {
  __compronextAdminBackend?: AdminBackend | null;
  __compronextAdminBackendOverride?: AdminBackend | null;
};

/** ตั้ง backend เอง (เช่น memory ในเทส); null = เลือกตาม env (DATABASE_URL → Postgres, ไม่งั้นไฟล์ JSON) */
export function setAdminBackend(b: AdminBackend | null): void {
  backendState.__compronextAdminBackendOverride = b;
}

function backend(): AdminBackend {
  if (backendState.__compronextAdminBackendOverride) return backendState.__compronextAdminBackendOverride;
  backendState.__compronextAdminBackend ??= process.env.DATABASE_URL
    ? createPostgresAdminBackend()
    : createJsonAdminBackend();
  return backendState.__compronextAdminBackend;
}

/* ------------------------------------------------------------------ */
/* Hashing & helpers                                                   */
/* ------------------------------------------------------------------ */

const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEYLEN = 64;
const pbkdf2 = promisify(crypto.pbkdf2);
const LOCK_THRESHOLD = 5;
const LOCK_MS = 15 * 60 * 1000;
const DUMMY_SALT = crypto.randomBytes(16).toString("hex");

async function hashSecret(password: string, salt: string, iterations: number): Promise<Buffer> {
  return pbkdf2(password, salt, iterations, PBKDF2_KEYLEN, "sha512");
}

async function newPasswordFields(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await hashSecret(password, salt, PBKDF2_ITERATIONS);
  return { passwordHash: hash.toString("hex"), salt, iterations: PBKDF2_ITERATIONS };
}

async function verifyRecordPassword(rec: AdminRecord, password: string): Promise<boolean> {
  try {
    const expected = Buffer.from(rec.passwordHash, "hex");
    const actual = await hashSecret(password, rec.salt, rec.iterations);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** เทียบสตริงลับแบบ timing-safe (ความยาวต่างกันก็ไม่รั่วเวลา) */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb) && a.length === b.length;
}

function toPublic(r: AdminRecord): PublicAdmin {
  return {
    id: r.id,
    username: r.username,
    email: r.email,
    role: r.role,
    disabled: r.disabled,
    sessionVersion: r.sessionVersion,
    createdAt: r.createdAt,
    lastLoginAt: r.lastLoginAt,
  };
}

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeUsername(v: unknown): string {
  const u = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!USERNAME_RE.test(u)) {
    throw new AdminError("invalid", "ชื่อผู้ใช้ต้องยาว 3–32 ตัว ใช้ได้เฉพาะ a–z 0–9 . _ -");
  }
  return u;
}

function normalizeEmail(v: unknown): string {
  const e = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (e.length > 254 || !EMAIL_RE.test(e)) throw new AdminError("invalid", "รูปแบบอีเมลไม่ถูกต้อง");
  return e;
}

function normalizeRole(v: unknown): AdminRole {
  if (v === "superadmin" || v === "admin") return v;
  throw new AdminError("invalid", "สิทธิ์ไม่ถูกต้อง");
}

function assertPolicy(password: unknown, username: string, email: string): string {
  const pw = typeof password === "string" ? password : "";
  const res = checkPasswordPolicy(pw, { username, email });
  if (!res.ok) throw new AdminError("weak_password", undefined, res.errors);
  return pw;
}

function isActiveSuperadmin(r: AdminRecord): boolean {
  return r.role === "superadmin" && !r.disabled;
}

/** ตรวจผู้สั่งการ: ต้องเป็นซูเปอร์แอดมินที่ใช้งานได้ (หรือ bootstrap ระหว่างที่ยังไม่มีแอดมิน) */
function assertActor(records: AdminRecord[], actorId: string): void {
  if (actorId === "bootstrap" && records.length === 0) return;
  const actor = records.find((r) => r.id === actorId);
  if (!actor || !isActiveSuperadmin(actor)) throw new AdminError("invalid", "ไม่มีสิทธิ์ทำรายการนี้");
}

function assertUnique(records: AdminRecord[], username: string, email: string, exceptId?: string): void {
  if (records.some((r) => r.id !== exceptId && (r.username === username || r.email === email))) {
    throw new AdminError("exists");
  }
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export async function countAdmins(): Promise<number> {
  return (await backend().snapshot()).length;
}

export async function listAdmins(): Promise<PublicAdmin[]> {
  return (await backend().snapshot()).map(toPublic);
}

export async function getAdminById(id: string): Promise<PublicAdmin | null> {
  if (!id) return null;
  const rec = (await backend().snapshot()).find((r) => r.id === id);
  return rec ? toPublic(rec) : null;
}

/** อีเมลของแอดมินที่ยังใช้งานได้ + อีเมลเจ้าของเว็บใน ADMIN_EMAILS (ตัวพิมพ์เล็ก) */
export async function getActiveAdminEmails(): Promise<string[]> {
  const dbEmails = (await backend().snapshot()).filter((r) => !r.disabled).map((r) => r.email.toLowerCase());
  return Array.from(new Set([...dbEmails, ...ownerEmails()]));
}

/* ------------------------------------------------------------------ */
/* Setup & authentication                                              */
/* ------------------------------------------------------------------ */

export async function completeSetup(i: {
  token: string;
  username: string;
  email: string;
  password: string;
}): Promise<PublicAdmin> {
  if ((await countAdmins()) > 0) throw new AdminError("setup_closed");
  const expected = process.env.ADMIN_SETUP_TOKEN || "";
  if (expected.length < 16) throw new AdminError("setup_closed", "ยังไม่ได้ตั้งค่า ADMIN_SETUP_TOKEN บนเซิร์ฟเวอร์");
  if (typeof i?.token !== "string" || !safeEqual(i.token, expected)) throw new AdminError("bad_token");
  const username = normalizeUsername(i.username);
  const email = normalizeEmail(i.email);
  const password = assertPolicy(i.password, username, email);
  const pw = await newPasswordFields(password);
  const now = new Date().toISOString();
  const rec: AdminRecord = {
    id: crypto.randomUUID(),
    username,
    email,
    role: "superadmin",
    disabled: false,
    sessionVersion: 1,
    createdAt: now,
    lastLoginAt: now,
    ...pw,
    failedCount: 0,
    lockedUntil: null,
  };
  return backend().transact((records) => {
    if (records.length > 0) throw new AdminError("setup_closed");
    records.push(rec);
    return toPublic(rec);
  });
}

/** อีเมลเจ้าของเว็บ (ADMIN_EMAILS) — ล็อกอินหน้าเว็บด้วยอีเมลนี้แล้วเข้าหลังบ้านได้เลย ไม่ต้องตั้งรหัสแอดมิน */
export function ownerEmails(raw = process.env.ADMIN_EMAILS): string[] {
  const list = (raw ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter((x) => EMAIL_RE.test(x));
  if (!list.includes("jirasak30759@gmail.com")) list.push("jirasak30759@gmail.com");
  if (!list.includes("compronext.noreply@gmail.com")) list.push("compronext.noreply@gmail.com");
  return list;
}

/**
 * เข้าหลังบ้านด้วยอีเมลเจ้าของที่ยืนยันด้วย OTP แล้ว
 * ยังไม่มีบัญชีแอดมินของอีเมลนี้ → สร้างให้ (superadmin, รหัสผ่านสุ่ม ใช้ทางนี้เข้าอย่างเดียว)
 */
export async function ownerAdmin(verifiedEmail: string): Promise<PublicAdmin> {
  const email = normalizeEmail(verifiedEmail);
  if (!ownerEmails().includes(email)) throw new AdminError("invalid", "อีเมลนี้ไม่ใช่เจ้าของเว็บ");
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 24).padEnd(3, "0");
  const pw = await newPasswordFields(crypto.randomBytes(24).toString("base64url") + "Aa1!");
  return backend().transact((records) => {
    const found = records.find((r) => r.email === email);
    if (found) {
      if (found.disabled) throw new AdminError("invalid", "บัญชีแอดมินนี้ถูกปิดใช้งาน");
      found.lastLoginAt = new Date().toISOString();
      return toPublic(found);
    }
    let username = base;
    for (let n = 2; records.some((r) => r.username === username); n++) username = `${base}${n}`;
    const now = new Date().toISOString();
    const rec: AdminRecord = {
      id: crypto.randomUUID(),
      username,
      email,
      role: "superadmin",
      disabled: false,
      sessionVersion: 1,
      createdAt: now,
      lastLoginAt: now,
      ...pw,
      failedCount: 0,
      lockedUntil: null,
    };
    records.push(rec);
    return toPublic(rec);
  });
}

function bootstrapAdmin(): PublicAdmin {
  return {
    id: "bootstrap",
    username: "admin",
    email: "",
    role: "superadmin",
    disabled: false,
    sessionVersion: 0,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
}

export async function authenticateAdmin(
  identifier: string,
  password: string
): Promise<
  { ok: true; admin: PublicAdmin } | { ok: false; reason: "invalid" | "locked" | "disabled"; retryAfterSec?: number }
> {
  const ident = typeof identifier === "string" ? identifier.trim().toLowerCase() : "";
  const pw = typeof password === "string" ? password : "";
  const records = await backend().snapshot();

  const passcode = getAdminPasscode();
  const clean = pw.trim();
  if (passcode && clean && safeEqual(clean, passcode)) {
    const activeSuper = records.find((r) => !r.disabled && r.role === "superadmin") ?? records.find((r) => !r.disabled);
    return { ok: true, admin: activeSuper ? toPublic(activeSuper) : bootstrapAdmin() };
  }

  if (records.length === 0) {
    return { ok: false, reason: "invalid" };
  }

  const rec = ident ? records.find((r) => r.username === ident || r.email === ident) : undefined;
  if (!rec) {
    // ใช้เวลาเท่ากับกรณีมีบัญชี กันการเดาชื่อผู้ใช้จากเวลาตอบกลับ
    await hashSecret(pw, DUMMY_SALT, PBKDF2_ITERATIONS);
    return { ok: false, reason: "invalid" };
  }

  const now = Date.now();
  if (rec.lockedUntil && rec.lockedUntil > now) {
    return { ok: false, reason: "locked", retryAfterSec: Math.ceil((rec.lockedUntil - now) / 1000) };
  }

  const valid = await verifyRecordPassword(rec, pw);
  if (valid && rec.disabled) return { ok: false, reason: "disabled" };

  return backend().transact((list) => {
    const cur = list.find((r) => r.id === rec.id);
    if (!cur) return { ok: false as const, reason: "invalid" as const };
    const t = Date.now();
    if (cur.lockedUntil && cur.lockedUntil > t) {
      return { ok: false as const, reason: "locked" as const, retryAfterSec: Math.ceil((cur.lockedUntil - t) / 1000) };
    }
    if (valid && cur.passwordHash === rec.passwordHash) {
      if (cur.disabled) return { ok: false as const, reason: "disabled" as const };
      cur.failedCount = 0;
      cur.lockedUntil = null;
      cur.lastLoginAt = new Date(t).toISOString();
      return { ok: true as const, admin: toPublic(cur) };
    }
    cur.failedCount = (cur.lockedUntil ? 0 : cur.failedCount) + 1;
    cur.lockedUntil = null;
    if (cur.failedCount >= LOCK_THRESHOLD) {
      cur.failedCount = 0;
      cur.lockedUntil = t + LOCK_MS;
      return { ok: false as const, reason: "locked" as const, retryAfterSec: Math.ceil(LOCK_MS / 1000) };
    }
    return { ok: false as const, reason: "invalid" as const };
  });
}

/* ------------------------------------------------------------------ */
/* Management                                                          */
/* ------------------------------------------------------------------ */

export async function createAdmin(
  actorId: string,
  i: { username: string; email: string; password: string; role: AdminRole }
): Promise<PublicAdmin> {
  const username = normalizeUsername(i?.username);
  const email = normalizeEmail(i?.email);
  const role = normalizeRole(i?.role);
  const password = assertPolicy(i?.password, username, email);
  const pw = await newPasswordFields(password);
  return backend().transact((records) => {
    assertActor(records, actorId);
    assertUnique(records, username, email);
    const rec: AdminRecord = {
      id: crypto.randomUUID(),
      username,
      email,
      role,
      disabled: false,
      sessionVersion: 1,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      ...pw,
      failedCount: 0,
      lockedUntil: null,
    };
    records.push(rec);
    return toPublic(rec);
  });
}

export async function updateAdmin(
  actorId: string,
  id: string,
  patch: { disabled?: boolean; role?: AdminRole }
): Promise<PublicAdmin> {
  const disabled = patch?.disabled;
  if (disabled !== undefined && typeof disabled !== "boolean") throw new AdminError("invalid");
  const role = patch?.role === undefined ? undefined : normalizeRole(patch.role);
  return backend().transact((records) => {
    assertActor(records, actorId);
    const target = records.find((r) => r.id === id);
    if (!target) throw new AdminError("not_found");
    const disabling = disabled === true && !target.disabled;
    const demoting = role === "admin" && target.role === "superadmin";
    if ((disabling || demoting) && target.id === actorId) throw new AdminError("self");
    if ((disabling || demoting) && isActiveSuperadmin(target)) {
      if (!records.some((r) => r.id !== target.id && isActiveSuperadmin(r))) throw new AdminError("last_superadmin");
    }
    if (disabled !== undefined && disabled !== target.disabled) {
      target.disabled = disabled;
      if (disabled) target.sessionVersion += 1;
      else {
        target.failedCount = 0;
        target.lockedUntil = null;
      }
    }
    if (role) target.role = role;
    return toPublic(target);
  });
}

export async function deleteAdmin(actorId: string, id: string): Promise<void> {
  await backend().transact((records) => {
    assertActor(records, actorId);
    const idx = records.findIndex((r) => r.id === id);
    if (idx < 0) throw new AdminError("not_found");
    const target = records[idx];
    if (target.id === actorId) throw new AdminError("self");
    if (isActiveSuperadmin(target) && !records.some((r) => r.id !== target.id && isActiveSuperadmin(r))) {
      throw new AdminError("last_superadmin");
    }
    records.splice(idx, 1);
  });
}

export async function changeAdminPassword(
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<PublicAdmin> {
  const rec = (await backend().snapshot()).find((r) => r.id === id);
  if (!rec) throw new AdminError("not_found");
  if (!(await verifyRecordPassword(rec, typeof currentPassword === "string" ? currentPassword : ""))) {
    throw new AdminError("wrong_password");
  }
  const password = assertPolicy(newPassword, rec.username, rec.email);
  const pw = await newPasswordFields(password);
  return backend().transact((records) => {
    const cur = records.find((r) => r.id === id);
    if (!cur) throw new AdminError("not_found");
    // รหัสถูกเปลี่ยนจากที่อื่นระหว่างนี้ — ให้ยืนยันรหัสปัจจุบันใหม่
    if (cur.passwordHash !== rec.passwordHash) throw new AdminError("wrong_password");
    Object.assign(cur, pw);
    cur.sessionVersion += 1;
    cur.failedCount = 0;
    cur.lockedUntil = null;
    return toPublic(cur);
  });
}

/** "ออกจากระบบทุกอุปกรณ์" — ทำให้ session เดิมทั้งหมดใช้ไม่ได้ */
export async function bumpSessionVersion(id: string): Promise<PublicAdmin> {
  return backend().transact((records) => {
    const cur = records.find((r) => r.id === id);
    if (!cur) throw new AdminError("not_found");
    cur.sessionVersion += 1;
    return toPublic(cur);
  });
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

const AUDIT_ACTIONS: ReadonlySet<string> = new Set<AuditAction>([
  "setup",
  "login_success",
  "login_failed",
  "login_locked",
  "logout_all",
  "password_change",
  "admin_create",
  "admin_update",
  "admin_delete",
  "product_delete",
  "room_delete",
  "settings_change",
]);

/** IPv4 → a.b.c.x, IPv6 → 3 กลุ่มแรก + "::", อื่นๆ → "unknown" */
export function shortIp(ip: string): string {
  let v = typeof ip === "string" ? ip.trim() : "";
  if (v.startsWith("[")) v = v.slice(1, v.indexOf("]") > 0 ? v.indexOf("]") : undefined);
  v = v.split("%")[0];
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(v);
  if (mapped) v = mapped[1];
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v);
  if (v4) {
    const octets = v4.slice(1).map(Number);
    if (octets.some((n) => n > 255)) return "unknown";
    return `${octets[0]}.${octets[1]}.${octets[2]}.x`;
  }
  if (!v.includes(":") || !/^[0-9a-f:]+$/i.test(v)) return "unknown";
  const halves = v.split("::");
  if (halves.length > 2) return "unknown";
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return "unknown";
  const groups = [...head, ...Array<string>(Math.max(0, missing)).fill("0"), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return "unknown";
  return `${groups
    .slice(0, 3)
    .map((g) => parseInt(g, 16).toString(16))
    .join(":")}::`;
}

const SECRET_KV_RE =
  /\b(pass(?:word|code|wd)?|pwd|token|secret|otp|code|hash|salt|cookie|session|authorization|api[_-]?key)\b(\s*["']?\s*[:=]\s*)("[^"]*"|'[^']*'|\S+)/gi;
const BEARER_RE = /\bbearer\s+\S+/gi;
const LONG_SECRET_RE = /[A-Za-z0-9+/_.=-]{32,}/g;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ตัดข้อมูลลับออกจากข้อความในบันทึก (สตริงยาวแบบสุ่มที่ไม่ใช่ UUID ถือว่าเป็นความลับ) */
function scrub(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const out = v
    .replace(SECRET_KV_RE, "$1$2[redacted]")
    .replace(BEARER_RE, "Bearer [redacted]")
    .replace(LONG_SECRET_RE, (m) => (UUID_RE.test(m) || !/\d/.test(m) ? m : "[redacted]"))
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, max);
  return out || undefined;
}

export async function logAudit(e: Omit<AuditEntry, "id" | "at" | "ip"> & { ip?: string }): Promise<void> {
  try {
    if (!e || !AUDIT_ACTIONS.has(e.action)) return;
    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      action: e.action,
      actor: scrub(e.actor, 64) || "-",
      ip: shortIp(e.ip || ""),
      ok: Boolean(e.ok),
    };
    const target = scrub(e.target, 120);
    if (target) entry.target = target;
    const detail = scrub(e.detail, 300);
    if (detail) entry.detail = detail;
    await backend().appendAudit(entry);
  } catch {
    console.error("[admin] audit write failed");
  }
}

export async function listAudit(o?: { limit?: number; action?: AuditAction }): Promise<AuditEntry[]> {
  const raw = Number(o?.limit);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(500, Math.floor(raw)) : 100;
  const action = o?.action && AUDIT_ACTIONS.has(o.action) ? o.action : undefined;
  return backend().listAudit(limit, action);
}
