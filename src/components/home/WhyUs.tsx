import { BellRing, Eye, Scale, ShieldCheck } from "lucide-react";
import Reveal from "@/components/Reveal";

const POINTS = [
  { icon: Scale, title: "เทียบราคาหลายร้าน", text: "เห็นราคาจากหลายร้านในที่เดียว" },
  { icon: ShieldCheck, title: "เช็กว่าเข้ากันได้ก่อนซื้อ", text: "ช่วยเช็กข้อมูลความเข้ากันได้ก่อนเลือกซื้อ" },
  { icon: Eye, title: "เห็นภาพก่อนจ่าย", text: "ลองจัดห้องและสเปกให้เห็นก่อนตัดสินใจ" },
  { icon: BellRing, title: "ติดตามราคา", text: "แจ้งเตือนเมื่อสินค้าที่ชอบราคาลด" },
];

export function WhyUs() {
  return (
    <section className="container-page space-y-5" aria-labelledby="home-why-title">
      <h2 id="home-why-title" className="text-h2 text-ink-950">ทำไมต้อง ComproNext</h2>
      <Reveal as="ul" stagger={60} className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-surface p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-bg text-info" aria-hidden="true">
              <Icon className="h-5 w-5" />
            </span>
            <div className="space-y-0.5">
              <p className="font-display text-base font-bold text-ink-950">{title}</p>
              <p className="text-sm leading-relaxed text-ink-600">{text}</p>
            </div>
          </li>
        ))}
      </Reveal>
    </section>
  );
}
