import type { Metadata } from "next";
import { Box, Sparkles } from "lucide-react";
import Link from "next/link";
import { Room3DStudioClient } from "@/components/design/Room3DStudioClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "จัดห้อง 3D (My Dream Setup) | ComproNext",
  description: "วาดแปลนห้อง กำหนดขนาดกว้าง ยาว สูง และประตูหน้าต่างสไตล์ My Dream Setup แล้วจัดวางโต๊ะคอม เก้าอี้ จอภาพ และสินค้าทั้งหมดในเว็บแบบ 3D",
};

export default function Room3DPage() {
  return (
    <div className="container-page space-y-5 py-5 sm:py-7">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-info/10 px-3 py-1 text-xs font-bold text-info border border-info/30">
              <Box className="h-3.5 w-3.5" /> จัดห้อง 3D
            </span>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 border border-amber-500/20">
              My Dream Setup Mode
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">
            จัดห้อง 3D & วาดแปลนห้องในฝัน
          </h1>
          <p className="text-sm text-ink-600">
            เริ่มต้นด้วยโหมดพิมพ์เขียว (Blueprint Mode) วาดขนาดห้อง ตำแหน่งประตูและหน้าต่าง จากนั้นเริ่มจัดวางสินค้าจริงกว่า 2,100+ ชิ้นในระบบ 3D ได้อย่างอิสระ
          </p>
        </div>

        {/* Link to AI Design */}
        <div className="flex items-center gap-2">
          <Link
            href="/design"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface px-4 py-2 text-xs font-bold text-ink-700 hover:border-info hover:text-info transition-colors shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-info" />
            ต้องการให้ AI จัดห้องจากรูปถ่าย? →
          </Link>
        </div>
      </div>

      {/* Main 3D Studio Client */}
      <Room3DStudioClient />
    </div>
  );
}
