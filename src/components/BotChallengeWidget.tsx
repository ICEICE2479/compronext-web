"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Cpu,
  KeyRound,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

interface ChallengeOption {
  id: string;
  labelTh: string;
}

/** เวลาปัจจุบัน (เรียกเฉพาะใน event handler) */
const nowMs = () => Date.now();

export function BotChallengeWidget({
  onVerified,
}: {
  onVerified: (botPassToken: string | null) => void;
}) {
  const [status, setStatus] = useState<"idle" | "challenging" | "verifying" | "verified">(
    "idle"
  );
  const [targetLabelTh, setTargetLabelTh] = useState<string>("");
  const [options, setOptions] = useState<ChallengeOption[]>([]);
  const [challengeToken, setChallengeToken] = useState<string>("");
  const [openedAt, setOpenedAt] = useState<number>(0);
  const [honeypot, setHoneypot] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function renderIcon(id: string) {
    switch (id) {
      case "shield":
        return <Shield className="h-5 w-5" />;
      case "lock":
        return <Lock className="h-5 w-5" />;
      case "cpu":
        return <Cpu className="h-5 w-5" />;
      case "key":
      default:
        return <KeyRound className="h-5 w-5" />;
    }
  }

  async function startChallenge() {
    if (status === "verified") return;
    setError(null);
    setStatus("verifying");
    try {
      const res = await fetch("/api/bot-challenge", { method: "GET" });
      const data = await res.json();
      if (data.ok) {
        setTargetLabelTh(data.targetLabelTh);
        setOptions(data.options || []);
        setChallengeToken(data.challengeToken);
        setOpenedAt(nowMs());
        setStatus("challenging");
      } else {
        setError(data.error || "ไม่สามารถโหลดระบบป้องกันบอทได้ กรุณาลองใหม่");
        setStatus("idle");
      }
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ป้องกันบอทไม่สำเร็จ");
      setStatus("idle");
    }
  }

  async function handleSelectOption(selectedId: string) {
    setError(null);
    setStatus("verifying");
    const solveDurationMs = nowMs() - openedAt;
    try {
      const res = await fetch("/api/bot-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeToken,
          selectedId,
          solveDurationMs,
          honeypot,
        }),
      });
      const data = await res.json();
      if (data.ok && data.botPassToken) {
        setStatus("verified");
        onVerified(data.botPassToken);
      } else {
        setError(data.error || "เลือกไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
        onVerified(null);
        await startChallenge();
      }
    } catch {
      setError("ตรวจสอบไม่สำเร็จ กรุณาลองใหม่");
      setStatus("idle");
    }
  }

  return (
    <div className="rounded-xl border border-ink-300 bg-ink-50/70 p-3.5 space-y-2.5">
      {/* Honeypot ซ่อนสำหรับดักจับบอทสแปมที่กรอกทุกช่องอัตโนมัติ */}
      <input
        type="text"
        name="website_hp_url"
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        aria-hidden="true"
        className="hidden"
      />

      {/* แถวหลักสไตล์ Cloudflare Turnstile / Anti-Bot Shield */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {status === "verified" ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ok text-white shadow-2xs">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          ) : (
            <button
              type="button"
              onClick={startChallenge}
              disabled={status === "verifying"}
              aria-label="กดเพื่อยืนยันว่าไม่ใช่บอท"
              className="tap-target flex h-7 w-7 items-center justify-center rounded-md border-2 border-ink-400 bg-white hover:border-[#0050ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0050ff] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-all"
            >
              {status === "verifying" && (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0050ff]" />
              )}
            </button>
          )}

          <div>
            <button
              type="button"
              onClick={startChallenge}
              disabled={status === "verified" || status === "verifying"}
              className="block min-h-11 text-left text-xs font-bold text-ink-900 hover:text-[#0050ff] disabled:cursor-default cursor-pointer"
            >
              {status === "verified"
                ? "ยืนยันสำเร็จ: คุณไม่ใช่บอทอัตโนมัติ"
                : "กดยืนยันว่าฉันไม่ใช่บอท (Anti-Bot & Anti-DDoS)"}
            </button>
            <span className="text-xs text-ink-600 block">
              ป้องกันบอทสแปมสมัครสมาชิกและป้องกันการยิงคำขอรัวๆ
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[#0050ff]">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>ComproShield</span>
          </span>
          <span className="text-[10px] text-ink-600">WAF & Bot Guard</span>
        </div>
      </div>

      {/* กล่องท้าทายให้กดเลือกรูปสัญลักษณ์ที่ถูกต้อง */}
      {status === "challenging" && (
        <div className="rounded-lg border border-[#0050ff]/30 bg-white p-3 space-y-2.5 shadow-xs animate-reveal">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-ink-800">
              กรุณากดเลือกรูป:{" "}
              <strong className="text-[#0050ff] underline">{targetLabelTh}</strong>
            </span>
            <button
              type="button"
              onClick={startChallenge}
              title="สุ่มโจทย์ใหม่"
              className="tap-target inline-flex items-center gap-1 text-xs font-semibold text-ink-600 hover:text-ink-900 cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>เปลี่ยนโจทย์</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectOption(opt.id)}
                className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border border-ink-200 bg-ink-50/60 py-2.5 px-1.5 text-ink-800 hover:border-[#0050ff] hover:bg-info-bg/50 hover:text-[#0050ff] transition-all cursor-pointer"
              >
                {renderIcon(opt.id)}
                <span className="text-[10px] font-semibold text-center leading-tight">
                  {opt.labelTh}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-bad">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
