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

  // Three.js & Blueprint: -z = back (North 0°), +x = right (East 90°), +z = front (South 180°), -x = left (West 270°)
  const sunDirX = Math.sin(azRad);
  const sunDirZ = -Math.cos(azRad);
  const sunX = cx + sunDirX * Math.cos(elRad) * dist;
  const sunY = cy + Math.sin(elRad) * dist;
  const sunZ = cz + sunDirZ * Math.cos(elRad) * dist;

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
    sunDirX,
    sunDirZ,
    relativeAzimuthDeg,
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

/** คำนวณคำแนะนำสภาพแสง อุณหภูมิในห้อง และแดดส่องเข้าหน้าต่าง */
export function analyzeWindowSunlight(
  sun: SunSettings,
  windows: Array<{
    wall: "top" | "bottom" | "left" | "right" | "back";
    pos: number;
    width?: number;
    outwardBaseDeg?: number;
  }>
) {
  const { timeHour, orientationDeg } = sun;
  const isNight = timeHour < 5.8 || timeHour > 18.8;

  // อุณหภูมิอากาศภายนอกพื้นฐาน
  let outdoorTempC = 26;
  if (timeHour >= 6 && timeHour < 10) outdoorTempC = 26.5 + (timeHour - 6) * 1.4;
  else if (timeHour >= 10 && timeHour < 15) outdoorTempC = 32.5 + Math.sin(((timeHour - 10) / 5) * Math.PI) * 3.0;
  else if (timeHour >= 15 && timeHour < 18.8) outdoorTempC = 33.5 - (timeHour - 15) * 1.2;
  else if (timeHour >= 18.8 && timeHour < 22) outdoorTempC = 28.5 - (timeHour - 18.8) * 0.7;
  else outdoorTempC = 25.5;

  if (isNight) {
    const roomTempC = Math.round((outdoorTempC - 0.5) * 10) / 10;
    return {
      statusText: "กลางคืน (โหมดไฟห้อง & RGB)",
      outdoorTempC: Math.round(outdoorTempC * 10) / 10,
      roomTempC,
      tempText: `นอกห้อง ${Math.round(outdoorTempC)}°C · ในห้อง ~${roomTempC}°C (เปิดแอร์แนะนำ 25°C)`,
      advice: "ไม่มีแสงแดดภายนอก เหมาะสำหรับเล่นเกมหรือทำงานกลางคืน แนะนำติดไฟเส้น LED หลังจอ/โต๊ะเพื่อลดความล้าสายตา",
      sunlightHitsWindow: false,
      activeWall: null as string | null,
    };
  }

  // ทิศดวงอาทิตย์ (06:00 = 90° ตะวันออก -> 12:00 = 180° ใต้ -> 18:00 = 270° ตะวันตก)
  const sunAzimuth = 90 + ((timeHour - 6) / 12) * 180;

  let directHit = false;
  let hitWallLabel = "";
  let heatGainC = 0;

  for (const win of windows) {
    const wallWorldDeg =
      win.outwardBaseDeg !== undefined
        ? (win.outwardBaseDeg + orientationDeg) % 360
        : getWallOrientation(win.wall, orientationDeg).angleDeg;
    const wallInfo = degToCardinal(wallWorldDeg);
    const diff = Math.abs(((sunAzimuth - wallWorldDeg + 540) % 360) - 180);
    if (diff < 75) {
      directHit = true;
      hitWallLabel = wallInfo.label;
      const cosFactor = Math.cos((diff * Math.PI) / 180);
      const sizeFactor = (win.width ?? 120) / 120;
      heatGainC += (timeHour >= 12.5 ? 3.2 : 1.6) * cosFactor * sizeFactor;
    }
  }

  const roomTempC = Math.round((outdoorTempC - 1.5 + Math.min(4.5, heatGainC)) * 10) / 10;
  outdoorTempC = Math.round(outdoorTempC * 10) / 10;

  if (directHit) {
    if (timeHour >= 13) {
      return {
        statusText: `แดดบ่ายส่องเข้าหน้าต่างฝั่ง${hitWallLabel}`,
        outdoorTempC,
        roomTempC,
        tempText: `นอกห้อง ${outdoorTempC}°C · ในห้องสะสมความร้อน ~${roomTempC}°C`,
        advice: "แสงแดดบ่ายส่องตรงเข้าหน้าต่างทำให้อุณหภูมิห้องสูงขึ้นและเกิดแสงสะท้อนบนจอ แนะนำติดมู่ลี่/ม่านกัน UV และหันจอตั้งฉากกับหน้าต่าง",
        sunlightHitsWindow: true,
        activeWall: hitWallLabel,
      };
    }
    return {
      statusText: `แสงแดดเช้า-กลางวันส่องเข้าฝั่ง${hitWallLabel}`,
      outdoorTempC,
      roomTempC,
      tempText: `นอกห้อง ${outdoorTempC}°C · ในห้องอบอุ่น ~${roomTempC}°C`,
      advice: "แสงแดดธรรมชาติส่องเข้าห้องกำลังสดใส ช่วยให้ตื่นตัวเวลาทำงาน หากแสงจ้าเกินไปสามารถปรับมู่ลี่กรองแสงได้",
      sunlightHitsWindow: true,
      activeWall: hitWallLabel,
    };
  }

  return {
    statusText: "ห้องร่มรับแสงสว่างธรรมชาติ (แดดไม่ส่องตรง)",
    outdoorTempC,
    roomTempC,
    tempText: `นอกห้อง ${outdoorTempC}°C · ในห้องร่มเย็น ~${roomTempC}°C`,
    advice: "ดวงอาทิตย์ไม่ได้ส่องเข้าหน้าต่างโดยตรง ห้องจึงไม่สะสมความร้อนและไม่มีแสงแยงตาบนหน้าจอคอมพิวเตอร์",
    sunlightHitsWindow: false,
    activeWall: null as string | null,
  };
}
