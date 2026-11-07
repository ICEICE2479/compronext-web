import { formatTHB, formatThaiDate } from "@/lib/format";

/** กราฟประวัติราคา (เส้นขั้นบันได) — วาดฝั่งเซิร์ฟเวอร์ ไม่ต้องโหลดไลบรารี */
export function PriceHistoryChart({ history, current }: { history: Array<{ d: string; p: number }>; current: number }) {
  const pts = history.length ? history : [];
  if (pts.length < 2) return null;
  const W = 320;
  const H = 96;
  const pad = { l: 4, r: 4, t: 10, b: 18 };
  const prices = pts.map((x) => x.p);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || max * 0.1 || 1;
  const t0 = Date.parse(pts[0].d);
  const t1 = Date.parse(pts[pts.length - 1].d);
  const tx = (d: string) => pad.l + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const ty = (p: number) => pad.t + (1 - (p - min) / span) * (H - pad.t - pad.b);
  let path = "";
  pts.forEach((x, i) => {
    const X = tx(x.d).toFixed(1);
    const Y = ty(x.p).toFixed(1);
    path += i === 0 ? `M${X},${Y}` : `H${X}V${Y}`;
  });
  const lowest = pts.reduce((a, b) => (b.p < a.p ? b : a));
  const first = pts[0].p;
  const diff = current - first;
  const pct = first ? Math.round((diff / first) * 100) : 0;

  return (
    <div className="rounded-2xl border border-ink-200 bg-surface p-3.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink-900">ประวัติราคา</p>
        <p className={`text-xs font-semibold ${diff < 0 ? "text-ok" : diff > 0 ? "text-bad" : "text-ink-600"}`}>
          {diff === 0 ? "ราคาคงที่" : `${diff < 0 ? "ลดลง" : "ขึ้น"} ${formatTHB(Math.abs(diff))} (${pct > 0 ? "+" : ""}${pct}%)`}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label={`ราคาต่ำสุด ${formatTHB(min)} สูงสุด ${formatTHB(max)}`}>
        <line x1={pad.l} x2={W - pad.r} y1={ty(min)} y2={ty(min)} className="stroke-ink-200" strokeDasharray="3 3" />
        <path d={path} fill="none" className="stroke-info" strokeWidth={2} strokeLinejoin="round" />
        <circle cx={tx(lowest.d)} cy={ty(lowest.p)} r={3.5} className="fill-ok" />
        <text x={pad.l} y={H - 4} className="fill-ink-600 text-[10px]">
          {formatThaiDate(pts[0].d)}
        </text>
        <text x={W - pad.r} y={H - 4} textAnchor="end" className="fill-ink-600 text-[10px]">
          {formatThaiDate(pts[pts.length - 1].d)}
        </text>
      </svg>
      <p className="mt-1 text-[11px] text-ink-600">
        ต่ำสุด {formatTHB(min)} ({formatThaiDate(lowest.d)}) · สูงสุด {formatTHB(max)}
      </p>
    </div>
  );
}
