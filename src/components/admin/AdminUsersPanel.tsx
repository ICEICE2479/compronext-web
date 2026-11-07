"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, UserCheck, UserX } from "lucide-react";
import type { AdminRole, PublicAdmin } from "@/lib/admin/types";
import { checkPasswordPolicy } from "@/lib/admin/password-policy";
import { PasswordInput } from "@/components/admin/PasswordInput";

const ROLE_LABEL: Record<AdminRole, string> = { superadmin: "ซูเปอร์แอดมิน", admin: "แอดมิน" };

function fmtDate(iso: string | null): string {
  if (!iso) return "ยังไม่เคยเข้าสู่ระบบ";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("th-TH");
}

export function AdminUsersPanel({
  currentAdmin,
  onSessionEnded,
}: {
  currentAdmin: { username: string; role: AdminRole };
  onSessionEnded: () => void;
}) {
  const [admins, setAdmins] = useState<PublicAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        onSessionEnded();
        return null;
      }
      const data = await res.json().catch(() => ({}));
      return data as { ok: boolean; error?: string; errors?: string[]; admins?: PublicAdmin[] };
    },
    [onSessionEnded]
  );

  const applyList = useCallback((data: Awaited<ReturnType<typeof post>>) => {
    if (!data) return;
    if (data.ok && data.admins) {
      setAdmins(data.admins);
      setError(null);
    } else {
      setError(data.error || "โหลดรายชื่อแอดมินไม่สำเร็จ");
    }
  }, []);

  const load = useCallback(
    () =>
      post({ action: "admin_list" })
        .then(applyList)
        .catch(() => setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้")),
    [post, applyList]
  );

  useEffect(() => {
    let cancelled = false;
    post({ action: "admin_list" })
      .then((d) => {
        if (!cancelled) applyList(d);
      })
      .catch(() => {
        if (!cancelled) setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      });
    return () => {
      cancelled = true;
    };
  }, [post, applyList]);

  async function run(body: Record<string, unknown>, okMsg: string): Promise<boolean> {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const data = await post(body);
      if (!data) return false;
      if (data.ok) {
        setSuccess(okMsg);
        await load();
        return true;
      }
      setError(data.errors?.length ? `${data.error ?? ""} ${data.errors.join(" · ")}`.trim() : data.error || "ดำเนินการไม่สำเร็จ");
      return false;
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!checkPasswordPolicy(password, { username, email }).ok) {
      setError("รหัสผ่านยังไม่ผ่านเกณฑ์ความปลอดภัย");
      return;
    }
    const ok = await run(
      { action: "admin_create", username, email, password, role },
      `สร้างบัญชี "${username}" เรียบร้อย`
    );
    if (ok) {
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("admin");
    }
  }

  async function toggleDisabled(a: PublicAdmin) {
    const msg = a.disabled ? `เปิดใช้งาน "${a.username}" แล้ว` : `ปิดใช้งาน "${a.username}" แล้ว`;
    await run({ action: "admin_update", id: a.id, disabled: !a.disabled }, msg);
  }

  async function changeRole(a: PublicAdmin, next: AdminRole) {
    await run({ action: "admin_update", id: a.id, role: next }, `เปลี่ยนบทบาทของ "${a.username}" เรียบร้อย`);
  }

  async function remove(a: PublicAdmin) {
    if (!window.confirm(`ลบบัญชีแอดมิน "${a.username}" ถาวรใช่หรือไม่?`)) return;
    await run({ action: "admin_delete", id: a.id }, `ลบบัญชี "${a.username}" แล้ว`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-7">
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

        <div className="card divide-y divide-ink-100">
          <div className="p-4">
            <h2 className="font-display text-lg font-bold text-ink-950">บัญชีผู้ดูแลระบบ</h2>
          </div>
          {admins === null && !error && <p className="p-4 text-sm text-ink-600">กำลังโหลด...</p>}
          {admins?.length === 0 && <p className="p-4 text-sm text-ink-600">ยังไม่มีบัญชีผู้ดูแล</p>}
          {admins?.map((a) => {
            const isSelf = a.username === currentAdmin.username;
            return (
              <div key={a.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink-950">{a.username}</span>
                  {isSelf && <span className="badge bg-info-bg text-info">คุณ</span>}
                  <span className="badge bg-ink-100 text-ink-700">{ROLE_LABEL[a.role]}</span>
                  {a.disabled && <span className="badge bg-bad-bg text-bad">ปิดใช้งาน</span>}
                </div>
                <p className="break-all text-xs text-ink-600">{a.email}</p>
                <p className="text-xs text-ink-500">เข้าสู่ระบบล่าสุด: {fmtDate(a.lastLoginAt)}</p>
                {!isSelf && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label htmlFor={`role-${a.id}`} className="sr-only">
                      บทบาทของ {a.username}
                    </label>
                    <select
                      id={`role-${a.id}`}
                      value={a.role}
                      disabled={busy}
                      onChange={(e) => changeRole(a, e.target.value as AdminRole)}
                      className="input min-h-11 w-auto"
                    >
                      <option value="admin">{ROLE_LABEL.admin}</option>
                      <option value="superadmin">{ROLE_LABEL.superadmin}</option>
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleDisabled(a)}
                      className="btn btn-outline btn-sm min-h-11"
                    >
                      {a.disabled ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                      <span>{a.disabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(a)}
                      className="btn btn-outline btn-sm min-h-11 text-bad"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>ลบ</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleCreate} className="card h-fit space-y-4 p-6 lg:col-span-5" noValidate>
        <span className="eyebrow">NEW ADMIN</span>
        <h2 className="font-display text-lg font-bold text-ink-950">เพิ่มแอดมินใหม่</h2>
        <div>
          <label htmlFor="new-admin-username" className="label">ชื่อผู้ใช้</label>
          <input
            id="new-admin-username"
            type="text"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="input min-h-11"
          />
        </div>
        <div>
          <label htmlFor="new-admin-email" className="label">อีเมล</label>
          <input
            id="new-admin-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input min-h-11"
          />
        </div>
        <div>
          <label htmlFor="new-admin-role" className="label">บทบาท</label>
          <select
            id="new-admin-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className="input min-h-11"
          >
            <option value="admin">{ROLE_LABEL.admin}</option>
            <option value="superadmin">{ROLE_LABEL.superadmin}</option>
          </select>
        </div>
        <PasswordInput
          id="new-admin-password"
          label="รหัสผ่านเริ่มต้น"
          value={password}
          onChange={setPassword}
          username={username}
          email={email}
          withGenerator
        />
        <button
          type="submit"
          disabled={busy || !username.trim() || !email.trim() || !password}
          className="btn btn-primary min-h-11 w-full"
        >
          <Plus className="h-4 w-4" />
          <span>{busy ? "กำลังบันทึก..." : "สร้างบัญชีแอดมิน"}</span>
        </button>
      </form>
    </div>
  );
}
