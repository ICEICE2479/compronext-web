import type { Metadata } from "next";
import Link from "next/link";
import { GLOSSARY, GUIDE_SECTIONS } from "@/lib/builder/guide";

const TITLE = "คู่มือเลือกชิ้นส่วนคอมสำหรับมือใหม่";
const DESCRIPTION = "อธิบายซีพียู การ์ดจอ เมนบอร์ด แรม SSD พาวเวอร์ เคส ชุดระบายความร้อน และจอ แบบเข้าใจง่าย พร้อมเช็คลิสต์ความเข้ากันได้และคำศัพท์";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/builder/guide" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/builder/guide", type: "article", locale: "th_TH" },
};

export default function BuilderGuidePage() {
  return (
    <div className="container-page space-y-8 py-8">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">{TITLE}</h1>
        <p className="max-w-2xl text-sm text-ink-600">{DESCRIPTION}</p>
        <Link href="/builder" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#0050ff] underline-offset-2 hover:underline">
          ← กลับไปหน้าจัดสเปก
        </Link>
      </header>

      <nav aria-label="สารบัญ" className="rounded-2xl border border-ink-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-bold text-ink-950">สารบัญ</h2>
        <ol className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDE_SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="flex min-h-11 items-center text-sm text-[#0050ff] underline-offset-2 hover:underline">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
          <li>
            <a href="#glossary" className="flex min-h-11 items-center text-sm text-[#0050ff] underline-offset-2 hover:underline">
              {GUIDE_SECTIONS.length + 1}. คำศัพท์
            </a>
          </li>
        </ol>
      </nav>

      <div className="space-y-6">
        {GUIDE_SECTIONS.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24 rounded-2xl border border-ink-200 bg-white p-5">
            <h2 id={`${s.id}-h`} className="font-display text-xl font-bold text-ink-950">
              {s.title}
            </h2>
            <p className="mt-1 text-sm text-ink-600">{s.summary}</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-800">
              {s.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {s.howToChoose.length > 0 && (
              <div className="mt-4 rounded-xl bg-[#0050ff]/5 p-4">
                <h3 className="text-sm font-bold text-[#0050ff]">เลือกยังไง / ต้องเช็ก</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-800">
                  {s.howToChoose.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}

        <section id="glossary" aria-labelledby="glossary-h" className="scroll-mt-24 rounded-2xl border border-ink-200 bg-white p-5">
          <h2 id="glossary-h" className="font-display text-xl font-bold text-ink-950">
            คำศัพท์
          </h2>
          <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {GLOSSARY.map((g) => (
              <div key={g.key} id={`term-${g.key}`} className="scroll-mt-24">
                <dt className="text-sm font-bold text-ink-950">{g.term}</dt>
                <dd className="text-sm text-ink-700">{g.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
