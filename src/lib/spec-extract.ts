import type { Product, ProductCategory } from "@/lib/types";

/** หมวดที่เปรียบเทียบได้ (คอมพิวเตอร์และอุปกรณ์) */
export const COMPARE_CATEGORIES: ProductCategory[] = [
  "computer",
  "monitor",
  "monitor_arm",
  "keyboard",
  "mouse",
  "mousepad",
  "keyboard_pad",
  "headphone",
  "microphone",
  "speaker",
  "webcam",
];

export function isComparable(category: string): boolean {
  return (COMPARE_CATEGORIES as string[]).includes(category);
}

/** ชนิดย่อยของสินค้า ใช้จัดกลุ่มและเตือนเมื่อเทียบของคนละชนิด */
export function partKind(p: Pick<Product, "name" | "category" | "specs">): string {
  if (p.category === "monitor" && /monitor arm|ขายึดจอ|แขนจับจอ|monitor stand/i.test(p.name)) return "ขาจับจอ";
  if (p.category !== "computer") {
    return (
      {
        monitor: "จอ",
        monitor_arm: "ขาจับจอ",
        keyboard: "คีย์บอร์ด",
        mouse: "เมาส์",
        mousepad: "แผ่นรองเมาส์",
        keyboard_pad: "แผ่นรองเมาส์",
        headphone: "หูฟัง",
        microphone: "ไมโครโฟน",
        speaker: "ลำโพง",
        webcam: "เว็บแคม",
      } as Record<string, string>
    )[p.category] ?? "อื่นๆ";
  }
  const typed = p.specs["ประเภทชิ้นส่วน"];
  const n = `${typed ?? ""} ${p.name}`.toLowerCase();
  const hasCpu = /ryzen|core i\d|core ultra|\bi[3579]-\d/.test(n);
  const hasGpu = /rtx|radeon|\brx\s?\d|geforce/.test(n);
  if (/notebook|โน้ตบุ๊|laptop|macbook/.test(n)) return "โน้ตบุ๊ก";
  if (hasCpu && (hasGpu || /onboard/.test(n)) && n.split(" / ").length >= 3) return "คอมประกอบ";
  if (/\bcpu\b|ryzen|core i\d|core ultra|ซีพียู/.test(n)) return "ซีพียู";
  if (/vga|การ์ดจอ|rtx|radeon|\bgpu\b|geforce/.test(n)) return "การ์ดจอ";
  if (/mainboard|เมนบอร์ด|motherboard/.test(n)) return "เมนบอร์ด";
  if (/\bram\b|ddr[45]|แรม/.test(n)) return "แรม";
  if (/ssd|nvme|m\.2|hdd|harddisk/.test(n)) return "SSD/HDD";
  if (/psu|power supply|จ่ายไฟ|พาวเวอร์/.test(n)) return "พาวเวอร์ซัพพลาย";
  if (/liquid|cooler|ชุดน้ำ|ซิงก์|heatsink|\bfan\b|พัดลม/.test(n)) return "ระบายความร้อน";
  if (/\bcase\b|เคส/.test(n)) return "เคส";
  if (/mac studio|mac mini|imac|desktop|\bpc\b/.test(n)) return "คอมตั้งโต๊ะ";
  return "ชิ้นส่วนคอม";
}

const m = (s: string, re: RegExp) => s.match(re)?.[1];

/** ดึงสเปกที่อ่านได้จากชื่อสินค้า (ร้านไทยมักใส่สเปกในชื่อ) + สเปกที่ร้านกรอกไว้ */
export function extractSpecs(p: Pick<Product, "name" | "category" | "specs">): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const add = (k: string, v: string | undefined | null) => {
    if (v && !out.some(([x]) => x === k)) out.push([k, v.trim()]);
  };
  const name = p.name;
  const up = name.toUpperCase();
  const kind = partKind(p);

  switch (kind) {
    case "ซีพียู": {
      const ct = name.match(/(\d+)\s*C\s*[/ ]\s*(\d+)\s*T\b/i);
      add("คอร์/เธรด", ct ? `${ct[1]} คอร์ / ${ct[2]} เธรด` : null);
      add("ความเร็วสูงสุด", m(name, /(\d+(?:\.\d+)?)\s*GHz/i) && `${m(name, /(\d+(?:\.\d+)?)\s*GHz/i)} GHz`);
      add("ซ็อกเก็ต", m(up, /\b(AM[45]|LGA\s?\d{4})\b/));
      if (/3D V-CACHE|X3D/.test(up)) add("จุดเด่น", "3D V-Cache (แรงเรื่องเกม)");
      break;
    }
    case "การ์ดจอ": {
      add("ชิป", m(up, /\b((?:RTX|GTX|RX|ARC)\s?[A-Z]?\d{3,4}\s?(?:TI SUPER|TI|SUPER|XTX|XT|GRE)?)\b/));
      add("หน่วยความจำ", m(up, /\b(\d{1,2})\s?GB\b/) && `${m(up, /\b(\d{1,2})\s?GB\b/)} GB`);
      add("ชนิดหน่วยความจำ", m(up, /\b(GDDR\d[X]?)\b/));
      break;
    }
    case "เมนบอร์ด": {
      add("ชิปเซ็ต", m(up, /\b([ABHXZ]\d{3}[A-Z]?)\b/));
      add("ซ็อกเก็ต", m(up, /\((AM[45]|\d{4})\)/) ?? m(up, /\b(AM[45]|LGA\s?\d{4})\b/));
      add("ขนาดบอร์ด", /ITX/.test(up) ? "Mini-ITX" : /\b\w+M\b|MATX|M-ATX|MICRO/.test(up) ? "Micro-ATX" : /ATX/.test(up) ? "ATX" : null);
      add("Wi-Fi", /WIFI|WI-FI/.test(up) ? "มี" : null);
      break;
    }
    case "แรม": {
      add("ความจุ", m(up, /\b(\d{1,3})\s?GB\b/) && `${m(up, /\b(\d{1,3})\s?GB\b/)} GB`);
      add("ชนิด", m(up, /\b(DDR[45])\b/));
      add("บัส", m(up, /\b(\d{4})\s?(?:MHZ|MT)/) && `${m(up, /\b(\d{4})\s?(?:MHZ|MT)/)} MHz`);
      add("จำนวนแถว", m(up, /\((\d)\s?X\s?\d+\s?GB\)/) && `${m(up, /\((\d)\s?X/)} แถว`);
      break;
    }
    case "SSD/HDD": {
      const cap = up.match(/\b(\d+(?:\.\d+)?)\s?(TB|GB)\b/);
      add("ความจุ", cap ? `${cap[1]} ${cap[2]}` : null);
      add("ชนิด", /NVME|M\.2/.test(up) ? "SSD NVMe M.2" : /SSD/.test(up) ? "SSD SATA" : /HDD|HARDDISK/.test(up) ? "HDD" : null);
      add("PCIe", m(up, /\bGEN\s?(\d)\b/) && `Gen ${m(up, /\bGEN\s?(\d)\b/)}`);
      break;
    }
    case "พาวเวอร์ซัพพลาย": {
      add("กำลังไฟ", m(up, /\b(\d{3,4})\s?W\b/) && `${m(up, /\b(\d{3,4})\s?W\b/)} W`);
      add("มาตรฐาน", m(up, /80\s?\+\s?(BRONZE|GOLD|PLATINUM|TITANIUM|WHITE)/) && `80+ ${m(up, /80\s?\+\s?(BRONZE|GOLD|PLATINUM|TITANIUM|WHITE)/)}`);
      add("สายถอดได้", /FULL MODULAR|MODULAR/.test(up) ? "ได้" : null);
      break;
    }
    case "ระบายความร้อน": {
      add("ชนิด", /LIQUID|AIO|ชุดน้ำ/.test(up) ? "ชุดน้ำปิด" : "ซิงก์ลม/พัดลม");
      add("ขนาดหม้อน้ำ", m(up, /\b(120|240|280|360|420)\b/) && `${m(up, /\b(120|240|280|360|420)\b/)} มม.`);
      add("ไฟ", /ARGB|RGB/.test(up) ? "ARGB" : null);
      break;
    }
    case "เคส": {
      add("ขนาด", /ITX/.test(up) ? "Mini-ITX" : /MID/.test(up) ? "Mid Tower" : /FULL/.test(up) ? "Full Tower" : /ATX/.test(up) ? "ATX" : null);
      add("กระจกข้าง", /GLASS|กระจก/.test(up) ? "มี" : null);
      break;
    }
    case "คอมประกอบ":
    case "โน้ตบุ๊ก":
    case "คอมตั้งโต๊ะ": {
      add("ซีพียู", m(up, /\b((?:INTEL\s)?(?:CORE\s)?(?:I[3579]-\d{4,5}[A-Z]{0,2}|ULTRA\s?\d\s?\d{3}[A-Z]?)|RYZEN\s?[3579]\s?\d{4}[A-Z0-9]{0,3}|M[1-4](?:\s?(?:PRO|MAX|ULTRA))?)\b/));
      add("การ์ดจอ", m(up, /\b((?:RTX|GTX|RX)\s?\d{4}\s?(?:TI|SUPER|XT)?)\b/));
      const ram = up.match(/\b(\d{1,3})\s?GB\s?(?:DDR\d|RAM|LPDDR\d)/) ?? up.match(/\/\s?(\d{1,3})\s?GB\s?\//);
      add("แรม", ram ? `${ram[1]} GB` : null);
      const ssd = up.match(/(?:M\.2|SSD|NVME)\s?(\d+(?:\.\d+)?)\s?(TB|GB)/) ?? up.match(/\b(\d+(?:\.\d+)?)\s?(TB|GB)\s?(?:SSD|M\.2|NVME)/);
      add("พื้นที่เก็บข้อมูล", ssd ? `${ssd[1]} ${ssd[2]}` : null);
      add("พาวเวอร์", m(up, /\/\s?(\d{3,4})\s?W\b/) && `${m(up, /\/\s?(\d{3,4})\s?W\b/)} W`);
      add("การ์ดจอ", /ONBOARD/.test(up) ? "ออนบอร์ด" : null);
      add("หน้าจอ", m(name, /(\d{2}(?:\.\d)?)\s?(?:"|”|-inch|นิ้ว)/i) && `${m(name, /(\d{2}(?:\.\d)?)\s?(?:"|”|-inch|นิ้ว)/i)} นิ้ว`);
      break;
    }
    case "จอ": {
      const size = m(name, /[-\s](\d{2}(?:\.\d)?)\s?(?:"|นิ้ว|INCH|\s(?:IPS|VA|TN|OLED|QD))/i) ?? m(name, /(\d{2}(?:\.\d)?)\s?"/);
      add("ขนาด", size && `${size} นิ้ว`);
      add("พาเนล", m(up, /\b(QD-OLED|OLED|IPS|VA|TN|MINILED)\b/));
      add(
        "ความละเอียด",
        /\b(5K|6K)\b/.test(up) ? m(up, /\b(5K|6K)\b/) : /4K|UHD|3840/.test(up) ? "4K" : /WQHD|QHD|2K|2560/.test(up) ? "2K (QHD)" : /FHD|1080/.test(up) ? "Full HD" : null
      );
      add("รีเฟรชเรต", m(up, /\b(\d{2,3})\s?HZ/) && `${m(up, /\b(\d{2,3})\s?HZ/)} Hz`);
      add("จอโค้ง", /CURVED|โค้ง/.test(up) ? "ใช่" : null);
      break;
    }
    case "คีย์บอร์ด": {
      add("สวิตช์", m(up, /\(([^()]*SWITCH)\)/)?.replace(/\s*SWITCH/, ""));
      add("การเชื่อมต่อ", /TRI-MODE|3-MODE/.test(up) ? "ไร้สาย 3 โหมด" : /WIRELESS|ไร้สาย|BLUETOOTH/.test(up) ? "ไร้สาย" : "มีสาย");
      add("ขนาด", m(up, /\b(60%|65%|75%|TKL|96|98|100%)\b/) ?? (/\b(?:G|K)\d+\s?X?\s?(?:98|96)\b/.test(up) ? "98%" : null));
      add("แป้นไทย", /TH\)|EN\/TH/.test(up) ? "มี" : null);
      break;
    }
    case "เมาส์": {
      add("การเชื่อมต่อ", /WIRELESS|LIGHTSPEED|ไร้สาย|BLUETOOTH/.test(up) ? "ไร้สาย" : "มีสาย");
      add("DPI", m(up, /\b(\d{1,2},?\d{3})\s?DPI/) && `${m(up, /\b(\d{1,2},?\d{3})\s?DPI/)} DPI`);
      add("เงียบ", /SILENT/.test(up) ? "ใช่" : null);
      break;
    }
    case "หูฟัง": {
      add("การเชื่อมต่อ", /WIRELESS|LIGHTSPEED|ไร้สาย|BLUETOOTH/.test(up) ? "ไร้สาย" : /3\.5/.test(up) ? "สาย 3.5 มม." : /USB/.test(up) ? "USB" : null);
      add("รูปแบบ", /EARBUD|IN-?EAR/.test(up) ? "หูฟังเอียร์บัด" : "ครอบหู");
      add("เสียง", /7\.1/.test(up) ? "7.1 Surround" : /STEREO/.test(up) ? "Stereo" : null);
      break;
    }
    case "ไมโครโฟน": {
      add("การเชื่อมต่อ", /USB/.test(up) ? "USB" : /XLR/.test(up) ? "XLR" : null);
      break;
    }
  }

  // สเปกที่ร้านใส่มา (ไม่ซ้ำกับที่ดึงได้)
  for (const [k, v] of Object.entries(p.specs ?? {})) {
    if (k === "ประเภทชิ้นส่วน" || k === "แบรนด์") continue;
    add(k, v);
  }
  return out;
}
