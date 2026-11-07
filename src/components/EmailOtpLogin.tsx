"use client";

import { refreshSession } from "@/lib/use-session";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KeyRound, Mail, X } from "lucide-react";
import type { UserSession } from "@/lib/auth";
import { BotChallengeWidget } from "./BotChallengeWidget";

type Providers = { line: boolean; google: boolean };
let providersCache: Promise<Providers> | null = null;
/** ถามเซิร์ฟเวอร์ครั้งเดียวว่าเปิด LINE / Google ไว้หรือยัง */
function loadProviders(): Promise<Providers> {
  providersCache ??= fetch("/api/auth/providers")
    .then((r) => r.json() as Promise<Providers>)
    .catch(() => ({ line: false, google: false }));
  return providersCache;
}

/**
 * เข้าสู่ระบบ / สมัครสมาชิกด้วยรหัส OTP 6 หลักทางอีเมล (ช่องทางเดียวที่ยืนยันตัวตนได้จริง)
 */
export function EmailOtpLogin({
  onSuccess,
  onClose,
}: {
  onSuccess?: (user: UserSession) => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [refCode, setRefCode] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [botPassToken, setBotPassToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Providers | null>(null);
  useEffect(() => {
    let alive = true;
    loadProviders().then((p) => alive && setProviders(p));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function post(payload: object) {
    const res = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json().catch(() => ({ ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่" }));
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!botPassToken) {
      setError("กรุณากดยืนยันว่าฉันไม่ใช่บอทด้านบนก่อนส่งรหัส OTP");
      return;
    }
    setLoading(true);
    setError(null);
    const data = await post({
      action: "email_request_verification",
      email: email.trim(),
      name: name.trim(),
      botPassToken,
    });
    setLoading(false);
    if (data.ok) {
      setRefCode(data.refCode || "");
      setPendingToken(typeof data.pendingToken === "string" ? data.pendingToken : null);
      setOtp("");
      setCooldown(30);
      setStep("verify");
    } else {
      setError(data.error || "ส่งรหัสไม่สำเร็จ");
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    const data = await post({
      action: "email_request_verification",
      email: email.trim(),
      name: name.trim(),
      botPassToken,
    });
    setResending(false);
    if (data.ok) {
      setRefCode(data.refCode || "");
      setPendingToken(typeof data.pendingToken === "string" ? data.pendingToken : null);
      setCooldown(30);
    } else {
      setError(data.error || "ส่งรหัสซ้ำไม่สำเร็จ");
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const data = await post({
      action: "email_verify_code",
      email: email.trim(),
      name: name.trim(),
      otp,
      pendingToken,
    });
    setLoading(false);
    if (data.ok) {
      onSuccess?.(data.user);
      onClose?.();
      router.refresh();
      void refreshSession();
    } else {
      setError(data.error || "รหัสไม่ถูกต้อง");
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-[440px] rounded-2xl border border-ink-200 bg-white px-5 py-6 shadow-2xl sm:px-8 sm:py-8">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดหน้าต่างเข้าสู่ระบบ"
          className="absolute right-3.5 top-3.5 tap-target inline-flex items-center justify-center rounded-lg p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-800 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      <div className={`space-y-1 text-center ${providers?.line || providers?.google ? "" : "mb-5"}`}>
        <h2 className="font-display text-2xl font-bold text-ink-950">เข้าสู่ระบบ / สมัครสมาชิก</h2>
        <p className="text-sm text-ink-600">ใช้อีเมลรับรหัส 6 หลัก ไม่ต้องตั้งรหัสผ่าน</p>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-lg bg-bad-bg p-3 text-sm font-semibold text-bad">{error}</div>
      )}

      {step === "form" && (providers?.line || providers?.google) && (
        <>
          {providers.line && (
          <a
            href={`/api/auth/line?next=${encodeURIComponent(pathname === "/login" ? "/" : pathname)}`}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#06C755] text-sm font-bold text-white hover:brightness-95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
              <path d="M12 3C6.48 3 2 6.58 2 11c0 3.95 3.58 7.26 8.42 7.89.33.07.78.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1 .88.55 1.08-.46 5.83-3.43 7.95-5.88C21.53 14.24 22 12.67 22 11c0-4.42-4.48-8-10-8z" />
            </svg>
            เข้าสู่ระบบด้วย LINE
          </a>
          )}
          {providers.google && (
          <a
            href={`/api/auth/google?next=${encodeURIComponent(pathname === "/login" ? "/" : pathname)}`}
            className={`${providers.line ? "mt-2.5" : "mt-5"} flex h-11 w-full items-center justify-center gap-2 rounded-full border border-ink-300 bg-white text-sm font-bold text-[#1f1f1f] hover:bg-ink-50`}
          >
            <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
              <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
            </svg>
            เข้าสู่ระบบด้วย Google
          </a>
          )}
          <div className="my-4 flex items-center gap-3 text-xs text-ink-600">
            <span className="h-px flex-1 bg-ink-200" /> หรือใช้อีเมล <span className="h-px flex-1 bg-ink-200" />
          </div>
        </>
      )}

      {step === "form" ? (
        <form onSubmit={handleRequest} className="space-y-3.5">
          <div>
            <label htmlFor="otp-email" className="label">อีเมล</label>
            <input
              id="otp-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="otp-name" className="label">ชื่อที่แสดง (ไม่บังคับ)</label>
            <input
              id="otp-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </div>

          <BotChallengeWidget onVerified={setBotPassToken} />

          <button type="submit" disabled={loading} aria-busy={loading} className="btn btn-primary w-full py-2.5">
            <Mail className="h-4 w-4" />
            <span>{loading ? "กำลังส่งรหัส..." : "ส่งรหัส OTP ไปที่อีเมล"}</span>
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="mt-5 space-y-3.5">
            <div className="space-y-1.5 rounded-xl border border-info/30 bg-info-bg/50 p-3 text-xs text-ink-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  ส่งรหัส 6 หลักไปที่ <strong>{email}</strong> แล้ว{refCode && <> (Ref: {refCode})</>}
                </span>
                {email.toLowerCase().endsWith("@gmail.com") && (
                  <a
                    href="https://mail.google.com/mail/u/0/#search/in%3Aanywhere+ComproNext+OR+verification"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-info/15 px-2 py-0.5 text-[11px] font-bold text-info hover:underline"
                  >
                    เปิดเช็คใน Gmail ↗
                  </a>
                )}
              </div>
              <div className="text-[11px] text-ink-600">
                เช็คใน <strong>กล่องจดหมาย / อัปเดต (Updates) / จดหมายขยะ (Spam)</strong> ชื่อผู้ส่ง <strong>compronext</strong>
              </div>
            </div>
          <div>
            <label htmlFor="otp-code" className="label">รหัส OTP 6 หลัก</label>
            <input
              id="otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="input text-center font-mono text-2xl tracking-[0.5em]"
            />
          </div>
          <button type="submit" disabled={loading || otp.length !== 6} aria-busy={loading} className="btn btn-primary w-full py-2.5">
            <KeyRound className="h-4 w-4" />
            <span>{loading ? "กำลังตรวจสอบ..." : "ยืนยันรหัส"}</span>
          </button>
          <div className="flex items-center justify-between gap-2 pt-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setStep("form");
                setError(null);
                setBotPassToken(null);
              }}
              className="tap-target text-ink-600 hover:text-ink-900 cursor-pointer"
            >
              ← เปลี่ยนอีเมล
            </button>
            <button
              type="button"
              disabled={cooldown > 0 || resending}
              onClick={handleResend}
              className="tap-target text-info hover:underline disabled:text-ink-400 disabled:no-underline cursor-pointer"
            >
              {resending
                ? "กำลังส่งรหัสใหม่..."
                : cooldown > 0
                  ? `ส่งรหัสอีกครั้ง (${cooldown}s)`
                  : "ส่งรหัส OTP อีกครั้ง"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
