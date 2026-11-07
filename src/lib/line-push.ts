import "server-only";

/**
 * ส่งข้อความหาสมาชิกที่ล็อกอินด้วย LINE ผ่าน LINE Official Account (Messaging API)
 * ตั้ง LINE_MESSAGING_TOKEN = Channel access token (long-lived) ของ OA
 * ช่อง LINE Login กับ OA ต้องอยู่ Provider เดียวกัน และลูกค้าต้องเป็นเพื่อนกับ OA (ล็อกอินจะชวนแอดเพื่อนให้)
 */
export function linePushEnabled(): boolean {
  return Boolean(process.env.LINE_MESSAGING_TOKEN);
}

/** userId ของ LINE จากสมาชิก (clerkUserId = "line:<sub>") */
export function lineUserIdOf(user: { clerkUserId?: string } | undefined): string | null {
  const id = user?.clerkUserId;
  return id?.startsWith("line:") && /^U[0-9a-f]{32}$/.test(id.slice(5)) ? id.slice(5) : null;
}

export async function pushLineText(to: string, text: string, url?: string): Promise<boolean> {
  const token = process.env.LINE_MESSAGING_TOKEN;
  if (!token) return false;
  const message = url
    ? {
        type: "template",
        altText: text.slice(0, 400),
        template: { type: "buttons", text: text.slice(0, 160), actions: [{ type: "uri", label: "ดูสินค้า", uri: url }] },
      }
    : { type: "text", text: text.slice(0, 5000) };
  try {
    const r = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [message] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) console.error("[line-push]", r.status, (await r.text()).slice(0, 200));
    return r.ok;
  } catch {
    return false;
  }
}
