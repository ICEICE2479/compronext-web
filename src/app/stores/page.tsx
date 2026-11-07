import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ChevronRight, Store } from "lucide-react";
import { readDb } from "@/lib/data/store";
import { listStores, ratingSummary } from "@/lib/stores";
import { StarRating } from "@/components/reviews/StarRating";
import EmptyState from "@/components/EmptyState";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "ร้านค้า",
  description: "รวมร้านค้าไอทีที่เชื่อถือได้ พร้อมคะแนนรีวิวและสินค้าจากแต่ละร้าน",
};

export default function StoresPage() {
  const db = readDb();
  const stores = listStores(db).map((s) => ({ ...s, rating: ratingSummary(s.key, db) }));
  stores.sort((a, b) => Number(!!b.partner) - Number(!!a.partner) || b.rating.count - a.rating.count || b.productCount - a.productCount);

  return (
    <div className="container-page space-y-6 py-6 sm:py-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">ร้านค้า</h1>
        <p className="text-sm text-ink-600">ดูคะแนนรีวิวจากลูกค้าจริง แล้วทักร้านพาร์ตเนอร์ได้ในเว็บ</p>
      </div>
      {stores.length === 0 && (
        <EmptyState
          icon={<Store className="h-8 w-8" aria-hidden="true" />}
          title="ยังไม่มีร้านค้า"
          description="ตอนนี้ยังไม่มีร้านค้าในระบบ ลองกลับมาดูใหม่ภายหลัง"
          action={{ label: "ดูสินค้าทั้งหมด", href: "/categories" }}
        />
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((s) => (
          <li key={s.key}>
            <Link href={`/stores/${encodeURIComponent(s.key)}`} className="tile flex-row items-center gap-3 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-info-bg text-info">
                <Store className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink-950">
                  <span className="truncate">
                    {s.name}
                  </span>
                  {s.partner && <BadgeCheck className="h-4 w-4 shrink-0 text-ok" role="img" aria-label="ร้านพาร์ตเนอร์" />}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-600">
                  <StarRating value={s.rating.avg} size={12} />
                  {s.rating.count ? `${s.rating.avg.toFixed(1)} (${s.rating.count})` : "ยังไม่มีรีวิว"} · {s.productCount.toLocaleString()} สินค้า
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
