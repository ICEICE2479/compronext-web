import type { CommunityPostRecord, RuntimeDatabase } from "@/lib/data/store";
import { PC_PARTS } from "@/lib/builder/parts";
import { MONITOR_CATALOG } from "@/lib/builder/monitors";

export const BUILD_SLOTS = ["cpu", "gpu", "motherboard", "ram", "storage", "cooler", "psu", "case", "monitor"] as const;
/** โพสต์ถูกรายงานครบกี่ครั้งแล้วซ่อนอัตโนมัติ (รอแอดมินตรวจ) */
export const AUTO_HIDE_REPORTS = 3;

/** เก็บเฉพาะรหัสชิ้นส่วนที่มีจริง */
export function cleanSelection(raw: unknown): Record<string, string | null> | null {
  if (!raw || typeof raw !== "object") return null;
  const ids = new Set([...PC_PARTS.map((p) => p.id), ...MONITOR_CATALOG.map((m) => m.id)]);
  const sel: Record<string, string | null> = {};
  let count = 0;
  for (const k of BUILD_SLOTS) {
    const v = (raw as Record<string, unknown>)[k];
    sel[k] = typeof v === "string" && ids.has(v) ? v : null;
    if (sel[k]) count++;
  }
  return count >= 2 ? sel : null;
}

export function visiblePosts(db: RuntimeDatabase, kind?: "build" | "room", sort: "new" | "top" = "new"): CommunityPostRecord[] {
  return db.community
    .filter((p) => p.status === "visible" && (!kind || p.kind === kind))
    .sort((a, b) => (sort === "top" ? b.likes.length * 3 + b.copies - (a.likes.length * 3 + a.copies) : 0) || b.createdAt.localeCompare(a.createdAt));
}
