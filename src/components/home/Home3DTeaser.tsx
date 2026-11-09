"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Box,
  CheckCircle2,
  Cpu,
  Eye,
  Layers,
  Maximize2,
  Moon,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react";
import Reveal from "@/components/Reveal";

interface SetupPreset {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  style: string;
  estPrice: string;
  itemCount: number;
  roomSlug: string;
  accentColor: string;
  previewBg: string;
  items: {
    name: string;
    category: string;
    price: string;
    x: number; // percentage from left
    y: number; // percentage from top
  }[];
}

const PRESETS: SetupPreset[] = [
  {
    id: "cyberpunk",
    name: "Cyberpunk Battlestation",
    tagline: "มุมเกมมิ่งสุดล้ำ แสงไฟนีออน RGB Ambient พร้อมจอโค้งและเก้าอี้แข่ง",
    badge: "ยอดนิยมในกลุ่มเกมเมอร์",
    style: "Cyberpunk Dark Mode",
    estPrice: "฿42,890",
    itemCount: 8,
    roomSlug: "cyberpunk-corner",
    accentColor: "from-blue-600 via-indigo-600 to-cyan-400",
    previewBg: "from-[#0a1128] via-[#0f1d40] to-[#140b2e]",
    items: [
      { name: "จอเกมมิ่ง 27\" OLED 240Hz", category: "จอเกมมิ่ง", price: "฿18,900", x: 48, y: 32 },
      { name: "โต๊ะเกมมิ่งดำด้าน 140x60cm", category: "โต๊ะคอม", price: "฿4,590", x: 50, y: 58 },
      { name: "เก้าอี้เกมมิ่ง Bucket Seat", category: "เก้าอี้", price: "฿6,900", x: 26, y: 65 },
      { name: "ไฟเส้น Ambient RGB Smart App", category: "ไฟ RGB", price: "฿1,290", x: 78, y: 22 },
      { name: "หูฟังเกมมิ่งไร้สาย 7.1 พร้อมแท่นวาง", category: "หูฟัง", price: "฿3,490", x: 74, y: 48 },
    ],
  },
  {
    id: "japandi",
    name: "Minimal Japandi Oak",
    tagline: "มินิมอลผสานความอบอุ่น ไม้โอ๊คแท้ โคมไฟโทนอุ่น และต้นไม้ฟอกอากาศ",
    badge: "สายแต่งห้อง & WFH",
    style: "Scandinavian Oak",
    estPrice: "฿34,450",
    itemCount: 7,
    roomSlug: "japandi-minimal",
    accentColor: "from-amber-600 via-stone-700 to-emerald-600",
    previewBg: "from-[#221c17] via-[#2d251e] to-[#1c1f1a]",
    items: [
      { name: "จอ 4K ถนอมสายตา USB-C 90W", category: "จอทำงาน", price: "฿14,900", x: 48, y: 34 },
      { name: "โต๊ะไม้โอ๊คแท้ปรับระดับ 160x80", category: "โต๊ะทำงาน", price: "฿12,900", x: 50, y: 58 },
      { name: "เก้าอี้ Ergonomic ผ้าตาข่ายระบายอากาศ", category: "เก้าอี้เพื่อสุขภาพ", price: "฿7,900", x: 26, y: 65 },
      { name: "โคมไฟตั้งโต๊ะแก้วโอปอล Warm White", category: "โคมไฟ", price: "฿890", x: 78, y: 44 },
      { name: "ต้นมอนสเตอร่าในกระถางเซรามิก", category: "ต้นไม้", price: "฿490", x: 18, y: 36 },
    ],
  },
  {
    id: "creator",
    name: "Pro Streamer & Creator",
    tagline: "สตูดิโอสตรีมมิ่งครบวงจร ขาจับจอ ไมค์บูมอาร์ม และไฟแขวนจอกันแสงสะท้อน",
    badge: "ครบเครื่องสำหรับครีเอเตอร์",
    style: "Studio Black & Slate",
    estPrice: "฿49,200",
    itemCount: 9,
    roomSlug: "creator-studio",
    accentColor: "from-sky-500 via-blue-600 to-indigo-700",
    previewBg: "from-[#0f172a] via-[#1e293b] to-[#0f172a]",
    items: [
      { name: "จอ Ultrawide 34\" Curved 165Hz", category: "จอ Ultrawide", price: "฿19,900", x: 50, y: 30 },
      { name: "แขนจับจอ Gas-Spring อลูมิเนียม", category: "ขาจับจอ", price: "฿2,190", x: 38, y: 45 },
      { name: "ไมโครโฟน Condenser + ขาบูมอาร์ม", category: "ไมโครโฟน", price: "฿4,590", x: 72, y: 40 },
      { name: "ไฟแขวนจอ ScreenBar Auto-Dimming", category: "ไฟแขวนจอ", price: "฿1,590", x: 50, y: 16 },
      { name: "โต๊ะปรับระดับไฟฟ้า Dual-Motor", category: "โต๊ะปรับระดับ", price: "฿11,500", x: 50, y: 58 },
    ],
  },
];

export function Home3DTeaser() {
  const [activeTab, setActiveTab] = useState<string>("cyberpunk");
  const [isNight, setIsNight] = useState<boolean>(true);
  const [hoveredPin, setHoveredPin] = useState<number | null>(null);

  const preset = PRESETS.find((p) => p.id === activeTab) || PRESETS[0];

  return (
    <section className="container-page" aria-labelledby="home-3d-teaser-title">
      <div className="rounded-3xl border border-ink-200/80 bg-surface p-4 sm:p-8 shadow-card dark:border-white/10">
        {/* Header & Preset Selector */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-info-bg px-3 py-1 text-xs font-bold text-info">
              <Box className="h-3.5 w-3.5" aria-hidden="true" />
              <span>สตูดิโอจำลองห้อง 3D แบบเรียลไทม์</span>
            </div>
            <h2 id="home-3d-teaser-title" className="text-h2 text-ink-950">
              ลองสัมผัสห้องจริงก่อนตัดสินใจซื้อ
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-ink-600">
              คลิกดูตัวอย่างการจัดวางสเกลจริง 1:1 ปรับแสงกลางวัน/กลางคืน
              และดูตำแหน่งเฟอร์นิเจอร์พร้อมราคาได้ทันที
            </p>
          </div>

          {/* Controls: Mode Switch & Night/Day */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveTab(p.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    activeTab === p.id
                      ? "bg-surface text-ink-950 shadow-sm dark:bg-ink-950 dark:text-white"
                      : "text-ink-600 hover:text-ink-950 dark:text-ink-300"
                  }`}
                >
                  {p.name.split(" ")[0]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsNight(!isNight)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-surface px-3 py-1.5 text-xs font-semibold text-ink-800 shadow-sm transition-colors hover:bg-ink-100 dark:border-white/10 dark:text-ink-100"
              title="สลับโหมดแสงกลางวัน / กลางคืน"
            >
              {isNight ? (
                <>
                  <Moon className="h-3.5 w-3.5 text-indigo-400" />
                  <span>โหมดกลางคืน</span>
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  <span>โหมดกลางวัน</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3D Visual Stage Box */}
        <div className="mt-6 relative overflow-hidden rounded-2xl border border-ink-200/80 bg-ink-950 shadow-pop">
          {/* Ambient Lighting Gradient */}
          <div
            className={`absolute inset-0 bg-gradient-to-br transition-all duration-700 ease-out opacity-95 ${
              isNight
                ? preset.previewBg
                : "from-[#2a374a] via-[#33465e] to-[#1e2a3b]"
            }`}
          />

          {/* Soft Grid overlay for 3D room floor feel */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* Glowing Ambient Light source */}
          <div
            className={`absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
              isNight
                ? activeTab === "cyberpunk"
                  ? "bg-cyan-500/20"
                  : activeTab === "japandi"
                  ? "bg-amber-500/20"
                  : "bg-blue-500/25"
                : "bg-amber-200/15"
            }`}
          />

          {/* Room Content Container */}
          <div className="relative min-h-[380px] sm:min-h-[460px] flex flex-col justify-between p-5 sm:p-8">
            {/* Top Badges & Preset Info */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/20">
                  <Sparkles className="h-3 w-3 text-cyan-300" />
                  {preset.badge}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {preset.name}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-md">
                  {preset.tagline}
                </p>
              </div>

              {/* Estimated Budget Tag */}
              <div className="text-right shrink-0">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">
                  งบประมาณรวม
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-cyan-300 tracking-tight">
                  {preset.estPrice}
                </span>
                <span className="text-[11px] text-slate-400 block">
                  {preset.itemCount} ชิ้นส่วนขนาดจริง
                </span>
              </div>
            </div>

            {/* Interactive Pins on the 3D Setup */}
            <div className="relative my-auto py-12 sm:py-16">
              {preset.items.map((item, idx) => {
                const isHovered = hoveredPin === idx;
                return (
                  <div
                    key={item.name}
                    className="absolute transition-transform duration-200"
                    style={{ left: `${item.x}%`, top: `${item.y}%` }}
                    onMouseEnter={() => setHoveredPin(idx)}
                    onMouseLeave={() => setHoveredPin(null)}
                  >
                    {/* Pin Dot / Trigger */}
                    <button
                      type="button"
                      aria-label={item.name}
                      className="group relative flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink-950 shadow-lift transition-transform hover:scale-125 focus:outline-none"
                    >
                      <span className="absolute h-full w-full rounded-full bg-cyan-400 opacity-75 animate-ping pointer-events-none" />
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                    </button>

                    {/* Pin Card Tooltip */}
                    <div
                      className={`pointer-events-none absolute left-1/2 top-9 -translate-x-1/2 z-20 w-44 rounded-xl bg-ink-900/90 backdrop-blur-md p-2.5 text-left text-white shadow-pop border border-white/15 transition-all duration-200 ${
                        isHovered
                          ? "opacity-100 scale-100 translate-y-0"
                          : "opacity-0 scale-95 -translate-y-1 sm:opacity-90 sm:scale-100 sm:translate-y-0"
                      }`}
                    >
                      <span className="block text-[10px] font-medium text-cyan-300">
                        {item.category}
                      </span>
                      <span className="block text-xs font-bold leading-tight text-white line-clamp-1">
                        {item.name}
                      </span>
                      <span className="mt-1 block text-xs font-extrabold text-emerald-300">
                        {item.price}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Bar: Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10">
              <div className="flex items-center gap-4 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  สเกล 1:1 ตรงตามแคตตาล็อกจริง
                </span>
                <span className="inline-flex items-center gap-1 hidden sm:inline-flex">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  ตรวจสอบระยะกางขาโต๊ะและขอบจอ
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Link
                  href={`/rooms/${preset.roomSlug}`}
                  className="inline-flex min-h-11 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-md px-4 text-xs font-bold text-white transition-colors hover:bg-white/25 border border-white/20"
                >
                  <Eye className="h-3.5 w-3.5" /> ดูของในห้อง
                </Link>

                <Link
                  href="/room-3d"
                  className="inline-flex min-h-11 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-xs font-bold text-white shadow-lift transition-transform hover:scale-105"
                >
                  <Box className="h-4 w-4" /> ปรับแต่งต่อในสตูดิโอ 3D
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
