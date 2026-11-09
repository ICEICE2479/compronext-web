import Link from "next/link";
import {
  ArrowRight,
  Box,
  Camera,
  Cpu,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Reveal from "@/components/Reveal";

export function StartPaths() {
  return (
    <section className="container-page space-y-6" aria-labelledby="home-start-title">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-info">
            เครื่องมือแนะนำ
          </span>
          <h2 id="home-start-title" className="text-h2 text-ink-950">
            วันนี้คุณอยากเริ่มต้นจากอะไร
          </h2>
        </div>
        <p className="text-sm text-ink-600">
          เลือกเครื่องมือที่ตรงกับความต้องการของคุณได้ทันที
        </p>
      </div>

      {/* Bento Grid */}
      <Reveal stagger={50} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card 1: Large Featured Card (AI Room) */}
        <Link
          href="/design"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50 via-surface to-indigo-50/30 p-6 sm:p-8 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-blue-400 hover:shadow-lift md:col-span-2 dark:border-blue-900/40 dark:from-ink-900 dark:via-ink-950 dark:to-blue-950/20"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                <Camera className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                <Sparkles className="h-3 w-3" /> ยอดนิยมอันดับ 1
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">
                AI Room Visualizer — ถ่ายรูปห้องแล้วแปลงโฉม
              </h3>
              <p className="text-sm leading-relaxed text-ink-600 sm:text-base">
                มีห้องเดิมอยู่แล้วแต่ไม่รู้จะเริ่มแต่งยังไง? ถ่ายรูปห้องของคุณ
                AI จะช่วยจัดวางเฟอร์นิเจอร์และโต๊ะคอมใหม่ให้เข้ากับขนาดห้อง
                พร้อมสรุปงบประมาณและรายการของที่ควรซื้อก่อนอย่างคุ้มค่า
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-ink-200/60 pt-4 dark:border-white/10">
            <span className="text-xs font-semibold text-ink-500">
              ฟรี · ได้ผลลัพธ์ใน 5 วินาที
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 transition-transform group-hover:translate-x-1">
              เริ่มถ่ายรูปห้อง <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>

        {/* Card 2: 3D PC Builder */}
        <Link
          href="/builder"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-ink-200/80 bg-surface p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-info hover:shadow-lift dark:border-white/10 dark:bg-surface"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <Cpu className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                <ShieldCheck className="h-3 w-3" /> เช็กความเข้ากันได้
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold tracking-tight text-ink-950">
                จัดสเปกคอม 3D
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-ink-600">
                ประกอบคอมจำลอง 3D ตรวจเช็กมิติการ์ดจอว่าชนเคสไหม
                พาวเวอร์ซัพพลายพอไหม พร้อมวัด FPS ก่อนตัดสินใจซื้อ
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-ink-200/60 pt-4 dark:border-white/10">
            <span className="text-xs font-semibold text-ink-500">
              วัด FPS เกมจริง
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-bold text-info transition-transform group-hover:translate-x-1">
              จัดสเปก <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>

        {/* Card 3: Room 3D Studio */}
        <Link
          href="/room-3d"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-ink-200/80 bg-surface p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-info hover:shadow-lift dark:border-white/10 dark:bg-surface"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400">
                <Box className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-bold text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
                <Layers className="h-3 w-3" /> สเกล 1:1
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold tracking-tight text-ink-950">
                สตูดิโอจัดห้อง 3D
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-ink-600">
                ขยับโต๊ะ เก้าอี้ เตียง และของตกแต่งในห้อง 3D สเกลจริง
                กะระยะทางเดินและมุมเปิดตู้ ไม่ให้ห้องอึดอัด
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-ink-200/60 pt-4 dark:border-white/10">
            <span className="text-xs font-semibold text-ink-500">
              หมุนดูได้ 360 องศา
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-bold text-info transition-transform group-hover:translate-x-1">
              เข้าสู่สตูดิโอ <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>

        {/* Card 4: Price Comparison */}
        <Link
          href="/categories"
          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-ink-200/80 bg-surface p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-info hover:shadow-lift md:col-span-2 dark:border-white/10 dark:bg-surface"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <Search className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                <TrendingUp className="h-3 w-3" /> เช็กราคา & สต็อก
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold tracking-tight text-ink-950">
                ค้นหาของ & เปรียบเทียบราคาหลายร้าน
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-ink-600">
                ค้นหาสินค้าชิ้นเดียวหรือจัดเซ็ต เปรียบเทียบราคาสดใหม่จากร้านค้าทางการ
                (IKEA, JIB, Advice, Mercular, ฯลฯ) พร้อมลิงก์สั่งซื้อตรง
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-ink-200/60 pt-4 dark:border-white/10">
            <span className="text-xs font-semibold text-ink-500">
              1,600+ รายการพร้อมลิงก์ซื้อจริง
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-bold text-info transition-transform group-hover:translate-x-1">
              ดูสินค้าทั้งหมด <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>
      </Reveal>
    </section>
  );
}
