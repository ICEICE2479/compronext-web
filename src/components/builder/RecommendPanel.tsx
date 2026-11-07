"use client";

import { useMemo, useState, useTransition } from "react";
import Spinner from "../Spinner";
import { Sparkles, X } from "lucide-react";
import { estimateAllGamesFps, GAME_BENCHMARKS, type FpsResolution } from "@/lib/builder/fps";
import { resolveBuildSelection } from "@/lib/builder/compat";
import { recommendBuild, type RecommendResult } from "@/lib/builder/recommend";
import { formatTHB } from "@/lib/format";

/** ให้ระบบจัดสเปกให้: เลือกงบ + เกม + ความละเอียดจอ */
export function RecommendPanel({ onApply, onClose }: { onApply: (r: RecommendResult) => void; onClose: () => void }) {
  const [budget, setBudget] = useState(40000);
  const [games, setGames] = useState<string[]>(["valorant", "cs2"]);
  const [resolution, setResolution] = useState<FpsResolution>("1080p");
  const [result, setResult] = useState<RecommendResult | null | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const toggle = (id: string) => {
    setGames((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
    setResult(undefined);
  };
  const fill = Math.round(((budget - 15000) / (200000 - 15000)) * 100);
  // รายละเอียดผล: ชิ้นหลัก + FPS ทีละเกม
  const detail = useMemo(() => {
    if (!result) return null;
    const b = resolveBuildSelection(result.selection);
    const fps = estimateAllGamesFps(b, resolution, "high", true).results.filter((r) => !games.length || games.includes(r.game.id));
    return { cpu: b.cpu?.name, gpu: b.gpu?.name ?? "ใช้กราฟิกในซีพียู", fps };
  }, [result, resolution, games]);

  return (
    <div className="scene-chip card space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-ink-950">
            <Sparkles className="h-4 w-4 text-info" /> ช่วยจัดสเปกให้
          </p>
          <p className="text-xs text-ink-600">บอกงบกับเกมที่เล่น ระบบเลือกชุดที่ได้ FPS สูงสุดและเข้ากันได้ทุกชิ้น</p>
        </div>
        <button type="button" onClick={onClose} aria-label="ปิด" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>

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
            setResult(undefined);
          }}
          style={{ ["--fill" as string]: `${fill}%` }}
          className="range"
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-sm text-ink-700">เกมที่เล่น</span>
        <div className="flex flex-wrap gap-1.5">
          {GAME_BENCHMARKS.map((g) => (
            <button key={g.id} type="button" data-active={games.includes(g.id)} onClick={() => toggle(g.id)} className="chip text-xs">
              {g.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-ink-700">จอ</span>
        {(["1080p", "1440p", "4K"] as const).map((r) => (
          <button
            key={r}
            type="button"
            data-active={resolution === r}
            onClick={() => {
              setResolution(r);
              setResult(undefined);
            }}
            className="chip text-xs"
          >
            {r}
          </button>
        ))}
      </div>

      {result === null && <p className="text-sm text-bad">งบนี้จัดชุดที่เข้ากันได้ครบไม่ได้ ลองเพิ่มงบ</p>}
      {result && detail && (
        <div className="space-y-2.5 rounded-xl bg-info-bg px-3 py-2.5 text-sm text-ink-900">
          <p>
            ได้ชุด <b>{formatTHB(result.total)}</b> · FPS เฉลี่ย ~{result.avgFps} ที่ {resolution} กราฟิก High
          </p>
          <p className="text-xs text-ink-700">
            {detail.cpu} + {detail.gpu}
          </p>
          <ul className="space-y-1.5">
            {detail.fps.map((r) => {
              const tone = r.avgFps >= 144 ? "bg-ok" : r.avgFps >= 60 ? "bg-info" : "bg-warn";
              return (
                <li key={r.game.id} className="text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{r.game.title}</span>
                    <b className="shrink-0">~{r.avgFps} FPS</b>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface">
                    <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.round((r.avgFps / 240) * 100))}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-ink-600">60+ เล่นลื่น · 144+ ลื่นมากสำหรับเกมแข่ง (ค่าประมาณ)</p>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={() => startTransition(() => setResult(recommendBuild({ budget, games, resolution })))}
          className="btn btn-outline h-11 flex-1 rounded-full disabled:opacity-60"
        >
          {pending ? <Spinner size={16} /> : null}
          คำนวณ
        </button>
        <button
          type="button"
          disabled={!result || pending}
          onClick={() => result && onApply(result)}
          className="btn btn-primary h-11 flex-1 rounded-full disabled:opacity-40"
        >
          ใช้สเปกนี้
        </button>
      </div>
    </div>
  );
}
