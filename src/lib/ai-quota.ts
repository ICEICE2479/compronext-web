import "server-only";

/**
 * โควตา AI รายวัน (นับตามจำนวนภาพที่สร้าง) — เก็บถาวร:
 *   DATABASE_URL → Postgres (แถว `aiq:<day>:<key>` ใน compronext_state, เพิ่มค่าแบบ atomic คำสั่งเดียว)
 *   ไม่มี → ไฟล์ข้อมูลของ store.ts (RuntimeDatabase.aiUsage)
 *   ที่เก็บใช้ไม่ได้/ช้าเกิน 4 วินาที → ปิดไว้ก่อน (fail closed, degraded=true)
 * `bonus` = สิทธิ์เพิ่มของผู้ใช้ (เตรียมไว้สำหรับระบบเติมเครดิตในอนาคต)
 */

export interface QuotaStatus {
  limit: number;
  used: number;
  remaining: number;
  /** ISO เวลา 00:00 ของวันถัดไปตามเวลาไทย */
  resetAt: string;
  loggedIn: boolean;
  /** true เฉพาะเมื่อที่เก็บโควตาล้มเหลว */
  degraded?: boolean;
  /** เครดิตที่เติมไว้ (ใช้ต่อเมื่อโควตาฟรีหมด) — ใส่โดย route */
  credits?: number;
}

export interface QuotaBackend {
  /** เพิ่ม `amount` ถ้ารวมแล้วไม่เกิน `limit` (ok=false = ไม่เพิ่ม) คืนยอดที่ใช้ไปหลังทำงาน */
  add(key: string, day: string, amount: number, limit: number): Promise<{ ok: boolean; used: number }>;
  get(key: string, day: string): Promise<number>;
}

interface QuotaOpts {
  backend?: QuotaBackend;
  now?: Date;
  bonus?: number;
}

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BACKEND_TIMEOUT_MS = 4000;
const DEFAULT_LIMIT = { user: 10, guest: 2 };

export function memoryBackend(): QuotaBackend {
  const usage = new Map<string, { day: string; count: number }>();
  const read = (key: string, day: string) => {
    const cur = usage.get(key);
    return cur && cur.day === day ? cur.count : 0;
  };
  return {
    async add(key, day, amount, limit) {
      const count = read(key, day);
      if (count + amount > limit) return { ok: false, used: count };
      usage.set(key, { day, count: count + amount });
      return { ok: true, used: count + amount };
    },
    async get(key, day) {
      return read(key, day);
    },
  };
}

/** วันที่ "YYYY-MM-DD" ตามเวลาไทย (UTC+7) */
export function bangkokDay(now: Date = new Date()): string {
  return new Date(now.getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10);
}

function nextBangkokMidnight(now: Date): string {
  const startOfBkkDay = Date.parse(`${bangkokDay(now)}T00:00:00Z`) - BKK_OFFSET_MS;
  return new Date(startOfBkkDay + DAY_MS).toISOString();
}

function envInt(raw: string | undefined, fallback: number): number {
  const s = (raw ?? "").trim();
  return /^\d+$/.test(s) ? Number(s) : fallback;
}

export function dailyLimit(loggedIn: boolean): number {
  return loggedIn
    ? envInt(process.env.AI_DAILY_LIMIT_USER, DEFAULT_LIMIT.user)
    : envInt(process.env.AI_DAILY_LIMIT_GUEST, DEFAULT_LIMIT.guest);
}

// ---- ที่เก็บถาวร ----------------------------------------------------------

function pgBackend(): QuotaBackend {
  const rowId = (key: string, day: string) => `aiq:${day}:${key}`;
  const sql = async () => {
    const { getPgSql } = await import("@/lib/data/store");
    const client = await getPgSql();
    if (!client) throw new Error("postgres unavailable");
    return client;
  };
  const get = async (key: string, day: string) => {
    const db = await sql();
    const rows = await db<{ count: number | null }[]>`
      select (data->>'count')::int as count from compronext_state where id = ${rowId(key, day)}`;
    return Number(rows[0]?.count ?? 0);
  };
  return {
    get,
    async add(key, day, amount, limit) {
      const db = await sql();
      pruneOldRows(day);
      const rows = await db<{ count: number }[]>`
        insert into compronext_state (id, data, updated_at)
        select ${rowId(key, day)}, jsonb_build_object('count', ${amount}::int), now()
        where ${amount}::int <= ${limit}::int
        on conflict (id) do update
          set data = jsonb_build_object('count', coalesce((compronext_state.data->>'count')::int, 0) + ${amount}::int),
              updated_at = now()
          where coalesce((compronext_state.data->>'count')::int, 0) + ${amount}::int <= ${limit}::int
        returning (data->>'count')::int as count`;
      if (rows.length > 0) return { ok: true, used: Number(rows[0].count) };
      return { ok: false, used: await get(key, day) };
    },
  };
}

const pruneState = globalThis as unknown as { __compronextAiqPruned?: string };
/** ลบแถวโควตาของวันก่อนๆ วันละครั้งต่อ instance (ไม่รอผล) */
function pruneOldRows(day: string) {
  if (pruneState.__compronextAiqPruned === day) return;
  pruneState.__compronextAiqPruned = day;
  void import("@/lib/data/store")
    .then(({ getPgSql }) => getPgSql())
    .then((db) => db && db`delete from compronext_state where id like 'aiq:%' and id not like ${`aiq:${day}:%`}`)
    .catch(() => {
      pruneState.__compronextAiqPruned = undefined;
    });
}

const jsonState = globalThis as unknown as { __compronextAiqJsonChain?: Promise<unknown> };
/** ให้ add ของ JSON ทำทีละคำขอต่อ process (กันอ่าน-เขียนทับกัน) */
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = (jsonState.__compronextAiqJsonChain ?? Promise.resolve()).then(task, task);
  jsonState.__compronextAiqJsonChain = next.catch(() => undefined);
  return next;
}

function jsonBackend(): QuotaBackend {
  const load = async () => import("@/lib/data/store");
  return {
    add: (key, day, amount, limit) =>
      serialize(async () => {
        const { readDb, writeDbStrict } = await load();
        const db = readDb();
        const usage: NonNullable<typeof db.aiUsage> = {};
        for (const [k, v] of Object.entries(db.aiUsage ?? {})) if (v && v.day === day) usage[k] = v;
        const count = usage[key]?.count ?? 0;
        if (count + amount > limit) return { ok: false, used: count };
        usage[key] = { day, count: count + amount };
        writeDbStrict({ ...db, aiUsage: usage });
        return { ok: true, used: count + amount };
      }),
    async get(key, day) {
      const { readDb } = await load();
      const cur = readDb().aiUsage?.[key];
      return cur && cur.day === day ? cur.count : 0;
    },
  };
}

function defaultBackend(): QuotaBackend {
  return process.env.DATABASE_URL ? pgBackend() : jsonBackend();
}

function withTimeout<T>(task: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("quota backend timeout")), BACKEND_TIMEOUT_MS);
  });
  return Promise.race([task, timeout]).finally(() => clearTimeout(timer));
}

const warnState = globalThis as unknown as { __compronextAiqWarned?: boolean };
function warnDegradedOnce() {
  if (warnState.__compronextAiqWarned) return;
  warnState.__compronextAiqWarned = true;
  console.warn("[ai-quota] storage unavailable, quota degraded (fail closed)");
}

/** เรียกที่เก็บหลัก ถ้าล้มเหลว/หมดเวลา คืน null (ผู้เรียกต้อง fail closed) */
async function run<T>(backend: QuotaBackend, fn: (b: QuotaBackend) => Promise<T>): Promise<T | null> {
  try {
    return await withTimeout(fn(backend));
  } catch {
    warnDegradedOnce();
    return null;
  }
}

function status(used: number, limit: number, now: Date, loggedIn: boolean): QuotaStatus {
  return { limit, used, remaining: Math.max(0, limit - used), resetAt: nextBangkokMidnight(now), loggedIn };
}

function limitFor(loggedIn: boolean, bonus: number | undefined): number {
  const extra = typeof bonus === "number" && Number.isFinite(bonus) && bonus > 0 ? Math.floor(bonus) : 0;
  return dailyLimit(loggedIn) + extra;
}

export async function takeAiQuota(
  key: string,
  loggedIn: boolean,
  amount: number,
  opts: QuotaOpts = {}
): Promise<QuotaStatus & { ok: boolean }> {
  const now = opts.now ?? new Date();
  const day = bangkokDay(now);
  const limit = limitFor(loggedIn, opts.bonus);
  const qty = Math.max(1, Math.floor(amount) || 1);
  const r = await run(opts.backend ?? defaultBackend(), (b) => b.add(key, day, qty, limit));
  if (!r) return { ok: false, ...status(limit, limit, now, loggedIn), degraded: true };
  return { ok: r.ok, ...status(r.used, limit, now, loggedIn) };
}

export async function peekAiQuota(key: string, loggedIn: boolean, opts: QuotaOpts = {}): Promise<QuotaStatus> {
  const now = opts.now ?? new Date();
  const day = bangkokDay(now);
  const limit = limitFor(loggedIn, opts.bonus);
  const used = await run(opts.backend ?? defaultBackend(), (b) => b.get(key, day));
  if (used === null) return { ...status(limit, limit, now, loggedIn), degraded: true };
  return status(used, limit, now, loggedIn);
}
