import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Box, Sparkles } from "lucide-react";
import { DesignStudio } from "@/components/DesignStudio";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI จัดห้อง",
  description: "ถ่ายรูปห้องของคุณ บอกสไตล์ที่อยากได้ แล้วให้ AI เลือกสินค้าจากร้านพาร์ตเนอร์และสร้างภาพห้องที่จัดเสร็จ",
};

export default async function DesignPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  const demo = sp.demo === "1";
  return (
    <div className="container-page space-y-6 py-6 sm:py-8">
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white ai-gradient">
          <Sparkles className="h-3.5 w-3.5" /> AI จัดห้อง
        </span>
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">ถ่ายรูปห้อง บอกสไตล์ แล้วให้ AI จัดให้</h1>
        <p className="text-sm text-ink-600">หน้านี้ให้ AI จัดห้องจากรูปของคุณ · ถ่ายรูป เลือกสไตล์ ใส่งบ แล้วกด “ให้ AI จัดห้อง” จากนั้นใส่ตะกร้าได้ทั้งชุด</p>
      </div>

      {/* Blueprint / 3D Room Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 p-4 sm:p-5 dark:border-sky-800/40 dark:from-sky-950/30 dark:via-blue-950/20 dark:to-indigo-950/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm">
              <Box className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink-950">อยากวาดแปลนและจัดห้องเองแบบ My Dream Setup?</span>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">ใหม่</span>
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-ink-600">
                โหมด Blueprint Mode วาดขนาดห้อง ประตู หน้าต่าง แล้วหยิบสินค้าทุกชิ้นในร้านมาวางหมุนในห้อง 3D ได้อิสระ
              </p>
            </div>
          </div>
          <Link
            href="/room-3d"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-95"
          >
            ไปที่จัดห้อง 3D
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      {demo && (
        <p className="rounded-xl bg-info-bg px-4 py-2.5 text-sm text-info">
          โหมดสาธิต: ใส่รูปห้องและสไตล์ไว้ให้แล้ว กด “ให้ AI จัดห้อง” ได้เลย
        </p>
      )}
      <DesignStudio loggedIn={!!user} demo={demo} />
    </div>
  );
}
