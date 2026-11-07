"use client";

import { useState, useSyncExternalStore } from "react";
import { GraduationCap, X } from "lucide-react";
import { BEGINNER_USAGES, beginnerRecommend, type BeginnerUsage } from "@/lib/builder/explain";
import type { RecommendResult } from "@/lib/builder/recommend";
import type { BuilderSlot } from "@/lib/builder/types";
import { formatTHB } from "@/lib/format";

const KEY = "cn-builder-beginner";
const EVT = "cn-builder-beginner-change";
const SLOT_LABEL: Array<[BuilderSlot, string]> = [
  ["cpu", "ซีพียู"],
  ["gpu", "การ์ดจอ"],
  ["motherboard", "เมนบอร์ด"],
  ["ram", "แรม"],
  ["storage", "SSD"],
  ["cooler", "ระบายความร้อน"],
  ["psu", "พาวเวอร์"],
  ["case", "เคส"],
];

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readOpen(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "open";
  } catch {
    return false;
  }
}
function writeOpen(open: boolean) {
  try {
    window.localStorage.setItem(KEY, open ? "open" : "closed");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVT));
}

/** ปุ่มเปิด/ปิดโหมดมือใหม่ (อยู่ในแถวปุ่มด้านบน) */
export function BeginnerChip() {
  const open = useSyncExternalStore(subscribe, readOpen, () => false);
  return (
    <button type="button" data-active={open} aria-expanded={open} onClick={() => writeOpen(!open)} className="chip shrink-0 rounded-full">
      <GraduationCap className="h-3.5 w-3.5" /> โหมดมือใหม่
    </button>
  );
}

/** โหมดมือใหม่: เลือกการใช้งาน + งบ แล้วระบบจัดสเปกพร้อมเหตุผลรายชิ้น (ปิดไว้ก่อน กดจากปุ่มด้านบน — หน้าไม่รก) */
export function BeginnerMode({ onApply }: { onApply: (r: RecommendResult) => void }) {
  const open = useSyncExternalStore(subscribe, readOpen, () => false);
  const [usage, setUsage] = useState<BeginnerUsage>(BEGINNER_USAGES[0]?.id ?? "study");
  const [budget, setBudget] = useState(30000);
  const [out, setOut] = useState<ReturnType<typeof beginnerRecommend> | null>(null);

  if (!open) return null;

  const fill = Math.round(((budget - 15000) / (200000 - 15000)) * 100);
  const reasons = out?.reasons ?? {};

  return (
    <div className="scene-chip card space-y-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-ink-950">
            <GraduationCap className="h-4 w-4 text-info" /> โหมดมือใหม่
          </p>
          <p className="text-xs text-ink-600">บอกว่าใช้ทำอะไรกับงบเท่าไร ระบบจัดสเปกให้พร้อมบอกเหตุผลแต่ละชิ้น</p>
        </div>
        <button type="button" onClick={() => writeOpen(false)} aria-label="ปิดโหมดมือใหม่" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="การใช้งาน">
        {BEGINNER_USAGES.map((u) => (
          <button
            key={u.id}
            type="button"
            data-active={usage === u.id}
            onClick={() => {
              setUsage(u.id);
              setOut(null);
            }}
            className="chip min-h-11 text-xs"
          >
            {u.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-600">{BEGINNER_USAGES.find((u) => u.id === usage)?.hint}</p>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-700">งบเฉพาะตัวเครื่อง</span>
          <span className="font-display text-lg font-bold text-ink-950">{formatTHB(budget)}</span>
        </div>
        <input
          type="range"
          aria-label="งบประมาณ"
          min={15000}
          max={200000}
          step={1000}
          value={budget}
          onChange={(e) => {
            setBudget(Number(e.target.value));
            setOut(null);
          }}
          style={{ ["--fill" as string]: `${fill}%` }}
          className="range"
        />
      </div>

      <button
        type="button"
        onClick={() => {
          const r = beginnerRecommend(usage, budget);
          setOut(r);
          if (r.result) onApply(r.result);
        }}
        className="btn btn-primary h-11 w-full rounded-full"
      >
        จัดสเปกให้เลย
      </button>

      {out && out.result === null && <p className="text-sm text-bad">งบนี้จัดชุดที่เข้ากันได้ครบไม่ได้ ลองเพิ่มงบ</p>}
      {out?.result && (
        <div className="space-y-2">
          <p className="rounded-xl bg-info-bg px-3 py-2 text-sm text-ink-900">ใส่สเปกให้แล้ว {formatTHB(out.result.total)}</p>
          <ul className="space-y-1.5 text-xs text-ink-800">
            {SLOT_LABEL.filter(([s]) => reasons[s]).map(([s, label]) => (
              <li key={s}>
                <span className="font-semibold text-ink-950">{label}:</span> {reasons[s]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
