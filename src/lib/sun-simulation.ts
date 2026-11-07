/**
 * ระบบจำลองการโคจรของดวงอาทิตย์ อุณหภูมิแสง และสภาพอากาศในห้อง (Solar & Climate Simulation)
 * คำนวณมุมแสงอาทิตย์ ทิศทางเข็มทิศ (Compass) และอุณหภูมิแสงตามเวลาจริง
 */

export interface SunSettings {
  /** เวลาในรูปแบบทศนิยม เช่น 6.0 = 06:00, 14.5 = 14:30 */
  timeHour: number;
  /** ทิศของห้อง (องศาเข็มทิศ 0 - 359): 0° = ผนังหลังหันไปทางทิศเหนือ (N) */
  orientationDeg: number;
  /** อุณหภูมิแสง (Kelvin) เช่น 2700K (อบอุ่น) ถึง 7500K (ขาวอมฟ้า) */
  colorTempK: number;
  /** ความสว่างของแสงอาทิตย์ (0.0 - 3.0) */
  sunIntensity?: number;
}

export const DEFAULT_SUN_SETTINGS: SunSettings = {
  timeHour: 14.5, // 14:30 น. (แดดบ่ายสวยงาม)
  orientationDeg: 0, // ทิศเหนือ
  colorTempK: 5200, // แดดธรรมชาติ
  sunIntensity: 1.8,
};

export type CardinalDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface CardinalInfo {
  cardinal: CardinalDirection;
  label: string;
  angleDeg: number;
  description: string;
}

export const CARDINALS: CardinalInfo[] = [
  { cardinal: "N", label: "ทิศเหนือ (N)", angleDeg: 0, description: "แสงสะท้อนนุ่มนวล ไม่โดนแดดตรง เย็นสบายตลอดวัน" },
  { cardinal: "NE", label: "ทิศตะวันออกเฉียงเหนือ (NE)", angleDeg: 45, description: "รับแดดเช้าอ่อน ๆ อากาศโปร่งสบาย" },
  { cardinal: "E", label: "ทิศตะวันออก (E)", angleDeg: 90, description: "รับแสงแดดยามเช้าเต็มที่ สดใส บ่ายร่มเย็น" },
  { cardinal: "SE", label: "ทิศตะวันออกเฉียงใต้ (SE)", angleDeg: 135, description: "รับแดดเช้าถึงสาย ลมพัดผ่านดี" },
  { cardinal: "S", label: "ทิศใต้ (S)", angleDeg: 180, description: "รับแดดช่วงกลางวัน ลมมรสุมพัดผ่านเกือบตลอดปี" },
  { cardinal: "SW", label: "ทิศตะวันตกเฉียงใต้ (SW)", angleDeg: 225, description: "รับแดดบ่ายร้อนแรงสะสม ลมพัดเข้าช่วงฤดูร้อน" },
  { cardinal: "W", label: "ทิศตะวันตก (W)", angleDeg: 270, description: "รับแดดบ่ายเต็มที่จนถึงเย็น อุณหภูมิห้องจะอุ่นขึ้น" },
  { cardinal: "NW", label: "ทิศตะวันตกเฉียงเหนือ (NW)", angleDeg: 315, description: "รับแดดบ่ายคล้อยช่วงบ่ายแก่ ๆ ร่มรื่นตอนเช้า" },
];

/** แปลงองศา (0-359) เป็นทิศย่อ */
export function degToCardinal(deg: number): CardinalInfo {
  const normalized = ((deg % 360) + 360) % 360;
  const idx = Math.round(normalized / 45) % 8;
  return CARDINALS[idx];
}

/** คำนวณทิศจริงของผนังแต่ละด้านเมื่อห้องหมุน orientationDeg */
export function getWallOrientation(
  wall: "top" | "bottom" | "left" | "right" | "back",
  orientationDeg: number
): CardinalInfo {
  let baseAngle = 0;
  if (wall === "top" || wall === "back") baseAngle = 0;
  else if (wall === "right") baseAngle = 90;
  else if (wall === "bottom") baseAngle = 180;
  else if (wall === "left") baseAngle = 270;

  const realAngle = (baseAngle + orientationDeg) % 360;
  return degToCardinal(realAngle);
}

/**
 * แปลงอุณหภูมิสี Kelvin (1000K - 12000K) เป็นค่า RGB และ HEX
 * ใช้อัลกอริทึม Tanner Helland / Planckian Locus
 */
export function kelvinToRgb(kelvin: number): { r: number; g: number; b: number; hex: string } {
  const temp = Math.max(1000, Math.min(12000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;

  // Red
  if (temp <= 66) {
    r = 255;
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    r = Math.max(0, Math.min(255, r));
  }

  // Green
  if (temp <= 66) {
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    g = Math.max(0, Math.min(255, g));
  } else {
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    g = Math.max(0, Math.min(255, g));
  }

  // Blue
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = temp - 10;
    b = 138.5177312231 * Math.log(b) - 305.0447927307;
    b = Math.max(0, Math.min(255, b));
  }

  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return { r: r / 255, g: g / 255, b: b / 255, hex };
}

/** คำนวณตำแหน่ง 3D ของดวงอาทิตย์, สีของแสง, และสภาพอากาศ */
export function calculateSunState(
  sun: SunSettings,
  roomW: number,
  roomD: number,
  roomH: number
) {
  const { timeHour, orientationDeg, colorTempK } = sun;
  const isDay = timeHour >= 5.8 && timeHour <= 18.8;
  const isDawnOrDusk = (timeHour >= 5.8 && timeHour <= 7.2) || (timeHour >= 17.5 && timeHour <= 18.8);
  const isNight = !isDay;

  // Sun Azimuth (ทิศทางดวงอาทิตย์ในแนวระนาบ):
  // 06:00 = ตะวันออก (90°), 12:00 = ใต้ (180°), 18:00 = ตะวันตก (270°)
  let sunAzimuthDeg = 90;
  if (isDay) {
    sunAzimuthDeg = 90 + ((timeHour - 6) / 12) * 180;
  } else {
    // ดวงจันทร์ขึ้นสลับฝั่ง
    sunAzimuthDeg = (270 + ((timeHour - 18) / 12) * 180) % 360;
  }

  // Sun Elevation (มุมเงยจากขอบฟ้า): 0° ตอนพระอาทิตย์ขึ้น/ตก, สูงสุด 75° ตอนเที่ยง
  let elevationDeg = 0;
  if (isDay) {
    elevationDeg = Math.sin(((timeHour - 6) / 12) * Math.PI) * 72 + 5;
  } else {
    elevationDeg = Math.sin(((timeHour - 18 + 24) % 24 / 12) * Math.PI) * 45 + 15;
  }

  // ทิศทางสัมพัทธ์กับห้อง (เนื่องจากห้องหมุน orientationDeg)
  const relativeAzimuthDeg = (sunAzimuthDeg - orientationDeg + 360) % 360;
  const azRad = (relativeAzimuthDeg * Math.PI) / 180;
  const elRad = (elevationDeg * Math.PI) / 180;

  // ตำแหน่ง 3D
  const dist = Math.max(roomW, roomD) * 0.025 + 6.0;
  const cx = (roomW / 100) / 2;
  const cz = (roomD / 100) / 2;
  const cy = (roomH / 100) / 2;

  // Three.js: -z = back (North), +x = right (East), +z = front (South), -x = left (West)
  // azRad 0° = South (+z), 90° = West (-x), 180° = North (-z), 270° = East (+x)
  const sunX = cx + Math.sin(azRad) * Math.cos(elRad) * dist;
  const sunY = cy + Math.sin(elRad) * dist;
  const sunZ = cz + Math.cos(azRad) * Math.cos(elRad) * dist;

  // สีและอุณหภูมิแสง
  let effectiveKelvin = colorTempK;
  if (isDawnOrDusk) {
    effectiveKelvin = Math.min(colorTempK, 2800);
  } else if (isNight) {
    effectiveKelvin = 7800; // แสงจันทร์อมฟ้า
  }

  const rgb = kelvinToRgb(effectiveKelvin);

  // ความเข้มของแสง
  let intensity = isNight ? 0.4 : isDawnOrDusk ? 1.4 : 2.2;
  if (sun.sunIntensity) intensity *= sun.sunIntensity / 1.8;

  // อุณหภูมิอากาศ (°C) ตามเวลาในไทย
  let tempC = 26;
  if (timeHour >= 6 && timeHour < 10) tempC = 27 + (timeHour - 6) * 1.5;
  else if (timeHour >= 10 && timeHour < 15) tempC = 33 + Math.sin((timeHour - 10) / 5 * Math.PI) * 2.5;
  else if (timeHour >= 15 && timeHour < 18) tempC = 33 - (timeHour - 15) * 1.2;
  else if (timeHour >= 18 && timeHour < 22) tempC = 29 - (timeHour - 18) * 0.7;
  else tempC = 26;

  tempC = Math.round(tempC * 10) / 10;

  return {
    sunX,
    sunY,
    sunZ,
    intensity,
    isDay,
    isNight,
    isDawnOrDusk,
    sunColor: isNight ? "#a0b4ff" : rgb.hex,
    hemiSky: isNight ? "#1e293b" : isDawnOrDusk ? "#fb923c" : "#e0f2fe",
    hemiGround: isNight ? "#0f172a" : "#78716c",
    tempC,
    elevationDeg: Math.round(elevationDeg),
    azimuthDeg: Math.round(sunAzimuthDeg),
    effectiveKelvin,
  };
}

/** คำนวณคำแนะนำสภาพแสงและแดดส่องเข้าหน้าต่าง */
export function analyzeWindowSunlight(
  sun: SunSettings,
  windows: Array<{ wall: "top" | "bottom" | "left" | "right" | "back"; pos: number }>
) {
  const { timeHour, orientationDeg } = sun;
  const isNight = timeHour < 5.8 || timeHour > 18.8;

  if (isNight) {
    return {
      statusText: "กลางคืน (โหมดไฟห้อง & RGB)",
      tempText: "25°C · บรรยากาศเงียบสงบ",
      advice: "เหมาะสำหรับการเล่นเกมหรือดูหนัง แนะนำให้เปิดไฟ Ambient / LED Strip หลังโต๊ะคอมเพื่อถนอมสายตา",
      sunlightHitsWindow: false,
      activeWall: null,
    };
  }

  // คำนวณทิศแดด
  const sunAzimuth = 90 + ((timeHour - 6) / 12) * 180;

  // ตรวจสอบหน้าต่างที่แดดส่องเข้า
  let directHit = false;
  let hitWallLabel = "";

  for (const win of windows) {
    const wallInfo = getWallOrientation(win.wall, orientationDeg);
    const diff = Math.abs(((sunAzimuth - wallInfo.angleDeg + 540) % 360) - 180);
    if (diff < 70) {
      directHit = true;
      hitWallLabel = wallInfo.label;
      break;
    }
  }

  if (directHit) {
    if (timeHour >= 13) {
      return {
        statusText: `แดดบ่ายส่องเข้า ${hitWallLabel}`,
        tempText: "33°C - 35°C · แดดแรง",
        advice: "แสงแดดช่วงบ่ายมีความร้อนและแสงสะท้อนสูง แนะนำให้ดึงม่านหรือมู่ลี่ลง และวางหน้าจอไม่ให้หันหลังให้หน้าต่างเพื่อกันแสงสะท้อน",
        sunlightHitsWindow: true,
        activeWall: hitWallLabel,
      };
    } else {
      return {
        statusText: `แสงแดดยามเช้าส่องเข้า ${hitWallLabel}`,
        tempText: "28°C - 30°C · อบอุ่นสดใส",
        advice: "แสงเช้าช่วยให้ตื่นตัว กระปรี้กระเปร่า เหมาะแก่การเริ่มต้นทำงาน เปิดม่านรับแสงธรรมชาติได้สบายตา",
        sunlightHitsWindow: true,
        activeWall: hitWallLabel,
      };
    }
  }

  return {
    statusText: "ห้องรับแสงสะท้อนธรรมชาติ (Indirect Light)",
    tempText: "29°C · แสงนุ่มสบายตา",
    advice: "ไม่มีแดดส่องตรงเข้าหน้าต่าง แสงธรรมชาติกำลังดี ไม่เกิดแสงสะท้อนแยงตาบนหน้าจอคอมพิวเตอร์",
    sunlightHitsWindow: false,
    activeWall: null,
  };
}
