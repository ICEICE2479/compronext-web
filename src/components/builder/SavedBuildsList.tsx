"use client";

import { useState } from "react";
import Link from "next/link";
import { BuildCompare } from "./BuildCompare";
import { Cpu, Trash2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import {
  encodeBuildQuery,
  useSavedPcBuilds,
} from "@/lib/builder/saved-builds";
import {
  calculateBuildTotals,
  evaluateBuilderCompatibility,
  resolveBuildSelection,
} from "@/lib/builder/compat";
import { formatTHB, formatThaiDate } from "@/lib/format";

export function SavedBuildsList() {
  const { builds, remove } = useSavedPcBuilds();
  const [picked, setPicked] = useState<string[]>([]);
  const pair = picked.map((id) => builds.find((b) => b.id === id)).filter((b): b is (typeof builds)[number] => !!b);
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));

  if (builds.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<Cpu className="h-10 w-10 text-ink-400" aria-hidden="true" />}
          title="ยังไม่มีสเปกคอมพิวเตอร์ที่บันทึกไว้"
          description="จัดสเปกคอม 3D เลือกจอภาพ ทดสอบ FPS แล้วกดบันทึกเก็บไว้ดูภายหลังได้"
          action={{ label: "ไปหน้าจัดสเปกคอม 3D", href: "/builder" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {builds.length > 1 && (
        <p className="text-xs text-ink-600">{pair.length === 2 ? "กำลังเทียบ 2 ชุด" : `เลือก "เทียบ" 2 ชุดเพื่อดูข้างกัน (${pair.length}/2)`}</p>
      )}
      {pair.length === 2 && <BuildCompare builds={[pair[0], pair[1]]} onClose={() => setPicked([])} />}
    <div className="grid gap-4 md:grid-cols-2">
      {builds.map((b) => {
        const resolved = resolveBuildSelection(b.selection);
        const totals = calculateBuildTotals(resolved);
        const compat = evaluateBuilderCompatibility(resolved);
        const failCount = compat.filter((c) => c.status === "fail").length;
        const encoded = encodeBuildQuery(b.selection);

        return (
          <div key={b.id} className="card flex min-w-0 flex-col justify-between gap-4 p-5">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="badge bg-ink-900 text-volt">
                  {totals.selectedCount} ชิ้นส่วน · ~{totals.estimatedWatts}W
                </span>
                <span className="text-xs text-ink-600">
                  บันทึกเมื่อ {formatThaiDate(b.createdAt)}
                </span>
              </div>
              <h3 className="break-words font-display text-lg font-bold text-ink-950">
                {b.name}
              </h3>
              <ul className="text-xs text-ink-600 space-y-1">
                <li>CPU: <strong>{resolved.cpu?.name ?? "-"}</strong></li>
                <li>GPU: <strong>{resolved.gpu?.name ?? "-"}</strong></li>
                <li>Mainboard: <strong>{resolved.motherboard?.name ?? "-"}</strong></li>
                <li>RAM: <strong>{resolved.ram?.name ?? "-"}</strong></li>
                <li>Monitor: <strong>{resolved.monitor?.name ?? "-"}</strong></li>
              </ul>
              {failCount > 0 && (
                <p className="text-xs font-semibold text-bad">
                  พบจุดไม่เข้ากัน {failCount} รายการ
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
              <div>
                <span className="block text-xs text-ink-600">ราคารวมประมาณการ</span>
                <span className="font-display text-xl font-bold text-ink-950">
                  {formatTHB(totals.totalPrice)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {builds.length > 1 && (
                  <button type="button" data-active={picked.includes(b.id)} aria-pressed={picked.includes(b.id)} onClick={() => togglePick(b.id)} className="chip tap-target text-xs">
                    เทียบ
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(b.id)}
                  className="btn btn-outline btn-sm tap-target text-bad"
                  aria-label="ลบสเปกนี้"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <Link
                  href={`/builder?b=${encoded}`}
                  className="btn btn-primary btn-sm"
                >
                  เปิดใน Builder 3D →
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
