import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { readDb } from "@/lib/data/store";
import { formatTHB } from "@/lib/format";
import { ProductTile, productToCartInput } from "@/components/ProductTile";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ShareButton } from "@/components/ShareButton";

export const dynamic = "force-dynamic";

function getDesign(id: string) {
  const db = readDb();
  const design = db.designs.find((d) => d.id === id);
  if (!design) return null;
  const byId = new Map(db.products.map((p) => [p.id, p]));
  const products = design.productIds.map((pid) => byId.get(pid)).filter((p): p is NonNullable<typeof p> => !!p);
  return { design, products };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const found = getDesign(id);
  if (!found) return {};
  return {
    title: `ห้องที่ AI จัดให้ ${found.design.userName}`,
    description: found.design.prompt || "ดูห้องที่ AI จัดให้และใส่สินค้าทั้งชุดลงตะกร้าได้ทันที",
    openGraph: { images: [found.design.imageUrl] },
  };
}

export default async function SharedDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = getDesign(id);
  if (!found) notFound();
  const { design, products } = found;
  const available = products.filter((p) => p.status === "available");
  const total = available.reduce((s, p) => s + p.price, 0);

  return (
    <div className="container-page space-y-6 py-6 sm:py-8">
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-ink-200 lg:col-span-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={design.imageUrl} alt={design.prompt || "ห้องที่ AI จัด"} width={1200} height={800} fetchPriority="high" decoding="async" className="h-auto w-full" />
        </div>
        <div className="space-y-4 lg:col-span-4">
          <p className="text-xs font-semibold text-info">ห้องที่ AI จัดให้ {design.userName}</p>
          <h1 className="font-display break-words text-2xl font-bold text-ink-950">{design.prompt || "ห้องของฉัน"}</h1>
          <p className="text-sm text-ink-600">
            {available.length} ชิ้น · รวม {formatTHB(total)}
          </p>
          <div className="flex flex-wrap gap-2">
            {available.length > 0 && (
              <AddToCartButton item={available.map((p) => productToCartInput(p))} label="ใส่ตะกร้าทั้งชุด" className="h-11" />
            )}
            <ShareButton title={design.prompt || "ห้องที่ AI จัด"} />
          </div>
          <Link href="/design" className="icon-btn h-11 w-full">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> <span className="text-sm font-semibold">ลองจัดห้องของคุณเอง</span>
          </Link>
          <p className="text-xs text-ink-600">ภาพจำลองโดย AI ของจริงอาจต่างเล็กน้อย</p>
        </div>
      </div>
      {products.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold text-ink-950">ของในห้องนี้</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {products.map((p) => (
              <ProductTile key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
