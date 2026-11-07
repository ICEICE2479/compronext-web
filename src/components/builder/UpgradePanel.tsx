"use client";

import { useMemo, useState } from "react";
import { ArrowRight, TrendingUp, X } from "lucide-react";
import type { FpsResolution } from "@/lib/builder/fps";
import type { BuildSelection } from "@/lib/builder/types";
import { suggestUpgrades, type UpgradeOption } from "@/lib/builder/upgrade";
import { formatTHB } from "@/lib/format";

const SLOT_TH: Record<string, string> = { cpu: "ซีพียู", gpu: "การ์ดจอ", psu: "พาวเวอร์", ram: "แรม", storage: "SSD" };
const BUDGETS = [0, 10000, 20000, 40000];

function Row({ o, best, onApply }: { o: UpgradeOption; best?: boolean; onApply: (o: UpgradeOption) => void }) {
  return (
    <li className={`rounded-2xl border p-3 ${best ? "border-info bg-info-bg" : "border-ink-200"}`}>
      {best && <p className="mb-1 text-xs font-bold text-info">คุ้มที่สุด</p>}
      <ul className="space-y-1">
        {o.changes.map((c) => (
          <li key={c.slot} className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="shrink-0 font-semibold text-ink-950">{SLOT_TH[c.slot] ?? c.slot}</span>
            {c.from && <span className="min-w-0 truncate text-ink-500 line-through">{c.from.name.split(" (")[0]}</span>}
            {c.from && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-400" />}
            <span className="min-w-0 truncate text-ink-900">{c.to.name.split(" (")[0]}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-700">
          {o.gainPct > 0 ? (
            <>
              FPS <b className="text-ink-950">{o.fpsBefore} → {o.fpsAfter}</b> <span className="font-bold text-ok">+{o.gainPct}%</span>
            </>
          ) : (
            o.note
          )}
          {o.gainPct > 0 && o.note && <span className="block text-ink-500">{o.note}</span>}
        </p>
        <button type="button" onClick={() => onApply(o)} className="btn btn-outline h-9 rounded-full px-3 text-sm">
          {formatTHB(o.cost)} · ลองใส่
        </button>
      </div>
    </li>
  );
}

/** เช็กเครื่องเดิม: ใส่ชิ้นที่มีอยู่ในหน้าจัดสเปก แล้วระบบบอกว่าอัปอะไรคุ้มสุด (ไม่ต้องเปลี่ยนเมนบอร์ด) */
export function UpgradePanel({
  selection,
  onApply,
  onClose,
}: {
  selection: BuildSelection;
  onApply: (o: UpgradeOption) => void;
  onClose: () => void;
}) {
  const [resolution, setResolution] = useState<FpsResolution>("1440p");
  const [budget, setBudget] = useState(0);
  const report = useMemo(() => suggestUpgrades(selection, resolution, budget || undefined), [selection, resolution, budget]);

  return (
    <div className="scene-chip card space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-ink-950">
            <TrendingUp className="h-4 w-4 text-info" /> อัปเกรดเครื่องเดิม
          </p>
          <p className="text-xs text-ink-600">เลือกชิ้นที่มีอยู่ในเครื่องคุณด้านล่าง ระบบหาชิ้นที่ใส่ได้เลยและแรงขึ้นคุ้มเงินที่สุด</p>
        </div>
        <button type="button" onClick={onClose} aria-label="ปิด" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-ink-700">จอ</span>
        {(["1080p", "1440p", "4K"] as const).map((r) => (
          <button key={r} type="button" data-active={resolution === r} onClick={() => setResolution(r)} className="chip text-xs">
            {r}
          </button>
        ))}
        <span className="ml-2 mr-1 text-sm text-ink-700">งบ</span>
        {BUDGETS.map((b) => (
          <button key={b} type="button" data-active={budget === b} onClick={() => setBudget(b)} className="chip text-xs">
            {b ? `≤ ${formatTHB(b)}` : "ไม่จำกัด"}
          </button>
        ))}
      </div>

      {!report.ready ? (
        <p className="rounded-xl bg-warn-bg px-3 py-2 text-sm text-ink-900">{report.reason}</p>
      ) : (
        <>
          <p className="text-sm text-ink-800">
            เครื่องตอนนี้ได้ราว <b className="text-ink-950">{report.fpsNow} FPS</b> ที่ {resolution} · ติดคอขวดที่{" "}
            <b className="text-ink-950">{report.bottleneck === "CPU" ? "ซีพียู" : "การ์ดจอ"}</b>
          </p>
          {report.options.length ? (
            <ul className="space-y-2">
              {report.options.map((o, i) => (
                <Row key={o.changes.map((c) => c.to.id).join("+")} o={o} best={i === 0} onApply={onApply} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-600">ในงบนี้ยังไม่มีชิ้นที่ใส่ได้แล้วแรงขึ้นชัดเจน (เกิน 5%)</p>
          )}
          {report.extras.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-500">ควรเพิ่มด้วย</p>
              <ul className="space-y-2">
                {report.extras.map((o) => (
                  <Row key={o.changes[0].to.id} o={o} onApply={onApply} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
