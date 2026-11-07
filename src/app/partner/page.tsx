import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, MessageCircle, Star, Store } from "lucide-react";
import { partnerStoreKey, ratingSummary, unreadFor } from "@/lib/stores";
import { getCurrentUser } from "@/lib/auth";
import { getActivePartnerByEmail, readDb } from "@/lib/data/store";
import { AccountClient } from "@/components/AccountClient";
import { PartnerClient } from "@/components/PartnerClient";
import { PartnerOnboardingCard } from "@/components/PartnerOnboardingCard";
import { getStatsFor } from "@/lib/stats";
import { boostPrices, promptPayEnabled } from "@/lib/boost-pay";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "หลังร้านพาร์ตเนอร์", description: "จัดการสินค้า สถิติ และข้อความลูกค้าของร้านพาร์ตเนอร์ ComproNext", robots: { index: false } };

export default async function PartnerPage() {
  const user = await getCurrentUser();
  const partner = getActivePartnerByEmail(user);
  const own = partner ? readDb().products.filter((p) => p.partnerId === partner.id) : [];
  const stats = partner ? await getStatsFor(own.map((p) => p.id)) : {};

  return (
    <div className="container-page space-y-6 py-8">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink-950 sm:text-3xl">
        <Store className="h-7 w-7 text-info" /> หลังร้านพาร์ตเนอร์
      </h1>

      {!user ? (
        <>
          <p className="text-sm text-ink-600">เข้าสู่ระบบด้วยอีเมลที่ลงทะเบียนเป็นร้านพาร์ตเนอร์</p>
          <AccountClient initialUser={null} />
        </>
      ) : !partner ? (
        <PartnerOnboardingCard
          email={user.email}
          defaultStoreName={`ร้าน ${user.name || user.email.split("@")[0]} Official`}
        />
      ) : (
        <>
        {(() => {
          const db = readDb();
          const key = partnerStoreKey(partner)!;
          const rating = ratingSummary(key, db);
          const openCases = db.cases.filter((c) => c.partnerId === partner.id && c.status !== "resolved" && c.status !== "rejected").length;
          const unread = db.chats.filter((t) => t.partnerId === partner.id).reduce((n, t) => n + unreadFor(t, "store"), 0);
          return (
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href={`/stores/${encodeURIComponent(key)}`} className="tile flex-row items-center gap-3 p-4">
                <Star className="h-6 w-6 text-amber-400" fill="currentColor" strokeWidth={0} />
                <span>
                  <span className="block font-semibold text-ink-950">
                    {rating.count ? `${rating.avg.toFixed(1)} ดาว · ${rating.count} รีวิว` : "ยังไม่มีรีวิว"}
                  </span>
                  <span className="text-xs text-ink-500">ดูหน้าร้าน & ตอบรีวิว</span>
                </span>
              </Link>
              <Link href="/messages" className="tile flex-row items-center gap-3 p-4">
                <MessageCircle className="h-6 w-6 text-info" />
                <span>
                  <span className="block font-semibold text-ink-950">{unread ? `ข้อความใหม่ ${unread}` : "ข้อความจากลูกค้า"}</span>
                  <span className="text-xs text-ink-500">ตอบแชทลูกค้าที่ทักร้านคุณ</span>
                </span>
              </Link>
              <Link href="/partner/returns" className="tile flex-row items-center gap-3 p-4 sm:col-span-2">
                <LifeBuoy className="h-6 w-6 text-info" />
                <span>
                  <span className="block font-semibold text-ink-950">
                    {openCases ? `เคสหลังการขายรอจัดการ ${openCases}` : "เคสหลังการขาย"}
                  </span>
                  <span className="text-xs text-ink-500">ลูกค้าแจ้งของเสีย/ส่งผิด · ดูรายงานปัญหาหลังการขาย</span>
                </span>
              </Link>
            </div>
          );
        })()}
        <PartnerClient
          partnerName={partner.name}
          initialProducts={own}
          stats={stats}
          shipping={{ fee: partner.shippingFee ?? null, freeMin: partner.freeShippingMin ?? null }}
          boosts={Object.fromEntries(
            readDb()
              .boosts.filter((b) => b.partnerId === partner.id && (b.status === "pending" || b.status === "active"))
              .map((b) => [b.productId, b.status === "pending" && b.amount && !b.paidAt ? ("unpaid" as const) : (b.status as "pending" | "active")])
          )}
          boostPrices={promptPayEnabled() ? boostPrices() : null}
        />
        </>
      )}
    </div>
  );
}
