import Link from "next/link";
import { BarChart3, Eye, MousePointerClick, ShoppingCart, Sparkles } from "lucide-react";
import type { Product } from "@/lib/types";
import type { ProductStats, StatEvent } from "@/lib/stats";
import { formatTHB } from "@/lib/format";

const EVENTS: Array<{ key: StatEvent; label: string; icon: typeof Eye }> = [
  { key: "views", label: "ยอดดูสินค้า", icon: Eye },
  { key: "clicks", label: "คลิกไปร้าน", icon: MousePointerClick },
  { key: "carts", label: "ใส่ตะกร้า", icon: ShoppingCart },
  { key: "aiPicks", label: "AI เลือกใช้", icon: Sparkles },
];

/** สรุปสถิติ: ยอดรวม + สินค้าที่คนสนใจมากสุด + ร้านที่ได้คลิกมากสุด (ใช้คุยกับพาร์ตเนอร์) */
export function AdminStats({ stats, products }: { stats: Record<string, ProductStats>; products: Product[] }) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const totals = EVENTS.map((e) => ({ ...e, value: Object.values(stats).reduce((s, x) => s + x[e.key], 0) }));
  const rows = Object.entries(stats)
    .filter(([id]) => byId.has(id))
    .map(([id, s]) => ({ p: byId.get(id)!, s, score: s.clicks * 5 + s.carts * 3 + s.views }));
  const top = rows.sort((a, b) => b.score - a.score).slice(0, 10);
  const stores = new Map<string, { clicks: number; views: number }>();
  for (const { p, s } of rows) {
    const k = p.storeName || p.platform;
    const cur = stores.get(k) ?? { clicks: 0, views: 0 };
    cur.clicks += s.clicks;
    cur.views += s.views;
    stores.set(k, cur);
  }
  const topStores = [...stores.entries()].sort((a, b) => b[1].clicks - a[1].clicks || b[1].views - a[1].views).slice(0, 6);
  const ctr = totals[0].value ? ((totals[1].value / totals[0].value) * 100).toFixed(1) : "0";

  return (
    <section className="card space-y-4 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink-950">
        <BarChart3 className="h-5 w-5 text-info" /> สถิติการใช้งาน
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {totals.map(({ key, label, icon: Icon, value }) => (
          <div key={key} className="rounded-xl border border-ink-200 p-3">
            <p className="flex items-center gap-1.5 text-xs text-ink-600">
              <Icon className="h-3.5 w-3.5" /> {label}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-ink-950">{value.toLocaleString("th-TH")}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-600">อัตราคลิกไปร้าน (คลิก ÷ ยอดดู) {ctr}%</p>
      {top.length === 0 ? (
        <div className="empty-state" role="status">
          <BarChart3 className="h-8 w-8 text-ink-500" aria-hidden="true" />
          <p className="font-semibold text-ink-900">ยังไม่มีข้อมูล</p>
          <p className="text-sm text-ink-600">ตัวเลขจะขึ้นเมื่อมีคนเข้าชมหน้าสินค้า</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="overflow-x-auto lg:col-span-2">
            <p className="mb-2 text-sm font-semibold text-ink-900">สินค้าที่คนสนใจมากสุด</p>
            <table className="w-full min-w-[480px] text-sm">
              <caption className="sr-only">สินค้าที่คนสนใจมากสุด</caption>
              <thead className="text-left text-xs text-ink-600">
                <tr>
                  <th scope="col" className="py-1.5 font-medium">สินค้า</th>
                  <th scope="col" className="py-1.5 text-right font-medium">ดู</th>
                  <th scope="col" className="py-1.5 text-right font-medium">คลิก</th>
                  <th scope="col" className="py-1.5 text-right font-medium">ตะกร้า</th>
                </tr>
              </thead>
              <tbody>
                {top.map(({ p, s }) => (
                  <tr key={p.id} className="border-t border-ink-100">
                    <td className="max-w-[260px] truncate py-1.5 pr-2">
                      <Link href={`/products/${p.id}`} className="inline-block min-h-11 py-2 hover:text-info sm:min-h-0 sm:py-0">
                        {p.name}
                      </Link>
                      <span className="ml-1 text-xs text-ink-600">{formatTHB(p.price)}</span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{s.views}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.clicks}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.carts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-900">ร้านที่ได้คลิกมากสุด</p>
            <ul className="space-y-1.5 text-sm">
              {topStores.map(([name, v]) => (
                <li key={name} className="flex justify-between gap-2 border-b border-ink-100 pb-1.5">
                  <span className="truncate">{name}</span>
                  <span className="shrink-0 tabular-nums text-ink-700">
                    {v.clicks} คลิก · {v.views} ดู
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
