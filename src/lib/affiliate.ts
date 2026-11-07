import "server-only";

/**
 * ใส่รหัส affiliate ให้ลิงก์ไปร้าน (ได้ค่าคอมมิชชันเมื่อลูกค้าซื้อ) — ตั้งใน env ทีละร้าน:
 *   AFFILIATE_SHOPEE=https://s.shopee.co.th/an_redir?origin_link={url}&affiliate_id=123   (มี {url} = ห่อลิงก์)
 *   AFFILIATE_LAZADA=sub_aff_id=abc&utm_source=compronext                                 (ไม่มี {url} = ต่อท้ายพารามิเตอร์)
 * โดเมนที่รองรับ: shopee, lazada, jib, advice, ihavecpu, ikea, bananait, amazon — ไม่ตั้ง = ลิงก์ตรงเหมือนเดิม
 */
const HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)shopee\.(co\.th|com)$/i, "AFFILIATE_SHOPEE"],
  [/(^|\.)lazada\.(co\.th|com)$/i, "AFFILIATE_LAZADA"],
  [/(^|\.)jib\.co\.th$/i, "AFFILIATE_JIB"],
  [/(^|\.)advice\.co\.th$/i, "AFFILIATE_ADVICE"],
  [/(^|\.)ihavecpu\.com$/i, "AFFILIATE_IHAVECPU"],
  [/(^|\.)ikea\.com$/i, "AFFILIATE_IKEA"],
  [/(^|\.)bananait\.com$/i, "AFFILIATE_BANANA"],
  [/(^|\.)amazon\.(com|co\.jp|sg)$/i, "AFFILIATE_AMAZON"],
];

export function affiliateUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  const env = HOSTS.find(([re]) => re.test(u.hostname))?.[1];
  const rule = env ? process.env[env]?.trim() : "";
  if (!rule) return raw;
  if (rule.includes("{url}")) {
    const wrapped = rule.replace("{url}", encodeURIComponent(raw));
    return /^https:\/\//.test(wrapped) ? wrapped : raw;
  }
  for (const [k, v] of new URLSearchParams(rule)) u.searchParams.set(k, v);
  return u.toString();
}

/** ลิงก์นี้มีค่าคอมมิชชันไหม (ไว้บอกผู้ใช้ตามกฎโฆษณา) */
export function isAffiliate(raw: string): boolean {
  return affiliateUrl(raw) !== raw;
}
