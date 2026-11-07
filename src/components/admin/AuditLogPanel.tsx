"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { AuditAction, AuditEntry } from "@/lib/admin/types";

const ACTION_LABEL: Record<AuditAction, string> = {
  setup: "ตั้งค่าระบบครั้งแรก",
  login_success: "เข้าสู่ระบบสำเร็จ",
  login_failed: "เข้าสู่ระบบไม่สำเร็จ",
  login_locked: "บัญชีถูกล็อก",
  logout_all: "ออกจากระบบทุกอุปกรณ์",
  password_change: "เปลี่ยนรหัสผ่าน",
  admin_create: "สร้างแอดมิน",
  admin_update: "แก้ไขแอดมิน",
  admin_delete: "ลบแอดมิน",
  product_delete: "ลบสินค้า",
  room_delete: "ลบห้องตัวอย่าง",
  settings_change: "แก้ไขตั้งค่าเว็บไซต์",
};

export function AuditLogPanel({ onSessionEnded }: { onSessionEnded: () => void }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [filter, setFilter] = useState<AuditAction | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "audit_list",
        limit: 100,
        ...(filter ? { auditAction: filter } : {}),
      }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          onSessionEnded();
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          setEntries(data.entries);
          setError(null);
        } else {
          setError(data.error || "โหลดบันทึกกิจกรรมไม่สำเร็จ");
        }
      })
      .catch(() => {
        if (!cancelled) setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey, onSessionEnded]);

  return (
    <div className="card space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="eyebrow">AUDIT LOG</span>
          <h2 className="font-display text-lg font-bold text-ink-950">บันทึกกิจกรรมผู้ดูแลระบบ</h2>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="audit-filter" className="label">กรองตามกิจกรรม</label>
            <select
              id="audit-filter"
              value={filter}
              onChange={(e) => {
                setLoading(true);
                setFilter(e.target.value as AuditAction | "");
              }}
              className="input min-h-11"
            >
              <option value="">ทั้งหมด</option>
              {(Object.keys(ACTION_LABEL) as AuditAction[]).map((k) => (
                <option key={k} value={k}>
                  {ACTION_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setReloadKey((k) => k + 1);
            }}
            disabled={loading}
            aria-label="โหลดใหม่"
            className="btn btn-outline tap-target px-3"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div aria-live="assertive">
        {error && (
          <div role="alert" className="rounded-[var(--radius-sm)] bg-bad-bg p-3 text-sm font-semibold text-bad">
            {error}
          </div>
        )}
      </div>

      {entries === null && !error && <p className="text-sm text-ink-600">กำลังโหลด...</p>}
      {entries?.length === 0 && <p className="text-sm text-ink-600">ยังไม่มีบันทึกกิจกรรม</p>}

      {entries && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">รายการบันทึกกิจกรรมล่าสุด</caption>
            <thead className="text-xs text-ink-600">
              <tr>
                <th scope="col" className="py-2 pr-3">เวลา</th>
                <th scope="col" className="py-2 pr-3">กิจกรรม</th>
                <th scope="col" className="py-2 pr-3">ผู้ดำเนินการ</th>
                <th scope="col" className="py-2 pr-3">เป้าหมาย</th>
                <th scope="col" className="py-2 pr-3">IP</th>
                <th scope="col" className="py-2">ผลลัพธ์</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-ink-600">
                    {new Date(e.at).toLocaleString("th-TH")}
                  </td>
                  <td className="py-2 pr-3 font-semibold text-ink-950">{ACTION_LABEL[e.action] ?? e.action}</td>
                  <td className="py-2 pr-3">{e.actor}</td>
                  <td className="break-all py-2 pr-3 text-xs text-ink-600">
                    {e.target ?? "-"}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 font-mono text-xs">{e.ip}</td>
                  <td className="py-2">
                    <span className={`badge ${e.ok ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"}`}>
                      {e.ok ? "สำเร็จ" : "ไม่สำเร็จ"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
