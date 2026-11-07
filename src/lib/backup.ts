import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { readDb, writeDb, type RuntimeDatabase } from "@/lib/data/store";

/**
 * สำรองข้อมูลทั้งระบบ (วันละครั้งผ่าน cron + กดเองในหลังบ้าน) เก็บ 7 ชุดล่าสุด
 * - DATABASE_URL → ตาราง compronext_backups · ไม่ตั้ง → .data/backups/*.json
 */
const DIR = path.join(process.cwd(), ".data", "backups");
const KEEP = 7;
export interface BackupInfo {
  id: string;
  createdAt: string;
  reason: string;
  sizeKb: number;
}
const g = globalThis as unknown as { __cnBakSql?: import("postgres").Sql };
async function pg() {
  if (!g.__cnBakSql) {
    const { default: postgres } = await import("postgres");
    g.__cnBakSql = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 20, prepare: false });
    await g.__cnBakSql`create table if not exists compronext_backups (
      id text primary key, created_at timestamptz not null default now(), reason text not null, size_kb int not null, data jsonb not null)`;
  }
  return g.__cnBakSql;
}

export async function createBackup(reason: string): Promise<BackupInfo> {
  const json = JSON.stringify(readDb());
  const info: BackupInfo = { id: new Date().toISOString().replace(/[:.]/g, "-"), createdAt: new Date().toISOString(), reason: reason.slice(0, 80), sizeKb: Math.round(json.length / 1024) };
  if (process.env.DATABASE_URL) {
    const sql = await pg();
    await sql`insert into compronext_backups (id, created_at, reason, size_kb, data) values (${info.id}, ${info.createdAt}, ${info.reason}, ${info.sizeKb}, ${sql.json(JSON.parse(json))})`;
    await sql`delete from compronext_backups where id in (select id from compronext_backups order by created_at desc offset ${KEEP})`;
  } else {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(path.join(DIR, `${info.id}.json`), JSON.stringify({ info, data: JSON.parse(json) }), "utf8");
    const files = (await fs.readdir(DIR)).filter((f) => f.endsWith(".json")).sort().reverse();
    for (const f of files.slice(KEEP)) await fs.unlink(path.join(DIR, f)).catch(() => {});
  }
  return info;
}

export async function listBackups(): Promise<BackupInfo[]> {
  try {
    if (process.env.DATABASE_URL) {
      const sql = await pg();
      return await sql<BackupInfo[]>`select id, created_at::text as "createdAt", reason, size_kb as "sizeKb" from compronext_backups order by created_at desc`;
    }
    const files = (await fs.readdir(DIR)).filter((f) => f.endsWith(".json")).sort().reverse();
    const out: BackupInfo[] = [];
    for (const f of files) {
      const raw = JSON.parse(await fs.readFile(path.join(DIR, f), "utf8")) as { info: BackupInfo };
      out.push(raw.info);
    }
    return out;
  } catch {
    return [];
  }
}

/** กู้คืน — สำรองสถานะปัจจุบันไว้ก่อนเสมอ (ย้อนกลับได้) */
export async function restoreBackup(id: string): Promise<boolean> {
  if (!/^[\w-]{10,40}$/.test(id)) return false;
  let data: RuntimeDatabase | null = null;
  if (process.env.DATABASE_URL) {
    const sql = await pg();
    const rows = await sql<{ data: RuntimeDatabase }[]>`select data from compronext_backups where id = ${id}`;
    data = rows[0]?.data ?? null;
  } else {
    try {
      data = (JSON.parse(await fs.readFile(path.join(DIR, `${id}.json`), "utf8")) as { data: RuntimeDatabase }).data;
    } catch {
      data = null;
    }
  }
  if (!data || !Array.isArray(data.products)) return false;
  await createBackup("ก่อนกู้คืนข้อมูล");
  writeDb(data);
  return true;
}
