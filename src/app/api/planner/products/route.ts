import { NextResponse } from "next/server";
import { getAllCatalogProducts } from "@/lib/data/store";
import { CATEGORY_LABELS } from "@/lib/format";
import { matchScore } from "@/lib/search";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** ค้นสินค้าจริงมาวางในห้อง 3D (ส่งขนาด/สีไปด้วย) — ?q=คำค้น &cat=หมวด &limit=จำนวน */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 60);
  const cat = (sp.get("cat") ?? "").trim();
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 24, 6), 60);
  if (!rateLimit(`planner:${clientIp(request)}`, 120, 60_000).ok) return NextResponse.json({ products: [] }, { status: 429 });

  const labels = CATEGORY_LABELS as Record<string, string>;
  const isAll = !cat || cat === "all";

  const allAvailable = getAllCatalogProducts().filter((p) => p.status === "available");

  let filtered = allAvailable;
  if (!isAll) {
    filtered = allAvailable.filter((p) => p.category === cat);
  }

  const products = filtered
    .map((p) => ({
      p,
      s: q.length >= 2 ? matchScore(q, p.name, `${labels[p.category] ?? ""} ${p.storeName ?? ""} ${p.platform ?? ""}`) : 1 + (p.dimensions ? 1 : 0),
    }))
    .filter((x) => (q.length >= 2 ? x.s > 0 : true))
    .sort((a, b) => b.s - a.s || Number(!!b.p.dimensions) - Number(!!a.p.dimensions))
    .slice(0, limit)
    .map(({ p }) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      imageUrl: p.imageUrl,
      dimensions: p.dimensions,
      colors: p.colors,
      storeName: p.storeName || p.platform,
      platform: p.platform,
      buyUrl: p.buyUrl,
    }));

  return NextResponse.json({ products }, { headers: { "Cache-Control": "public, max-age=60" } });
}
