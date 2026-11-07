import { NextResponse } from "next/server";
import { getAllCatalogProducts, getAllRooms } from "@/lib/data/store";
import { CATEGORY_LABELS } from "@/lib/format";
import { matchScore } from "@/lib/search";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** คำแนะนำระหว่างพิมพ์ค้นหา: สินค้า 6 + ห้อง 2 + หมวด 2 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ products: [], rooms: [], categories: [] });
  if (!rateLimit(`suggest:${clientIp(request)}`, 90, 60_000).ok) return NextResponse.json({ products: [], rooms: [], categories: [] }, { status: 429 });
  const labels = CATEGORY_LABELS as Record<string, string>;
  const products = getAllCatalogProducts()
    .filter((p) => p.status === "available")
    .map((p) => ({ p, s: matchScore(q, p.name, `${labels[p.category] ?? ""} ${p.storeName}`) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6)
    .map(({ p }) => ({ id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl }));
  const rooms = getAllRooms()
    .map((r) => ({ r, s: matchScore(q, r.name, r.description) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2)
    .map(({ r }) => ({ slug: r.slug, name: r.name }));
  const categories = Object.entries(labels)
    .filter(([slug, label]) => matchScore(q, label, slug) > 0)
    .slice(0, 2)
    .map(([slug, label]) => ({ slug, label }));
  return NextResponse.json({ products, rooms, categories }, { headers: { "Cache-Control": "public, max-age=60" } });
}
