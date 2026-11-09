"use client";

import { useEffect, useState } from "react";
import { Box, PenTool, Ruler, ScanLine, Sparkles, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import { ROOM_LIMITS, roomLabel, type RoomSize } from "@/lib/room-planner";

const RoomMeasureTool = dynamic(() => import("./RoomMeasureTool").then((m) => m.RoomMeasureTool), { ssr: false });
const RoomShapeTool = dynamic(() => import("./RoomShapeTool").then((m) => m.RoomShapeTool), { ssr: false });

type Dim = "w" | "d" | "h";
const FIELDS: Array<{ key: Dim; label: string; sub: string; min: number; max: number }> = [
  { key: "w", label: "กว้าง (ม.)", sub: "ผนังที่จะวางโต๊ะ", min: ROOM_LIMITS.min, max: ROOM_LIMITS.max },
  { key: "d", label: "ลึก (ม.)", sub: "จากผนังนั้นถึงฝั่งตรงข้าม", min: ROOM_LIMITS.min, max: ROOM_LIMITS.max },
  { key: "h", label: "สูง (ม.)", sub: "พื้นถึงฝ้า", min: ROOM_LIMITS.hMin, max: ROOM_LIMITS.hMax },
];

/** กรอกขนาดห้องที่วัดมา (เมตร) — ตรงตามแบบ UI ขนาดห้องที่วัดมา 100% */
export function RoomSizeInputs({
  room,
  set,
  onChange,
  initialTool,
}: {
  room: RoomSize;
  set: boolean;
  onChange: (r: RoomSize, jumpTo3D?: boolean) => void;
  initialTool?: "measure" | "shape" | null;
}) {
  const [draft, setDraft] = useState<Record<Dim, string> | null>(null);
  const [measuring, setMeasuring] = useState(initialTool === "measure");
  const [shaping, setShaping] = useState(initialTool === "shape");
  const val = draft ?? {
    w: String(Number((room.w / 100).toFixed(2))),
    d: String(Number((room.d / 100).toFixed(2))),
    h: String(Number((room.h / 100).toFixed(2))),
  };

  useEffect(() => {
    if (initialTool === "measure") setMeasuring(true);
    if (initialTool === "shape") setShaping(true);
  }, [initialTool]);

  function parseRoom(next: Record<Dim, string>): RoomSize | null {
    const cm = (k: Dim) => Math.round(Number(next[k].replace(",", ".")) * 100);
    const r: RoomSize = { ...room, w: cm("w"), d: cm("d"), h: cm("h") };
    if (r.w !== room.w || r.d !== room.d) delete r.shape;
    const ok = FIELDS.every((f) => Number.isFinite(r[f.key]) && r[f.key] >= f.min && r[f.key] <= f.max);
    return ok ? r : null;
  }

  function commit(next: Record<Dim, string>) {
    const r = parseRoom(next);
    if (r) onChange(r, false);
  }

  const bad = (f: (typeof FIELDS)[number]) => {
    const v = Math.round(Number(val[f.key].replace(",", ".")) * 100);
    return !Number.isFinite(v) || v < f.min || v > f.max;
  };

  const areaM2 = ((room.w / 100) * (room.d / 100)).toFixed(2);
  const currentW = (room.w / 100).toFixed(1);
  const currentD = (room.d / 100).toFixed(1);
  const currentH = (room.h / 100).toFixed(1);

  return (
    <div className="space-y-3 rounded-2xl border border-ink-800/80 bg-ink-950 p-4 text-white shadow-xl">
      {/* ส่วนหัว: ขนาดห้องที่วัดมา + สถานะตามแปลน */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-sky-400" />
          <h4 className="font-display text-sm font-bold tracking-tight text-white">ขนาดห้องที่วัดมา</h4>
        </div>
        <div className="font-mono text-xs font-semibold text-emerald-400">
          ใช้ ตามแปลน {areaM2} ตร.ม. • {currentW} × {currentD} ม. (สูง {currentH} ม.)
        </div>
      </div>

      {/* 3 กล่องกรอกตัวเลขขนาด กว้าง / ลึก / สูง */}
      <div className="grid grid-cols-3 gap-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1 text-center">
            <span className="block text-xs font-semibold text-ink-300">{f.label}</span>
            <div
              className={`flex h-14 items-center justify-center rounded-xl border bg-black/40 px-2 py-1 transition-all ${
                bad(f) ? "border-rose-500 bg-rose-950/20" : "border-white/15 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/20"
              }`}
            >
              <input
                inputMode="decimal"
                value={val[f.key]}
                onChange={(e) => {
                  const next = { ...val, [f.key]: e.target.value.replace(/[^\d.,]/g, "").slice(0, 5) };
                  setDraft(next);
                  commit(next);
                }}
                onBlur={() => setDraft(null)}
                aria-invalid={bad(f)}
                className={`w-full bg-transparent text-center font-mono text-2xl font-extrabold text-white focus:outline-none ${
                  bad(f) ? "text-rose-400" : ""
                }`}
              />
            </div>
            <span className="block text-[10px] text-ink-400">{f.sub}</span>
          </div>
        ))}
      </div>

      {/* ปุ่มหลัก: สร้างห้อง 3D ตามขนาดนี้เลย */}
      <button
        type="button"
        onClick={() => {
          const r = parseRoom(val) ?? room;
          onChange(r, true);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600/90 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-sky-500 hover:shadow-sky-500/20 active:scale-[0.99]"
      >
        <Box className="h-4 w-4" />
        <Zap className="h-4 w-4 fill-amber-300 text-amber-300" />
        <span>
          สร้างห้อง 3D ตามขนาดนี้เลย ({currentW}×{currentD} ม.)
        </span>
      </button>

      {/* ปุ่มตัวเลือกรอง: วัดด้วยกล้องมือถือ & วาดรูปห้องใหม่ */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setMeasuring(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 py-2.5 text-xs font-semibold text-white/90 transition-all hover:border-white/40 hover:bg-white/10"
        >
          <ScanLine className="h-4 w-4 text-sky-400" />
          <span>ไม่มีตลับเมตร? วัดด้วยกล้องมือถือ</span>
        </button>

        <button
          type="button"
          onClick={() => setShaping(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 py-2.5 text-xs font-semibold text-white/90 transition-all hover:border-white/40 hover:bg-white/10"
        >
          <PenTool className="h-4 w-4 text-amber-400" />
          <span>{room.shape ? "วัดรูปห้องใหม่ (ตอนนี้ใช้แปลนที่วัดไว้)" : "วาดหรือเลือกแปลนห้องใหม่"}</span>
        </button>
      </div>

      {/* คำอธิบายวิธีวัด 4 แบบ */}
      <p className="text-center text-[11px] text-white/60">
        วัดได้ 4 แบบ: นับกระเบื้อง · กล้องวัดสด · ถ่ายรูปเทียบกระดาษ A4 · ส่อง AR
      </p>

      {shaping && <RoomShapeTool room={room} onApply={(r) => onChange(r, true)} onClose={() => setShaping(false)} />}
      {measuring && <RoomMeasureTool room={room} onApply={(r) => onChange(r, true)} onClose={() => setMeasuring(false)} />}
    </div>
  );
}
