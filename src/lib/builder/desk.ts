import type { CaseDimensionsMm } from "./case-sizes";

/** ขนาดโต๊ะคอม (ซม.) */
export interface DeskSize {
  widthCm: number;
  depthCm: number;
  heightCm: number;
}

export const DEFAULT_DESK: DeskSize = { widthCm: 120, depthCm: 60, heightCm: 75 };

export type CasePlacement = "desk" | "floor";

const round1 = (n: number) => Math.round(n * 10) / 10;
const finitePos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** ขนาดจอ (เฉพาะพื้นที่แสดงภาพ) จากขนาดทแยงเป็นนิ้ว + อัตราส่วนภาพ — 1 นิ้ว = 2.54 ซม. */
export function monitorDimensionsCm(diagonalInch: number, aspectW: number, aspectH: number): { widthCm: number; heightCm: number } {
  const d = finitePos(diagonalInch) * 2.54;
  const w = finitePos(aspectW);
  const h = finitePos(aspectH);
  const diag = Math.hypot(w, h);
  if (!d || !diag) return { widthCm: 0, heightCm: 0 };
  return { widthCm: round1((d * w) / diag), heightCm: round1((d * h) / diag) };
}

/** พื้นที่ที่เคสกินบนโต๊ะ (กว้าง × ลึก) และสัดส่วนเทียบพื้นโต๊ะ */
export function caseFootprint(
  caseDims: CaseDimensionsMm,
  desk: DeskSize = DEFAULT_DESK,
): { widthCm: number; heightCm: number; depthCm: number; areaCm2: number; deskSharePct: number; fitsDepth: boolean } {
  const wCm = finitePos(caseDims.widthMm) / 10;
  const hCm = finitePos(caseDims.heightMm) / 10;
  const dCm = finitePos(caseDims.depthMm) / 10;
  const area = wCm * dCm;
  const deskArea = finitePos(desk.widthCm) * finitePos(desk.depthCm);
  return {
    widthCm: round1(wCm),
    heightCm: round1(hCm),
    depthCm: round1(dCm),
    areaCm2: round1(area),
    deskSharePct: deskArea ? Math.round((area / deskArea) * 100) : 0,
    fitsDepth: dCm <= finitePos(desk.depthCm),
  };
}
