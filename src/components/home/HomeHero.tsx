import Link from "next/link";
import { ArrowRight, Box, Camera, Check, Cpu, ShieldCheck, Sparkles, Zap } from "lucide-react";

/** หัวหน้าแรกสไตล์ Next-Gen Tech Studio: ชัดเจน มีระดับ และน่าเชื่อถือ */
export function HomeHero() {
  return (
    <section className="relative overflow-hidden pt-6 pb-2 sm:pt-12 sm:pb-6" aria-labelledby="home-hero-title">
      {/* Background Radial Glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -z-10 h-[480px] w-full max-w-5xl opacity-40 blur-3xl dark:opacity-25"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 10%, rgba(0, 80, 255, 0.35), rgba(56, 189, 248, 0.15) 50%, transparent 80%)",
        }}
        aria-hidden="true"
      />

      <div className="container-page">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          {/* Top Pill Announcement */}
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/80 px-4 py-1.5 text-xs font-semibold text-ink-900 shadow-sm backdrop-blur-md transition-all hover:border-blue-300 dark:border-blue-900/60 dark:bg-ink-900/80 dark:text-blue-200">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="font-bold text-info">ใหม่</span>
            <span className="text-ink-400 dark:text-ink-600">|</span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              AI จัดห้อง & ประกอบสเปกคอม 3D ขนาดจริง 1:1
            </span>
          </div>

          {/* Main Headline */}
          <h1
            id="home-hero-title"
            className="text-display text-3xl font-extrabold tracking-tight text-ink-950 sm:text-5xl sm:leading-[1.15]"
          >
            เนรมิตห้องคอมในฝัน{" "}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
              สเกลจริง 1:1
            </span>{" "}
            ด้วยพลัง AI
          </h1>

          {/* Subtitle */}
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-ink-600 sm:text-lg">
            ถ่ายรูปห้องเดิม หรือเลือกสเปกคอมที่ชอบ — AI ช่วยจัดวางของสเกลจริง เช็กระยะทางเดิน
            และรวมราคาสินค้าจริงจากร้านค้าชั้นนำกว่า 1,600+ รายการในไทย
          </p>

          {/* Dual CTAs */}
          <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row sm:gap-4">
            <Link
              href="/design"
              className="btn min-h-13 w-full sm:w-auto px-8 text-base font-bold text-white shadow-lift ai-gradient transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Camera className="h-5 w-5" aria-hidden="true" />
              ถ่ายรูปห้อง → AI จัดให้
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            <Link
              href="/room-3d"
              className="btn btn-secondary min-h-13 w-full sm:w-auto px-6 text-base font-bold text-ink-900 shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98] dark:text-white"
            >
              <Box className="h-5 w-5 text-info" aria-hidden="true" />
              เปิดสตูดิโอจัดห้อง 3D
            </Link>
          </div>

          {/* Trust Metrics Pill Strip */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs font-semibold text-ink-600 sm:text-sm">
            <div className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <span>1,600+ สินค้าจริงในไทย</span>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <span>สัดส่วน 1:1 ระดับมิลลิเมตร</span>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <span>เช็กราคา & สเปกคอมเรียลไทม์</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
