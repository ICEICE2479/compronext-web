import type { Metadata } from "next";
import { shareMeta } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { summarizeCases } from "@/lib/returns";
import { BadgeCheck, ChevronLeft, Store } from "lucide-react";
import { readDb } from "@/lib/data/store";
import { getStore, ratingSummary, storeKeyOf } from "@/lib/stores";
import { ProductTile } from "@/components/ProductTile";
import { StarRating } from "@/components/reviews/StarRating";
import { StoreReviews } from "@/components/reviews/StoreReviews";
import { ChatStoreButton } from "@/components/chat/ChatStoreButton";

export const revalidate = 60;
/** สร้างหน้าตอนมีคนเปิดครั้งแรก แล้วแคชไว้ (รีเฟรชทุก 60 วิ) */
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const store = getStore(decodeURIComponent(key));
  if (!store) return {};
  const r = ratingSummary(store.key);
  return shareMeta({
    title: `ร้าน ${store.name} — รีวิว & สินค้า`,
    description: `${r.count ? `คะแนน ${r.avg}/5 จาก ${r.count} รีวิว · ` : ""}ดูสินค้า รีวิว และทักแชทร้าน ${store.name} บน ComproNext`,
    path: `/stores/${encodeURIComponent(store.key)}`,
  });
}

export default async function StorePage({ params }: Props) {
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const db = readDb();
  const store = getStore(key, db);
  if (!store) notFound();
  const summary = ratingSummary(store.key, db);
  const after = store.partner ? summarizeCases(db.cases.filter((c) => c.partnerId === store.partner!.id), Date.parse(db.updatedAt) || 0) : null;
  const products = db.products
    .filter((p) => p.published !== false && p.status === "available" && storeKeyOf(p.storeName || p.platform || "") === store.key)
    .slice(0, 12);

  return (
    <div className="container-page space-y-8 py-6 sm:py-8">
      <Link href="/stores" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-950">
        <ChevronLeft className="h-4 w-4" /> ร้านค้าทั้งหมด
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-info-bg text-info">
          <Store className="h-8 w-8" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold text-ink-950 sm:text-3xl">
            {store.name}
            {store.partner && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2.5 py-0.5 text-xs font-semibold text-ok">
                <BadgeCheck className="h-3.5 w-3.5" /> ร้านพาร์ตเนอร์
              </span>
            )}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-600">
            <StarRating value={summary.avg} size={15} />
            <span>{summary.count ? `${summary.avg.toFixed(1)} · ${summary.count} รีวิว` : "ยังไม่มีรีวิว"}</span>
            <span>· {store.productCount.toLocaleString()} สินค้า</span>
          </p>
          {after && after.total > 0 && (
            <p className="mt-1 text-xs text-ink-600">
              บริการหลังการขาย:{after.rating ? ` ★ ${after.rating.avg} จาก ${after.rating.count} เคส ·` : ""}
              {after.resolvedRate !== null ? ` แก้ไขให้ลูกค้าได้ ${after.resolvedRate}% ·` : ""}
              {after.avgFirstReplyHours !== null ? ` ตอบเฉลี่ย ${after.avgFirstReplyHours} ชม.` : " กำลังเก็บข้อมูล"}
            </p>
          )}
        </div>
        {store.partner && <ChatStoreButton storeKey={store.key} storeName={store.name} />}
      </header>

      {products.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-ink-950">สินค้าจากร้านนี้</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {products.map((p) => (
              <ProductTile key={p.id} product={p} />
            ))}
          </div>
          {store.productCount > products.length && (
            <Link href={`/categories?q=${encodeURIComponent(store.name)}`} className="inline-block text-sm font-semibold text-info">
              ดูสินค้าทั้งหมด {store.productCount.toLocaleString()} ชิ้น →
            </Link>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold text-ink-950">รีวิวร้าน</h2>
        <StoreReviews storeKey={store.key} storeName={store.name} initialSummary={summary} />
      </section>
    </div>
  );
}
