import type { BuyPlan, PlanItem } from "@/lib/buy-plan";
import { formatTHB } from "@/lib/format";

function Group({ title, items }: { title: string; items: PlanItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="font-display text-base font-bold text-ink-950">{title}</h3>
      <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
        {items.map((it) => (
          <li key={it.id} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold text-ink-900">{it.name}</p>
              <p className="mt-0.5 text-xs text-ink-600">{it.reason}</p>
            </div>
            <span className="shrink-0 font-display text-sm font-bold text-ink-950">{formatTHB(it.price * it.quantity)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** แผน "ซื้ออะไรก่อน" 2 กลุ่ม + ยอดรวมเทียบงบ + สรุป "คุ้มไหม?" */
export function BuyPlanView({ plan, savings = 0 }: { plan: BuyPlan; savings?: number }) {
  const firstPct = plan.total > 0 ? Math.round((plan.firstTotal / plan.total) * 100) : 100;
  return (
    <div className="card space-y-4 p-5">
      <div className="space-y-1.5 rounded-xl bg-info-bg p-3 text-sm" aria-label="คุ้มไหม?">
        <p className="font-display text-base font-bold text-ink-950">คุ้มไหม?</p>
        {plan.later.length > 0 ? (
          <p className="text-ink-800">
            ซื้อแค่ {plan.first.length} ชิ้นแรก ({formatTHB(plan.firstTotal)} · {firstPct}% ของทั้งชุด) ห้องก็เปลี่ยนเยอะแล้ว ที่เหลือค่อยซื้อทีหลัง
          </p>
        ) : (
          <p className="text-ink-800">ทุกชิ้นในชุดนี้ช่วยเปลี่ยนห้องได้ชัด ไม่มีชิ้นไหนควรตัดออก</p>
        )}
        {savings > 0 && <p className="text-ink-800">สลับเป็นรุ่นที่ถูกกว่าได้ ประหยัดสูงสุด <b>{formatTHB(savings)}</b> (กด “เปลี่ยน” ที่สินค้า)</p>}
      </div>
      <Group title="ควรซื้อก่อน (เปลี่ยนห้องมากสุด)" items={plan.first} />
      <Group title="ซื้อทีหลังได้" items={plan.later} />
      <div className="rounded-xl bg-ink-50 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-ink-700">ยอดรวมทั้งหมด</span>
          <span className="font-display font-bold text-ink-950">{formatTHB(plan.total)}</span>
        </div>
        {plan.later.length > 0 && (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-ink-700">เฉพาะที่ควรซื้อก่อน</span>
            <span className="font-semibold text-ink-950">{formatTHB(plan.firstTotal)}</span>
          </div>
        )}
        {plan.budget !== null && (
          <p className={`mt-1.5 text-xs font-semibold ${plan.overBudget > 0 ? "text-bad" : "text-ok"}`}>
            {plan.overBudget > 0
              ? `เกินงบ ${formatTHB(plan.overBudget)} (งบ ${formatTHB(plan.budget)}) — ซื้อกลุ่มแรกก่อนได้`
              : `อยู่ในงบ ${formatTHB(plan.budget)} เหลือ ${formatTHB(plan.budget - plan.total)}`}
          </p>
        )}
      </div>
    </div>
  );
}
