import "server-only";
import { getCurrentUser, type UserSession } from "@/lib/auth";
import { getActivePartnerByEmail, type ChatThreadRecord, type PartnerRecord } from "@/lib/data/store";

export interface ChatViewer {
  user: UserSession;
  partner: PartnerRecord | null;
}

export async function getChatViewer(): Promise<ChatViewer | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { user, partner: getActivePartnerByEmail(user) };
}

/** คนนี้อยู่ฝั่งไหนของห้องแชท (ไม่ใช่สมาชิกห้อง = null) */
export function sideOf(thread: ChatThreadRecord, viewer: ChatViewer): "user" | "store" | null {
  if (viewer.partner && thread.partnerId === viewer.partner.id) return "store";
  if (thread.userId === viewer.user.id) return "user";
  return null;
}

// กันสแปม: ไม่เกิน 20 ข้อความต่อนาทีต่อคน
const sent = new Map<string, number[]>();
export function allowSend(userId: string): boolean {
  const now = Date.now();
  const list = (sent.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 20) return false;
  list.push(now);
  sent.set(userId, list);
  return true;
}
