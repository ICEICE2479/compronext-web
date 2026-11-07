import { Check } from "lucide-react";
import { CASE_STATUSES, TRACK_STEPS, trackIndex, type CaseStatus } from "@/lib/returns";

const TONE: Record<CaseStatus, string> = {
  submitted: "bg-info-bg text-info",
  reviewing: "bg-info-bg text-info",
  need_info: "bg-warn-bg text-warn",
  approved: "bg-ok-bg text-ok",
  rejected: "bg-bad-bg text-bad",
  resolved: "bg-ok-bg text-ok",
};

export function StatusChip({ status }: { status: CaseStatus }) {
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[status]}`}>{CASE_STATUSES[status]}</span>;
}

/** แถบติดตามสถานะ 4 ขั้น */
export function CaseTracker({ status, compact = false }: { status: CaseStatus; compact?: boolean }) {
  const at = trackIndex(status);
  const dot = compact ? "h-5 w-5 text-[10px]" : "h-8 w-8 text-xs";
  return (
    <ol className="grid grid-cols-4" aria-label={`สถานะ: ${CASE_STATUSES[status]}`}>
      {TRACK_STEPS.map((s, i) => {
        const done = i < at || (i === at && status === "resolved");
        const current = i === at && status !== "resolved";
        const tone = done
          ? "bg-ok text-paper"
          : current
            ? status === "rejected"
              ? "bg-bad text-paper"
              : status === "need_info"
                ? "bg-warn text-paper"
                : "bg-info text-white"
            : "bg-ink-100 text-ink-500";
        const label = current && status === "rejected" ? "ไม่อนุมัติ" : current && status === "need_info" ? "ขอข้อมูลเพิ่ม" : s.label;
        return (
          <li key={s.key} className="relative flex flex-col items-center gap-1 text-center" aria-current={current ? "step" : undefined}>
            {i < TRACK_STEPS.length - 1 && (
              <span aria-hidden className={`absolute left-1/2 h-0.5 w-full ${compact ? "top-2.5" : "top-4"} ${i < at ? "bg-ok" : "bg-ink-200"}`} />
            )}
            <span className={`relative flex items-center justify-center rounded-full font-bold ${dot} ${tone}`}>
              {done ? <Check className={compact ? "h-3 w-3" : "h-4 w-4"} /> : i + 1}
            </span>
            {compact ? <span className="sr-only">{label}</span> : <span className={`text-[11px] leading-tight ${current ? "font-semibold text-ink-950" : "text-ink-600"}`}>{label}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
