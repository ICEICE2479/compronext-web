import "server-only";
import { getCurrentUser, isAdminAuthenticated, type UserSession } from "@/lib/auth";
import { after } from "next/server";
import { siteUrl } from "@/lib/seo";
import { getActivePartnerByEmail, readDb, type RuntimeDatabase } from "@/lib/data/store";
import { sendComproNextEmail } from "@/lib/serverless-stack";
import { CASE_STATUSES } from "@/lib/returns";
import type { SupportCaseRecord } from "@/lib/returns";

export type CaseViewer =
  | { role: "customer"; user: UserSession }
  | { role: "store"; user: UserSession; partnerId: string; partnerName: string }
  | { role: "admin" }
  | null;

/** ใครกำลังดูเคสนี้ (ลูกค้าเจ้าของเคส / ร้านเจ้าของเคส / แอดมิน) — คนอื่นเห็นไม่ได้ */
export async function caseViewer(c: SupportCaseRecord): Promise<CaseViewer> {
  if (await isAdminAuthenticated()) return { role: "admin" };
  const user = await getCurrentUser();
  if (!user) return null;
  const partner = getActivePartnerByEmail(user);
  if (partner && partner.id === c.partnerId) return { role: "store", user, partnerId: partner.id, partnerName: partner.name };
  if (c.userId === user.id) return { role: "customer", user };
  return null;
}

export function findCase(db: RuntimeDatabase, idOrCode: string): SupportCaseRecord | undefined {
  const key = idOrCode.trim().toUpperCase();
  return db.cases.find((c) => c.id === idOrCode || c.code === key);
}

/** ส่งอีเมลแจ้งความคืบหน้าเคส (หลังตอบผู้ใช้แล้ว ไม่ทำให้ช้า · ไม่มีระบบอีเมล = ข้ามเงียบๆ) */
export function notifyCaseEmail(c: SupportCaseRecord, to: "customer" | "store", headline: string, note: string) {
  const run = async () => {
    const email = to === "customer" ? c.email : readDb().partners.find((p) => p.id === c.partnerId)?.email;
    if (!email) return;
    const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL ? siteUrl() : "";
    const link = to === "customer" ? `${site}/returns/${c.code}` : `${site}/partner/returns`;
    await sendComproNextEmail({
      to: email,
      subject: `[ComproNext] เคส ${c.code}: ${headline}`,
      roomOrBuildTitle: `${headline} — ${c.productName}`,
      totalLabel: "สถานะ: ",
      totalPriceFormatted: CASE_STATUSES[c.status],
      itemsSummary: [`เลขเคส ${c.code} · ร้าน ${c.storeName}`, ...(note ? [`ข้อความ: ${note}`] : []), `ดูรายละเอียด: ${link}`],
    }).catch(() => {});
  };
  try {
    after(run);
  } catch {
    void run();
  }
}
