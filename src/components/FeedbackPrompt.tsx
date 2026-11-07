"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Star } from "lucide-react";

const KEY = "cn-feedback-sent";
const sub = () => () => {};
const sent = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** “เว็บนี้ใช้ง่ายไหม?” 1–5 ดาว + บอกสิ่งที่ติด (โชว์ครั้งเดียวต่อเครื่อง) */
export function FeedbackPrompt() {
  const already = useSyncExternalStore(sub, sent, () => true);
  const path = usePathname();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  if (already && state !== "done") return null;
  if (path.startsWith("/admin") || path.startsWith("/partner")) return null;

  async function send() {
    setState("busy");
    await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stars, text, page: path }) }).catch(() => {});
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* โหมดส่วนตัว */
    }
    setState("done");
  }

  if (state === "done") return <p className="rounded-2xl bg-ok-bg px-4 py-3 text-sm font-semibold text-ok">ขอบคุณที่ช่วยบอก 🙏 เราจะเอาไปปรับให้ดีขึ้น</p>;
  return (
    <div className="space-y-2 rounded-2xl border border-ink-200 bg-surface p-4">
      <p className="text-sm font-semibold text-ink-950">ช่วยบอกเราหน่อย: เว็บนี้ใช้ง่ายไหม?</p>
      <div className="flex gap-1" role="radiogroup" aria-label="ให้คะแนน 1 ถึง 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} ดาว`} onClick={() => setStars(n)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink-50">
            <Star className={`h-6 w-6 ${n <= stars ? "text-amber-400" : "text-ink-300"}`} fill={n <= stars ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
      {stars > 0 && (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={800} placeholder={stars <= 3 ? "ติดตรงไหน อยากให้แก้อะไร" : "ชอบตรงไหน (ไม่บังคับ)"} className="input w-full py-2" />
          <button type="button" disabled={state === "busy"} onClick={send} className="btn btn-primary h-10 rounded-full px-5 text-sm">
            ส่ง
          </button>
        </>
      )}
    </div>
  );
}
