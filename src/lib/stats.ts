import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { after } from "next/server";

/**
 * สถิติสินค้าสำหรับร้านพาร์ตเนอร์: ยอดดู / ใส่ตะกร้า / AI เลือก / คลิกไปร้าน
 * - ตั้ง DATABASE_URL → เก็บในตาราง product_stats
 * - ไม่ตั้ง → เก็บใน .data/stats.json
 * นับในหน่วยความจำก่อนแล้วค่อยบันทึกเป็นชุด เพื่อไม่ให้ทุกการเข้าชมต้องเขียนฐานข้อมูล
 */
export type StatEvent = "views" | "carts" | "aiPicks" | "clicks";
export type ProductStats = Record<StatEvent, number>;

const EMPTY: ProductStats = { views: 0, carts: 0, aiPicks: 0, clicks: 0 };
const STATS_FILE = path.join(process.cwd(), ".data", "stats.json");

const state = ((globalThis as unknown as { __cnStats?: { buffer: Map<string, ProductStats>; flushing: boolean } }).__cnStats ??= {
  buffer: new Map(),
  flushing: false,
});

async function pg() {
  const { default: postgres } = await import("postgres");
  const g = globalThis as unknown as { __cnStatsSql?: import("postgres").Sql };
  if (!g.__cnStatsSql) {
    g.__cnStatsSql = postgres(process.env.DATABASE_URL!, { max: 2, idle_timeout: 20, prepare: false });
    await g.__cnStatsSql`create table if not exists product_stats (
      product_id text not null, event text not null, count bigint not null default 0,
      primary key (product_id, event))`;
  }
  return g.__cnStatsSql;
}

async function readPersisted(): Promise<Record<string, ProductStats>> {
  if (process.env.DATABASE_URL) {
    const sql = await pg();
    const rows = await sql<{ product_id: string; event: StatEvent; count: string }[]>`select product_id, event, count from product_stats`;
    const out: Record<string, ProductStats> = {};
    for (const r of rows) (out[r.product_id] ??= { ...EMPTY })[r.event] = Number(r.count);
    return out;
  }
  try {
    return JSON.parse(await fs.readFile(STATS_FILE, "utf8")) as Record<string, ProductStats>;
  } catch {
    return {};
  }
}

async function flush() {
  if (state.flushing || state.buffer.size === 0) return;
  state.flushing = true;
  const batch = new Map(state.buffer);
  state.buffer.clear();
  try {
    if (process.env.DATABASE_URL) {
      const sql = await pg();
      for (const [id, s] of batch) {
        for (const ev of Object.keys(s) as StatEvent[]) {
          if (!s[ev]) continue;
          await sql`insert into product_stats (product_id, event, count) values (${id}, ${ev}, ${s[ev]})
                    on conflict (product_id, event) do update set count = product_stats.count + excluded.count`;
        }
      }
    } else {
      const all = await readPersisted();
      for (const [id, s] of batch) {
        const cur = (all[id] ??= { ...EMPTY });
        for (const ev of Object.keys(s) as StatEvent[]) cur[ev] = (cur[ev] ?? 0) + s[ev];
      }
      await fs.mkdir(path.dirname(STATS_FILE), { recursive: true });
      await fs.writeFile(STATS_FILE, JSON.stringify(all), "utf8");
    }
  } catch (err) {
    // บันทึกไม่สำเร็จ: คืนค่ากลับเข้าบัฟเฟอร์ รอบหน้าค่อยลองใหม่
    for (const [id, s] of batch) {
      const cur = state.buffer.get(id) ?? { ...EMPTY };
      for (const ev of Object.keys(s) as StatEvent[]) cur[ev] += s[ev];
      state.buffer.set(id, cur);
    }
    console.error("[stats] flush failed", err);
  } finally {
    state.flushing = false;
  }
}

export function trackEvent(productId: string, event: StatEvent) {
  const cur = state.buffer.get(productId) ?? { ...EMPTY };
  cur[event] += 1;
  state.buffer.set(productId, cur);
  try {
    after(flush);
  } catch {
    setTimeout(flush, 5000);
  }
}

export async function getStatsFor(productIds: string[]): Promise<Record<string, ProductStats>> {
  const persisted = await readPersisted().catch(() => ({}) as Record<string, ProductStats>);
  const out: Record<string, ProductStats> = {};
  for (const id of productIds) {
    const a = persisted[id] ?? EMPTY;
    const b = state.buffer.get(id) ?? EMPTY;
    out[id] = { views: a.views + b.views, carts: a.carts + b.carts, aiPicks: a.aiPicks + b.aiPicks, clicks: a.clicks + b.clicks };
  }
  return out;
}

/** สถิติรวมทุกสินค้า (หน้าแอดมิน) */
export async function getAllStats(): Promise<Record<string, ProductStats>> {
  const persisted = await readPersisted().catch(() => ({}) as Record<string, ProductStats>);
  const ids = new Set([...Object.keys(persisted), ...state.buffer.keys()]);
  return getStatsFor([...ids]);
}
