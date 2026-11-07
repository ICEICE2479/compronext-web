"use client";

import { PushToggle } from "@/components/PushToggle";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCheck, ChevronLeft, Loader2, MessageCircle, Send, Store, User } from "lucide-react";
import { formatTHB } from "@/lib/format";
import { toast } from "@/lib/toast";
import { ProductVisual } from "@/components/ProductVisual";
import EmptyState from "@/components/EmptyState";

interface ThreadItem {
  id: string;
  side: "user" | "store";
  title: string;
  storeKey: string;
  last: { text: string; at: string; from: "user" | "store" } | null;
  unread: number;
  updatedAt: string;
}
interface Msg {
  id: string;
  from: "user" | "store";
  text: string;
  at: string;
  productId?: string | null;
  pending?: boolean;
}
interface ProductRef {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

export function MessagesClient({ initialThreadId }: { initialThreadId: string | null }) {
  const [threads, setThreads] = useState<ThreadItem[] | null>(null);
  const [active, setActive] = useState<string | null>(initialThreadId);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [products, setProducts] = useState<Record<string, ProductRef | null>>({});
  const [meta, setMeta] = useState<{ side: "user" | "store"; title: string; storeKey: string; otherLastRead: string } | null>(null);
  const [text, setText] = useState("");
  const [loadingThread, setLoadingThread] = useState(!!initialThreadId);
  const [listFailed, setListFailed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef("");

  const loadThreads = useCallback(async () => {
    const d = await fetch("/api/chat").then((r) => r.json()).catch(() => null);
    if (d?.ok) setThreads(d.threads);
  }, []);

  // รายการห้อง: โหลดครั้งแรก + ทุก 15 วินาที
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/chat")
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          if (d?.ok) {
            setThreads(d.threads);
            setListFailed(false);
          } else setListFailed(true);
        })
        .catch(() => alive && setListFailed(true));
    };
    tick();
    const t = window.setInterval(tick, 15000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  // ห้องที่เปิดอยู่: โหลดทั้งหมด แล้วดึงข้อความใหม่ทุก 4 วินาที
  useEffect(() => {
    if (!active) return;
    let alive = true;
    lastAtRef.current = "";
    const pull = async (initial: boolean) => {
      if (!initial && document.visibilityState !== "visible") return;
      const after = initial ? "" : lastAtRef.current;
      const d = await fetch(`/api/chat/${encodeURIComponent(active)}${after ? `?after=${encodeURIComponent(after)}` : ""}`)
        .then((r) => r.json())
        .catch(() => null);
      if (!alive || !d?.ok) {
        if (initial && alive) setLoadingThread(false);
        return;
      }
      setMeta({ side: d.side, title: d.title, storeKey: d.storeKey, otherLastRead: d.otherLastRead });
      setProducts((p) => ({ ...p, ...d.products }));
      if (initial) {
        setMessages(d.messages);
        window.dispatchEvent(new CustomEvent("compronext:chat-read"));
      }
      else if (d.messages.length) {
        window.dispatchEvent(new CustomEvent("compronext:chat-read"));
        setMessages((m) => [...m.filter((x) => !x.pending), ...d.messages.filter((x: Msg) => !m.some((y) => y.id === x.id))]);
      }
      const last = d.messages[d.messages.length - 1];
      if (last) lastAtRef.current = last.at;
      if (initial) setLoadingThread(false);
    };
    pull(true);
    const t = window.setInterval(() => pull(false), 4000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, active]);

  function open(id: string) {
    setActive(id);
    setLoadingThread(true);
    setMessages([]);
    setMeta(null);
    window.history.replaceState(null, "", `/messages?t=${encodeURIComponent(id)}`);
    setThreads((list) => list?.map((t) => (t.id === id ? { ...t, unread: 0 } : t)) ?? list);
  }

  function back() {
    setActive(null);
    window.history.replaceState(null, "", "/messages");
    loadThreads();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !active || !meta) return;
    const temp: Msg = { id: `tmp-${Date.now()}`, from: meta.side, text: body, at: new Date().toISOString(), pending: true };
    setMessages((m) => [...m, temp]);
    setText("");
    const d = await fetch(`/api/chat/${encodeURIComponent(active)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false }));
    if (!d.ok) {
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      setText(body);
      return toast(d.error || "ส่งไม่สำเร็จ", { tone: "error" });
    }
    setMessages((m) => m.map((x) => (x.id === temp.id ? d.message : x)));
    lastAtRef.current = d.message.at;
  }

  const myLastIndex = meta ? messages.map((m) => m.from).lastIndexOf(meta.side) : -1;

  return (
    <div className="grid h-[calc(100dvh-12rem)] min-h-[440px] overflow-hidden rounded-3xl shadow-[var(--shadow-card)] border border-ink-200 bg-surface lg:h-[calc(100dvh-10rem)] lg:grid-cols-[320px_1fr]">
      {/* รายการห้อง */}
      <aside className={`min-h-0 flex-col border-ink-100 lg:flex lg:border-r ${active ? "hidden" : "flex"}`}>
        <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
          <h1 className="font-display text-lg font-bold text-ink-950">ข้อความ</h1>
          <PushToggle className="text-xs" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {threads === null && listFailed ? (
            <EmptyState
              tone="error"
              title="โหลดข้อความไม่สำเร็จ"
              description="ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง"
              action={{ label: "ลองใหม่", onClick: () => { setListFailed(false); loadThreads(); } }}
            />
          ) : threads === null ? (
            <div className="space-y-2 p-3" role="status" aria-label="กำลังโหลดข้อความ">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-16 rounded-2xl" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <EmptyState
              icon={<MessageCircle className="h-10 w-10 text-ink-400" aria-hidden="true" />}
              title="ยังไม่มีข้อความ"
              description="เริ่มแชทกับร้านพาร์ตเนอร์เพื่อถามสินค้าหรือสต็อก"
              action={{ label: "ดูร้านค้าที่ทักได้", href: "/stores" }}
            />
          ) : (
            <ul>
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => open(t.id)}
                    aria-current={active === t.id ? "true" : undefined}
                    className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info ${active === t.id ? "bg-info-bg/60" : ""}`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-info-bg text-info">
                      {t.side === "user" ? <Store className="h-5 w-5" aria-hidden="true" /> : <User className="h-5 w-5" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink-950">{t.title}</span>
                        <span className="shrink-0 text-xs text-ink-600">{t.last ? dayOf(t.last.at) : ""}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-xs ${t.unread ? "font-semibold text-ink-900" : "text-ink-600"}`}>
                          {t.last ? `${t.last.from === t.side ? "คุณ: " : ""}${t.last.text}` : ""}
                        </span>
                        {t.unread > 0 && <span className="icon-badge static shrink-0">{t.unread}</span>}
                      </span>
                      {t.side === "store" && <span className="text-xs font-semibold text-ok">ลูกค้าทักร้านคุณ</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ห้องแชท */}
      <section className={`min-h-0 flex-col ${active ? "flex" : "hidden lg:flex"}`}>
        {!active ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-ink-600">เลือกห้องแชททางซ้าย</div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b border-ink-100 px-3 py-2.5">
              <button type="button" onClick={back} aria-label="กลับ" className="icon-btn h-11 w-11 border-transparent p-0 lg:hidden">
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink-950">{meta?.title ?? "…"}</p>
                {meta?.side === "user" && (
                  <Link href={`/stores/${encodeURIComponent(meta.storeKey)}`} className="text-xs text-info">
                    ดูร้าน & รีวิว
                  </Link>
                )}
              </div>
            </header>
            <div role="log" aria-label="ข้อความในห้องแชท" className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-ink-50/60 px-3 py-4">
              {loadingThread && messages.length === 0 ? (
                <div className="flex justify-center py-10" role="status" aria-label="กำลังโหลด">
                  <Loader2 className="h-6 w-6 animate-spin text-ink-400 motion-reduce:animate-none" aria-hidden="true" />
                </div>
              ) : !meta ? (
                <EmptyState
                  tone="error"
                  title="เปิดห้องแชทไม่ได้"
                  description="อาจไม่มีห้องนี้หรือการเชื่อมต่อขัดข้อง"
                  action={{ label: "กลับไปรายการ", onClick: back }}
                />
              ) : messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-600">ยังไม่มีข้อความ ลองทักทายได้เลย</p>
              ) : (
                messages.map((m, i) => {
                  const mine = m.from === meta?.side;
                  const p = m.productId ? products[m.productId] : null;
                  const seen = mine && i === myLastIndex && !!meta?.otherLastRead && meta.otherLastRead >= m.at;
                  return (
                    <div key={m.id} className={`chat-bubble flex flex-col ${mine ? "items-end" : "items-start"}`}>
                      {p && (
                        <Link href={`/products/${p.id}`} className="mb-1 flex max-w-[80%] items-center gap-2 rounded-2xl border border-ink-200 bg-surface p-2">
                          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-ink-50">
                            <ProductVisual productId={p.id} name={p.name} category="other" imageUrl={p.imageUrl} size="tile" transparentBg />
                          </span>
                          <span className="min-w-0">
                            <span className="line-clamp-2 text-xs font-semibold text-ink-900">{p.name}</span>
                            <span className="text-xs font-bold text-ink-950">{formatTHB(p.price)}</span>
                          </span>
                        </Link>
                      )}
                      <div
                        className={`max-w-[80%] whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-sm ${
                          mine ? "rounded-br-md bg-info text-white" : "rounded-bl-md border border-ink-200 bg-surface text-ink-900"
                        } ${m.pending ? "opacity-60" : ""}`}
                      >
                        {m.text}
                      </div>
                      <span className="mt-0.5 flex items-center gap-1 px-1 text-xs text-ink-600">
                        {timeOf(m.at)}
                        {seen && (
                          <>
                            <CheckCheck className="h-3 w-3 text-info" aria-hidden="true" /> อ่านแล้ว
                          </>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={send} className="flex items-end gap-2 border-t border-ink-100 p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder="พิมพ์ข้อความ…"
                aria-label="พิมพ์ข้อความ"
                className="input max-h-32 min-h-11 flex-1 resize-none rounded-2xl"
              />
              <button type="submit" disabled={!text.trim()} aria-label="ส่ง" className="icon-btn icon-btn-primary h-11 w-11 shrink-0 p-0">
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
