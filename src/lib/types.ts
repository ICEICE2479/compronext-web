/**
 * ComproNext — โมเดลข้อมูลหลัก
 * ห้องเชื่อมกับสินค้าผ่าน productId เท่านั้น (ไม่คัดลอกราคา/รายละเอียดสินค้าไปเก็บในห้อง)
 */

export const PRODUCT_CATEGORIES = [
  "desk",
  "computer",
  "monitor",
  "mouse",
  "keyboard",
  "mousepad",
  "keyboard_pad",
  "microphone",
  "headphone",
  "speaker",
  "webcam",
  "chair",
  "lighting",
  "monitor_arm",
  "bed",
  "storage",
  "wardrobe",
  "plant_pot",
  "fake_plant",
  "real_plant",
  "decor",
  "rug",
  "other",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_STATUSES = ["available", "out_of_stock", "broken_link"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PLACEMENTS = ["desk", "floor", "wall", "other"] as const;
export type Placement = (typeof PLACEMENTS)[number];

export interface Dimensions {
  /** กว้าง (แกนซ้าย-ขวา) */
  width: number | null;
  /** ลึก/ยาว (แกนหน้า-หลัง) */
  depth: number | null;
  /** สูง */
  height: number | null;
  unit: "cm" | "mm" | "in";
}

export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  /** ลิงก์รูปเดิมจากเว็บร้าน (หลังเก็บรูปเข้าที่เก็บไฟล์ของเราแล้ว) */
  sourceImageUrl?: string | null;
  /** เก็บรูปเข้าระบบไม่สำเร็จล่าสุดเมื่อ (เว้น 7 วันค่อยลองใหม่) */
  imageMirrorFailedAt?: string;
  /** รูปวาดเดิม (ก่อนเปลี่ยนเป็นรูปจริงจากหน้าร้าน) */
  illustrationUrl?: string;
  /** หารูปจริงจากหน้าร้านไม่เจอเมื่อ */
  realImageFailedAt?: string;
  /** ขนาดนี้ดึงมาจากชื่อ/รายละเอียดสินค้าอัตโนมัติ */
  dimensionsSource?: "extracted";
  price: number;
  currency: "THB";
  buyUrl: string;
  storeName: string;
  platform: string;
  category: ProductCategory;
  colors: string[];
  materials: string[];
  dimensions: Dimensions | null;
  /** พอร์ตเชื่อมต่อ เช่น "HDMI 2.1", "DisplayPort 1.4", "USB-C (DP Alt)" */
  ports: string[];
  /** สเปกเพิ่มเติมแบบ key-value */
  specs: Record<string, string>;
  /** ตำแหน่งวาง ใช้ตรวจสอบพื้นที่บนโต๊ะ */
  placement: Placement;
  status: ProductStatus;
  /** ISO date (YYYY-MM-DD) วันที่อัปเดตราคาล่าสุด */
  priceUpdatedAt: string;
  /** เวลาที่ระบบเช็กราคากับร้านล่าสุด (ISO) */
  priceCheckedAt?: string;
  /** ประวัติราคา (วันที่ YYYY-MM-DD → ราคา) เก็บย้อนหลังสูงสุด 90 จุด */
  priceHistory?: Array<{ d: string; p: number }>;
  /** true = ข้อมูลทดลอง ยังไม่ได้ตรวจสอบกับร้านค้าจริง */
  isSample: boolean;
  /** เปิด/ปิดการเผยแพร่บนหน้าเว็บหลัก (ค่าเริ่มต้น true) */
  published?: boolean;
  /** สินค้าแนะนำบนหน้าแรก */
  featured?: boolean;
  /** ไฟล์โมเดล 3D (.glb) สำหรับดูแบบ 3D / AR */
  modelUrl?: string | null;
  /** รหัสร้านพาร์ตเนอร์ที่ลงสินค้านี้ (ถ้าลงผ่านหน้าร้านพาร์ตเนอร์) */
  partnerId?: string | null;
  /** งานสร้างโมเดล 3D อัตโนมัติจากรูป (Meshy) ที่กำลังทำอยู่ */
  model3dTaskId?: string | null;
}

export interface CatalogCategoryRecord {
  id: string;
  slug: string;
  labelTh: string;
  labelEn: string;
  macroSlug:
    | "computers"
    | "components"
    | "monitors"
    | "gaming-gear"
    | "furniture"
    | "room-items"
    | "decoration";
  order: number;
  active: boolean;
  isCustom?: boolean;
}

export interface SiteBannerRecord {
  id: string;
  partner: string;
  badge: string;
  title: string;
  detail: string;
  href: string;
  imageUrl?: string | null;
  active: boolean;
  order: number;
}

export interface SiteArticleRecord {
  id: string;
  issue: string;
  title: string;
  summary: string;
  content: string;
  readTime: string;
  href: string;
  status: "published" | "draft";
  createdAt: string;
  updatedAt: string;
}

export interface SiteSettingsRecord {
  siteName: string;
  logoText: string;
  logoUrl: string | null;
  tagline: string;
  description: string;
  heroBadge: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  featuredRoomSlug: string;
  featuredProductId: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  copyrightText: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  ogImageUrl: string | null;
  socialLinks: {
    facebook: string;
    line: string;
    youtube: string;
    tiktok: string;
    instagram: string;
  };
  updatedAt: string;
}

export const ROOM_STYLES = ["gaming", "work", "health", "creator", "student", "minimal"] as const;
export type RoomStyle = (typeof ROOM_STYLES)[number];

export const LIGHTING_TYPES = ["bright", "medium", "low", "none", "adjustable", "rgb", "warm", "neutral"] as const;
export type LightingType = (typeof LIGHTING_TYPES)[number];

export const ROOM_STATUSES = ["draft", "published", "hidden"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export interface RoomItem {
  productId: string;
  quantity: number;
  note?: string;
  x?: number; // Hotspot coordinate X on image (0-100)
  y?: number; // Hotspot coordinate Y on image (0-100)
  imageIndex?: number;
}

export interface Room {
  id: string;
  slug: string;
  name: string;
  description: string;
  images: string[];
  style: RoomStyle;
  colors: string[];
  materials: string[];
  lighting: LightingType[];
  items: RoomItem[];
  status: RoomStatus;
  featured: boolean;
  /** คะแนนความนิยม (ยอดเข้าชม/บันทึก) ใช้เรียงลำดับ */
  popularity: number;
  createdAt: string;
  updatedAt: string;
  isSample: boolean;
}

/** สินค้าในห้องที่ resolve แล้ว */
export interface ResolvedRoomItem extends RoomItem {
  product: Product | null;
}

export interface RoomTotals {
  /** ราคารวมทั้งห้อง (ทุกชิ้นที่มีข้อมูล) */
  fullTotal: number;
  /** ราคารวมเฉพาะชิ้นที่พร้อมซื้อ */
  availableTotal: number;
  /** ราคารวมของชิ้นที่ซื้อไม่ได้ (หมด/ลิงก์เสีย) */
  unavailableTotal: number;
  availableCount: number;
  unavailableCount: number;
  missingCount: number;
  itemCount: number;
  oldestPriceDate: string | null;
  newestPriceDate: string | null;
}

export interface RoomWithTotals extends Room {
  totals: RoomTotals;
  coverProduct?: Product | null;
}
