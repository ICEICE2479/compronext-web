import type { PcPart } from "./types";

export type CaseSizeClass = "itx" | "matx" | "mid" | "full";

export interface CaseDimensionsMm {
  /** ความกว้าง (ด้านข้าง ซ้าย-ขวา) */
  widthMm: number;
  /** ความสูง */
  heightMm: number;
  /** ความลึก (หน้า-หลัง) */
  depthMm: number;
}

export const CASE_SIZE_META: Record<
  CaseSizeClass,
  { labelTh: string; labelEn: string; boardHint: string; fallback: CaseDimensionsMm }
> = {
  itx: {
    labelTh: "เคสเล็ก",
    labelEn: "Mini-ITX",
    boardHint: "บอร์ด ITX · PSU SFX",
    fallback: { widthMm: 185, heightMm: 292, depthMm: 376 },
  },
  matx: {
    labelTh: "เคสกลางเล็ก",
    labelEn: "Micro-ATX",
    boardHint: "บอร์ด mATX / ITX",
    fallback: { widthMm: 205, heightMm: 350, depthMm: 460 },
  },
  mid: {
    labelTh: "เคสกลาง",
    labelEn: "Mid Tower",
    boardHint: "บอร์ด ATX / mATX / ITX",
    fallback: { widthMm: 287, heightMm: 415, depthMm: 435 },
  },
  full: {
    labelTh: "เคสใหญ่",
    labelEn: "Full Tower / Showcase",
    boardHint: "บอร์ด ATX ขึ้นไป · การ์ดจอยาวพิเศษ",
    fallback: { widthMm: 304, heightMm: 464, depthMm: 465 },
  },
};

export const CASE_SIZE_ORDER: CaseSizeClass[] = ["itx", "matx", "mid", "full"];

/** ขนาดจริงจากสเปกผู้ผลิต (มม.) อ้างอิงตามรหัสสินค้า */
const CASE_DIMENSIONS_BY_ID: Record<string, CaseDimensionsMm> = {
  // Cooler Master MasterBox NR200P — 376 × 185 × 292 mm (18.25 L)
  "case-nr200p-itx": { widthMm: 185, heightMm: 292, depthMm: 376 },
  // ASUS Prime AP201 — 460 × 205 × 350 mm (33 L)
  "case-ap201-matx-white": { widthMm: 205, heightMm: 350, depthMm: 460 },
  // NZXT H6 Flow — 435 × 287 × 415 mm
  "case-nzxt-h6-black": { widthMm: 287, heightMm: 415, depthMm: 435 },
  // Lian Li O11 Vision — 465 × 304 × 464 mm
  "case-lianli-vision-white": { widthMm: 304, heightMm: 464, depthMm: 465 },
};

/** เคสอ้างอิงที่โมเดล 3D ถูกสร้างไว้ (Mid Tower) — ใช้คำนวณอัตราส่วนย่อ/ขยาย */
export const REFERENCE_CASE_DIMENSIONS: CaseDimensionsMm = CASE_SIZE_META.mid.fallback;

export function getCaseSizeClass(part: PcPart | null | undefined): CaseSizeClass {
  return (part?.specs.caseSizeClass as CaseSizeClass | undefined) ?? "mid";
}

export function getCaseDimensions(part: PcPart | null | undefined): CaseDimensionsMm {
  if (part && CASE_DIMENSIONS_BY_ID[part.id]) return CASE_DIMENSIONS_BY_ID[part.id];
  return CASE_SIZE_META[getCaseSizeClass(part)].fallback;
}

export function getCaseVolumeLiters(d: CaseDimensionsMm): number {
  return Math.round(((d.widthMm * d.heightMm * d.depthMm) / 1_000_000) * 10) / 10;
}

/** อัตราส่วนเทียบกับเคสอ้างอิง (x = ลึก, y = สูง, z = กว้าง ตามแกนของโมเดล 3D) */
export function getCaseScale(part: PcPart | null | undefined) {
  const d = getCaseDimensions(part);
  const r = REFERENCE_CASE_DIMENSIONS;
  return {
    x: d.depthMm / r.depthMm,
    y: d.heightMm / r.heightMm,
    z: d.widthMm / r.widthMm,
  };
}
