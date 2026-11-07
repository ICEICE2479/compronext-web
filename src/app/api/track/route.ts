import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getProductById } from "@/lib/data/store";
import { trackEvent } from "@/lib/stats";
import { trackFunnel } from "@/lib/funnel";

/**
 * นับแบบไม่ระบุตัวตน (ส่งเฉพาะเมื่อผู้ใช้ยอมรับคุกกี้สถิติ)
 * - { ids } = ใส่ตะกร้า · { event: "visit", path } = เปิดหน้า (แยกนับหน้าจัดสเปก/ห้อง/ค้นหา)
 */
export async function POST(request: Request) {
  if (!rateLimit(`track:${clientIp(request)}`, 120, 60_000).ok) return NextResponse.json({ ok: true });
  const body = (await request.json().catch(() => ({}))) as { ids?: unknown; event?: unknown; path?: unknown; id?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 20) : [];
  let added = 0;
  for (const id of new Set(ids))
    if (getProductById(id)) {
      trackEvent(id, "carts");
      added++;
    }
  if (added) trackFunnel("cart_add");
  if (body.event === "product_view" && typeof body.id === "string" && getProductById(body.id)) {
    trackEvent(body.id, "views");
    trackFunnel("product_view");
  }
  if (body.event === "visit" && typeof body.path === "string") {
    const p = body.path.slice(0, 200);
    trackFunnel("visit");
    if (p.startsWith("/builder")) trackFunnel("builder_view");
    else if (/^\/rooms\/[^/]+/.test(p)) trackFunnel("room_view");
    if (/[?&]q=/.test(p)) trackFunnel("search");
  }
  return NextResponse.json({ ok: true });
}
