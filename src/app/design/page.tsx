import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
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
      {demo && (
        <p className="rounded-xl bg-info-bg px-4 py-2.5 text-sm text-info">
          โหมดสาธิต: ใส่รูปห้องและสไตล์ไว้ให้แล้ว กด “ให้ AI จัดห้อง” ได้เลย
        </p>
      )}
      <DesignStudio loggedIn={!!user} demo={demo} />
    </div>
  );
}
