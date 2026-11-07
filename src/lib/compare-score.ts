/** ให้คะแนนค่าสเปกเพื่อหา "ตัวที่ดีกว่า" ในหน้าเทียบ — คืน null ถ้าหัวข้อนั้นเทียบมากน้อยไม่ได้ (เช่น ซ็อกเก็ต) */

const RANKS: Array<[RegExp, Array<[RegExp, number]>]> = [
  [/^ความละเอียด$/, [[/6K/, 5], [/5K/, 4], [/4K/, 3], [/2K|QHD/, 2], [/Full HD|FHD/, 1]]],
  [/^มาตรฐาน$/, [[/TITANIUM/, 5], [/PLATINUM/, 4], [/GOLD/, 3], [/BRONZE/, 2], [/WHITE/, 1]]],
  [/^พาเนล$/, [[/QD-OLED/, 6], [/OLED/, 5], [/MINILED/, 4], [/IPS/, 3], [/VA/, 2], [/TN/, 1]]],
  [/^ชนิดหน่วยความจำ$/, [[/GDDR7/, 3], [/GDDR6X/, 2], [/GDDR6/, 1]]],
  [/^ชนิด$/, [[/NVMe/, 3], [/SSD SATA/, 2], [/HDD/, 1], [/DDR5/, 2], [/DDR4/, 1], [/ชุดน้ำ/, 2], [/ซิงก์ลม/, 1]]],
  [/^(Wi-Fi|สายถอดได้|กระจกข้าง|แป้นไทย)$/, [[/มี|ได้/, 1]]],
];

const HIGHER_NUM = /^(ความเร็วสูงสุด|หน่วยความจำ|ความจุ|บัส|กำลังไฟ|ขนาดหม้อน้ำ|รีเฟรชเรต|DPI|PCIe|แรม|พื้นที่เก็บข้อมูล|พาวเวอร์)$/;

/** ความแรงการ์ดจอโดยประมาณ (RTX 3050 = 10) อิงผลเทสต์เกมเฉลี่ย */
const GPU_PERF: Record<string, number> = {
  "GTX 1650": 6, "RTX 3050": 10, "RX 6500 XT": 7, "RX 6600": 19, "RX 7600": 23, "ARC A750": 20, "ARC B580": 26,
  "RTX 2060": 15, "RTX 3060": 21, "RTX 4060": 26, "RTX 5050": 24, "RTX 3060 TI": 29, "RTX 4060 TI": 31, "RTX 5060": 31,
  "RTX 5060 TI": 37, "RTX 3070": 34, "RTX 3070 TI": 37, "RX 6700 XT": 33, "RX 7700 XT": 37, "RX 9060 XT": 36, "RTX 3080": 44,
  "RTX 4070": 42, "RTX 4070 SUPER": 48, "RX 7800 XT": 45, "RTX 5070": 49, "RTX 4070 TI": 53, "RTX 4070 TI SUPER": 57,
  "RX 9070": 53, "RX 7900 GRE": 50, "RX 9070 XT": 60, "RTX 5070 TI": 62, "RX 7900 XT": 61, "RTX 4080": 67, "RTX 4080 SUPER": 69,
  "RX 7900 XTX": 70, "RTX 5080": 76, "RTX 4090": 90, "RTX 5090": 110,
};

export function gpuPerf(chip: string): number | null {
  const k = chip.toUpperCase().replace(/\s+/g, " ").replace(/(RTX|GTX|RX|ARC)\s?/, "$1 ").trim();
  return GPU_PERF[k] ?? null;
}

export function specScore(label: string, value: string): number | null {
  if (!value || value === "—") return null;
  if (label === "ชิป" || label === "การ์ดจอ") return gpuPerf(value);
  for (const [l, ranks] of RANKS) {
    if (!l.test(label)) continue;
    for (const [re, n] of ranks) if (re.test(value)) return n;
    return null;
  }
  if (label === "คอร์/เธรด") {
    const m = value.match(/(\d+)\D+(\d+)/);
    return m ? Number(m[1]) * 1000 + Number(m[2]) : null;
  }
  if (HIGHER_NUM.test(label)) {
    const m = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(TB)?/i);
    if (!m) return null;
    return Number(m[1]) * (m[2] ? 1000 : 1);
  }
  return null;
}

export interface RowResult {
  label: string;
  values: string[];
  scores: Array<number | null>;
  /** index ของตัวที่ดีที่สุด (เสมอกันได้หลายตัว) — ว่างถ้าเทียบไม่ได้หรือเท่ากันหมด */
  best: number[];
  /** 0..1 เทียบกับตัวสูงสุดในแถว สำหรับวาดแถบ */
  ratio: Array<number | null>;
}

export function compareRows(rows: Array<{ label: string; values: string[] }>): RowResult[] {
  return rows.map(({ label, values }) => {
    const scores = values.map((v) => specScore(label, v));
    const known = scores.filter((s): s is number => s !== null);
    const max = known.length ? Math.max(...known) : 0;
    const best = known.length >= 2 && new Set(known).size > 1 ? scores.flatMap((s, i) => (s === max ? [i] : [])) : [];
    const ratio = scores.map((s) => (s === null || max <= 0 ? null : s / max));
    return { label, values, scores, best, ratio };
  });
}

export interface Verdict {
  wins: number[];
  cheapest: number;
  strongest: number | null;
  bestValue: number | null;
  /** ราคาแพงกว่าตัวถูกสุดกี่บาท / กี่ % */
  priceDiff: Array<{ baht: number; pct: number }>;
}

export function verdict(prices: number[], rows: RowResult[]): Verdict {
  const wins = prices.map(() => 0);
  for (const r of rows) for (const i of r.best) wins[i] += 1;
  const min = Math.min(...prices);
  const cheapest = prices.indexOf(min);
  const maxWins = Math.max(...wins);
  const strongest = maxWins > 0 && wins.filter((w) => w === maxWins).length === 1 ? wins.indexOf(maxWins) : null;
  // คุ้มสุด: ชนะต่อราคา (บวก 1 กันศูนย์) — มีความหมายเมื่อมีแถวที่เทียบได้
  let bestValue: number | null = null;
  if (rows.some((r) => r.best.length)) {
    const v = prices.map((p, i) => (wins[i] + 1) / Math.max(1, p));
    const top = Math.max(...v);
    bestValue = v.filter((x) => x === top).length === 1 ? v.indexOf(top) : null;
  }
  const priceDiff = prices.map((p) => ({ baht: p - min, pct: min > 0 ? Math.round(((p - min) / min) * 100) : 0 }));
  return { wins, cheapest, strongest, bestValue, priceDiff };
}

/** คำอธิบายสั้นๆ ว่าหัวข้อนี้หมายถึงอะไร / มากดีไหม */
export const SPEC_EXPLAIN: Record<string, string> = {
  "คอร์/เธรด": "ยิ่งเยอะยิ่งทำงานหลายอย่างพร้อมกันได้ดี (ตัดต่อ, สตรีม) — เกมส่วนใหญ่ใช้ 6–8 คอร์ก็พอ",
  "ความเร็วสูงสุด": "ความเร็วต่อคอร์ ยิ่งสูง FPS เกมยิ่งดี",
  "ซ็อกเก็ต": "ช่องเสียบซีพียู ต้องตรงกับเมนบอร์ด (AM5 คู่ AM5, LGA1700 คู่ LGA1700)",
  "จุดเด่น": "ฟีเจอร์พิเศษของรุ่นนี้",
  "ชิป": "รุ่นชิปการ์ดจอ — แถบสีคือความแรงเล่นเกมโดยประมาณเทียบกัน (เลขหลังยิ่งสูงยิ่งแรง เช่น 4070 > 4060)",
  "หน่วยความจำ": "แรมการ์ดจอ (VRAM) เกมใหม่ 2K ควรมี 12 GB ขึ้นไป",
  "ชนิดหน่วยความจำ": "GDDR7 > GDDR6X > GDDR6 ยิ่งใหม่ยิ่งเร็ว",
  "ชิปเซ็ต": "ระดับเมนบอร์ด: B = ทั่วไป, X/Z = รองรับโอเวอร์คล็อกและพอร์ตมากกว่า",
  "ขนาดบอร์ด": "ATX ใหญ่ ช่องเยอะ / Micro-ATX กลาง / Mini-ITX เล็ก ต้องใช้เคสที่รองรับ",
  "Wi-Fi": "มี Wi-Fi ในตัว ไม่ต้องซื้อการ์ดแยก",
  "ความจุ": "ยิ่งเยอะยิ่งเก็บ/เปิดได้มาก — แรมเล่นเกมแนะนำ 16–32 GB",
  "ชนิด": "รุ่นของเทคโนโลยี ยิ่งใหม่ยิ่งเร็ว",
  "บัส": "ความเร็วแรม ยิ่งสูงยิ่งดี (DDR5 ทั่วไป 5600–6000)",
  "จำนวนแถว": "2 แถวทำงานแบบ Dual Channel เร็วกว่าแถวเดียว",
  "PCIe": "รุ่นช่องต่อ SSD ยิ่ง Gen สูงยิ่งอ่าน/เขียนเร็ว",
  "กำลังไฟ": "วัตต์ที่จ่ายได้ ควรเผื่อ 20–30% จากที่เครื่องกินจริง",
  "มาตรฐาน": "ประสิทธิภาพไฟ Titanium > Platinum > Gold > Bronze ยิ่งสูงยิ่งประหยัดไฟ ร้อนน้อย",
  "สายถอดได้": "ถอดสายที่ไม่ใช้ออกได้ เก็บสายง่าย ลมไหลดี",
  "ขนาดหม้อน้ำ": "ยิ่งยาวยิ่งระบายความร้อนดี แต่เคสต้องมีที่ใส่",
  "ไฟ": "ไฟ RGB ปรับสีได้",
  "ขนาด": "ขนาดตัวสินค้า",
  "กระจกข้าง": "ฝาข้างกระจก มองเห็นภายในเครื่อง",
  "พาเนล": "ชนิดจอ: OLED สีดำสนิทสุด > IPS สีสวยมุมกว้าง > VA คอนทราสต์ดี > TN เร็วแต่สีซีด",
  "ความละเอียด": "ยิ่งสูงยิ่งคม แต่ต้องใช้การ์ดจอแรงขึ้น",
  "รีเฟรชเรต": "ภาพต่อวินาทีที่จอแสดงได้ ยิ่งสูงยิ่งลื่น (เกมแข่ง 144 Hz+)",
  "จอโค้ง": "จอโค้งช่วยให้ภาพรอบตัว เหมาะจอกว้าง",
  "สวิตช์": "ชนิดปุ่ม: Red นุ่มเงียบ, Brown มีจังหวะ, Blue เสียงคลิก",
  "การเชื่อมต่อ": "วิธีต่อกับคอม",
  "แป้นไทย": "มีอักษรไทยพิมพ์บนปุ่ม",
  DPI: "ความไวเมาส์ ค่าสูงไม่ได้แปลว่าดีเสมอ เกมส่วนใหญ่ใช้ 800–3200",
  "เงียบ": "ปุ่มคลิกเสียงเบา",
  "รูปแบบ": "ทรงหูฟัง",
  "เสียง": "ระบบเสียง 7.1 จำลองเสียงรอบทิศ",
  "ซีพียู": "หัวใจของเครื่อง",
  "การ์ดจอ": "ตัวกำหนดความแรงเกม — แถบสีคือความแรงโดยประมาณ",
  "แรม": "16 GB ขึ้นไปสำหรับเกม",
  "พื้นที่เก็บข้อมูล": "เกมใหม่ใช้ 100 GB+ ต่อเกม",
  "พาวเวอร์": "กำลังไฟของพาวเวอร์ในเครื่อง",
  "หน้าจอ": "ขนาดจอ",
};
