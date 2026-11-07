"use client";

import { useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import type { AdminRole } from "@/lib/admin/types";
import { checkPasswordPolicy } from "@/lib/admin/password-policy";
import { PasswordInput } from "@/components/admin/PasswordInput";

export function AccountSecurityPanel({
  currentAdmin,
  onSessionEnded,
}: {
  currentAdmin: { username: string; role: AdminRole };
  onSessionEnded: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const policyOk = checkPasswordPolicy(newPassword, { username: currentAdmin.username }).ok;

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function handleChange(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!policyOk) {
      setError("รหัสผ่านใหม่ยังไม่ผ่านเกณฑ์ความปลอดภัย");
      return;
    }
    setBusy(true);
    try {
      const { res, data } = await post({
        action: "change_admin_password",
        currentPassword,
        newPassword,
      });
      if (data.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setSuccess("เปลี่ยนรหัสผ่านเรียบร้อย อุปกรณ์อื่นที่เข้าสู่ระบบอยู่จะถูกออกจากระบบ");
      } else if (res.status === 401 && data.error === undefined) {
        onSessionEnded();
      } else {
        setError(data.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogoutAll() {
    if (!window.confirm("ออกจากระบบทุกอุปกรณ์ รวมถึงอุปกรณ์นี้ใช่หรือไม่?")) return;
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const { data } = await post({ action: "logout_all" });
      if (data.ok) {
        onSessionEnded();
        return;
      }
      setError(data.error || "ออกจากระบบทุกอุปกรณ์ไม่สำเร็จ");
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={handleChange} className="card space-y-4 p-6" noValidate>
        <span className="eyebrow">ACCOUNT SECURITY</span>
        <h2 className="font-display text-lg font-bold text-ink-950">เปลี่ยนรหัสผ่าน</h2>
        <p className="text-xs text-ink-600">
          บัญชี: <strong>{currentAdmin.username}</strong> ·{" "}
          {currentAdmin.role === "superadmin" ? "ซูเปอร์แอดมิน" : "แอดมิน"}
        </p>

        <div aria-live="assertive">
          {error && (
            <div role="alert" className="rounded-[var(--radius-sm)] bg-bad-bg p-3 text-sm font-semibold text-bad">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="rounded-[var(--radius-sm)] bg-ok-bg p-3 text-sm font-semibold text-ok">
              {success}
            </div>
          )}
        </div>

        <PasswordInput
          id="sec-current-password"
          label="รหัสผ่านปัจจุบัน"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <PasswordInput
          id="sec-new-password"
          label="รหัสผ่านใหม่"
          value={newPassword}
          onChange={setNewPassword}
          username={currentAdmin.username}
          withGenerator
        />

        <button
          type="submit"
          disabled={busy || !currentPassword || !policyOk}
          className="btn btn-primary min-h-11 w-full"
        >
          <KeyRound className="h-4 w-4" />
          <span>{busy ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}</span>
        </button>
      </form>

      <div className="card h-fit space-y-3 p-6">
        <span className="eyebrow">SESSIONS</span>
        <h2 className="font-display text-lg font-bold text-ink-950">ออกจากระบบทุกอุปกรณ์</h2>
        <p className="text-xs text-ink-600">
          ยกเลิกเซสชันทั้งหมดของบัญชีนี้ทันที ใช้เมื่อสงสัยว่ามีผู้อื่นเข้าถึงบัญชีหรืออุปกรณ์สูญหาย
        </p>
        <button
          type="button"
          onClick={handleLogoutAll}
          disabled={busy}
          className="btn btn-outline min-h-11 w-full text-bad"
        >
          <LogOut className="h-4 w-4" />
          <span>ออกจากระบบทุกอุปกรณ์</span>
        </button>
      </div>
    </div>
  );
}
