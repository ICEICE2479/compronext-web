"use client";

import { useState } from "react";
import { PenTool, Ruler, ScanLine } from "lucide-react";
import dynamic from "next/dynamic";

const RoomMeasureTool = dynamic(() => import("./RoomMeasureTool").then((m) => m.RoomMeasureTool), { ssr: false });
const RoomShapeTool = dynamic(() => import("./RoomShapeTool").then((m) => m.RoomShapeTool), { ssr: false });
import { ROOM_LIMITS, roomLabel, type RoomSize } from "@/lib/room-planner";

type Dim = "w" | "d" | "h";
const FIELDS: Array<{ key: Dim; label: string; hint: string; min: number; max: number }> = [
  { key: "w", label: "กว้าง", hint: "ผนังที่จะวางโต๊ะ", min: ROOM_LIMITS.min, max: ROOM_LIMITS.max },
  { key: "d", label: "ลึก", hint: "จากผนังนั้นถึงฝั่งตรงข้าม", min: ROOM_LIMITS.min, max: ROOM_LIMITS.max },
  { key: "h", label: "สูง", hint: "พื้นถึงฝ้า", min: ROOM_LIMITS.hMin, max: ROOM_LIMITS.hMax },
];

/** กรอกขนาดห้องที่วัดมา (เมตร) — ส่งให้ AI เลือกของที่พอดีห้อง และใช้สร้างห้อง 3D */
export function RoomSizeInputs({ room, set, onChange }: { room: RoomSize; set: boolean; onChange: (r: RoomSize) => void }) {
  // เก็บค่าที่กำลังพิมพ์ไว้ก่อน (พิมพ์ "2." ได้โดยไม่เด้ง)
  const [draft, setDraft] = useState<Record<Dim, string> | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [shaping, setShaping] = useState(false);
  const val = draft ?? { w: String(room.w / 100), d: String(room.d / 100), h: String(room.h / 100) };

  function commit(next: Record<Dim, string>) {
    const cm = (k: Dim) => Math.round(Number(next[k].replace(",", ".")) * 100);
    const r: RoomSize = { ...room, w: cm("w"), d: cm("d"), h: cm("h") };
    // แก้กว้าง/ลึกเอง = เลิกใช้รูปห้องตามแปลน (กลับเป็นสี่เหลี่ยม)
    if (r.w !== room.w || r.d !== room.d) delete r.shape;
    const ok = FIELDS.every((f) => Number.isFinite(r[f.key]) && r[f.key] >= f.min && r[f.key] <= f.max);
    if (ok) onChange(r);
  }

  const bad = (f: (typeof FIELDS)[number]) => {
    const v = Math.round(Number(val[f.key].replace(",", ".")) * 100);
    return !Number.isFinite(v) || v < f.min || v > f.max;
  };

  return (
    <div className="space-y-2 rounded-xl border border-ink-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-800">
          <Ruler className="h-4 w-4 text-info" /> ขนาดห้องที่วัดมา
        </p>
        <span className={`text-[11px] ${set ? "font-semibold text-ok" : "text-ink-500"}`}>{set ? `ใช้ ${roomLabel(room)}` : "ไม่บังคับ — ช่วยให้เลือกของพอดีห้อง"}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="space-y-0.5">
            <span className="block text-[11px] font-semibold text-ink-700">{f.label} (ม.)</span>
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
              className={`input h-10 w-full text-center ${bad(f) ? "border-bad" : ""}`}
            />
            <span className="block text-[10px] leading-tight text-ink-500">{f.hint}</span>
          </label>
        ))}
      </div>
      <button type="button" onClick={() => setMeasuring(true)} className="btn btn-outline h-10 w-full rounded-full text-sm">
        <ScanLine className="h-4 w-4" /> ไม่มีตลับเมตร? วัดด้วยกล้องมือถือ
      </button>
      <button type="button" onClick={() => setShaping(true)} className="btn btn-outline h-10 w-full rounded-full text-sm">
        <PenTool className="h-4 w-4" /> {room.shape ? "วัดรูปห้องใหม่ (ตอนนี้ใช้แปลนที่วัดไว้)" : "ห้องไม่สี่เหลี่ยม? เดินวัดรอบห้อง / ใส่รูปแปลน"}
      </button>
      {shaping && <RoomShapeTool room={room} onApply={onChange} onClose={() => setShaping(false)} />}
      <p className="text-[10px] text-ink-500">วัดได้ 3 แบบ: ส่อง AR · ถ่ายรูปเทียบกับกระดาษ A4/กระเบื้อง · นับกระเบื้อง · กว้าง/ลึก 1–15 ม.</p>
      {measuring && <RoomMeasureTool room={room} onApply={onChange} onClose={() => setMeasuring(false)} />}
    </div>
  );
}
