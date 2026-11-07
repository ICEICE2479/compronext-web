import { FUNNEL_EXTRA, FUNNEL_STEPS } from "@/lib/funnel";

/** กราฟขั้นบันได: เข้าเว็บ → ดูสินค้า → ใส่ตะกร้า → กดไปร้าน (+ % ที่ไปต่อแต่ละขั้น) และแท่งรายวัน */
export function FunnelView({ days, byDay, total }: { days: string[]; byDay: Record<string, Record<string, number>>; total: Record<string, number> }) {
  const top = Math.max(1, total.visit ?? 0);
  const daily = days.map((d) => byDay[d]?.visit ?? 0);
  const maxDay = Math.max(1, ...daily);
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-ink-950">คนหลุดตรงไหน (14 วัน)</h2>
        <p className="text-xs text-ink-600">นับแบบไม่ระบุตัวตน เฉพาะผู้ที่ยอมรับคุกกี้สถิติ (ยอดดูสินค้า/กดไปร้าน นับทุกคน)</p>
      </div>
      <div className="space-y-2">
        {FUNNEL_STEPS.map(([k, label], i) => {
          const n = total[k] ?? 0;
          const prev = i ? total[FUNNEL_STEPS[i - 1][0]] ?? 0 : 0;
          return (
            <div key={k} className="space-y-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ink-800">{label}</span>
                <span className="tabular-nums text-ink-950">
                  <strong>{n.toLocaleString("th-TH")}</strong>
                  {i > 0 && <span className="ml-2 text-xs text-ink-600">ไปต่อ {prev ? Math.round((n / prev) * 100) : 0}%</span>}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                <div className="bar-grow h-full rounded-full bg-info" style={{ width: `${Math.min(100, (n / top) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700">
        {FUNNEL_EXTRA.map(([k, label]) => (
          <span key={k}>
            {label} <strong className="tabular-nums text-ink-950">{(total[k] ?? 0).toLocaleString("th-TH")}</strong>
          </span>
        ))}
      </div>
      <div>
        <p className="mb-1 text-xs text-ink-600">เข้าเว็บรายวัน</p>
        <div className="flex h-16 items-end gap-1" role="img" aria-label="จำนวนหน้าที่เปิดรายวัน">
          {days.map((d, i) => (
            <div key={d} title={`${d}: ${daily[i]}`} aria-hidden="true" className="flex-1 rounded-t bg-info/70" style={{ height: `${Math.max(3, (daily[i] / maxDay) * 100)}%` }} />
          ))}
        </div>
      </div>
    </section>
  );
}
