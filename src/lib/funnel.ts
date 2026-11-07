import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { after } from "next/server";

/**
 * ตัวนับรายวันแบบไม่ระบุตัวตน — ดูว่าคนหลุดตรงไหน (เข้าเว็บ → ดูสินค้า → ใส่ตะกร้า → ไปร้าน)
 * - DATABASE_URL → ตาราง funnel_daily · ไม่ตั้ง → .data/funnel.json
 */
export const FUNNEL_STEPS = [
  ["visit", "เข้าเว็บ (หน้า)"],
  ["product_view", "ดูสินค้า"],
  ["cart_add", "ใส่ตะกร้า"],
  ["go_click", "กดไปร้าน"],
] as const;
export const FUNNEL_EXTRA = [
  ["builder_view", "เปิดจัดสเปก"],
  ["room_view", "ดูห้อง"],
  ["ai_design", "สั่ง AI จัดห้อง"],
  ["search", "ค้นหา"],
] as const;
export type FunnelEvent = (typeof FUNNEL_STEPS)[number][0] | (typeof FUNNEL_EXTRA)[number][0];
export const FUNNEL_EVENTS = new Set<string>([...FUNNEL_STEPS, ...FUNNEL_EXTRA].map(([k]) => k));

const FILE = path.join(process.cwd(), ".data", "funnel.json");
type Data = Record<string, Record<string, number>>; // day → event → count
const g = globalThis as unknown as { __cnFunnel?: { buf: Map<string, number>; flushing: boolean }; __cnFunnelSql?: import("postgres").Sql };
const state = (g.__cnFunnel ??= { buf: new Map(), flushing: false });
const day = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10); // วันตามเวลาไทย

async function pg() {
  if (!g.__cnFunnelSql) {
    const { default: postgres } = await import("postgres");
    g.__cnFunnelSql = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 20, prepare: false });
    await g.__cnFunnelSql`create table if not exists funnel_daily (day date not null, event text not null, count bigint not null default 0, primary key (day, event))`;
  }
  return g.__cnFunnelSql;
}
async function readLocal(): Promise<Data> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Data;
  } catch {
    return {};
  }
}

async function flush() {
  if (state.flushing || !state.buf.size) return;
  state.flushing = true;
  const batch = new Map(state.buf);
  state.buf.clear();
  try {
    if (process.env.DATABASE_URL) {
      const sql = await pg();
      for (const [k, n] of batch) {
        const [d, ev] = k.split("|");
        await sql`insert into funnel_daily (day, event, count) values (${d}, ${ev}, ${n}) on conflict (day, event) do update set count = funnel_daily.count + excluded.count`;
      }
    } else {
      const all = await readLocal();
      for (const [k, n] of batch) {
        const [d, ev] = k.split("|");
        (all[d] ??= {})[ev] = (all[d][ev] ?? 0) + n;
      }
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(all), "utf8");
    }
  } catch (err) {
    for (const [k, n] of batch) state.buf.set(k, (state.buf.get(k) ?? 0) + n);
    console.error("[funnel] flush failed", err);
  } finally {
    state.flushing = false;
  }
}

export function trackFunnel(event: FunnelEvent, n = 1) {
  const k = `${day()}|${event}`;
  state.buf.set(k, (state.buf.get(k) ?? 0) + n);
  try {
    after(flush);
  } catch {
    setTimeout(flush, 5000);
  }
}

/** ยอดรวมย้อนหลัง N วัน: แยกรายวัน + รวม */
export async function readFunnel(days = 14): Promise<{ days: string[]; byDay: Data; total: Record<string, number> }> {
  const list: string[] = [];
  for (let i = days - 1; i >= 0; i--) list.push(new Date(Date.now() + 7 * 3_600_000 - i * 86_400_000).toISOString().slice(0, 10));
  let byDay: Data = {};
  try {
    if (process.env.DATABASE_URL) {
      const sql = await pg();
      const rows = await sql<{ day: string; event: string; count: string }[]>`select day::text as day, event, count from funnel_daily where day >= ${list[0]}`;
      for (const r of rows) (byDay[r.day] ??= {})[r.event] = Number(r.count);
    } else byDay = await readLocal();
  } catch {
    byDay = {};
  }
  for (const [k, n] of state.buf) {
    const [d, ev] = k.split("|");
    (byDay[d] ??= {})[ev] = (byDay[d][ev] ?? 0) + n;
  }
  const total: Record<string, number> = {};
  for (const d of list) for (const [ev, n] of Object.entries(byDay[d] ?? {})) total[ev] = (total[ev] ?? 0) + n;
  return { days: list, byDay, total };
}
