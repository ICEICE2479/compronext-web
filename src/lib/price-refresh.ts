import "server-only";
import type { Product } from "@/lib/types";
import type { RuntimeDatabase } from "@/lib/data/store";
import { parsePublicImageUrl } from "@/lib/safe-fetch";
import { applyPriceDropAlerts } from "@/lib/price-alerts";

/**
 * เช็กราคาสินค้ากับหน้าร้านจริง (วันละครั้งผ่าน /api/cron/prices)
 * อ่านราคาจากข้อมูลมาตรฐานที่ร้านใส่ไว้ให้ Google: JSON-LD Product/Offer, meta product:price:amount, itemprop="price"
 * ไม่เชื่อค่าที่ต่างจากราคาเดิมเกิน 3 เท่า (กันหยิบเลขผิดจากหน้าเว็บ)
 */

export interface PriceReading {
  price: number | null;
  inStock: boolean | null;
}

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

function fromJsonLd(html: string): PriceReading | null {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const body = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    let data: unknown;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const stack: unknown[] = [data];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node)) {
        stack.push(...node);
        continue;
      }
      const o = node as Record<string, unknown>;
      const type = String(o["@type"] ?? "");
      if (/Offer/i.test(type)) {
        const price = num(o.price) ?? num(o.lowPrice);
        const currency = String(o.priceCurrency ?? "THB");
        if (price && /THB|฿|^$/i.test(currency)) {
          const avail = String(o.availability ?? "");
          return { price, inStock: avail ? !/OutOfStock|SoldOut|Discontinued/i.test(avail) : null };
        }
      }
      for (const v of Object.values(o)) if (v && typeof v === "object") stack.push(v);
    }
  }
  return null;
}

/** อ่านราคาจาก HTML หน้าสินค้า */
export function extractPrice(html: string): PriceReading {
  const ld = fromJsonLd(html);
  if (ld) return ld;
  const meta =
    html.match(/<meta[^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["']/i);
  if (meta) return { price: num(meta[1]), inStock: null };
  const item = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i) ?? html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i);
  if (item) return { price: num(item[1]), inStock: null };
  return { price: null, inStock: null };
}

/** ราคาที่อ่านได้น่าเชื่อไหม (ไม่ห่างจากราคาเดิมเกินไป) */
export function plausible(oldPrice: number, next: number): boolean {
  if (!oldPrice) return next > 0;
  return next >= oldPrice / 3 && next <= oldPrice * 3;
}

async function fetchHtml(url: string, timeoutMs = 12000): Promise<string | null> {
  let current = url;
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop <= 3; hop++) {
    const u = await parsePublicImageUrl(current); // ตรวจว่าเป็นที่อยู่สาธารณะ (กันยิงเข้าเครือข่ายภายใน)
    if (!u) return null;
    try {
      const res = await fetch(u, {
        redirect: "manual",
        signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "th-TH,th;q=0.9,en;q=0.8",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        current = new URL(loc, u).toString();
        continue;
      }
      if (!res.ok) return null;
      const text = await res.text();
      return text.length > 3_000_000 ? text.slice(0, 3_000_000) : text;
    } catch {
      return null;
    }
  }
  return null;
}

/** บันทึกราคาใหม่ + ประวัติราคา (คืน true ถ้าราคาเปลี่ยน) */
export function recordPrice(p: Product, price: number, today = new Date().toISOString().slice(0, 10)): boolean {
  const history = p.priceHistory ?? [{ d: p.priceUpdatedAt || today, p: p.price }];
  const last = history[history.length - 1];
  if (last && last.d === today) last.p = price;
  else if (!last || last.p !== price) history.push({ d: today, p: price });
  p.priceHistory = history.slice(-90);
  const changed = p.price !== price;
  if (changed) {
    p.price = price;
    p.priceUpdatedAt = today;
  }
  return changed;
}

export interface RefreshSummary {
  checked: number;
  changed: number;
  failed: number;
  alerts: number;
  ids: string[];
}

/** เช็กสินค้าที่เช็กนานที่สุดก่อน ทีละ limit ชิ้น (ขนาน 4) แล้วส่งแจ้งเตือนราคาลด */
export async function refreshPrices(db: RuntimeDatabase, limit = 40, deadlineMs = 50_000): Promise<RefreshSummary> {
  const started = Date.now();
  const queue = db.products
    .filter((p) => p.published !== false && /^https?:\/\//.test(p.buyUrl ?? "") && !p.isSample)
    .sort((a, b) => (a.priceCheckedAt ?? "").localeCompare(b.priceCheckedAt ?? ""))
    .slice(0, limit);
  const sum: RefreshSummary = { checked: 0, changed: 0, failed: 0, alerts: 0, ids: [] };
  const changedIds: string[] = [];
  let i = 0;
  const worker = async () => {
    while (i < queue.length && Date.now() - started < deadlineMs) {
      const p = queue[i++];
      const html = await fetchHtml(p.buyUrl);
      p.priceCheckedAt = new Date().toISOString();
      sum.checked++;
      sum.ids.push(p.id);
      const r = html ? extractPrice(html) : { price: null, inStock: null };
      if (!r.price || !plausible(p.price, r.price)) {
        sum.failed++;
        continue;
      }
      if (recordPrice(p, Math.round(r.price))) {
        sum.changed++;
        changedIds.push(p.id);
      }
      if (r.inStock === false && p.status === "available") p.status = "out_of_stock";
      else if (r.inStock === true && p.status === "out_of_stock") p.status = "available";
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  sum.alerts = applyPriceDropAlerts(db, changedIds);
  return sum;
}
