import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Code2, Layout, Mail, ShieldCheck, Sparkles, Users } from "lucide-react";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "ทีมผู้พัฒนา",
  description: "รู้จักทีมผู้สร้างและพัฒนา ComproNext พร้อมช่องทางติดต่อทีมงาน",
};

export const CREATORS_LIST = [
  {
    id: "creator-1",
    number: "01",
    name: "นายธีร์กวิน สัตย์โตนนท์",
    email: "x2001227@gmail.com",
    roleTitle: "คนออกแบบหลัก (Lead Designer & Process Architect)",
    responsibility: "คนออกแบบหลัก คิดกระบวนการ และออกแบบหน้าต่างๆ",
    badge: "Lead Designer & Process",
  },
  {
    id: "creator-2",
    number: "02",
    name: "นายจีรศักดิ์ เผือกคล้าย",
    email: "jirasak30759@gmail.com",
    roleTitle: "คนออกแบบคนที่สอง (UI Designer & Backend Tuner)",
    responsibility: "คนออกแบบคนที่สอง ออกแบบยูไอ ปรับระบบหลัง",
    badge: "UI & System Design",
  },
  {
    id: "creator-3",
    number: "03",
    name: "นายสิริชัย จอมอ๊อด",
    email: "khuanjankhuam@gmail.com",
    roleTitle: "ฝ่ายดูแลระบบหลังบ้าน (Backend & QA Engineer)",
    responsibility: "ฝ่ายดูแลระบบหลังบ้าน ดูแลเรื่องเว็บและบัคต่างๆ",
    badge: "Backend & Bug Fixing",
  },
];

export default function CreatorsPage() {
  return (
    <div className="container-page space-y-8 py-8 animate-reveal">
      <div className="card p-6 sm:p-8 border-l-4 border-l-info space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-info text-white">
              <Users className="h-3.5 w-3.5" />
              <span>COMPRONEXT CREATORS & DEVELOPMENT TEAM</span>
            </span>
            <span className="badge bg-ink-100 text-ink-800">คณะผู้จัดทำและพัฒนาแพลตฟอร์ม</span>
          </div>
          <Link href="/" className="btn btn-outline btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>กลับหน้าหลัก</span>
          </Link>
        </div>

        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">
          คณะผู้สร้างและพัฒนาเว็บไซต์ ComproNext
        </h1>
        <p className="max-w-3xl text-sm text-ink-600">
          รายชื่อผู้พัฒนา ออกแบบกระบวนการ ยูสเซอร์อินเทอร์เฟซ และดูแลระบบหลังบ้านของแพลตฟอร์ม ComproNext
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {CREATORS_LIST.map((member, idx) => (
          <div
            key={member.id}
            className="market-card p-6 flex flex-col justify-between space-y-4 border-t-4 border-t-info"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm bg-info text-white font-display text-sm font-bold">
                  {member.number}
                </span>
                <span className="badge bg-info-bg text-info">
                  {idx === 0 ? (
                    <Sparkles className="h-3.5 w-3.5" />
                  ) : idx === 1 ? (
                    <Layout className="h-3.5 w-3.5" />
                  ) : (
                    <Code2 className="h-3.5 w-3.5" />
                  )}
                  <span>{member.badge}</span>
                </span>
              </div>

              <div>
                <h2 className="font-display text-lg font-bold text-ink-950">{member.name}</h2>
                <p className="mt-1 text-sm font-semibold text-info">{member.responsibility}</p>
              </div>
            </div>

            <div className="rounded-sm border border-ink-200 bg-ink-50 p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-ink-700">
                <Mail className="h-3.5 w-3.5 text-info shrink-0" aria-hidden="true" />
                <span className="font-semibold">อีเมล:</span>
                <span className="font-mono text-ink-950 break-all">{member.email}</span>
              </div>
              <div className="flex items-center gap-2 text-ink-600">
                <ShieldCheck className="h-3.5 w-3.5 text-ok shrink-0" aria-hidden="true" />
                <span>หน้าที่: {member.responsibility}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-ink-50/70">
        <div className="space-y-1 text-xs text-ink-700">
          <p className="font-display text-sm font-bold text-ink-950">ช่องทางติดต่อหลัก ComproNext</p>
          <p>ติดต่อทีมงานผ่าน LINE หรือ TikTok</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://line.me/ti/p/scM55NWXmi"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
          >
            ติดต่อผ่าน LINE
          </a>
          <a
            href="https://www.tiktok.com/@2479ice?_r=1&_t=ZS-9AzCf4XCffI"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
          >
            TikTok Official
          </a>
        </div>
      </div>
    </div>
  );
}
