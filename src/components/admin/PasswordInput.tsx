"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, Wand2 } from "lucide-react";
import { checkPasswordPolicy, generatePassword } from "@/lib/admin/password-policy";

const SCORE_LABELS = ["อ่อนมาก", "อ่อน", "พอใช้", "ดี", "แข็งแรง"] as const;
const SCORE_COLORS = ["bg-bad", "bg-bad", "bg-warn", "bg-ok", "bg-ok"] as const;

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  username,
  email,
  withGenerator = false,
  autoComplete = "new-password",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  username?: string;
  email?: string;
  withGenerator?: boolean;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const policy = checkPasswordPolicy(value, { username, email });
  const hintId = `${id}-hint`;

  function handleGenerate() {
    // Generated in the browser only; never sent anywhere except the form's own request.
    onChange(generatePassword());
    setVisible(true);
    setCopied(false);
    setCopyError(false);
  }

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex items-stretch gap-1.5">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setCopied(false);
          }}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={hintId}
          aria-invalid={value.length > 0 && !policy.ok}
          required
          className="input min-h-11 flex-1 font-mono"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          aria-pressed={visible}
          className="btn btn-outline tap-target px-3"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        {withGenerator && (
          <button
            type="button"
            onClick={handleCopy}
            disabled={!value}
            aria-label="คัดลอกรหัสผ่าน"
            className="btn btn-outline tap-target px-3"
          >
            {copied ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}
          </button>
        )}
      </div>

      {withGenerator && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleGenerate} className="btn btn-outline btn-sm min-h-11">
            <Wand2 className="h-3.5 w-3.5" />
            <span>สร้างรหัสผ่าน</span>
          </button>
          <span className="text-xs text-ink-600">
            สร้างในเบราว์เซอร์นี้เท่านั้น — บันทึกไว้ในตัวจัดการรหัสผ่านก่อนส่งฟอร์ม
          </span>
        </div>
      )}

      <div id={hintId} aria-live="polite" className="space-y-1.5">
        {value.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i < policy.score ? SCORE_COLORS[policy.score] : "bg-ink-100"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-ink-700">
                ความแข็งแรง: {SCORE_LABELS[policy.score]}
              </span>
            </div>
            {policy.errors.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-xs font-semibold text-bad">
                {policy.errors.map((er) => (
                  <li key={er}>{er}</li>
                ))}
              </ul>
            )}
          </>
        )}
        {copyError && (
          <p role="alert" className="text-xs font-semibold text-bad">
            คัดลอกอัตโนมัติไม่สำเร็จ กรุณาเลือกและคัดลอกด้วยตนเอง
          </p>
        )}
      </div>
    </div>
  );
}
