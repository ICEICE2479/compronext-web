import Link from "next/link";
import { Box, Camera, Cpu, Ruler, Sparkles } from "lucide-react";

/** หัวหน้าแรก: ปุ่มหลัก AI จัดห้อง + ปุ่มทางด่วน 3D Studio, วัดขนาดห้อง และจัดสเปกคอม 3D */
export function HomeHero() {
  return (
    <section className="container-page pt-8 sm:pt-14" aria-labelledby="home-hero-title">
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white ai-gradient">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> ฟรี ไม่ต้องสมัคร
        </span>
        <h1 id="home-hero-title" className="text-display text-ink-950">
          ถ่ายรูปห้อง <span className="text-info">AI จัดให้</span> พร้อมบอกว่าซื้ออะไรคุ้มสุด
        </h1>
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/design" className="btn min-h-14 w-full flex-1 border-0 px-6 text-base font-bold text-white shadow-pop ai-gradient">
            <Camera className="h-5 w-5" aria-hidden="true" /> ถ่ายรูปห้อง → AI จัดให้
          </Link>
          <Link
            href="/room-3d"
            className="btn btn-outline min-h-14 w-full flex-1 border-info/35 bg-white px-6 text-base font-bold text-info shadow-xs hover:bg-info-bg"
          >
            <Box className="h-5 w-5" aria-hidden="true" /> วาดแปลน & จัดห้อง 3D
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs font-semibold text-ink-700">
          <Link
            href="/design?mode=plan&tool=measure"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 hover:border-info hover:text-info transition-colors shadow-xs"
          >
            <Ruler className="h-3.5 w-3.5 text-info" /> กล้องวัดขนาดห้อง & นับกระเบื้อง
          </Link>
          <Link
            href="/builder"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 hover:border-info hover:text-info transition-colors shadow-xs"
          >
            <Cpu className="h-3.5 w-3.5 text-info" /> จัดสเปกคอม 3D เช็กขนาดเคส
          </Link>
        </div>
        <p className="text-sm text-ink-600">ถ่ายรูป · วาดแปลนห้อง · จำลองวางของจริงใน 3D · ได้รายการของที่ควรซื้อก่อน</p>
      </div>
    </section>
  );
}
