"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "@/lib/toast";

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

/** ปุ่มเปิด/ปิดแจ้งเตือนในเครื่องนี้ (ข้อความจากร้าน + ของที่ติดตามลดราคา) */
export function PushToggle({ className = "" }: { className?: string }) {
  const [state, setState] = useState<"loading" | "unsupported" | "off" | "on" | "blocked" | "unconfigured">("loading");
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      const res = await fetch("/api/push").then((r) => r.json()).catch(() => null);
      if (!alive) return;
      if (!res?.publicKey) return setState("unconfigured");
      setKey(res.publicKey);
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (alive) setState(sub ? "on" : "off");
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function enable() {
    if (!key) return;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "blocked" : "off");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
      const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!r.ok) throw new Error();
      setState("on");
      toast("เปิดแจ้งเตือนแล้ว");
    } catch {
      toast("เปิดแจ้งเตือนไม่สำเร็จ");
    }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setState("off");
  }

  if (state === "loading" || state === "unsupported" || state === "unconfigured") return null;
  if (state === "blocked")
    return <p className={`text-xs text-ink-600 ${className}`}>แจ้งเตือนถูกปิดในเบราว์เซอร์ — เปิดได้ที่การตั้งค่าเว็บไซต์ของเบราว์เซอร์</p>;
  return (
    <button type="button" onClick={state === "on" ? disable : enable} className={`chip tap-target rounded-full ${className}`} data-active={state === "on"} aria-pressed={state === "on"}>
      {state === "on" ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
      {state === "on" ? "แจ้งเตือนเปิดอยู่" : "เปิดแจ้งเตือน"}
    </button>
  );
}
