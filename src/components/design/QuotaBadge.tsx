import Link from "next/link";
import { Ticket } from "lucide-react";

export interface QuotaInfo {
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
  loggedIn: boolean;
  degraded?: boolean;
  credits?: number;
}

function resetText(resetAt: string): string {
  const t = new Date(resetAt);
  if (Number.isNaN(t.getTime())) return "เที่ยงคืน";
  const hm = t.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
  return `เที่ยงคืนนี้ (${hm} น.)`;
}

/** ป้ายโควตา AI รายวัน + ข้อความเชิญล็อกอิน/แจ้งรีเซ็ต */
export function QuotaBadge({ quota, guest }: { quota: QuotaInfo | null; guest: boolean }) {
  return (
    <div className="min-h-[3.5rem] space-y-1.5" aria-live="polite">
      <p className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-info-bg px-3 py-1 text-xs font-bold text-info">
        <Ticket className="h-3.5 w-3.5" />
        {!quota ? "กำลังเช็คโควตา…" : quota.degraded ? "เช็กโควตาไม่ได้ชั่วคราว" : `วันนี้เหลือ ${quota.remaining}/${quota.limit} ครั้ง`}
        {!!quota?.credits && <span className="font-semibold"> · เครดิต {quota.credits}</span>}
      </p>
      {quota && !quota.degraded && quota.limit > 0 && (
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
          <div className="h-full rounded-full bg-info transition-[width]" style={{ width: `${Math.round((quota.remaining / quota.limit) * 100)}%` }} />
        </div>
      )}
      {quota?.degraded && (
        <p className="rounded-lg bg-warn-bg p-3 text-xs text-ink-800">ระบบนับสิทธิ์ขัดข้องชั่วคราว ลองใหม่อีกสักครู่</p>
      )}
      {quota && !quota.degraded && quota.remaining <= 0 && (quota.credits ?? 0) > 0 && (
        <p className="text-[11px] text-ink-600">สิทธิ์ฟรีวันนี้หมดแล้ว ครั้งต่อไปจะใช้เครดิตที่เติมไว้</p>
      )}
      {quota && !quota.degraded && quota.remaining <= 0 && !(quota.credits ?? 0) && (
        <p className="rounded-lg bg-warn-bg p-3 text-xs text-ink-800">
          วันนี้ใช้ครบแล้ว ไว้มาใหม่ตอน {resetText(quota.resetAt)} ได้เลยนะ
          {!guest && (
            <>
              {" "}หรือ <Link href="/credits" className="font-semibold text-info underline">เติมเครดิต AI</Link> ใช้ต่อได้ทันที
            </>
          )}
          {guest && (
            <>
              {" "}หรือ <Link href="/login" className="font-semibold text-info underline">เข้าสู่ระบบ</Link> เพื่อรับสิทธิ์เพิ่ม
            </>
          )}
        </p>
      )}
      {guest && quota && !quota.degraded && quota.remaining > 0 && (
        <p className="text-[11px] text-ink-500">
          <Link href="/login" className="font-semibold text-info">เข้าสู่ระบบ</Link> เพื่อรับสิทธิ์ใช้ AI ต่อวันเพิ่มขึ้น
        </p>
      )}
    </div>
  );
}
