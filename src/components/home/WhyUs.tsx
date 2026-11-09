import { BellRing, Eye, Layers, Scale, ShieldCheck, Zap } from "lucide-react";
import Reveal from "@/components/Reveal";

const POINTS = [
  {
    icon: Scale,
    title: "เปรียบเทียบราคาหลายร้าน",
    text: "รวบรวมและเทียบราคากลางจากร้านค้าทางการ (IKEA, JIB, Advice, Mercular) ในที่เดียว",
    badge: "ประหยัดกว่า",
  },
  {
    icon: ShieldCheck,
    title: "เช็กความเข้ากันได้ 100%",
    text: "ระบบคำนวณมิติการ์ดจอ ขนาดเคส และพาวเวอร์ซัพพลาย ป้องกันการสั่งซื้อผิดสเปก",
    badge: "ไม่พลาด",
  },
  {
    icon: Layers,
    title: "จำลองสเกลจริง 1:1 ก่อนจ่าย",
    text: "จัดวางโต๊ะ ตู้ เตียง และจอคอมในพื้นที่ห้องจริง กะระยะทางเดินได้แม่นยำระดับมิลลิเมตร",
    badge: "เห็นภาพจริง",
  },
  {
    icon: BellRing,
    title: "ติดตามราคา & ดีลลดพิเศษ",
    text: "ระบบแจ้งเตือนอัตโนมัติเมื่อไอเทมที่คุณหมายตาไว้มีโปรโมชั่นหรือราคาปรับลดลง",
    badge: "แจ้งเตือนฟรี",
  },
];

export function WhyUs() {
  return (
    <section className="container-page space-y-6" aria-labelledby="home-why-title">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-info">
            ทำไมต้อง ComproNext
          </span>
          <h2 id="home-why-title" className="text-h2 text-ink-950">
            ประสบการณ์จัดห้องและสเปกคอมที่ดีกว่า
          </h2>
        </div>
        <p className="text-sm text-ink-600">
          ออกแบบมาเพื่อช่วยคุณตัดสินใจซื้อได้อย่างมั่นใจ
        </p>
      </div>

      <Reveal as="ul" stagger={50} className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {POINTS.map(({ icon: Icon, title, text, badge }) => (
          <li
            key={title}
            className="group relative flex flex-col justify-between rounded-3xl border border-ink-200/80 bg-surface p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-info hover:shadow-lift dark:border-white/10"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-info-bg text-info shadow-sm transition-transform group-hover:scale-110"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-bold text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                  {badge}
                </span>
              </div>
              <div className="space-y-1">
                <p className="font-display text-base font-bold text-ink-950">{title}</p>
                <p className="text-xs sm:text-sm leading-relaxed text-ink-600">{text}</p>
              </div>
            </div>
          </li>
        ))}
      </Reveal>
    </section>
  );
}
