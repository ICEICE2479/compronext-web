import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, LifeBuoy } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getActivePartnerByEmail, readDb } from "@/lib/data/store";
import { CaseBoard } from "@/components/returns/CaseBoard";
import { AccountClient } from "@/components/AccountClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เคสหลังการขาย — หลังร้าน", robots: { index: false } };

/** หลังร้าน: จัดการเคส + รายงานหลังการขายของร้านตัวเอง */
export default async function PartnerReturnsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "open" } = await searchParams;
  const user = await getCurrentUser();
  const partner = getActivePartnerByEmail(user);
  const cases = partner ? readDb().cases.filter((c) => c.partnerId === partner.id) : [];
  const now = new Date().getTime();

  return (
    <div className="container-page space-y-5 py-8">
      <Link href="/partner" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-950">
        <ChevronLeft className="h-4 w-4" /> หลังร้าน
      </Link>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink-950 sm:text-3xl">
        <LifeBuoy className="h-7 w-7 text-info" /> เคสหลังการขาย
      </h1>
      {!user ? (
        <AccountClient initialUser={null} />
      ) : !partner ? (
        <p className="card p-6 text-sm text-ink-700">บัญชีนี้ยังไม่ได้เป็นร้านพาร์ตเนอร์</p>
      ) : (
        <CaseBoard cases={cases} filter={status} baseHref="/partner/returns" now={now} />
      )}
    </div>
  );
}
