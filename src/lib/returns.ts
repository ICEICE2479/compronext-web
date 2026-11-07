/**
 * ReturnEase — ระบบหลังการขายของ ComproNext
 * 1) แจ้งปัญหา (ลูกค้า + แนบหลักฐาน) 2) จัดการเคส (ร้าน) 3) ติดตามสถานะ (ลูกค้า) 4) รายงาน (ร้าน/แอดมิน)
 * ไฟล์นี้เป็นตรรกะล้วน (ไม่แตะฐานข้อมูล) เพื่อให้ทดสอบได้
 */

export const CASE_TYPES = {
  defect: "สินค้าเสีย / ใช้งานไม่ได้",
  damaged: "ได้รับของเสียหายจากขนส่ง",
  wrong_item: "ได้ของผิดรุ่น / ผิดสี",
  missing: "ของไม่ครบ",
  not_as_described: "ไม่ตรงตามที่ลงขาย",
  other: "อื่นๆ",
} as const;
export type CaseType = keyof typeof CASE_TYPES;

export const CASE_WISHES = {
  replace: "เปลี่ยนสินค้าใหม่",
  repair: "ส่งซ่อม / เคลม",
  refund: "คืนเงิน",
  other: "อยากคุยกับร้านก่อน",
} as const;
export type CaseWish = keyof typeof CASE_WISHES;

export const CASE_STATUSES = {
  submitted: "ส่งเรื่องแล้ว",
  reviewing: "ร้านกำลังตรวจสอบ",
  need_info: "ร้านขอข้อมูลเพิ่ม",
  approved: "อนุมัติแล้ว กำลังดำเนินการ",
  rejected: "ไม่อนุมัติ",
  resolved: "เสร็จสิ้น",
} as const;
export type CaseStatus = keyof typeof CASE_STATUSES;

/** ขั้นที่ลูกค้าเห็นในแถบติดตามสถานะ */
export const TRACK_STEPS: Array<{ key: CaseStatus; label: string }> = [
  { key: "submitted", label: "ส่งเรื่อง" },
  { key: "reviewing", label: "ร้านตรวจสอบ" },
  { key: "approved", label: "ดำเนินการ" },
  { key: "resolved", label: "เสร็จสิ้น" },
];

export interface CaseEvent {
  at: string;
  by: "customer" | "store" | "admin";
  name: string;
  status?: CaseStatus;
  note: string;
  files?: string[];
}

export interface SupportCaseRecord {
  id: string;
  /** เลขเคสที่ลูกค้าเห็น เช่น RE-7K3M9Q */
  code: string;
  userId: string;
  userName: string;
  email: string;
  partnerId: string;
  storeName: string;
  productId: string | null;
  productName: string;
  orderRef: string;
  type: CaseType;
  wish: CaseWish;
  description: string;
  evidence: string[];
  status: CaseStatus;
  events: CaseEvent[];
  createdAt: string;
  updatedAt: string;
  /** ร้านตอบครั้งแรกเมื่อ (ไว้วัดเวลาตอบกลับ) */
  firstReplyAt?: string;
  closedAt?: string;
  /** ลูกค้าให้คะแนนการดูแลหลังปิดเคส */
  rating?: { stars: number; note: string; at: string };
}

/** ร้านเปลี่ยนสถานะได้แค่ตามลำดับที่สมเหตุสมผล (ปิดเคสแล้วเปิดใหม่ไม่ได้) */
const NEXT: Record<CaseStatus, CaseStatus[]> = {
  submitted: ["reviewing", "need_info", "approved", "rejected"],
  reviewing: ["need_info", "approved", "rejected"],
  need_info: ["reviewing", "approved", "rejected"],
  approved: ["resolved"],
  rejected: [],
  resolved: [],
};

export function allowedNext(status: CaseStatus): CaseStatus[] {
  return NEXT[status];
}

export function isClosed(status: CaseStatus): boolean {
  return status === "rejected" || status === "resolved";
}

/** ตำแหน่งในแถบติดตาม (need_info นับเป็นขั้นตรวจสอบ, rejected จบที่ขั้นตรวจสอบ) */
export function trackIndex(status: CaseStatus): number {
  if (status === "need_info" || status === "rejected") return 1;
  return TRACK_STEPS.findIndex((s) => s.key === status);
}

export function caseCode(rand: () => number = Math.random): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ไม่มี 0/O/1/I ให้อ่านง่าย
  let out = "RE-";
  for (let i = 0; i < 6; i++) out += abc[Math.floor(rand() * abc.length)];
  return out;
}

/** สิ่งที่ลูกค้าควรทำต่อ (โชว์บนหน้าติดตาม) */
export function nextStepText(c: Pick<SupportCaseRecord, "status">): string {
  switch (c.status) {
    case "submitted":
      return "รอร้านเปิดดูเรื่อง ปกติร้านตอบภายใน 1–2 วันทำการ";
    case "reviewing":
      return "ร้านกำลังตรวจหลักฐาน ถ้าร้านขอข้อมูลเพิ่มจะแจ้งที่หน้านี้";
    case "need_info":
      return "ร้านขอข้อมูลเพิ่ม — ตอบกลับหรือแนบรูปด้านล่าง เรื่องจะเดินต่อทันที";
    case "approved":
      return "ร้านอนุมัติแล้ว ทำตามขั้นตอนที่ร้านแจ้งในไทม์ไลน์ (เช่น ส่งของกลับ)";
    case "rejected":
      return "ร้านไม่อนุมัติ ดูเหตุผลในไทม์ไลน์ ถ้าไม่เห็นด้วยแจ้งทีม ComproNext ได้";
    case "resolved":
      return "เคสเสร็จสิ้นแล้ว ขอบคุณที่แจ้งเข้ามา";
  }
}

const HOUR = 3_600_000;

export interface CaseReport {
  total: number;
  open: number;
  byStatus: Record<CaseStatus, number>;
  byType: Array<{ type: CaseType; label: string; count: number; pct: number }>;
  byWish: Array<{ wish: CaseWish; label: string; count: number }>;
  /** ชั่วโมงเฉลี่ยที่ร้านตอบครั้งแรก */
  avgFirstReplyHours: number | null;
  /** วันเฉลี่ยจนปิดเคส */
  avgCloseDays: number | null;
  /** % เคสที่จบแบบอนุมัติ/แก้ไขให้ (จากเคสที่ปิดแล้ว) */
  resolvedRate: number | null;
  /** สินค้าที่มีปัญหาบ่อยสุด */
  topProducts: Array<{ name: string; count: number }>;
  /** จำนวนเคสใหม่รายสัปดาห์ (ล่าสุดอยู่ท้าย) */
  weekly: Array<{ weekStart: string; count: number }>;
  /** เคสที่ค้างนานเกิน 48 ชม. โดยร้านยังไม่ตอบ */
  overdue: number;
  /** คะแนนความพอใจหลังการขายเฉลี่ย (1–5) */
  rating: { avg: number; count: number } | null;
}

/** สรุปสถิติหลังการขาย (ใช้ทั้งหลังร้านและหลังบ้านแอดมิน) */
export function summarizeCases(cases: SupportCaseRecord[], now = Date.now(), weeks = 8): CaseReport {
  const byStatus = Object.fromEntries(Object.keys(CASE_STATUSES).map((k) => [k, 0])) as Record<CaseStatus, number>;
  const typeCount = new Map<CaseType, number>();
  const wishCount = new Map<CaseWish, number>();
  const prod = new Map<string, number>();
  let replySum = 0;
  let replyN = 0;
  let closeSum = 0;
  let closeN = 0;
  let good = 0;
  let overdue = 0;
  let starSum = 0;
  let starN = 0;
  for (const c of cases) {
    if (c.rating) {
      starSum += c.rating.stars;
      starN++;
    }
    byStatus[c.status]++;
    typeCount.set(c.type, (typeCount.get(c.type) ?? 0) + 1);
    wishCount.set(c.wish, (wishCount.get(c.wish) ?? 0) + 1);
    prod.set(c.productName, (prod.get(c.productName) ?? 0) + 1);
    const created = Date.parse(c.createdAt);
    if (c.firstReplyAt) {
      replySum += (Date.parse(c.firstReplyAt) - created) / HOUR;
      replyN++;
    } else if (!isClosed(c.status) && now - created > 48 * HOUR) overdue++;
    if (c.closedAt) {
      closeSum += (Date.parse(c.closedAt) - created) / (24 * HOUR);
      closeN++;
      if (c.status === "resolved") good++;
    }
  }
  const total = cases.length;
  const weekMs = 7 * 24 * HOUR;
  const start = now - weeks * weekMs;
  const weekly = Array.from({ length: weeks }, (_, i) => ({ weekStart: new Date(start + i * weekMs).toISOString().slice(0, 10), count: 0 }));
  for (const c of cases) {
    const i = Math.floor((Date.parse(c.createdAt) - start) / weekMs);
    if (i >= 0 && i < weeks) weekly[i].count++;
  }
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    total,
    open: cases.filter((c) => !isClosed(c.status)).length,
    byStatus,
    byType: [...typeCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, label: CASE_TYPES[type], count, pct: Math.round((count / total) * 100) })),
    byWish: [...wishCount.entries()].sort((a, b) => b[1] - a[1]).map(([wish, count]) => ({ wish, label: CASE_WISHES[wish], count })),
    avgFirstReplyHours: replyN ? round1(replySum / replyN) : null,
    avgCloseDays: closeN ? round1(closeSum / closeN) : null,
    resolvedRate: closeN ? Math.round((good / closeN) * 100) : null,
    topProducts: [...prod.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    weekly,
    overdue,
    rating: starN ? { avg: Math.round((starSum / starN) * 10) / 10, count: starN } : null,
  };
}

/** ไฟล์ทั้งหมดของเคส (หลักฐาน + ไฟล์แนบในไทม์ไลน์) ลำดับคงที่ ใช้เป็นเลขอ้างอิงของลิงก์แบบส่วนตัว */
export function caseFiles(c: Pick<SupportCaseRecord, "evidence" | "events">): string[] {
  const out: string[] = [];
  for (const u of [...c.evidence, ...c.events.flatMap((e) => e.files ?? [])]) if (!out.includes(u)) out.push(u);
  return out;
}

/** เคสสำหรับส่งให้เบราว์เซอร์: เปลี่ยนลิงก์ไฟล์จริงเป็นลิงก์ที่ต้องล็อกอินถึงเปิดได้ */
export function caseForViewer(c: SupportCaseRecord): SupportCaseRecord {
  const files = caseFiles(c);
  const map = (u: string) => `/api/returns/${c.id}/file/${files.indexOf(u)}`;
  return { ...c, evidence: c.evidence.map(map), events: c.events.map((e) => (e.files ? { ...e, files: e.files.map(map) } : e)) };
}
