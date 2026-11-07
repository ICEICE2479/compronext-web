"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CornerDownRight, Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { StarRating } from "@/components/reviews/StarRating";
import { toast } from "@/lib/toast";
import { formatThaiDate } from "@/lib/format";

interface Review {
  id: string;
  userName: string;
  rating: number;
  text: string;
  createdAt: string;
  updatedAt?: string;
  reply?: { text: string; at: string } | null;
  mine: boolean;
}
interface Summary {
  avg: number;
  count: number;
  dist: number[];
}

const RATING_WORDS = ["", "แย่", "พอใช้", "โอเค", "ดี", "ดีมาก"];

export function StoreReviews({ storeKey, storeName, initialSummary }: { storeKey: string; storeName: string; initialSummary: Summary }) {
  const [summary, setSummary] = useState(initialSummary);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const load = useCallback(async () => {
    const d = await fetch(`/api/reviews?store=${encodeURIComponent(storeKey)}`).then((r) => r.json()).catch(() => null);
    if (!d?.ok) return;
    setReviews(d.reviews);
    setSummary(d.summary);
    setLoggedIn(d.loggedIn);
    setIsOwner(d.isOwner);
  }, [storeKey]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/reviews?store=${encodeURIComponent(storeKey)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.ok) return;
        setReviews(d.reviews);
        setSummary(d.summary);
        setLoggedIn(d.loggedIn);
        setIsOwner(d.isOwner);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [storeKey]);

  const mine = reviews?.find((r) => r.mine) ?? null;

  function startEdit() {
    setRating(mine?.rating ?? 0);
    setText(mine?.text ?? "");
    setEditing(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return toast("เลือกจำนวนดาวก่อน", { tone: "error" });
    setBusy(true);
    const d = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store: storeKey, rating, text }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false }));
    setBusy(false);
    if (!d.ok) return toast(d.error || "ส่งรีวิวไม่สำเร็จ", { tone: "error" });
    toast(mine ? "แก้รีวิวแล้ว" : "ขอบคุณสำหรับรีวิว");
    setEditing(false);
    load();
  }

  async function remove() {
    if (!window.confirm("ลบรีวิวของคุณ?")) return;
    await fetch(`/api/reviews?store=${encodeURIComponent(storeKey)}`, { method: "DELETE" });
    toast("ลบรีวิวแล้ว");
    load();
  }

  async function sendReply(reviewId: string) {
    const d = await fetch("/api/reviews/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, text: replyText }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false }));
    if (!d.ok) return toast(d.error || "ตอบไม่สำเร็จ", { tone: "error" });
    setReplyFor(null);
    setReplyText("");
    toast("ตอบรีวิวแล้ว");
    load();
  }

  const shown = hover || rating;

  return (
    <section className="space-y-5">
      <div className="grid gap-5 rounded-3xl border border-ink-200 bg-surface p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="text-center sm:pr-6">
          <p className="font-display text-5xl font-bold text-ink-950">{summary.count ? summary.avg.toFixed(1) : "–"}</p>
          <StarRating value={summary.avg} size={18} className="mt-1" />
          <p className="mt-1 text-xs text-ink-500">{summary.count} รีวิว</p>
        </div>
        <ul className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = summary.dist[n - 1] ?? 0;
            const pct = summary.count ? (c / summary.count) * 100 : 0;
            return (
              <li key={n} className="flex items-center gap-2 text-xs text-ink-600">
                <span className="w-3 text-right">{n}</span>
                <Star className="h-3 w-3 text-amber-400" fill="currentColor" strokeWidth={0} />
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <span className="bar-grow block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-6 text-right tabular-nums">{c}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* เขียนรีวิว */}
      {!isOwner &&
        (loggedIn ? (
          editing || !mine ? (
            <form onSubmit={submit} className="space-y-3 rounded-3xl border border-ink-200 bg-surface p-5">
              <p className="font-semibold text-ink-950">{mine ? "แก้รีวิวของคุณ" : `ให้คะแนนร้าน ${storeName}`}</p>
              <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHover(n)}
                    aria-label={`${n} ดาว`}
                    aria-pressed={rating === n}
                    className="star-btn flex h-11 w-11 items-center justify-center rounded-full"
                  >
                    <Star className={`h-8 w-8 ${n <= shown ? "text-amber-400" : "text-ink-200"}`} fill="currentColor" strokeWidth={0} />
                  </button>
                ))}
                <span className="ml-2 text-sm font-semibold text-ink-700">{RATING_WORDS[shown]}</span>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="เล่าประสบการณ์ เช่น ส่งไว ของตรงปก ตอบแชทเร็ว"
                className="input resize-none"
              />
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="btn btn-primary">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} ส่งรีวิว
                </button>
                {mine && (
                  <button type="button" onClick={() => setEditing(false)} className="btn btn-outline">
                    ยกเลิก
                  </button>
                )}
              </div>
            </form>
          ) : null
        ) : (
          <Link href="/login" className="flex items-center justify-between rounded-3xl border border-dashed border-ink-300 p-5 text-sm text-ink-700 hover:border-info">
            เข้าสู่ระบบเพื่อให้ดาวและเขียนรีวิวร้านนี้
            <span className="font-semibold text-info">เข้าสู่ระบบ</span>
          </Link>
        ))}

      {/* รายการรีวิว */}
      {reviews === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-100" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="rounded-2xl bg-ink-50 p-6 text-center text-sm text-ink-600">ยังไม่มีรีวิว เป็นคนแรกที่รีวิวร้านนี้</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="review-in rounded-2xl border border-ink-200 bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-info-bg text-sm font-bold text-info">
                    {r.userName.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink-950">
                      {r.userName} {r.mine && <span className="text-xs font-normal text-ink-500">(คุณ)</span>}
                    </p>
                    <div className="flex items-center gap-2">
                      <StarRating value={r.rating} size={13} />
                      <span className="text-[11px] text-ink-500">{formatThaiDate(r.updatedAt ?? r.createdAt)}</span>
                    </div>
                  </div>
                </div>
                {r.mine && !editing && (
                  <span className="flex gap-1">
                    <button type="button" onClick={startEdit} aria-label="แก้รีวิว" className="icon-btn h-9 w-9 border-transparent p-0">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={remove} aria-label="ลบรีวิว" className="icon-btn h-9 w-9 border-transparent p-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </div>
              <p className="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-ink-800">{r.text}</p>
              {r.reply && (
                <div className="mt-3 flex gap-2 rounded-xl bg-ink-50 p-3 text-sm">
                  <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                  <div>
                    <p className="text-xs font-semibold text-ink-700">ร้านตอบกลับ</p>
                    <p className="whitespace-pre-line text-ink-800">{r.reply.text}</p>
                  </div>
                </div>
              )}
              {isOwner &&
                (replyFor === r.id ? (
                  <div className="mt-3 flex gap-2">
                    <input value={replyText} onChange={(e) => setReplyText(e.target.value)} maxLength={600} placeholder="ตอบลูกค้า…" className="input flex-1" />
                    <button type="button" onClick={() => sendReply(r.id)} className="btn btn-primary">
                      ตอบ
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setReplyFor(r.id);
                      setReplyText(r.reply?.text ?? "");
                    }}
                    className="mt-2 text-xs font-semibold text-info"
                  >
                    {r.reply ? "แก้คำตอบ" : "ตอบรีวิวนี้"}
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
