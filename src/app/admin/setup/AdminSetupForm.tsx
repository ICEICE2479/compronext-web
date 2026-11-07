"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PasswordInput } from "@/components/admin/PasswordInput";
import { checkPasswordPolicy } from "@/lib/admin/password-policy";

export function AdminSetupForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!checkPasswordPolicy(password, { username, email }).ok) {
      setError("รหัสผ่านยังไม่ผ่านเกณฑ์ความปลอดภัย");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(data.error || "ตั้งค่าไม่สำเร็จ");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setLoading(false);
    }
  }

  return (
    <div className="container-page py-12 animate-reveal">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="card mx-auto max-w-md space-y-4 border-t-4 border-t-info p-6 sm:p-8"
      >
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] bg-info text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="eyebrow">FIRST-TIME SETUP</p>
          <h1 className="font-display text-2xl font-bold text-ink-950">ตั้งค่าซูเปอร์แอดมินคนแรก</h1>
          <p className="text-xs text-ink-600">
            กรอกโทเคนตั้งค่า (ADMIN_SETUP_TOKEN) ที่กำหนดไว้ในเซิร์ฟเวอร์ แล้วสร้างบัญชีผู้ดูแลระบบหลัก
          </p>
        </div>

        <div aria-live="assertive">
          {error && (
            <div role="alert" className="rounded-[var(--radius-sm)] bg-bad-bg p-3 text-sm font-semibold text-bad">
              {error}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="setup-token" className="label">โทเคนตั้งค่า</label>
          <input
            id="setup-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            className="input min-h-11"
          />
        </div>
        <div>
          <label htmlFor="setup-username" className="label">ชื่อผู้ใช้</label>
          <input
            id="setup-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="input min-h-11"
          />
        </div>
        <div>
          <label htmlFor="setup-email" className="label">อีเมล</label>
          <input
            id="setup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input min-h-11"
          />
        </div>
        <PasswordInput
          id="setup-password"
          label="รหัสผ่าน"
          value={password}
          onChange={setPassword}
          username={username}
          email={email}
          withGenerator
        />

        <button
          type="submit"
          disabled={loading || !token || !username.trim() || !email.trim() || !password}
          className="btn btn-primary min-h-11 w-full"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>{loading ? "กำลังสร้างบัญชี..." : "สร้างบัญชีและเข้าสู่ระบบ"}</span>
        </button>
      </form>
    </div>
  );
}
