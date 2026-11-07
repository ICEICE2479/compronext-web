"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { BotChallengeWidget } from "./BotChallengeWidget";

export function AdminLoginClient({ demoPasscodeHint }: { demoPasscodeHint: string | null }) {
  const router = useRouter();
  const [loginMethod, setLoginMethod] = useState<"otp" | "passcode">("passcode");
  const [otpTarget, setOtpTarget] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [refCode, setRefCode] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [botPassToken, setBotPassToken] = useState<string | null>(null);

  const [username, setUsername] = useState("admin");
  const [passcode, setPasscode] = useState(demoPasscodeHint || "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleQuickAdminLogin() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quick_admin_login" }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push("/admin");
        router.refresh();
        return;
      }
      setError(data.error || "ไม่สามารถเข้าสู่ระบบหลังบ้านได้");
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
    setLoading(false);
  }

  async function handleRequestAdminOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "admin_request_otp",
          otpChannel: "email",
          otpTarget,
          botPassToken,
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.ok) {
        setOtpSent(true);
        setRefCode(data.refCode || "");
        setPendingToken(typeof data.pendingToken === "string" ? data.pendingToken : null);
        setOtpInput("");
      } else {
        setError(throttleMessage(res.status, data) || data.error || "ไม่สามารถส่งรหัส OTP ได้");
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setLoading(false);
    }
  }

  async function handleVerifyAdminOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "admin_verify_otp",
          otpCode: otpInput,
          pendingToken,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(throttleMessage(res.status, data) || data.error || "รหัส OTP 6 หลักไม่ถูกต้อง");
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

  function throttleMessage(status: number, data: { error?: string; retryAfterSec?: number }): string | null {
    if (status !== 423 && status !== 429) return null;
    const sec = typeof data.retryAfterSec === "number" ? Math.max(1, Math.ceil(data.retryAfterSec)) : null;
    const wait = sec === null ? "" : sec >= 90 ? ` กรุณาลองใหม่ใน ${Math.ceil(sec / 60)} นาที` : ` กรุณาลองใหม่ใน ${sec} วินาที`;
    const base =
      status === 423
        ? "บัญชีถูกล็อกชั่วคราวเนื่องจากกรอกรหัสผิดหลายครั้ง"
        : "พยายามเข้าสู่ระบบบ่อยเกินไป";
    return `${base}${wait}`;
  }

  async function handlePasscodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          username,
          passcode,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(throttleMessage(res.status, data) || data.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
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
      <div className="mx-auto max-w-md space-y-4">
        <Link
          href="/"
          className="tap-target inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-info"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>กลับไปหน้าเว็บไซต์หลัก ComproNext</span>
        </Link>

        <div className="card p-6 sm:p-8 space-y-4 border-t-4 border-t-info">
          <div className="flex items-center justify-between">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] bg-info text-white">
              <Lock className="h-5 w-5" />
            </div>
            <span className="badge bg-info-bg text-info">
              <ShieldCheck className="h-3.5 w-3.5" />
              2FA OTP + Anti-Bot Shield
            </span>
          </div>

          <div className="space-y-1">
            <p className="eyebrow">ADMIN AUTHENTICATION</p>
            <h1 className="font-display text-2xl font-bold text-ink-950">
              เข้าสู่ระบบผู้ดูแลหลังบ้าน (Admin Login)
            </h1>
            <p className="text-xs text-ink-600">
              เลือกรับรหัสยืนยัน OTP 6 หลักทางอีเมล / เบอร์โทรศัพท์ หรือเข้าด้วยรหัสผ่านผู้ดูแลระบบ
            </p>
          </div>

          <button
            type="button"
            onClick={handleQuickAdminLogin}
            disabled={loading}
            className="btn btn-primary w-full py-3 text-sm font-bold shadow-md cursor-pointer"
          >
            ⚡ เข้าสู่ระบบผู้ดูแลหลังบ้านทันที (1-Click สำหรับกรรมการ / ทดสอบ)
          </button>

          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-ink-100 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setLoginMethod("otp");
                setError(null);
              }}
              aria-pressed={loginMethod === "otp"}
              className={`min-h-11 rounded-md py-2 transition-all cursor-pointer ${
                loginMethod === "otp"
                  ? "bg-white text-info shadow-xs"
                  : "text-ink-600 hover:text-ink-950"
              }`}
            >
              ส่งรหัส OTP (อีเมล / เบอร์โทร)
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod("passcode");
                setError(null);
              }}
              aria-pressed={loginMethod === "passcode"}
              className={`min-h-11 rounded-md py-2 transition-all cursor-pointer ${
                loginMethod === "passcode"
                  ? "bg-white text-info shadow-xs"
                  : "text-ink-600 hover:text-ink-950"
              }`}
            >
              รหัสผ่านผู้ดูแล (Passcode)
            </button>
          </div>

          {error && (
            <div role="alert" className="rounded-[var(--radius-sm)] bg-bad-bg p-3 text-sm font-semibold text-bad">
              {error}
            </div>
          )}

          {loginMethod === "otp" ? (
            !otpSent ? (
              <form onSubmit={handleRequestAdminOtp} className="space-y-3.5">
                <div>
                  <label htmlFor="admin-otp-email" className="label">อีเมลผู้ดูแลระบบสำหรับรับรหัส OTP 6 หลัก</label>
                  <input
                    id="admin-otp-email"
                    type="email"
                    autoComplete="email"
                    placeholder="admin@yourdomain.com"
                    value={otpTarget}
                    onChange={(e) => setOtpTarget(e.target.value)}
                    required
                    className="input"
                  />
                </div>

                <BotChallengeWidget onVerified={(token) => setBotPassToken(token)} />

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full py-2.5"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>
                    {loading
                      ? "กำลังส่งรหัสยืนยัน OTP..."
                      : "ส่งรหัส OTP 6 หลักไปที่อีเมล"}
                  </span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAdminOtp} className="space-y-3.5">
                <div className="rounded-lg border border-info/30 bg-info-bg/60 p-3 text-xs text-ink-800">
                  ส่งรหัส OTP 6 หลัก (Ref: <strong>{refCode}</strong>) ไปยัง{" "}
                  <strong>{otpTarget}</strong> เรียบร้อยแล้ว กรุณาเช็คกล่องข้อความของคุณ
                </div>

                <div>
                  <label htmlFor="admin-otp-code" className="label">กรอกรหัสยืนยัน OTP 6 หลัก (Ref: {refCode})</label>
                  <input
                    id="admin-otp-code"
                    type="text"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="000000"
                    required
                    className="input text-center font-mono text-xl font-bold tracking-[0.35em]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpInput.replace(/\D/g, "").length !== 6}
                  className="btn btn-primary w-full py-2.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{loading ? "กำลังตรวจสอบ..." : "ยืนยันรหัส OTP เข้าสู่ระบบหลังบ้าน"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="tap-target w-full text-center text-sm font-semibold text-ink-600 hover:text-ink-900 cursor-pointer"
                >
                  ← เปลี่ยนช่องทางรับรหัส OTP
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handlePasscodeSubmit} className="space-y-4">
              {demoPasscodeHint && (
              <div className="rounded-[var(--radius-sm)] border border-info/30 bg-info-bg/50 p-3 text-xs text-ink-800 space-y-1">
                <div>
                  บัญชีผู้ดูแลเริ่มต้น: <code className="font-bold text-ink-950">admin</code>
                </div>
                <div>
                  รหัสผ่านผู้ดูแล (Passcode):{" "}
                  <code className="font-bold text-info">{demoPasscodeHint}</code>{" "}
                  <button
                    type="button"
                    onClick={() => setPasscode(demoPasscodeHint)}
                    className="ml-1 min-h-11 underline font-semibold text-info cursor-pointer"
                  >
                    (คลิกเพื่อกรอกอัตโนมัติ)
                  </button>
                </div>
              </div>
              )}

              <div>
                <label htmlFor="admin-username" className="label">
                  ชื่อผู้ใช้หรืออีเมลผู้ดูแลระบบ
                </label>
                <input
                  id="admin-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ชื่อผู้ใช้ หรืออีเมล"
                  autoComplete="username"
                  required
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="admin-passcode-login" className="label">
                  รหัสผ่านผู้ดูแลระบบ (Admin Password / Passcode)
                </label>
                <input
                  id="admin-passcode-login"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="กรอกรหัสผ่านผู้ดูแล..."
                  autoComplete="current-password"
                  required
                  className="input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-2.5"
              >
                <KeyRound className="h-4 w-4" />
                <span>
                  {loading
                    ? "กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ..."
                    : "เข้าสู่ระบบจัดการหลังบ้าน (/admin)"}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

