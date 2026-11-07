"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Mail, ShieldCheck, Users, X } from "lucide-react";
import type { SiteSettingsRecord } from "@/lib/types";
import { useFocusTrap } from "./useFocusTrap";
import { FeedbackPrompt } from "./FeedbackPrompt";

/** ปุ่มทัก LINE OA (ตั้ง NEXT_PUBLIC_LINE_OA_URL เช่น https://lin.ee/xxxx) */
const LINE_OA = process.env.NEXT_PUBLIC_LINE_OA_URL || "";

const CREATORS_TEAM = [
  {
    number: "01",
    name: "นายธีร์กวิน สัตย์โตนนท์",
    email: "x2001227@gmail.com",
    role: "คนออกแบบหลัก คิดกระบวนการ และออกแบบหน้าต่างๆ",
  },
  {
    number: "02",
    name: "นายจีรศักดิ์ เผือกคล้าย",
    email: "jirasak30759@gmail.com",
    role: "คนออกแบบคนที่สอง ออกแบบยูไอ ปรับระบบหลัง",
  },
  {
    number: "03",
    name: "นายสิริชัย จอมอ๊อด",
    email: "khuanjankhuam@gmail.com",
    role: "ฝ่ายดูแลระบบหลังบ้าน ดูแลเรื่องเว็บและบัคต่างๆ",
  },
];

const DEFAULT_LINE_URL = "https://line.me/ti/p/scM55NWXmi";
const DEFAULT_TIKTOK_URL = "https://www.tiktok.com/@2479ice?_r=1&_t=ZS-9AzCf4XCffI";

/** ลิงก์ในส่วนท้าย: มือถือแตะง่าย (≥44px), คอมกระชับ */
const LINK = "inline-flex min-h-11 items-center py-1 transition-colors hover:text-info md:min-h-0";

const ROOM_LINKS = [
  { href: "/rooms?style=gaming", label: "ห้องเกมมิ่ง (Gaming Setup)" },
  { href: "/rooms?style=work", label: "ห้องทำงาน (Workstation)" },
  { href: "/rooms?style=health", label: "ห้องเพื่อสุขภาพ (Ergonomic & Health)" },
  { href: "/rooms?style=creator", label: "ห้องตัดต่อ-ครีเอเตอร์ (Creator Studio)" },
  { href: "/rooms?style=student", label: "ห้องนักเรียนงบประหยัด (Student Budget)" },
  { href: "/rooms?style=minimal", label: "ห้องสไตล์มินิมอล (Minimal Clean)" },
];

const TOOL_LINKS = [
  { href: "/design", label: "AI จัดห้องจากรูปถ่าย" },
  { href: "/room-3d", label: "จัดห้อง 3D (My Dream Setup)" },
  { href: "/builder", label: "จัดสเปกคอม 3D & ทดสอบ FPS เกม" },
  { href: "/cart", label: "ตะกร้าสินค้า" },
  { href: "/stores", label: "ร้านค้า & รีวิว" },
  { href: "/monitors", label: "เลือกจอคอมตามสายงาน (Hz / PPI)" },
  { href: "/compare", label: "ตารางเปรียบเทียบสเปกสินค้า" },
];

const PLATFORM_LINKS = [
  { href: "/account", label: "บัญชีสมาชิก" },
  { href: "/returns", label: "แจ้งปัญหาสินค้า / ติดตามเคส" },
  { href: "/partner/join", label: "สมัครเป็นร้านพาร์ตเนอร์ (ฟรี)" },
  { href: "/partner", label: "หลังร้านพาร์ตเนอร์" },
  { href: "/admin", label: "ระบบผู้ดูแลหลังบ้าน (Admin)" },
  { href: "/about", label: "เกี่ยวกับเรา" },
  { href: "/terms", label: "ข้อกำหนดการใช้งาน" },
  { href: "/privacy", label: "นโยบายความเป็นส่วนตัว (PDPA)" },
  { href: "/privacy#consent", label: "ตั้งค่าคุกกี้" },
  { href: "/categories", label: "แคตตาล็อกสินค้าทั้งหมด" },
  { href: "/saved", label: "ห้องและสเปกที่บันทึกไว้" },
];

export function SiteFooter({ siteSettings }: { siteSettings?: SiteSettingsRecord }) {
  const [showCreatorsModal, setShowCreatorsModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeModal = useCallback(() => setShowCreatorsModal(false), []);
  useFocusTrap(modalRef, showCreatorsModal, closeModal);

  const emailToDisplay = siteSettings?.contactEmail?.trim() || "";
  const phoneToDisplay = siteSettings?.contactPhone?.trim() || "";

  const lineUrl =
    !siteSettings?.socialLinks?.line ||
    siteSettings.socialLinks.line === "https://line.me/R/ti/p/@compronext"
      ? DEFAULT_LINE_URL
      : siteSettings.socialLinks.line;

  const tiktokUrl =
    !siteSettings?.socialLinks?.tiktok ||
    siteSettings.socialLinks.tiktok === "https://tiktok.com/@compronext"
      ? DEFAULT_TIKTOK_URL
      : siteSettings.socialLinks.tiktok;

  return (
    <footer className="mt-16 border-t border-ink-200 bg-surface text-ink-700">
      <div className="container-page py-12 md:py-16">
        <div className="mb-10 grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
          <FeedbackPrompt />
          {LINE_OA && (
            <a href={LINE_OA} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#06C755] px-5 text-sm font-bold text-white hover:brightness-95">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
                <path d="M12 3C6.48 3 2 6.58 2 11c0 3.95 3.58 7.26 8.42 7.89.33.07.78.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1 .88.55 1.08-.46 5.83-3.43 7.95-5.88C21.53 14.24 22 12.67 22 11c0-4.42-4.48-8-10-8z" />
              </svg>
              ถามทีมงานทาง LINE
            </a>
          )}
        </div>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:gap-8">
          <div className="space-y-4 sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5" aria-label="ComproNext หน้าแรก">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info font-display font-bold text-white" aria-hidden="true">
                {siteSettings?.logoText || "CN"}
              </span>
              <span className="font-display text-lg font-bold text-ink-950" aria-hidden="true">
                {siteSettings?.siteName && siteSettings.siteName !== "ComproNext" ? (
                  siteSettings.siteName
                ) : (
                  <>
                    Compro<span className="text-info">Next</span>
                  </>
                )}
              </span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-ink-600">
              {siteSettings?.description ||
                "แพลตฟอร์มรวมไอเดียจัดห้องคอมพิวเตอร์ ตรวจสอบความเข้ากันได้ของโต๊ะ-จอ-พอร์ต พร้อมระบบจัดสเปกคอม 3D และจำลอง FPS เกมเพื่อการตัดสินใจซื้อที่มั่นใจที่สุด"}
            </p>
            {(emailToDisplay || phoneToDisplay) && (
              <div className="space-y-0.5 text-xs text-ink-500">
                {emailToDisplay && <p>อีเมล: {emailToDisplay}</p>}
                {phoneToDisplay && <p>โทร: {phoneToDisplay}</p>}
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              <a href={lineUrl} target="_blank" rel="noopener noreferrer" className="chip min-h-11 px-4">
                LINE<span className="sr-only"> (เปิดแท็บใหม่)</span>
              </a>
              <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className="chip min-h-11 px-4">
                TikTok<span className="sr-only"> (เปิดแท็บใหม่)</span>
              </a>
            </div>
          </div>

          <nav aria-labelledby="footer-rooms">
            <h2 id="footer-rooms" className="mb-3 text-sm font-bold text-ink-950">สำรวจห้องตัวอย่างตามสไตล์</h2>
            <ul className="space-y-1 text-sm text-ink-600">
              {ROOM_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={LINK}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-tools">
            <h2 id="footer-tools" className="mb-3 text-sm font-bold text-ink-950">เครื่องมือ</h2>
            <ul className="space-y-1 text-sm text-ink-600">
              <li>
                <Link href="/design" className={`${LINK} font-semibold text-info`}>AI จัดห้องจากรูปห้องของคุณ</Link>
              </li>
              {TOOL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={LINK}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-platform">
            <h2 id="footer-platform" className="mb-3 text-sm font-bold text-ink-950">ระบบสมาชิก & ข้อมูลแพลตฟอร์ม</h2>
            <ul className="space-y-1 text-sm text-ink-600">
              {PLATFORM_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={LINK}>{l.label}</Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setShowCreatorsModal(true)}
                  aria-haspopup="dialog"
                  className={`${LINK} cursor-pointer gap-1.5 text-left font-semibold text-info hover:underline`}
                >
                  <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>รายชื่อผู้สร้างเว็บไซต์ (คณะผู้จัดทำ)</span>
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-ink-200 pt-6 text-xs leading-relaxed text-ink-500 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <p className="max-w-2xl">
            หมายเหตุ: ComproNext เป็นแพลตฟอร์มตัวกลาง (Affiliate) ไม่ได้จำหน่ายหรือสต็อกสินค้าเอง การสั่งซื้อและรับประกันดำเนินการกับร้านค้าต้นทางโดยตรง
          </p>
          <p className="shrink-0">{siteSettings?.copyrightText || `© ${new Date().getFullYear()} ComproNext Thailand. All rights reserved.`}</p>
        </div>
      </div>

      {/* พอร์ทัลไป body: footer ใช้ content-visibility (contain paint) ทำให้ position:fixed ข้างในไม่อิงจอ */}
      {showCreatorsModal && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="creators-modal-title"
          onClick={closeModal}
        >
          <div
            ref={modalRef}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl space-y-5 overflow-y-auto overscroll-contain rounded-2xl border border-ink-200 bg-surface p-5 shadow-pop sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-ink-200 pb-4">
              <div className="min-w-0">
                <span className="badge mb-2 bg-info text-white">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>CREATORS & DEVELOPMENT TEAM</span>
                </span>
                <h2 id="creators-modal-title" className="font-display text-xl font-bold text-ink-950">
                  รายชื่อผู้สร้างและพัฒนาเว็บไซต์ ComproNext
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="icon-btn tap-target -mr-2 -mt-1 shrink-0 border-transparent"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <ul className="space-y-3">
              {CREATORS_TEAM.map((person) => (
                <li
                  key={person.number}
                  className="flex flex-col justify-between gap-3 rounded-card border border-ink-200 bg-ink-50/70 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-info font-display text-xs font-bold text-white" aria-hidden="true">
                      {person.number}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-display text-base font-bold text-ink-950">{person.name}</p>
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-info">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{person.role}</span>
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0 pl-11 sm:pl-0 sm:text-right">
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-sm border border-ink-200 bg-surface px-2.5 py-1 font-mono text-xs text-ink-800">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-info" aria-hidden="true" />
                      <span className="truncate">อีเมล {person.email}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 pt-4">
              <Link href="/creators" onClick={closeModal} className="btn btn-outline min-h-11">
                เปิดหน้าผู้สร้างแบบเต็มจอ
              </Link>
              <button type="button" onClick={closeModal} className="btn btn-primary min-h-11">
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </footer>
  );
}
