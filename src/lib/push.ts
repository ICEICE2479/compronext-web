import "server-only";
import { after } from "next/server";
import type { RuntimeDatabase } from "@/lib/data/store";

/**
 * แจ้งเตือนบนมือถือ/คอม (Web Push) — ตั้ง VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
 * สร้างคีย์: npx web-push generate-vapid-keys
 */
export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PUBLIC_KEY : null;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

type Sub = RuntimeDatabase["pushSubs"][string][number];

/** ส่งแจ้งเตือนหลังตอบกลับผู้ใช้แล้ว (ไม่ทำให้ API ช้า) — ที่หมดอายุ (404/410) จะถูกลบทิ้ง */
export function queuePush(db: RuntimeDatabase, target: { userIds?: string[]; email?: string }, payload: PushPayload) {
  if (!pushPublicKey()) return;
  const targets: Array<{ owner: string; sub: Sub }> = [];
  for (const [owner, subs] of Object.entries(db.pushSubs ?? {})) {
    for (const sub of subs) {
      if (target.userIds?.includes(owner) || (target.email && sub.email.toLowerCase() === target.email.toLowerCase())) targets.push({ owner, sub });
    }
  }
  if (!targets.length) return;
  const run = async () => {
    const { default: webpush } = await import("web-push");
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@compronext.app", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    const dead: Array<{ owner: string; endpoint: string }> = [];
    await Promise.allSettled(
      targets.map(({ owner, sub }) =>
        webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 * 60 * 24 }).catch((e: { statusCode?: number }) => {
          if (e.statusCode === 404 || e.statusCode === 410) dead.push({ owner, endpoint: sub.endpoint });
        })
      )
    );
    if (dead.length) {
      const { readDb, writeDb } = await import("@/lib/data/store");
      const fresh = readDb();
      for (const d of dead) fresh.pushSubs[d.owner] = (fresh.pushSubs[d.owner] ?? []).filter((s) => s.endpoint !== d.endpoint);
      writeDb(fresh);
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}
