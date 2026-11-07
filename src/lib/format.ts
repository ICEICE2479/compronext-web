import type { LightingType, ProductCategory, ProductStatus, RoomStatus, RoomStyle } from "./types";

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  desk: "โต๊ะคอม",
  computer: "คอมพิวเตอร์",
  monitor: "จอภาพ",
  mouse: "เมาส์",
  keyboard: "คีย์บอร์ด",
  mousepad: "แผ่นรองเมาส์",
  keyboard_pad: "แผ่นรองคีย์บอร์ด/ที่รองข้อมือ",
  microphone: "ไมโครโฟน",
  headphone: "หูฟัง",
  speaker: "ลำโพง",
  webcam: "เว็บแคม",
  chair: "เก้าอี้",
  lighting: "ไฟและโคมไฟ",
  monitor_arm: "ขาตั้งจอ/แขนจับจอ",
  bed: "เตียงนอน",
  storage: "ตู้เก็บของ/ชั้นวางของ",
  wardrobe: "ตู้เสื้อผ้า",
  plant_pot: "กระถางต้นไม้",
  fake_plant: "ต้นไม้ปลอม",
  real_plant: "ต้นไม้จริง",
  decor: "ของตกแต่งต่างๆ",
  rug: "พรมแต่งห้อง",
  other: "อุปกรณ์เสริมอื่นๆ",
};

export const STYLE_LABELS: Record<RoomStyle, string> = {
  gaming: "เกม",
  work: "ทำงาน",
  health: "สุขภาพ",
  creator: "ตัดต่อ-ครีเอเตอร์",
  student: "นักเรียน-นักศึกษา",
  minimal: "มินิมอล",
};

export const STYLE_EN: Record<RoomStyle, string> = {
  gaming: "Gaming",
  work: "Work",
  health: "Health",
  creator: "Creator",
  student: "Student",
  minimal: "Minimal",
};

export const LIGHTING_LABELS: Record<LightingType, string> = {
  bright: "สว่างมาก",
  medium: "ปานกลาง",
  low: "น้อย",
  none: "ไม่มีไฟ",
  adjustable: "ปรับแสงได้",
  rgb: "RGB",
  warm: "โทนอุ่น",
  neutral: "โทนธรรมชาติ",
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  available: "พร้อมขาย",
  out_of_stock: "สินค้าหมด",
  broken_link: "ลิงก์เสีย",
};

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  draft: "แบบร่าง",
  published: "เผยแพร่",
  hidden: "ซ่อน",
};

/** สีที่รู้จัก: key ภาษาอังกฤษ (เก็บในฐานข้อมูล) → ชื่อไทย + swatch */
export const COLOR_META: Record<string, { label: string; hex: string }> = {
  black: { label: "ดำ", hex: "#111111" },
  white: { label: "ขาว", hex: "#F7F7F5" },
  gray: { label: "เทา", hex: "#8A8F98" },
  blue: { label: "น้ำเงิน", hex: "#2F5BEA" },
  pink: { label: "ชมพู", hex: "#F29CC1" },
  wood: { label: "ไม้", hex: "#B98552" },
  walnut: { label: "วอลนัท", hex: "#5C3B24" },
  green: { label: "เขียว", hex: "#3E8E5E" },
  beige: { label: "เบจ", hex: "#E3D5BC" },
  purple: { label: "ม่วง", hex: "#7C4DDB" },
  red: { label: "แดง", hex: "#D23B3B" },
  silver: { label: "เงิน", hex: "#C9CDD3" },
  gold: { label: "ทอง", hex: "#C9A54A" },
  brass: { label: "ทองเหลือง", hex: "#B5893B" },
};

export const MATERIAL_LABELS: Record<string, string> = {
  wood: "ไม้จริง",
  mdf: "ไม้ MDF/ปาร์ติเกิล",
  metal: "โลหะ",
  steel: "เหล็ก",
  aluminum: "อะลูมิเนียม",
  plastic: "พลาสติก",
  glass: "กระจก",
  fabric: "ผ้า",
  mesh: "ผ้าตาข่าย",
  leather: "หนัง",
  pu_leather: "หนัง PU",
  ceramic: "เซรามิก",
  felt: "สักหลาด",
  rubber: "ยาง",
  bamboo: "ไม้ไผ่",
};

export function colorLabel(key: string) {
  return COLOR_META[key]?.label ?? key;
}
export function colorHex(key: string) {
  return COLOR_META[key]?.hex ?? "#CBD5E1";
}
export function materialLabel(key: string) {
  return MATERIAL_LABELS[key] ?? key;
}

/** ราคาแบบไทย: "1,690 บาท" */
export function formatTHB(n: number) {
  return `${Math.round(n).toLocaleString("en-US")} บาท`;
}

export function formatCompactTHB(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("th-TH", { maximumFractionDigits: 1 })} ล้านบาท`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("th-TH", { maximumFractionDigits: 0 })}K บาท`;
  return `${n} บาท`;
}

export function formatThaiDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}
