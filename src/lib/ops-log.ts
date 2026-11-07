import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * บันทึกเหตุการณ์ระบบ (error / การทำงานของ cron) สำหรับหน้าแอดมิน
 * - ตั้ง DATABASE_URL → ตาราง compronext_ops_log
 * - ไม่ตั้ง → .data/ops-log.json
 * ตั้ง ALERT_WEBHOOK_URL (Discord / Slack / Google Chat) → ส่งแจ้งเตือนเมื่อเกิด error (กันส่งซ้ำ 15 นาที/ข้อความ)
 */
export type OpsKind = "error" | "cron" | "admin";
export interface OpsEntry {
  id: string;
  kind: OpsKind;
  at: string;
  title: string;
  detail?: string;
  ok?: boolean;
}

const FILE = path.join(process.cwd(), ".data", "ops-log.json");
const KEEP = 300;
const g = globalThis as unknown as { __cnOpsSql?: import("postgres").Sql; __cnAlertAt?: Map<string, number> };

async function pg() {
  if (!g.__cnOpsSql) {
    const { default: postgres } = await import("postgres");
    g.__cnOpsSql = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 20, prepare: false });
    await g.__cnOpsSql`create table if not exists compronext_ops_log (
      id text primary key, kind text not null, at timestamptz not null default now(), title text not null, detail text, ok boolean)`;
  }
  return g.__cnOpsSql;
}

export async function logOps(e: Omit<OpsEntry, "id" | "at">): Promise<void> {
  const entry: OpsEntry = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), ...e, title: e.title.slice(0, 300), detail: e.detail?.slice(0, 4000) };
  try {
    if (process.env.DATABASE_URL) {
      const sql = await pg();
      await sql`insert into compronext_ops_log (id, kind, at, title, detail, ok) values (${entry.id}, ${entry.kind}, ${entry.at}, ${entry.title}, ${entry.detail ?? null}, ${entry.ok ?? null})`;
      await sql`delete from compronext_ops_log where id in (select id from compronext_ops_log order by at desc offset ${KEEP})`;
    } else {
      const list = await readLocal();
      list.unshift(entry);
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(list.slice(0, KEEP)), "utf8");
    }
  } catch (err) {
    console.error("[ops-log] write failed", err);
  }
  if (entry.kind === "error" || entry.ok === false) await alert(entry);
}

async function readLocal(): Promise<OpsEntry[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as OpsEntry[];
  } catch {
    return [];
  }
}

export async function readOps(kind?: OpsKind, limit = 100): Promise<OpsEntry[]> {
  try {
    if (process.env.DATABASE_URL) {
      const sql = await pg();
      const rows = kind
        ? await sql<OpsEntry[]>`select id, kind, at::text as at, title, detail, ok from compronext_ops_log where kind = ${kind} order by at desc limit ${limit}`
        : await sql<OpsEntry[]>`select id, kind, at::text as at, title, detail, ok from compronext_ops_log order by at desc limit ${limit}`;
      return rows;
    }
    return (await readLocal()).filter((e) => !kind || e.kind === kind).slice(0, limit);
  } catch {
    return [];
  }
}

async function alert(e: OpsEntry) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url || !/^https:\/\//.test(url)) return;
  const sent = (g.__cnAlertAt ??= new Map());
  const key = e.title.slice(0, 120);
  if (Date.now() - (sent.get(key) ?? 0) < 15 * 60_000) return;
  sent.set(key, Date.now());
  const text = `⚠️ ComproNext: ${e.title}${e.detail ? `\n${e.detail.slice(0, 600)}` : ""}`;
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text, text }), signal: AbortSignal.timeout(5000) }).catch(() => {});
}
