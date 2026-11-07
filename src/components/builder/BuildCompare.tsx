"use client";

import { X } from "lucide-react";
import { calculateBuildTotals, resolveBuildSelection } from "@/lib/builder/compat";
import { estimateAllGamesFps } from "@/lib/builder/fps";
import type { SavedPcBuild } from "@/lib/builder/types";
import { formatTHB } from "@/lib/format";

const ROWS: Array<[string, "cpu" | "gpu" | "motherboard" | "ram" | "storage" | "cooler" | "psu" | "case" | "monitor"]> = [
  ["ซีพียู", "cpu"],
  ["การ์ดจอ", "gpu"],
  ["เมนบอร์ด", "motherboard"],
  ["แรม", "ram"],
  ["SSD", "storage"],
  ["ระบายความร้อน", "cooler"],
  ["พาวเวอร์", "psu"],
  ["เคส", "case"],
  ["จอ", "monitor"],
];

/** เทียบสเปกที่บันทึกไว้ 2 ชุดข้างกัน: ชิ้นส่วน ราคา ไฟ FPS (ตัวที่ดีกว่าเป็นสีเขียว) */
export function BuildCompare({ builds, onClose }: { builds: [SavedPcBuild, SavedPcBuild]; onClose: () => void }) {
  const data = builds.map((b) => {
    const r = resolveBuildSelection(b.selection);
    const t = calculateBuildTotals(r);
    const fps = estimateAllGamesFps(r, "1440p", "high", true).results;
    const avg = fps.length ? Math.round(fps.reduce((s, x) => s + x.avgFps, 0) / fps.length) : 0;
    return { b, r, t, avg };
  });
  const better = (a: number, b: number, lowerIsBetter = false) => (a === b ? "" : (lowerIsBetter ? a < b : a > b) ? "text-ok font-bold" : "");
  const [A, B] = data;

  return (
    <div className="scene-chip card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <p className="font-semibold text-ink-950">เทียบสเปก 2 ชุด</p>
        <button type="button" onClick={onClose} aria-label="ปิด" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left">
              <th className="w-28 px-4 py-2 text-xs font-medium text-ink-600" />
              {data.map((d) => (
                <th key={d.b.id} className="px-3 py-2 font-semibold text-ink-950">
                  {d.b.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-ink-100 bg-ink-50">
              <td className="px-4 py-2 text-xs text-ink-600">ราคารวม</td>
              <td className={`px-3 py-2 ${better(A.t.totalPrice, B.t.totalPrice, true)}`}>{formatTHB(A.t.totalPrice)}</td>
              <td className={`px-3 py-2 ${better(B.t.totalPrice, A.t.totalPrice, true)}`}>{formatTHB(B.t.totalPrice)}</td>
            </tr>
            <tr className="border-t border-ink-100 bg-ink-50">
              <td className="px-4 py-2 text-xs text-ink-600">FPS เฉลี่ย 1440p</td>
              <td className={`px-3 py-2 ${better(A.avg, B.avg)}`}>~{A.avg}</td>
              <td className={`px-3 py-2 ${better(B.avg, A.avg)}`}>~{B.avg}</td>
            </tr>
            <tr className="border-t border-ink-100 bg-ink-50">
              <td className="px-4 py-2 text-xs text-ink-600">กินไฟ</td>
              <td className={`px-3 py-2 ${better(A.t.estimatedWatts, B.t.estimatedWatts, true)}`}>~{A.t.estimatedWatts}W</td>
              <td className={`px-3 py-2 ${better(B.t.estimatedWatts, A.t.estimatedWatts, true)}`}>~{B.t.estimatedWatts}W</td>
            </tr>
            {ROWS.map(([label, slot]) => {
              const a = A.r[slot];
              const b = B.r[slot];
              const same = a?.id === b?.id;
              return (
                <tr key={slot} className="border-t border-ink-100 align-top">
                  <td className="px-4 py-2 text-xs text-ink-600">{label}</td>
                  {[a, b].map((p, i) => (
                    <td key={i} className={`px-3 py-2 ${same ? "text-ink-600" : "text-ink-900"}`}>
                      {p ? (
                        <>
                          <span className="line-clamp-2">{p.name}</span>
                          <span className="text-xs text-ink-600">{formatTHB(p.price)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
