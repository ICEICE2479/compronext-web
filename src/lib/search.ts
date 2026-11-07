/**
 * ค้นหาภาษาไทย/อังกฤษ: คำพ้อง (การ์ดจอ = GPU = VGA), พิมพ์ผิดเล็กน้อย (อังกฤษ), จัดอันดับความตรง
 * ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์
 */
const GROUPS: string[][] = [
  ["การ์ดจอ", "gpu", "vga", "กราฟิกการ์ด", "graphics card", "geforce", "radeon", "rtx"],
  ["ซีพียู", "cpu", "processor", "หน่วยประมวลผล", "ryzen", "core i"],
  ["แรม", "ram", "memory", "หน่วยความจำ", "ddr4", "ddr5"],
  ["เมนบอร์ด", "เมนบอด", "mainboard", "motherboard"],
  ["ssd", "เอสเอสดี", "nvme", "m.2", "ฮาร์ดดิสก์", "hdd", "storage"],
  ["พาวเวอร์ซัพพลาย", "พาวเวอร์", "psu", "power supply"],
  ["เคสคอม", "เคส", "case", "chassis"],
  ["จอ", "จอคอม", "หน้าจอ", "monitor", "display"],
  ["คีย์บอร์ด", "คีบอร์ด", "keyboard", "แป้นพิมพ์"],
  ["เมาส์", "เม้าส์", "mouse"],
  ["หูฟัง", "headphone", "headset", "เฮดเซ็ต", "หูฟังเกมมิ่ง"],
  ["ลำโพง", "speaker"],
  ["โต๊ะ", "desk", "table", "โต๊ะคอม"],
  ["เก้าอี้", "chair", "เก้าอี้เกมมิ่ง", "เก้าอี้ทำงาน"],
  ["โคมไฟ", "lamp", "light", "ไฟ", "lighting"],
  ["ชั้นวาง", "ชั้น", "shelf", "shelving", "ตู้"],
  ["ต้นไม้", "plant", "ต้นไม้ปลอม"],
  ["พรม", "rug", "carpet"],
  ["ชุดน้ำ", "aio", "liquid cooler", "ระบายความร้อน", "cooler", "ซิงก์ลม", "ฮีตซิงก์"],
  ["โน้ตบุ๊ก", "โน๊ตบุ๊ค", "โน้ตบุ๊ค", "notebook", "laptop", "แล็ปท็อป"],
  ["ขาตั้งจอ", "แขนจับจอ", "monitor arm"],
  ["ไมค์", "ไมโครโฟน", "microphone", "mic"],
  ["ขาว", "white", "สีขาว"],
  ["ดำ", "black", "สีดำ"],
  ["ไม้", "wood", "wooden"],
];
const GROUP_OF = new Map<string, string[]>();
for (const g of GROUPS) for (const w of g) GROUP_OF.set(w, g);

export const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[“”"'`(),/\\|[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** ระยะแก้คำ (Levenshtein) หยุดเร็วเมื่อเกิน max */
function editWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

let seg: Intl.Segmenter | null | undefined;
/** ตัดคำภาษาไทย (Intl.Segmenter) — รวมคำที่อยู่ในพจนานุกรมคำพ้องให้เป็นคำเดียว */
function segThai(s: string): string[] {
  if (seg === undefined) seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "word" }) : null;
  if (!seg) return [s];
  const parts = [...seg.segment(s)].filter((x) => x.isWordLike).map((x) => x.segment);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    // ต่อคำย่อยกลับถ้ารวมแล้วเป็นคำในพจนานุกรม (เช่น "การ์ด"+"จอ" = "การ์ดจอ")
    let j = parts.length;
    for (; j > i + 1; j--) if (GROUP_OF.has(parts.slice(i, j).join(""))) break;
    out.push(parts.slice(i, j).join(""));
    i = j - 1;
  }
  return out;
}

/** แยกคำค้น — คำที่อยู่ในกลุ่มคำพ้องแบบหลายคำ (เช่น "power supply") นับเป็นคำเดียว */
function tokens(q: string): string[] {
  let rest = ` ${q} `;
  const out: string[] = [];
  for (const w of [...GROUP_OF.keys()].filter((k) => k.includes(" ")).sort((a, b) => b.length - a.length)) {
    if (rest.includes(` ${w} `)) {
      out.push(w);
      rest = rest.replace(` ${w} `, " ");
    }
  }
  return [...out, ...rest.split(" ").filter(Boolean)];
}

/**
 * คะแนนความตรง (0 = ไม่ตรง) — ทุกคำในคำค้นต้องเจอ (ตรงตัว > คำพ้อง > พิมพ์ผิดเล็กน้อย)
 * @param title ชื่อ (ตรงในชื่อได้คะแนนมากกว่า)
 * @param rest ข้อความอื่น (คำอธิบาย แบรนด์ หมวด ร้าน)
 */
export function matchScore(query: string, title: string, rest = ""): number {
  const q = normalize(query);
  if (!q) return 1;
  const t = normalize(title);
  const all = `${t} ${normalize(rest)}`;
  let score = t.includes(q) ? 50 : all.includes(q) ? 20 : 0;
  let words: string[] | null = null;
  for (const tok of tokens(q)) {
    if (t.includes(tok)) score += 10;
    else if (all.includes(tok)) score += 5;
    else {
      const syn = GROUP_OF.get(tok)?.find((w) => w !== tok && all.includes(w));
      if (syn) score += t.includes(syn) ? 7 : 4;
      else if (/[\u0E00-\u0E7F]/.test(tok) && segThai(tok).length > 1) {
        // ภาษาไทยเขียนติดกัน (เช่น "เก้าอี้ขาว") → ตัดคำแล้วให้ทุกคำต้องเจอ
        const sub = matchScore(segThai(tok).join(" "), title, rest);
        if (!sub) return 0;
        score += Math.min(sub, 8);
      } else if (/^[a-z0-9.-]{4,}$/.test(tok)) {
        words ??= all.split(" ");
        const max = tok.length >= 8 ? 2 : 1;
        if (words.some((w) => w.length >= 3 && editWithin(tok, w, max))) score += 2;
        else return 0;
      } else return 0;
    }
  }
  return score;
}
