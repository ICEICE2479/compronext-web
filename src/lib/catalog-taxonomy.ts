import type { Product, ProductCategory } from "./types";
import { PC_PARTS } from "./builder/parts";

export type MacroCategorySlug =
  | "room-items"
  | "components"
  | "gaming-gear"
  | "monitors"
  | "furniture"
  | "decoration";

export interface MacroSubcategory {
  slug: string;
  labelTh: string;
  labelEn: string;
  keywords: string[];
}

export interface MacroCategoryGroup {
  slug: MacroCategorySlug;
  titleEn: string;
  titleTh: string;
  subtitle: string;
  mappedCategories: ProductCategory[];
  includeBuilderParts?: boolean;
  subcategories: MacroSubcategory[];
}

export const MACRO_CATEGORIES: MacroCategoryGroup[] = [
  {
    slug: "room-items",
    titleEn: "หมวดหมู่ของใช้ในห้อง",
    titleTh: "เตียง ตู้เก็บของ ตู้เสื้อผ้า ชั้นวาง ต้นไม้ และพรมแต่งห้อง",
    subtitle:
      "รวมของใช้ในห้องครบวงจร: เตียงนอน ตู้เก็บของ ตู้เสื้อผ้า ชั้นวางของ กระถางต้นไม้ ต้นไม้ปลอม ต้นไม้จริง ของตกแต่งต่างๆ และพรมแต่งห้อง",
    mappedCategories: [
      "bed",
      "storage",
      "wardrobe",
      "plant_pot",
      "fake_plant",
      "real_plant",
      "decor",
      "rug",
    ],
    subcategories: [
      {
        slug: "beds",
        labelTh: "เตียงนอน (Beds & Sofa Beds)",
        labelEn: "เตียงนอน",
        keywords: ["เตียง", "โซฟาเบด", "ฟูก", "ที่นอน", "bed"],
      },
      {
        slug: "storage-cabinets",
        labelTh: "ตู้เก็บของ (Storage Cabinets & Drawers)",
        labelEn: "ตู้เก็บของ",
        keywords: ["ตู้เก็บของ", "ตู้ลิ้นชัก", "ตู้เอกสาร", "ตู้กระจก", "cabinet", "drawer", "sideboard", "lockers"],
      },
      {
        slug: "wardrobes",
        labelTh: "ตู้เสื้อผ้า (Wardrobes & Closets)",
        labelEn: "ตู้เสื้อผ้า",
        keywords: ["ตู้เสื้อผ้า", "ตู้ผ้า", "wardrobe", "closet", "ตู้บานเลื่อน", "ราวแขวนผ้า"],
      },
      {
        slug: "shelves",
        labelTh: "ชั้นวางของ (Shelves & Pegboards)",
        labelEn: "ชั้นวางของ",
        keywords: ["ชั้นวาง", "ตู้โชว์", "ลิ้นชัก", "เพ็กบอร์ด", "pegboard", "shelf"],
      },
      {
        slug: "plant-pots",
        labelTh: "กระถางต้นไม้ (Plant Pots)",
        labelEn: "กระถางต้นไม้",
        keywords: ["กระถาง", "ขาตั้งกระถาง", "pot"],
      },
      {
        slug: "fake-plants",
        labelTh: "ต้นไม้ปลอม (Artificial Plants)",
        labelEn: "ต้นไม้ปลอม",
        keywords: ["ต้นไม้ปลอม", "ไม้ประดิษฐ์", "ปลอม", "ประดิษฐ์", "fejka", "fake-plant"],
      },
      {
        slug: "real-plants",
        labelTh: "ต้นไม้จริง (Real Indoor Plants)",
        labelEn: "ต้นไม้จริง",
        keywords: [
          "ต้นไม้จริง",
          "ไม้ฟอกอากาศ",
          "ลิ้นมังกร",
          "ยางอินเดีย",
          "กวักมรกต",
          "มอนสเตอร่าใบแฉก",
          "real-plant",
        ],
      },
      {
        slug: "room-decor",
        labelTh: "ของตกแต่งต่างๆ (Room Decorations)",
        labelEn: "ของตกแต่งต่างๆ",
        keywords: [
          "ป้ายไฟนีออน",
          "นาฬิกา",
          "แผ่นซับเสียง",
          "บอร์ดไม้ก๊อก",
          "ขาตั้งหูฟัง",
          "ขาแขวนหูฟัง",
          "โปรเจคเตอร์",
          "กรอบรูป",
          "ของตกแต่ง",
          "decor",
        ],
      },
      {
        slug: "room-rugs",
        labelTh: "พรมแต่งห้อง (Room Rugs & Mats)",
        labelEn: "พรมแต่งห้อง",
        keywords: ["พรม", "แผ่นยืน", "rug", "mat-antifatigue"],
      },
    ],
  },
  {
    slug: "components",
    titleEn: "Computer Components",
    titleTh: "อุปกรณ์ฮาร์ดแวร์และชิ้นส่วนคอมพิวเตอร์",
    subtitle: "CPU, GPU, Motherboard, RAM, SSD/HDD, Power Supply, Case และระบบระบายความร้อน",
    mappedCategories: ["computer"],
    includeBuilderParts: true,
    subcategories: [
      { slug: "cpu", labelTh: "ซีพียู (CPU)", labelEn: "CPU", keywords: ["ryzen", "core i", "core ultra", "cpu"] },
      { slug: "gpu", labelTh: "การ์ดจอ (GPU)", labelEn: "GPU", keywords: ["rtx", "radeon", "rx", "gpu"] },
      { slug: "motherboard", labelTh: "เมนบอร์ด (Motherboard)", labelEn: "Motherboard", keywords: ["b650", "x870", "b760", "z790", "z890", "motherboard"] },
      { slug: "ram", labelTh: "แรม (RAM)", labelEn: "RAM", keywords: ["ddr5", "ddr4", "ram"] },
      { slug: "storage", labelTh: "SSD / HDD", labelEn: "SSD / HDD", keywords: ["nvme", "ssd", "hdd", "wd", "samsung", "990 pro"] },
      { slug: "psu", labelTh: "พาวเวอร์ซัพพลาย (Power Supply)", labelEn: "Power Supply", keywords: ["psu", "gold", "bronze", "platinum", "850w", "750w", "650w", "1200w"] },
      { slug: "case", labelTh: "เคสคอมพิวเตอร์ (Computer Case)", labelEn: "Computer Case", keywords: ["case", "เคส", "lian li", "nzxt", "nr200p", "ap201"] },
      { slug: "cooling", labelTh: "ชุดระบายความร้อน (Cooling System)", labelEn: "Cooling System", keywords: ["aio", "cooler", "ชุดน้ำ", "ซิงก์ลม", "kraken", "arctic", "ak400"] },
    ],
  },
  {
    slug: "gaming-gear",
    titleEn: "Gaming Gear",
    titleTh: "เกมมิ่งเกียร์และอุปกรณ์สตรีมมิ่ง",
    subtitle: "หูฟัง เมาส์ คีย์บอร์ด แผ่นรองเมาส์ ไมโครโฟน ลำโพง และเว็บแคม",
    mappedCategories: [
      "headphone",
      "mouse",
      "keyboard",
      "mousepad",
      "keyboard_pad",
      "microphone",
      "speaker",
      "webcam",
    ],
    subcategories: [
      { slug: "headset", labelTh: "หูฟังเกมมิ่ง (Gaming Headset)", labelEn: "Gaming Headset", keywords: ["หูฟัง", "headset"] },
      { slug: "mouse", labelTh: "เมาส์เกมมิ่ง (Gaming Mouse)", labelEn: "Gaming Mouse", keywords: ["เมาส์", "mouse"] },
      { slug: "keyboard", labelTh: "คีย์บอร์ด (Gaming Keyboard)", labelEn: "Gaming Keyboard", keywords: ["คีย์บอร์ด", "keyboard"] },
      { slug: "mousepad", labelTh: "แผ่นรองเมาส์ (Mouse Pad)", labelEn: "Mouse Pad", keywords: ["แผ่นรอง", "ที่รองข้อมือ", "mat", "pad"] },
      { slug: "microphone", labelTh: "ไมโครโฟน (Microphone)", labelEn: "Microphone", keywords: ["ไมโครโฟน", "ไมค์", "บูมอาร์ม"] },
      { slug: "speakers", labelTh: "ลำโพง (Speakers)", labelEn: "Speakers", keywords: ["ลำโพง", "speaker"] },
      { slug: "streaming", labelTh: "เว็บแคม & สตรีมมิ่ง (Webcam)", labelEn: "Webcam & Stream", keywords: ["เว็บแคม", "webcam"] },
    ],
  },
  {
    slug: "monitors",
    titleEn: "Monitor & Display",
    titleTh: "จอคอมพิวเตอร์และขาตั้งจอภาพ",
    subtitle: "Gaming Monitor, Work Monitor, 4K Monitor, OLED Monitor และแขนจับจอ",
    mappedCategories: ["monitor", "monitor_arm"],
    subcategories: [
      { slug: "gaming-monitor", labelTh: "จอเกมมิ่ง (Gaming Monitor)", labelEn: "Gaming Monitor", keywords: ["165hz", "170hz", "180hz", "240hz", "360hz", "จอเกม"] },
      { slug: "work-monitor", labelTh: "จอทำงานและถนอมสายตา (Work Monitor)", labelEn: "Work Monitor", keywords: ["ถนอมสายตา", "usb-c", "ips", "100hz", "75hz"] },
      { slug: "4k-monitor", labelTh: "จอความละเอียด 4K (4K Monitor)", labelEn: "4K Monitor", keywords: ["4k", "3840"] },
      { slug: "oled-monitor", labelTh: "จอพาเนล OLED (OLED Monitor)", labelEn: "OLED Monitor", keywords: ["oled", "qd-oled"] },
      { slug: "monitor-arm", labelTh: "ขาตั้งและแขนจับจอ (Monitor Arm)", labelEn: "Monitor Arm", keywords: ["แขนจับจอ", "ขาตั้งจอ", "arm"] },
    ],
  },
  {
    slug: "furniture",
    titleEn: "Desks & Chairs",
    titleTh: "โต๊ะคอมพิวเตอร์และเก้าอี้ทำงาน",
    subtitle: "เก้าอี้เกมมิ่ง เก้าอี้เพื่อสุขภาพ โต๊ะคอมพิวเตอร์ และโต๊ะปรับระดับไฟฟ้า",
    mappedCategories: ["chair", "desk"],
    subcategories: [
      { slug: "gaming-chair", labelTh: "เก้าอี้เกมมิ่ง (Gaming Chair)", labelEn: "Gaming Chair", keywords: ["เก้าอี้เกมมิ่ง"] },
      { slug: "ergonomic-chair", labelTh: "เก้าอี้เพื่อสุขภาพ (Ergonomic Chair)", labelEn: "Ergonomic Chair", keywords: ["เก้าอี้เพื่อสุขภาพ", "เก้าอี้ทำงาน", "เออร์โกโนมิก", "เก้าอี้ผู้บริหาร", "เก้าอี้สำนักงาน"] },
      { slug: "computer-desk", labelTh: "โต๊ะคอมพิวเตอร์ (Computer Desk)", labelEn: "Computer Desk", keywords: ["โต๊ะเกมมิ่ง", "โต๊ะคอม", "โต๊ะท็อปไม้", "โต๊ะพับ", "โต๊ะไม้", "โต๊ะทรงตัว l", "โต๊ะทำงาน"] },
      { slug: "standing-desk", labelTh: "โต๊ะปรับระดับไฟฟ้า (Standing Desk)", labelEn: "Standing Desk", keywords: ["ปรับระดับไฟฟ้า", "มอเตอร์"] },
    ],
  },
  {
    slug: "decoration",
    titleEn: "Lighting & Desk Gadgets",
    titleTh: "โคมไฟ ไฟ RGB และอุปกรณ์เสริมบนโต๊ะ",
    subtitle: "ไฟเส้น RGB, ไฟแขวนจอ Monitor Light Bar, โคมไฟตั้งโต๊ะ และอุปกรณ์เสริมสายครีเอเตอร์",
    mappedCategories: ["lighting", "other"],
    subcategories: [
      { slug: "rgb-lighting", labelTh: "ไฟ RGB & Ambient (RGB Lighting)", labelEn: "RGB Lighting", keywords: ["rgb", "ambient", "หกเหลี่ยม"] },
      { slug: "led-lights", labelTh: "โคมไฟและไฟแขวนจอ (LED Lights)", labelEn: "LED Lights", keywords: ["light bar", "ไฟแขวนจอ", "โคมไฟ", "key light"] },
      { slug: "desk-gadgets", labelTh: "อุปกรณ์เสริมบนโต๊ะ (Desk Gadgets)", labelEn: "Desk Gadgets", keywords: ["แท่นวางโน้ตบุ๊ก", "ขาตั้งโน้ตบุ๊ก", "ที่วางเท้า", "ออดิโออินเทอร์เฟซ", "คอนโทรลเลอร์", "คาลิเบรต"] },
    ],
  },
];

const KNOWN_BRANDS = [
  "AMD", "Intel", "NVIDIA", "ASUS", "ROG", "MSI", "Gigabyte", "ASRock", "Corsair", "G.Skill",
  "Kingston", "Samsung", "WD", "Lian Li", "NZXT", "Fractal", "Noctua", "Arctic", "DeepCool",
  "Cooler Master", "Seasonic", "Crucial", "Super Flower", "Thermaltake", "Thermalright", "Montech",
  "LG", "Dell", "BenQ", "AOC", "ViewSonic", "Lenovo", "Acer", "Keychron", "NuPhy", "Logitech",
  "Razer", "HyperX", "SteelSeries", "Nubwo", "Fantech", "EGA", "JBL", "Edifier", "Shure", "Rode",
  "Audio-Technica", "Sennheiser", "Behringer", "Elgato", "Secretlab", "Inno3D", "Palit", "Zotac",
  "PowerColor", "Colorful", "XFX", "Galax", "Sapphire", "Apple", "Sony", "Bose", "Canon",
  "Google", "Oakywood", "Bellroy", "Ugmonk", "Grovemade", "Herman Miller", "Blackmagic", "Pioneer",
  "LEGO", "Philips", "Xiaomi", "IKEA", "HomePro",
];

const BRAND_PATTERNS = KNOWN_BRANDS.map((b) => ({
  brand: b === "ROG" ? "ASUS" : b,
  re: new RegExp(`(^|[^A-Z0-9])${b.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Z0-9]|$)`),
}));

// ร้านของผู้ผลิตเอง — ใช้ชื่อร้านเป็นแบรนด์ได้
const BRAND_BY_PLATFORM: Record<string, string> = {
  IKEA: "IKEA",
  "Apple Store": "Apple",
  Grovemade: "Grovemade",
  "Grovemade Official": "Grovemade",
  Keychron: "Keychron",
  "Herman Miller Official": "Herman Miller",
  "Sony Store": "Sony",
  "Bose Official": "Bose",
};

export const UNKNOWN_BRAND = "ไม่ระบุแบรนด์";

/**
 * สกัดชื่อแบรนด์จริงจากชื่อสินค้า (หรือร้านของผู้ผลิต) — ถ้าไม่รู้คืน "ไม่ระบุแบรนด์" แทนการเดา
 */
export function extractProductBrand(
  name: string,
  _category?: ProductCategory,
  platform?: string
): string {
  const upper = name.toUpperCase();
  for (const { brand, re } of BRAND_PATTERNS) {
    if (re.test(upper)) return brand;
  }
  if (platform && BRAND_BY_PLATFORM[platform]) return BRAND_BY_PLATFORM[platform];
  return UNKNOWN_BRAND;
}

/**
 * แปลงชิ้นส่วนใน PC Builder (PARTS_CATALOG) ให้เป็นรายการ Product มาตรฐาน
 * พร้อมรูปถ่ายสินค้าจริงจาก JIB / iHAVECPU
 */
export function getBuilderPartsAsProducts(): Product[] {
  return PC_PARTS.map((part) => ({
    id: part.id,
    name: part.name,
    description: `${part.highlights} — ชิ้นส่วนฮาร์ดแวร์คอมพิวเตอร์ (${part.slot.toUpperCase()}) เช็กราคาได้จาก JIB, iHAVECPU, Advice, BaNANA IT, Shopee และ Lazada`,
    imageUrl: part.imageUrl ?? null,
    price: part.price,
    currency: "THB",
    buyUrl: part.buyUrl,
    storeName: part.platform,
    platform: part.platform,
    category: "computer",
    colors: [part.color],
    materials: ["aluminum", "steel"],
    dimensions: part.specs.lengthMm
      ? { width: Math.round(part.specs.lengthMm / 10), depth: 14, height: 12, unit: "cm" }
      : null,
    ports: part.specs.videoOutputs ?? [],
    specs: {
      แบรนด์: part.brand,
      ประเภทชิ้นส่วน: part.slot.toUpperCase(),
      จุดเด่น: part.highlights,
      ...(part.specs.socket ? { ซ็อกเก็ต: part.specs.socket } : {}),
      ...(part.specs.ramType ? { ชนิดแรม: part.specs.ramType } : {}),
      ...(part.specs.tdpWatts ? { TDP: `${part.specs.tdpWatts}W` } : {}),
      ...(part.specs.boardPowerWatts ? { กำลังไฟการ์ดจอ: `${part.specs.boardPowerWatts}W` } : {}),
    },
    placement: "other",
    status: "available",
    priceUpdatedAt: "2026-10-31",
    isSample: false,
  }));
}

export function getMacroCategoryForProduct(product: Product): MacroCategoryGroup {
  for (const group of MACRO_CATEGORIES) {
    if (group.mappedCategories.includes(product.category)) {
      return group;
    }
  }
  return MACRO_CATEGORIES[0];
}
