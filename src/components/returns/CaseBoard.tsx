import Link from "next/link";
import { AlertTriangle, ChevronRight, Clock, Inbox, TrendingUp } from "lucide-react";
import { CASE_STATUSES, CASE_TYPES, summarizeCases, type CaseStatus, type SupportCaseRecord } from "@/lib/returns";
import { CaseTracker, fmtWhen, StatusChip } from "./CaseBits";

const FILTERS: Array<[string, string]> = [
  ["open", "ยังไม่ปิด"],
  ["submitted", "เรื่องใหม่"],
  ["need_info", "รอลูกค้า"],
  ["approved", "กำลังดำเนินการ"],
  ["closed", "ปิดแล้ว"],
  ["all", "ทั้งหมด"],
];

function pick(cases: SupportCaseRecord[], f: string) {
  if (f === "all") return cases;
  if (f === "open") return cases.filter((c) => c.status !== "resolved" && c.status !== "rejected");
  if (f === "closed") return cases.filter((c) => c.status === "resolved" || c.status === "rejected");
  return cases.filter((c) => c.status === (f as CaseStatus));
}

/**
 * ระบบจัดการเคส + ระบบรายงาน (ใช้ทั้งหลังร้านและหลังบ้านแอดมิน)
 * now ส่งมาจากหน้า server เพื่อไม่ให้ค่าเวลาเปลี่ยนระหว่างเรนเดอร์
 */
export function CaseBoard({ cases, filter, baseHref, showStore = false, now }: { cases: SupportCaseRecord[]; filter: string; baseHref: string; showStore?: boolean; now: number }) {
  const r = summarizeCases(cases, now);
  const list = pick(cases, filter).sort((a, b) => Number(b.status === "submitted") - Number(a.status === "submitted") || b.updatedAt.localeCompare(a.updatedAt));
  const maxWeek = Math.max(1, ...r.weekly.map((w) => w.count));
  const sep = baseHref.includes("?") ? "&" : "?";

  return (
    <div className="space-y-6">
      {/* ---------- รายงาน ---------- */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [Inbox, "เคสที่ยังไม่ปิด", `${r.open}`, `จากทั้งหมด ${r.total}`],
          [Clock, "ตอบครั้งแรกเฉลี่ย", r.avgFirstReplyHours === null ? "—" : `${r.avgFirstReplyHours} ชม.`, "เป้าหมาย ≤ 24 ชม."],
          [TrendingUp, "แก้ไขให้ลูกค้าได้", r.resolvedRate === null ? "—" : `${r.resolvedRate}%`, r.avgCloseDays === null ? "ยังไม่มีเคสปิด" : `ปิดเคสเฉลี่ย ${r.avgCloseDays} วัน`],
          [AlertTriangle, "ค้างเกิน 48 ชม.", `${r.overdue}`, r.overdue ? "รีบตอบลูกค้า" : r.rating ? `ความพอใจ ★ ${r.rating.avg} (${r.rating.count} เคส)` : "ไม่มีเคสค้าง"],
        ].map(([Icon, label, value, sub]) => {
          const I = Icon as typeof Inbox;
          return (
            <div key={label as string} className="card p-4">
              <I className={`h-5 w-5 ${label === "ค้างเกิน 48 ชม." && r.overdue ? "text-bad" : "text-info"}`} />
              <p className="mt-2 font-display text-2xl font-bold text-ink-950">{value as string}</p>
              <p className="text-xs font-semibold text-ink-700">{label as string}</p>
              <p className="text-[11px] text-ink-500">{sub as string}</p>
            </div>
          );
        })}
      </section>

      {r.total > 0 && (
        <section className="grid gap-3 lg:grid-cols-3">
          <div className="card p-4">
            <p className="mb-2 text-sm font-semibold text-ink-950">ปัญหาที่เจอบ่อย</p>
            <ul className="space-y-2">
              {r.byType.map((t) => (
                <li key={t.type} className="text-xs">
                  <div className="mb-0.5 flex justify-between text-ink-700">
                    <span>{t.label}</span>
                    <span className="font-semibold text-ink-950">
                      {t.count} ({t.pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink-100">
                    <div className="h-full rounded-full bg-info" style={{ width: `${t.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <p className="mb-2 text-sm font-semibold text-ink-950">สินค้าที่มีเคสมากสุด</p>
            <ol className="space-y-1.5 text-xs">
              {r.topProducts.map((p, i) => (
                <li key={p.name} className="flex gap-2">
                  <span className="w-4 shrink-0 font-bold text-ink-500">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-800">{p.name}</span>
                  <span className="font-semibold text-ink-950">{p.count}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] text-ink-500">สินค้าที่ติดอันดับซ้ำๆ ควรเช็กล็อตสินค้า/การแพ็ก</p>
          </div>
          <div className="card p-4">
            <p className="mb-2 text-sm font-semibold text-ink-950">เคสใหม่ 8 สัปดาห์ล่าสุด</p>
            <div className="flex h-24 items-end gap-1.5" role="img" aria-label={`เคสใหม่รายสัปดาห์: ${r.weekly.map((w) => w.count).join(", ")}`}>
              {r.weekly.map((w) => (
                <div key={w.weekStart} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-semibold text-ink-700">{w.count || ""}</span>
                  <div className="w-full rounded-t bg-info/80" style={{ height: `${Math.max(3, (w.count / maxWeek) * 72)}px` }} />
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-500">
              ลูกค้าอยากได้: {r.byWish.map((w) => `${w.label} ${w.count}`).join(" · ") || "—"}
            </p>
          </div>
        </section>
      )}

      {/* ---------- รายการเคส ---------- */}
      <section className="space-y-3">
        <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="กรองเคส">
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={`${baseHref}${sep}status=${k}`} data-active={filter === k} className="chip shrink-0 rounded-full">
              {label} <span className="text-[11px] opacity-70">{pick(cases, k).length}</span>
            </Link>
          ))}
        </nav>
        {list.length === 0 ? (
          <p className="card p-8 text-center text-sm text-ink-600">ไม่มีเคสในกลุ่มนี้</p>
        ) : (
          <ul className="space-y-2">
            {list.map((c) => {
              const late = !c.firstReplyAt && c.status === "submitted" && now - Date.parse(c.createdAt) > 48 * 3_600_000;
              return (
                <li key={c.id}>
                  <Link href={`/returns/${c.code}`} className="card flex items-center gap-3 p-3 transition-shadow hover:shadow-md sm:p-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                        <span className="font-mono font-semibold text-ink-700">{c.code}</span>
                        {showStore && <span>{c.storeName}</span>}
                        <span>{c.userName}</span>
                        <span>{fmtWhen(c.updatedAt)}</span>
                        {late && <span className="font-semibold text-bad">ค้างเกิน 48 ชม.</span>}
                      </p>
                      <p className="truncate font-semibold text-ink-950">{c.productName}</p>
                      <p className="truncate text-xs text-ink-600">
                        {CASE_TYPES[c.type]} · {c.description}
                      </p>
                      <div className="max-w-xs pt-1">
                        <CaseTracker status={c.status} compact />
                      </div>
                    </div>
                    <StatusChip status={c.status} />
                    <ChevronRight className="h-5 w-5 shrink-0 text-ink-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-ink-500">สถานะ: {Object.values(CASE_STATUSES).join(" → ")}</p>
      </section>
    </div>
  );
}
