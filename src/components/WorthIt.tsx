import Link from "next/link";
import { Scale } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatTHB } from "@/lib/format";
import { extractSpecs, partKind } from "@/lib/spec-extract";
import { insightFor } from "@/lib/product-insights";

import { WorthItCompat } from "@/components/WorthItCompat";

const POOL_CATEGORIES: string[] = ["computer", "monitor", "desk", "monitor_arm"];

/** กล่อง "คุ้มไหม?" — ใช้เฉพาะข้อมูลจริงของสินค้า ถ้าไม่มีข้อมูลจะซ่อนแถวนั้น */
export function WorthIt({ product, catalog }: { product: Product; catalog: Product[] }) {
  const specs = extractSpecs(product);
  const insight = insightFor(partKind(product), product.name, specs);
  const cheaper = catalog
    .filter((p) => p.category === product.category && p.id !== product.id && p.status === "available" && p.price < product.price)
    .sort((a, b) => b.price - a.price)
    .slice(0, 3);
  // ส่งไปฝั่งเบราว์เซอร์เฉพาะช่องที่ใช้เช็กความเข้ากัน (เดิมส่งสินค้าทั้งร้าน ~600KB ทำหน้าโหลดช้า)
  const slim = (p: Product) =>
    ({ id: p.id, name: p.name, category: p.category, placement: p.placement, dimensions: p.dimensions, ports: p.ports }) as Product;

  if (!insight.fit && insight.cons.length === 0 && cheaper.length === 0 && !POOL_CATEGORIES.includes(product.category)) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-ink-200 bg-white p-4" aria-labelledby="worth-it-title">
      <h2 id="worth-it-title" className="flex items-center gap-2 font-display text-lg font-bold text-ink-950">
        <Scale className="h-5 w-5 text-info" aria-hidden="true" /> คุ้มไหม?
      </h2>
      <dl className="space-y-3 text-sm">
        {insight.fit && (
          <div>
            <dt className="font-semibold text-ink-950">เหมาะกับใคร</dt>
            <dd className="text-ink-700">
              {insight.fit}
              {insight.pros.length > 0 && ` · ${insight.pros.slice(0, 2).join(" · ")}`}
            </dd>
          </div>
        )}
        {insight.cons.length > 0 && (
          <div>
            <dt className="font-semibold text-ink-950">ไม่เหมาะกับใคร / ข้อควรรู้</dt>
            <dd className="text-ink-700">{insight.cons.slice(0, 3).join(" · ")}</dd>
          </div>
        )}
        {cheaper.length > 0 && (
          <div>
            <dt className="font-semibold text-ink-950">ทางเลือกที่ถูกกว่า</dt>
            <dd>
              <ul className="mt-1 space-y-1">
                {cheaper.map((p) => (
                  <li key={p.id}>
                    <Link href={`/products/${p.id}`} className="flex items-center justify-between gap-3 text-ink-800 hover:text-info">
                      <span className="line-clamp-1 min-w-0">{p.name}</span>
                      <span className="shrink-0 font-bold">
                        {formatTHB(p.price)} <span className="text-xs font-normal text-ink-500">ถูกกว่า {formatTHB(product.price - p.price)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {POOL_CATEGORIES.includes(product.category) && <WorthItCompat product={slim(product)} />}
      </dl>
    </section>
  );
}
