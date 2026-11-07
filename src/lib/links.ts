/**
 * ระบบลิงก์ร้านค้าพาร์ทเนอร์และแหล่งขายสินค้าภายนอก (Multi-Store External Links)
 * รองรับ JIB, iHAVECPU, Advice, BaNANA IT, Mercular, IKEA, HomePro, Index Living Mall, Shopee, Lazada และ Google Shopping
 */
export type SamplePlatform =
  | "JIB"
  | "iHAVECPU"
  | "Advice"
  | "BaNANA IT"
  | "Mercular"
  | "IKEA"
  | "HomePro"
  | "Index Living Mall"
  | "Shopee"
  | "Lazada"
  | "Google Shopping";

export interface ExternalStoreOption {
  id: string;
  name: string;
  badge: string;
  description: string;
  url: string;
  accentColor: string;
  bgLight: string;
  isPrimary?: boolean;
  recommendedFor: "it" | "room" | "all";
}

export function cleanSearchQuery(rawName: string): string {
  return rawName
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchLink(platform: SamplePlatform | string, query: string): string {
  const clean = cleanSearchQuery(query);
  const q = encodeURIComponent(clean);
  switch (platform) {
    case "JIB":
    case "JIB Online":
      return `https://www.jib.co.th/web/product/product_search/0?str_search=${q}`;
    case "iHAVECPU":
      return `https://ihavecpu.com/product/search/${q}`;
    case "Advice":
    case "Advice Online":
      return `https://www.advice.co.th/product/search?keyword=${q}`;
    case "BaNANA IT":
    case "Banana IT":
      return `https://www.bnn.in.th/th/p?q=${q}`;
    case "Mercular":
      return `https://www.mercular.com/search?q=${q}`;
    case "IKEA":
    case "IKEA Thailand":
      return `https://www.ikea.com/th/th/search/?q=${q}`;
    case "HomePro":
      return `https://www.homepro.co.th/search?q=${q}`;
    case "Index Living Mall":
      return `https://www.indexlivingmall.com/search?q=${q}`;
    case "Shopee":
    case "Shopee Mall":
      return `https://shopee.co.th/search?keyword=${q}`;
    case "Lazada":
    case "Lazada Mall":
      return `https://www.lazada.co.th/catalog/?q=${q}`;
    case "Google Shopping":
    default:
      return `https://www.google.com/search?tbm=shop&q=${q}`;
  }
}

/**
 * สร้างรายการร้านค้าภายนอกทั้งหมดสำหรับสินค้าชิ้นนั้น เพื่อให้ผู้ใช้กดเลือกดูได้ว่าจะไปดูที่ร้านไหน
 * เช่น JIB, iHAVECPU, Advice, BaNANA IT, Mercular, IKEA, HomePro, Index Living Mall, Shopee, Lazada
 */
export function getExternalStoreOptions(params: {
  name: string;
  category?: string;
  buyUrl?: string | null;
  platform?: string | null;
}): ExternalStoreOption[] {
  const q = cleanSearchQuery(params.name);
  const cat = (params.category || "").toLowerCase();
  const isRoomItem = [
    "bed",
    "storage",
    "plant_pot",
    "fake_plant",
    "real_plant",
    "decor",
    "rug",
    "desk",
    "chair",
    "lighting",
  ].includes(cat);

  const allStores: ExternalStoreOption[] = [
    {
      id: "jib",
      name: "JIB Online (เจ.ไอ.บี.)",
      badge: "ร้านไอที & ฮาร์ดแวร์ชั้นนำ",
      description: "ศูนย์รวมคอมพิวเตอร์ ซีพียู การ์ดจอ จอภาพ และเกมมิ่งเกียร์ของแท้ประกันศูนย์",
      url: searchLink("JIB", q),
      accentColor: "#1d4ed8",
      bgLight: "rgba(29, 78, 216, 0.1)",
      recommendedFor: "it",
    },
    {
      id: "ihavecpu",
      name: "iHAVECPU (ไอแฮฟซีพียู)",
      badge: "ร้านจัดสเปกคอมยอดฮิต",
      description: "ผู้เชี่ยวชาญคอมประกอบ การ์ดจอ ซีพียู ชุดน้ำ และอุปกรณ์เกมมิ่งครบวงจร",
      url: searchLink("iHAVECPU", q),
      accentColor: "#dc2626",
      bgLight: "rgba(220, 38, 38, 0.1)",
      recommendedFor: "it",
    },
    {
      id: "advice",
      name: "Advice Online (แอดไวซ์)",
      badge: "แหล่งรวมอุปกรณ์ไอทีทั่วไทย",
      description: "จำหน่ายอุปกรณ์คอมพิวเตอร์ โน้ตบุ๊ก จอมอนิเตอร์ และอุปกรณ์ต่อพ่วงราคาคุ้มค่า",
      url: searchLink("Advice", q),
      accentColor: "#0284c7",
      bgLight: "rgba(2, 132, 199, 0.1)",
      recommendedFor: "it",
    },
    {
      id: "banana",
      name: "BaNANA IT (บานาน่า ไอที)",
      badge: "ไอที & แกดเจ็ตครบวงจร",
      description: "ตัวแทนจำหน่ายอุปกรณ์คอม จอภาพ โน้ตบุ๊ก เกมมิ่งเกียร์ และอุปกรณ์ทำงาน",
      url: searchLink("BaNANA IT", q),
      accentColor: "#ca8a04",
      bgLight: "rgba(202, 138, 4, 0.12)",
      recommendedFor: "it",
    },
    {
      id: "mercular",
      name: "Mercular (เมอร์คูลาร์)",
      badge: "เกมมิ่งเกียร์ & จัดโต๊ะคอม",
      description: "ร้านรวมหูฟัง คีย์บอร์ดคัสตอม เมาส์ โต๊ะปรับระดับ เก้าอี้สุขภาพ และของแต่งโต๊ะ",
      url: searchLink("Mercular", q),
      accentColor: "#0d9488",
      bgLight: "rgba(13, 148, 136, 0.1)",
      recommendedFor: "all",
    },
    {
      id: "ikea",
      name: "IKEA Thailand (อิเกีย)",
      badge: "ของใช้ในห้อง & เฟอร์นิเจอร์",
      description: "เตียงนอน ชั้นวางของ กระถางต้นไม้ ต้นไม้ปลอม/จริง พรมปูพื้น และโต๊ะทำงาน",
      url: searchLink("IKEA", q),
      accentColor: "#0058a3",
      bgLight: "rgba(0, 88, 163, 0.1)",
      recommendedFor: "room",
    },
    {
      id: "index",
      name: "Index Living Mall",
      badge: "เตียง ชั้นวาง & ของแต่งห้อง",
      description: "เฟอร์นิเจอร์ห้องนอน เตียง ชั้นวางของ พรมแต่งห้อง และของตกแต่งบ้านครบชุด",
      url: searchLink("Index Living Mall", q),
      accentColor: "#4f46e5",
      bgLight: "rgba(79, 70, 229, 0.1)",
      recommendedFor: "room",
    },
    {
      id: "homepro",
      name: "HomePro (โฮมโปร)",
      badge: "ของใช้ในบ้าน & โคมไฟ",
      description: "โคมไฟตั้งโต๊ะ ชั้นวางของ อุปกรณ์จัดเก็บ พรม และของใช้ในห้องคุณภาพสูง",
      url: searchLink("HomePro", q),
      accentColor: "#2563eb",
      bgLight: "rgba(37, 99, 235, 0.1)",
      recommendedFor: "room",
    },
    {
      id: "shopee",
      name: "Shopee Thailand",
      badge: "มาร์เก็ตเพลสยอดนิยม",
      description: "ค้นหาและเปรียบเทียบราคาจากร้านค้าทางการ (Shopee Mall) และร้านแนะนำ",
      url: searchLink("Shopee", q),
      accentColor: "#ea580c",
      bgLight: "rgba(234, 88, 12, 0.1)",
      recommendedFor: "all",
    },
    {
      id: "lazada",
      name: "Lazada Thailand",
      badge: "LazMall & ร้านค้าพาร์ทเนอร์",
      description: "ศูนย์รวมสินค้าไอที เฟอร์นิเจอร์ ของแต่งห้อง และต้นไม้พร้อมส่งทั่วไทย",
      url: searchLink("Lazada", q),
      accentColor: "#4338ca",
      bgLight: "rgba(67, 56, 202, 0.1)",
      recommendedFor: "all",
    },
    {
      id: "google",
      name: "Google Shopping",
      badge: "เปรียบเทียบราคาทุกร้าน",
      description: "ค้นหาราคาและโปรโมชั่นล่าสุดจากร้านค้าออนไลน์ชั้นนำทั่วประเทศไทย",
      url: searchLink("Google Shopping", q),
      accentColor: "#059669",
      bgLight: "rgba(5, 150, 105, 0.1)",
      recommendedFor: "all",
    },
  ];

  // Reorder so the most relevant stores appear at the top (JIB & iHAVECPU always highlighted first for IT, or IKEA + JIB + iHAVECPU for room items)
  if (isRoomItem) {
    const order = [
      "ikea",
      "jib",
      "ihavecpu",
      "index",
      "homepro",
      "mercular",
      "shopee",
      "lazada",
      "advice",
      "banana",
      "google",
    ];
    allStores.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }

  // Mark primary if matching platform
  const platLower = (params.platform || "").toLowerCase();
  for (const st of allStores) {
    if (platLower && st.name.toLowerCase().includes(platLower.split(" ")[0])) {
      st.isPrimary = true;
    }
  }

  return allStores;
}

/** อนุญาตเฉพาะ http/https เพื่อกัน javascript: URL จากข้อมูลที่แอดมินกรอก */
export function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * รูปห้องในเครื่อง (/rooms/x.jpg) → srcSet ที่มีเวอร์ชัน WebP 800px สำหรับมือถือ
 * (ไฟล์ย่อสำหรับการ์ด อยู่ใน public/rooms/w800)
 */
export function roomImageProps(src: string | null | undefined, sizes = "(max-width: 768px) 100vw, 50vw") {
  if (!src) return { src: undefined };
  const m = src.match(/^\/rooms\/([^/]+)\.(jpe?g|png)$/i);
  if (!m) return { src };
  return { src, srcSet: `/rooms/w800/${m[1]}.webp 800w, ${src} 1600w`, sizes };
}
