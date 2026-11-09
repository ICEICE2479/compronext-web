import "server-only";
import roomAttributes from "./room-attributes.json";
import { after } from "next/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SEED_ROOMS } from "./seed";
import type {
  CatalogCategoryRecord,
  Product,
  Room,
  SiteArticleRecord,
  SiteBannerRecord,
  SiteSettingsRecord,
} from "../types";
import { PRODUCT_CATEGORIES } from "../types";
import type { SupportCaseRecord } from "../returns";
import { CATEGORY_LABELS } from "../format";
import { getBuilderPartsAsProducts, MACRO_CATEGORIES } from "../catalog-taxonomy";
import { resolveRealProductImage } from "../product-images";
import { knownRealImage } from "../known-real-images";

export interface AdminWalletOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  totalAmountTHB: number;
  paymentMethod: "ComproNext Wallet Escrow" | "Thai QR PromptPay";
  status: "pending_partner_purchase" | "ordered_from_partner" | "shipped" | "completed" | "refunded";
  itemsSummary: Array<{
    productId: string;
    name: string;
    platform: string;
    price: number;
    quantity: number;
  }>;
  receiptEmailSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminClerkKycUser {
  id: string;
  clerkUserId: string;
  fullName: string;
  email: string;
  phone: string;
  authProvider: "Google OAuth (Clerk)" | "LINE Login (Clerk)" | "Phone OTP (+66)" | "Email + 2FA";
  nationalIdMasked: string;
  kycStatus: "verified" | "pending_review" | "rejected";
  creatorTier: "Starter (40%)" | "Pro Creator (50%)" | "Partner Streamer (60%)";
  walletBalanceTHB: number;
  pendingPayoutTHB: number;
  joinedAt: string;
  /** ระงับการโพสต์/รีวิว/แชท (ตั้งโดยแอดมิน) */
  banned?: boolean;
}

export interface RuntimeDatabase {
  products: Product[];
  rooms: Room[];
  categories: CatalogCategoryRecord[];
  banners: SiteBannerRecord[];
  articles: SiteArticleRecord[];
  siteSettings: SiteSettingsRecord;
  orders: AdminWalletOrder[];
  users: AdminClerkKycUser[];
  neonActiveBranch: "main" | "staging-preview" | "dev-sandbox";
  partners: PartnerRecord[];
  /** ห้องที่ AI จัดแล้วลูกค้ากดบันทึก/แชร์ */
  designs: DesignRecord[];
  /** ตะกร้าของสมาชิก (ซิงก์ข้ามเครื่อง) */
  carts: Record<string, Array<{ id: string; quantity: number }>>;
  /** แจ้งเตือนเมื่อสินค้าลดราคา */
  priceWatches: PriceWatchRecord[];
  /** รีวิวร้านค้า (ดาว 1–5 + ข้อความ) */
  reviews: StoreReviewRecord[];
  /** แชทระหว่างลูกค้ากับร้านพาร์ตเนอร์ */
  chats: ChatThreadRecord[];
  /** ห้องที่บันทึก + สเปกคอมที่บันทึกของสมาชิก (ซิงก์ข้ามเครื่อง) */
  saved: Record<string, { rooms: string[]; builds: Array<{ id: string; name: string; selection: Record<string, string | null>; createdAt: string }> }>;
  /** การสมัครรับแจ้งเตือน (Web Push) ของแต่ละสมาชิก */
  pushSubs: Record<string, Array<{ endpoint: string; keys: { p256dh: string; auth: string }; email: string; at: string }>>;
  /** คำขอดันสินค้าของร้านพาร์ตเนอร์ (แอดมินอนุมัติ → ขึ้นสินค้าแนะนำตามจำนวนวัน) */
  boosts: BoostRecord[];
  /** โพสต์ชุมชน: สเปกคอม / ห้องของผู้ใช้ */
  community: CommunityPostRecord[];
  /** สมาชิกที่สมัครรับอีเมลสรุปรายสัปดาห์ */
  digestSubs: Record<string, { email: string; name: string; at: string }>;
  /** เคสหลังการขาย (ReturnEase): ลูกค้าแจ้งปัญหา → ร้านจัดการ → ติดตามสถานะ → รายงาน */
  cases: SupportCaseRecord[];
  /** ร้านที่สมัครเป็นพาร์ตเนอร์ (รอแอดมินอนุมัติ) */
  partnerApplications: PartnerApplicationRecord[];
  /** ความเห็นจากผู้ใช้ (ใช้ง่ายไหม 1–5 + ข้อความ) */
  feedback: FeedbackRecord[];
  /** เครดิต AI ที่ซื้อเพิ่ม (ใช้เมื่อโควตารายวันหมด) key = userId */
  aiCredits: Record<string, number>;
  /** คำสั่งซื้อเครดิต AI (พร้อมเพย์ → แจ้งโอน → แอดมินอนุมัติ) */
  creditOrders: CreditOrderRecord[];
  /** ห้อง 3D ที่สมาชิกบันทึกไว้ (ซิงก์ข้ามเครื่อง) key = userId */
  roomPlans: Record<string, RoomPlanRecord[]>;
  /** โควตา AI รายวัน (ใช้เมื่อไม่มี Postgres) key = u:<userId> | ip:<ip> */
  aiUsage?: Record<string, { day: string; count: number }>;
  /** ตั้งค่าคีย์ AI จากหน้าหลังบ้าน (สลับ FLUX → Gemini 2.5 Flash Image / Claude อัตโนมัติโดยไม่ต้องแก้โค้ด) */
  aiConfig?: {
    geminiApiKey?: string;
    anthropicApiKey?: string;
    preferredImageProvider?: "auto" | "gemini" | "cloudflare";
  };
  updatedAt: string;
}

export interface CreditOrderRecord {
  id: string;
  userId: string;
  email: string;
  credits: number;
  amount: number;
  status: "unpaid" | "pending" | "approved" | "rejected";
  slipUrl?: string | null;
  createdAt: string;
  paidAt?: string;
  decidedAt?: string;
}

export interface RoomPlanRecord {
  id: string;
  name: string;
  /** ห้อง (ขนาด + ของ) เข้ารหัสแบบเดียวกับลิงก์แชร์ (encodePlan) */
  code: string;
  updatedAt: string;
}

export interface PartnerApplicationRecord {
  id: string;
  storeName: string;
  contactName: string;
  email: string;
  phone: string;
  line: string;
  shopUrl: string;
  categories: string[];
  productCount: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string;
}

export interface FeedbackRecord {
  id: string;
  stars: number;
  text: string;
  page: string;
  userId: string | null;
  at: string;
}

export interface BoostRecord {
  id: string;
  partnerId: string;
  partnerName: string;
  productId: string;
  productName: string;
  days: number;
  note: string;
  status: "pending" | "active" | "rejected" | "ended";
  createdAt: string;
  /** ราคาที่ต้องจ่าย (ถ้าเปิดจ่ายผ่านพร้อมเพย์) */
  amount?: number;
  /** ร้านกดแจ้งโอนแล้ว + สลิป */
  paidAt?: string;
  slipUrl?: string | null;
  startAt?: string;
  endAt?: string;
}

export interface CommunityPostRecord {
  id: string;
  kind: "build" | "room";
  userId: string;
  userName: string;
  title: string;
  text: string;
  /** สเปกคอม: selection (slot → id) · ห้อง: รหัสสินค้า */
  selection?: Record<string, string | null>;
  productIds?: string[];
  imageUrl?: string | null;
  likes: string[];
  copies: number;
  status: "visible" | "hidden";
  reports: string[];
  createdAt: string;
}

export interface StoreReviewRecord {
  id: string;
  storeKey: string;
  storeName: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  createdAt: string;
  updatedAt?: string;
  reply?: { text: string; at: string } | null;
}

export interface ChatMessageRecord {
  id: string;
  from: "user" | "store";
  text: string;
  at: string;
  productId?: string | null;
}

export interface ChatThreadRecord {
  id: string;
  storeKey: string;
  storeName: string;
  partnerId: string;
  userId: string;
  userName: string;
  messages: ChatMessageRecord[];
  updatedAt: string;
  userLastRead: string;
  storeLastRead: string;
}

export interface DesignRecord {
  id: string;
  userId: string;
  userName: string;
  imageUrl: string;
  prompt: string;
  productIds: string[];
  createdAt: string;
}

export interface PriceWatchRecord {
  userId: string;
  email: string;
  productId: string;
  priceAtSave: number;
  createdAt: string;
}

/** ร้านพาร์ตเนอร์ที่แอดมินอนุมัติ — ล็อกอินด้วยอีเมลนี้แล้วลงสินค้าได้ที่ /partner */
export interface PartnerRecord {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
  /** ค่าส่งต่อออเดอร์ (บาท) — ไม่ตั้ง = ให้ลูกค้าดูที่ร้าน */
  shippingFee?: number | null;
  /** ยอดขั้นต่ำส่งฟรี (บาท) */
  freeShippingMin?: number | null;
}

const BUNDLED_DATA_DIR = path.join(process.cwd(), ".data");
const BUNDLED_DB_FILE = path.join(BUNDLED_DATA_DIR, "compronext-db.json");
const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "compronext-data")
  : BUNDLED_DATA_DIR;
const DB_FILE = path.join(DATA_DIR, "compronext-db.json");
const SQLITE_FILE = path.join(DATA_DIR, "compronext.sqlite");

/** โฟลเดอร์เก็บข้อมูลในเครื่อง (.data หรือ tmp บน Vercel) */
export function getDataDir(): string {
  return DATA_DIR;
}

const SEED_BANNERS: SiteBannerRecord[] = [
  {
    id: "deal-01",
    partner: "ร้านเฟอร์นิเจอร์พาร์ตเนอร์",
    badge: "เฟอร์นิเจอร์",
    title: "ไอเดียโต๊ะทำงาน & เก้าอี้เพื่อสุขภาพ",
    detail: "รวมโต๊ะปรับระดับและเก้าอี้ ergonomic จากร้านพาร์ตเนอร์ เทียบราคาได้ในที่เดียว",
    href: "/categories?macro=furniture",
    imageUrl: "/rooms/room-03-a.jpg",
    active: true,
    order: 1,
  },
  {
    id: "deal-02",
    partner: "ร้านไอทีพาร์ตเนอร์",
    badge: "ฮาร์ดแวร์",
    title: "อัปเกรดการ์ดจอ & จอ 240Hz",
    detail: "เทียบราคาฮาร์ดแวร์ แล้วเช็กกำลังไฟ PSU และ FPS บนหน้าจัดสเปกคอม 3D",
    href: "/categories?macro=components",
    imageUrl: "/rooms/room-01-a.jpg",
    active: true,
    order: 2,
  },
  {
    id: "deal-03",
    partner: "ร้านเกมมิ่งเกียร์พาร์ตเนอร์",
    badge: "เกมมิ่งเกียร์",
    title: "คีย์บอร์ด ไมโครโฟน & ไฟสตูดิโอ",
    detail: "คัดอุปกรณ์สตรีมเมอร์และเกมมิ่งเกียร์ยอดนิยม พร้อมลิงก์ไปร้านค้า",
    href: "/categories?macro=gaming-gear",
    imageUrl: "/rooms/room-04-a.jpg",
    active: true,
    order: 3,
  },
];

const SEED_ARTICLES: SiteArticleRecord[] = [
  {
    id: "art-01",
    issue: "GUIDE 01 // ERGONOMICS & SPACE",
    title: "วิธีคำนวณความกว้างโต๊ะคอมพิวเตอร์ให้เหมาะกับจอ Dual 27 นิ้ว และแขนจับจอ",
    summary:
      "เจาะลึกระยะห่างสายตา ความลึกหน้าโต๊ะ 70–80 ซม. และการเลือกวัสดุไม้โอ๊คแท้เทียบกับเมลามีนเพื่อรองรับน้ำหนักอุปกรณ์ระยะยาว",
    content:
      "การวางจอขนาด 27 นิ้วจำนวน 2 จอคู่กันควรใช้โต๊ะที่มีความกว้างอย่างน้อย 140–160 ซม. และความลึก 70–80 ซม. เพื่อให้ระยะห่างจากดวงตาอยู่ที่ 65–75 ซม. ตามหลักสรีรศาสตร์ พร้อมแนะนำให้ยึดแขนจับจอเข้ากับท็อปไม้จริงหรือเหล็กหนาตั้งแต่ 25 มม. ขึ้นไป",
    readTime: "อ่าน 4 นาที",
    href: "/rooms",
    status: "published",
    createdAt: "2026-10-25",
    updatedAt: "2026-10-30",
  },
  {
    id: "art-02",
    issue: "GUIDE 02 // HARDWARE ARCHITECTURE",
    title: "จับคู่การ์ดจอ RTX 4070 Super กับจอ QHD 170Hz–240Hz อย่างไรไม่ให้เกิดคอขวด",
    summary:
      "เปรียบเทียบเฟรมเรตจริงในเกม FiveM, Valorant และ Cyberpunk 2077 พร้อมวิธีเลือกขนาดพาวเวอร์ซัพพลายเผื่ออัปเกรด",
    content:
      "RTX 4070 Super จับคู่กับ Ryzen 7 7800X3D หรือ Core i7 Gen 14 บนแรม DDR5-6000 สามารถดันเฟรมเรตที่ความละเอียด 1440p (QHD) ทะลุ 170–240 FPS ในเกม Esports และแนะนำให้เลือก PSU มาตรฐาน 750W–850W 80+ Gold ขึ้นไป",
    readTime: "อ่าน 5 นาที",
    href: "/builder",
    status: "published",
    createdAt: "2026-10-27",
    updatedAt: "2026-10-30",
  },
  {
    id: "art-03",
    issue: "GUIDE 03 // DISPLAY CLARITY",
    title: "IPS vs QD-OLED: เลือกพาเนลจอคอมให้ตรงสายงานตัดต่อสีและเกมมิ่งแข่งขัน",
    summary:
      "ทำความเข้าใจค่า PPI (ความคมชัดต่อตารางนิ้ว), ขอบเขตสี DCI-P3 และเทคโนโลยีถนอมสายตา Flicker-Free ก่อนตัดสินใจซื้อ",
    content:
      "พาเนล Fast IPS ให้ความคุ้มค่าและความสว่างสูงเหมาะกับห้องทำงานที่มีแสงสว่างมาก ส่วน QD-OLED และ WOLED ให้คอนทราสต์แท้จริงและ Response Time 0.03ms เหมาะกับสายเกมมิ่งและงานเกรดสี HDR ระดับมืออาชีพ",
    readTime: "อ่าน 4 นาที",
    href: "/monitors",
    status: "published",
    createdAt: "2026-10-29",
    updatedAt: "2026-10-30",
  },
];

function createSeedCategories(): CatalogCategoryRecord[] {
  return PRODUCT_CATEGORIES.map((slug, idx) => {
    const macro =
      MACRO_CATEGORIES.find((m) => m.mappedCategories.includes(slug))?.slug ?? "furniture";
    return {
      id: `cat-${slug}`,
      slug,
      labelTh: CATEGORY_LABELS[slug] || slug,
      labelEn: slug.replace(/_/g, " ").toUpperCase(),
      macroSlug: macro,
      order: idx + 1,
      active: true,
      isCustom: false,
    };
  });
}

function createSeedSiteSettings(): SiteSettingsRecord {
  return {
    siteName: "ComproNext",
    logoText: "CN",
    logoUrl: null,
    tagline: "OFFICIAL PC & ROOM MARKETPLACE",
    description: "ถ่ายรูปห้อง บอกสไตล์ แล้วให้ AI เลือกของแต่งห้องจากร้านพาร์ตเนอร์ให้ทั้งชุด",
    heroBadge: "AI จัดห้อง · ของจริงจากร้านพาร์ตเนอร์",
    heroTitle: "ถ่ายรูปห้อง แล้วให้ AI",
    heroHighlight: "จัดให้ทั้งห้อง",
    heroDescription: "บอกสไตล์ที่ชอบ AI จะเลือกของจริงจากร้านพาร์ตเนอร์ สร้างภาพห้องที่จัดเสร็จ แล้วใส่ตะกร้าได้ทั้งชุด",
    featuredRoomSlug: "minimal-white-oak",
    featuredProductId: "pc-gaming-4070s-7800x3d",
    contactEmail: "",
    contactPhone: "",
    contactAddress: "",
    copyrightText: `© ${new Date().getFullYear()} ComproNext Thailand. All rights reserved.`,
    seoTitle: "ComproNext — AI จัดห้อง & ช้อปของแต่งห้อง",
    seoDescription: "ถ่ายรูปห้องของคุณ บอกสไตล์ที่อยากได้ แล้วให้ AI เลือกของแต่งห้องจากร้านพาร์ตเนอร์ พร้อมภาพจำลองและตะกร้าสินค้า",
    seoKeywords: "จัดโต๊ะคอม, ประกอบคอม 3D, คอมประกอบ, โต๊ะปรับระดับไฟฟ้า, จอเกมมิ่ง, ComproNext",
    ogImageUrl: "/rooms/room-03-a.jpg",
    socialLinks: {
      facebook: "",
      line: "https://line.me/ti/p/scM55NWXmi",
      youtube: "",
      tiktok: "https://www.tiktok.com/@2479ice?_r=1&_t=ZS-9AzCf4XCffI",
      instagram: "",
    },
    updatedAt: new Date().toISOString(),
  };
}

const SEED_ADMIN_ORDERS: AdminWalletOrder[] = [];

const SEED_ADMIN_USERS: AdminClerkKycUser[] = [];

/** ตรวจสอบว่าสินค้ามีแหล่งขายจริง และมีรูปภาพจากผู้จัดจำหน่ายจริง ไม่ใช่ mock หรือรูปเจน */
export function isAuthenticProduct(p: Product): boolean {
  if (!p || !p.id || typeof p.id !== "string") return false;
  if (p.id.startsWith("gear-")) return false;
  if (p.isSample === true) return false;

  const buy = (p.buyUrl || "").trim();
  if (!buy.startsWith("http://") && !buy.startsWith("https://")) return false;
  if (
    buy.includes("google.com") ||
    buy.includes("/search") ||
    buy.includes("keyword=") ||
    buy.includes("catalog/?q=") ||
    buy.includes("?q=") ||
    buy === "#"
  ) {
    return false;
  }

  // ไม่ใช้รายชื่อร้าน/CDN แบบตายตัว: สินค้าที่ย้ายรูปมาเก็บเอง (cron สำรองรูป), สินค้าพาร์ตเนอร์
  // และสินค้าที่แอดมินลงเอง จะโดนลบทิ้งถาวรตอนบันทึกฐานข้อมูล — คัดออกเฉพาะของปลอม/ตัวอย่างที่ชัดเจน
  const img = (p.sourceImageUrl || p.imageUrl || (p as unknown as { image?: string }).image || "").trim();
  if (!img.startsWith("http://") && !img.startsWith("https://")) return false;
  if (img.includes("images.unsplash.com")) return false;
  if (img.includes("placeholder") || img.includes("dummy")) return false;
  return true;
}

function buildMergedSeedProducts(): Product[] {
  try {
    for (const f of [DB_FILE, BUNDLED_DB_FILE]) {
      if (fs.existsSync(/*turbopackIgnore: true*/ f)) {
        let raw = fs.readFileSync(/*turbopackIgnore: true*/ f, "utf8");
        if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.products) && parsed.products.length > 0) {
          return parsed.products.filter(isAuthenticProduct);
        }
      }
    }
  } catch {}
  return [];
}

function createInitialDb(): RuntimeDatabase {
  return {
    products: buildMergedSeedProducts(),
    rooms: structuredClone(SEED_ROOMS),
    categories: createSeedCategories(),
    banners: structuredClone(SEED_BANNERS),
    articles: structuredClone(SEED_ARTICLES),
    siteSettings: createSeedSiteSettings(),
    orders: structuredClone(SEED_ADMIN_ORDERS),
    users: structuredClone(SEED_ADMIN_USERS),
    neonActiveBranch: "main",
    partners: [],
    designs: [],
    carts: {},
    priceWatches: [],
    reviews: [],
    chats: [],
    saved: {},
    pushSubs: {},
    boosts: [],
    community: [],
    digestSubs: {},
    cases: [],
    partnerApplications: [],
    feedback: [],
    aiCredits: {},
    creditOrders: [],
    roomPlans: {},
    updatedAt: new Date().toISOString(),
  };
}

let sqliteInstance: DatabaseSync | null = null;

function getSqlite(): DatabaseSync | null {
  if (sqliteInstance) return sqliteInstance;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const db = new DatabaseSync(SQLITE_FILE);
    db.exec(`
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        status TEXT NOT NULL,
        published INTEGER NOT NULL DEFAULT 1,
        featured INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        json_data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        status TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        json_data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        json_data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS banners (
        id TEXT PRIMARY KEY,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        json_data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        json_data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        json_data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        kyc_status TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        json_data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS admin_accounts (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    sqliteInstance = db;
    return db;
  } catch {
    return null;
  }
}

function normalizeRuntimeDb(parsed: Partial<RuntimeDatabase>): RuntimeDatabase {
  const seed = createInitialDb();

  // กรองเฉพาะสินค้าจริง 100% ที่มีแหล่งขายจริงและรูปสินค้าจริง
  let products = (Array.isArray(parsed.products) ? parsed.products : seed.products).filter(isAuthenticProduct);
  products = products.map((p) => {
    const category = p.id === "decor-plant-ceramic" ? "fake_plant" : p.category;
    return {
      ...p,
      category,
      ports: Array.isArray(p.ports) ? p.ports : [],
      imageUrl:
        knownRealImage(p) ??
        resolveRealProductImage({
          id: p.id,
          name: p.name,
          category,
          imageUrl: p.imageUrl,
        }),
      isSample: false,
      published: p.published ?? true,
      featured: p.featured ?? false,
    };
  });

  // Ensure all seed categories (including room-items categories) exist and have updated macroSlug
  const seedCatsBySlug = new Map(seed.categories.map((c) => [c.slug, c]));
  const categories =
    Array.isArray(parsed.categories) && parsed.categories.length > 0
      ? parsed.categories.map((c) => {
          const fresh = seedCatsBySlug.get(c.slug);
          return fresh ? { ...c, labelTh: fresh.labelTh, macroSlug: fresh.macroSlug } : c;
        })
      : seed.categories;
  const seenCatSlugs = new Set(categories.map((c) => c.slug));
  for (const sc of seed.categories) {
    if (!seenCatSlugs.has(sc.slug)) {
      categories.push(sc);
      seenCatSlugs.add(sc.slug);
    }
  }

  // Use authentic rooms with verified photos; avoid re-injecting legacy blueprint rooms
  const rooms = Array.isArray(parsed.rooms) && parsed.rooms.length >= 50
    ? parsed.rooms.filter((r) => Array.isArray(r.images) && r.images.length > 0)
    : [...seed.rooms.filter((r) => Array.isArray(r.images) && r.images.length > 0)];

  return {
    products,
    rooms,
    categories,
    banners:
      Array.isArray(parsed.banners) && parsed.banners.length > 0
        ? parsed.banners
        : seed.banners,
    articles:
      Array.isArray(parsed.articles) && parsed.articles.length > 0
        ? parsed.articles
        : seed.articles,
    siteSettings: parsed.siteSettings
      ? {
          ...seed.siteSettings,
          ...parsed.siteSettings,
          socialLinks: {
            ...seed.siteSettings.socialLinks,
            ...(parsed.siteSettings.socialLinks ?? {}),
            facebook: "",
            youtube: "",
            line:
              !parsed.siteSettings.socialLinks?.line ||
              parsed.siteSettings.socialLinks.line === "https://line.me/R/ti/p/@compronext"
                ? "https://line.me/ti/p/scM55NWXmi"
                : parsed.siteSettings.socialLinks.line,
            tiktok:
              !parsed.siteSettings.socialLinks?.tiktok ||
              parsed.siteSettings.socialLinks.tiktok === "https://tiktok.com/@compronext"
                ? "https://www.tiktok.com/@2479ice?_r=1&_t=ZS-9AzCf4XCffI"
                : parsed.siteSettings.socialLinks.tiktok,
          },
        }
      : seed.siteSettings,
    orders: Array.isArray(parsed.orders) ? parsed.orders : seed.orders,
    users: Array.isArray(parsed.users) ? parsed.users : seed.users,
    neonActiveBranch: parsed.neonActiveBranch ?? "main",
    partners: Array.isArray(parsed.partners) ? parsed.partners : [],
    designs: Array.isArray(parsed.designs) ? parsed.designs : [],
    carts: parsed.carts && typeof parsed.carts === "object" ? parsed.carts : {},
    priceWatches: Array.isArray(parsed.priceWatches) ? parsed.priceWatches : [],
    reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
    chats: Array.isArray(parsed.chats) ? parsed.chats : [],
    saved: parsed.saved && typeof parsed.saved === "object" ? parsed.saved : {},
    pushSubs: parsed.pushSubs && typeof parsed.pushSubs === "object" ? parsed.pushSubs : {},
    boosts: Array.isArray(parsed.boosts) ? parsed.boosts : [],
    community: Array.isArray(parsed.community) ? parsed.community : [],
    digestSubs: parsed.digestSubs && typeof parsed.digestSubs === "object" ? parsed.digestSubs : {},
    cases: Array.isArray(parsed.cases) ? parsed.cases : [],
    partnerApplications: Array.isArray(parsed.partnerApplications) ? parsed.partnerApplications : [],
    feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
    aiCredits: parsed.aiCredits && typeof parsed.aiCredits === "object" ? parsed.aiCredits : {},
    creditOrders: Array.isArray(parsed.creditOrders) ? parsed.creditOrders : [],
    roomPlans: parsed.roomPlans && typeof parsed.roomPlans === "object" ? parsed.roomPlans : {},
    ...(parsed.aiUsage && typeof parsed.aiUsage === "object" ? { aiUsage: parsed.aiUsage } : {}),
    ...(parsed.aiConfig && typeof parsed.aiConfig === "object" ? { aiConfig: parsed.aiConfig } : {}),
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
  };
}

function syncToSqlite(data: RuntimeDatabase) {
  const sqlite = getSqlite();
  if (!sqlite) return;
  try {
    sqlite.exec("BEGIN IMMEDIATE TRANSACTION");

    sqlite.exec("DELETE FROM products");
    const insProd = sqlite.prepare(
      "INSERT INTO products (id, name, category, price, status, published, featured, sort_order, json_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    data.products.forEach((p, idx) => {
      insProd.run(
        p.id,
        p.name,
        p.category,
        p.price,
        p.status,
        p.published === false ? 0 : 1,
        p.featured ? 1 : 0,
        idx,
        JSON.stringify(p)
      );
    });

    sqlite.exec("DELETE FROM rooms");
    const insRoom = sqlite.prepare(
      "INSERT INTO rooms (id, slug, status, sort_order, json_data) VALUES (?, ?, ?, ?, ?)"
    );
    data.rooms.forEach((r, idx) => {
      insRoom.run(r.id, r.slug, r.status, idx, JSON.stringify(r));
    });

    sqlite.exec("DELETE FROM categories");
    const insCat = sqlite.prepare(
      "INSERT INTO categories (id, slug, sort_order, active, json_data) VALUES (?, ?, ?, ?, ?)"
    );
    data.categories.forEach((c, idx) => {
      insCat.run(c.id, c.slug, c.order ?? idx, c.active ? 1 : 0, JSON.stringify(c));
    });

    sqlite.exec("DELETE FROM banners");
    const insBan = sqlite.prepare(
      "INSERT INTO banners (id, sort_order, active, json_data) VALUES (?, ?, ?, ?)"
    );
    data.banners.forEach((b, idx) => {
      insBan.run(b.id, b.order ?? idx, b.active ? 1 : 0, JSON.stringify(b));
    });

    sqlite.exec("DELETE FROM articles");
    const insArt = sqlite.prepare(
      "INSERT INTO articles (id, status, sort_order, json_data) VALUES (?, ?, ?, ?)"
    );
    data.articles.forEach((a, idx) => {
      insArt.run(a.id, a.status, idx, JSON.stringify(a));
    });

    sqlite.exec("DELETE FROM orders");
    const insOrd = sqlite.prepare(
      "INSERT INTO orders (id, status, sort_order, json_data) VALUES (?, ?, ?, ?)"
    );
    data.orders.forEach((o, idx) => {
      insOrd.run(o.id, o.status, idx, JSON.stringify(o));
    });

    sqlite.exec("DELETE FROM users");
    const insUsr = sqlite.prepare(
      "INSERT INTO users (id, kyc_status, sort_order, json_data) VALUES (?, ?, ?, ?)"
    );
    data.users.forEach((u, idx) => {
      insUsr.run(u.id, u.kycStatus, idx, JSON.stringify(u));
    });

    const upsertKv = sqlite.prepare(
      "INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    );
    const now = new Date().toISOString();
    upsertKv.run("siteSettings", JSON.stringify(data.siteSettings), now);
    upsertKv.run("neonActiveBranch", data.neonActiveBranch, now);
    upsertKv.run("partners", JSON.stringify(data.partners ?? []), now);
    upsertKv.run("designs", JSON.stringify(data.designs ?? []), now);
    upsertKv.run("carts", JSON.stringify(data.carts ?? {}), now);
    upsertKv.run("priceWatches", JSON.stringify(data.priceWatches ?? []), now);
    upsertKv.run("reviews", JSON.stringify(data.reviews ?? []), now);
    upsertKv.run("chats", JSON.stringify(data.chats ?? []), now);
    upsertKv.run("saved", JSON.stringify(data.saved ?? {}), now);
    upsertKv.run("pushSubs", JSON.stringify(data.pushSubs ?? {}), now);
    upsertKv.run("boosts", JSON.stringify(data.boosts ?? []), now);
    upsertKv.run("community", JSON.stringify(data.community ?? []), now);
    upsertKv.run("digestSubs", JSON.stringify(data.digestSubs ?? {}), now);
    upsertKv.run("cases", JSON.stringify(data.cases ?? []), now);
    upsertKv.run("partnerApplications", JSON.stringify(data.partnerApplications ?? []), now);
    upsertKv.run("feedback", JSON.stringify(data.feedback ?? []), now);
    upsertKv.run("aiCredits", JSON.stringify(data.aiCredits ?? {}), now);
    upsertKv.run("creditOrders", JSON.stringify(data.creditOrders ?? []), now);
    upsertKv.run("roomPlans", JSON.stringify(data.roomPlans ?? {}), now);
    upsertKv.run("aiUsage", JSON.stringify(data.aiUsage ?? {}), now);
    upsertKv.run("aiConfig", JSON.stringify(data.aiConfig ?? {}), now);
    upsertKv.run("updatedAt", data.updatedAt, now);

    sqlite.exec("COMMIT");
  } catch {
    try {
      sqlite.exec("ROLLBACK");
    } catch {
      // ignore
    }
  }
}

function readFromSqlite(): RuntimeDatabase | null {
  const sqlite = getSqlite();
  if (!sqlite) return null;
  try {
    const prodRows = sqlite
      .prepare("SELECT json_data FROM products ORDER BY sort_order ASC")
      .all() as Array<{ json_data: string }>;
    if (prodRows.length === 0) return null;

    const roomRows = sqlite
      .prepare("SELECT json_data FROM rooms ORDER BY sort_order ASC")
      .all() as Array<{ json_data: string }>;
    const catRows = sqlite
      .prepare("SELECT json_data FROM categories ORDER BY sort_order ASC")
      .all() as Array<{ json_data: string }>;
    const banRows = sqlite
      .prepare("SELECT json_data FROM banners ORDER BY sort_order ASC")
      .all() as Array<{ json_data: string }>;
    const artRows = sqlite
      .prepare("SELECT json_data FROM articles ORDER BY sort_order ASC")
      .all() as Array<{ json_data: string }>;
    const ordRows = sqlite
      .prepare("SELECT json_data FROM orders ORDER BY sort_order ASC")
      .all() as Array<{ json_data: string }>;
    const usrRows = sqlite
      .prepare("SELECT json_data FROM users ORDER BY sort_order ASC")
      .all() as Array<{ json_data: string }>;

    const settingsRow = sqlite
      .prepare("SELECT value FROM kv_store WHERE key = ?")
      .get("siteSettings") as { value: string } | undefined;
    const branchRow = sqlite
      .prepare("SELECT value FROM kv_store WHERE key = ?")
      .get("neonActiveBranch") as { value: string } | undefined;
    const kv = (key: string) =>
      (sqlite.prepare("SELECT value FROM kv_store WHERE key = ?").get(key) as { value: string } | undefined)?.value;
    const partnersRow = sqlite
      .prepare("SELECT value FROM kv_store WHERE key = ?")
      .get("partners") as { value: string } | undefined;
    const updatedRow = sqlite
      .prepare("SELECT value FROM kv_store WHERE key = ?")
      .get("updatedAt") as { value: string } | undefined;

    return normalizeRuntimeDb({
      products: prodRows.map((r) => JSON.parse(r.json_data) as Product),
      rooms: roomRows.map((r) => JSON.parse(r.json_data) as Room),
      categories: catRows.map((r) => JSON.parse(r.json_data) as CatalogCategoryRecord),
      banners: banRows.map((r) => JSON.parse(r.json_data) as SiteBannerRecord),
      articles: artRows.map((r) => JSON.parse(r.json_data) as SiteArticleRecord),
      siteSettings: settingsRow
        ? (JSON.parse(settingsRow.value) as SiteSettingsRecord)
        : undefined,
      orders: ordRows.map((r) => JSON.parse(r.json_data) as AdminWalletOrder),
      users: usrRows.map((r) => JSON.parse(r.json_data) as AdminClerkKycUser),
      neonActiveBranch:
        (branchRow?.value as RuntimeDatabase["neonActiveBranch"]) || "main",
      partners: partnersRow ? (JSON.parse(partnersRow.value) as PartnerRecord[]) : [],
      designs: JSON.parse(kv("designs") ?? "[]") as DesignRecord[],
      carts: JSON.parse(kv("carts") ?? "{}") as RuntimeDatabase["carts"],
      priceWatches: JSON.parse(kv("priceWatches") ?? "[]") as PriceWatchRecord[],
      reviews: JSON.parse(kv("reviews") ?? "[]") as StoreReviewRecord[],
      chats: JSON.parse(kv("chats") ?? "[]") as ChatThreadRecord[],
      saved: JSON.parse(kv("saved") ?? "{}") as RuntimeDatabase["saved"],
      pushSubs: JSON.parse(kv("pushSubs") ?? "{}") as RuntimeDatabase["pushSubs"],
      boosts: JSON.parse(kv("boosts") ?? "[]") as BoostRecord[],
      community: JSON.parse(kv("community") ?? "[]") as CommunityPostRecord[],
      digestSubs: JSON.parse(kv("digestSubs") ?? "{}") as RuntimeDatabase["digestSubs"],
      cases: JSON.parse(kv("cases") ?? "[]") as SupportCaseRecord[],
      partnerApplications: JSON.parse(kv("partnerApplications") ?? "[]") as PartnerApplicationRecord[],
      feedback: JSON.parse(kv("feedback") ?? "[]") as FeedbackRecord[],
      aiCredits: JSON.parse(kv("aiCredits") ?? "{}") as RuntimeDatabase["aiCredits"],
      creditOrders: JSON.parse(kv("creditOrders") ?? "[]") as CreditOrderRecord[],
      roomPlans: JSON.parse(kv("roomPlans") ?? "{}") as RuntimeDatabase["roomPlans"],
      aiUsage: JSON.parse(kv("aiUsage") ?? "{}") as NonNullable<RuntimeDatabase["aiUsage"]>,
      aiConfig: JSON.parse(kv("aiConfig") ?? "{}") as NonNullable<RuntimeDatabase["aiConfig"]>,
      updatedAt: updatedRow?.value || new Date().toISOString(),
    });
  } catch {
    return null;
  }
}

/** อ่านจากไฟล์ในเครื่อง (SQLite → JSON snapshot → ข้อมูลตั้งต้น) */
function readLocalDb(): RuntimeDatabase {
  // 1. Primary: Read from SQLite relational database if populated with complete catalog
  const fromSqlite = readFromSqlite();
  if (fromSqlite && fromSqlite.products.length >= 100 && fromSqlite.rooms.length >= 10) {
    return fromSqlite;
  }

  // 2. Migrate from JSON snapshot if present (runtime DB_FILE first so admin edits persist, then BUNDLED_DB_FILE)
  for (const candidateFile of [DB_FILE, BUNDLED_DB_FILE]) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ candidateFile)) {
        let raw = fs.readFileSync(/*turbopackIgnore: true*/ candidateFile, "utf8");
        if (raw.charCodeAt(0) === 0xFEFF) {
          raw = raw.slice(1);
        }
        const parsed = JSON.parse(raw) as Partial<RuntimeDatabase>;
        if (Array.isArray(parsed.products) && Array.isArray(parsed.rooms)) {
          const normalized = normalizeRuntimeDb(parsed);
          if (!isPostgresEnabled()) writeLocalDb(normalized);
          return normalized;
        }
      }
    } catch {
      // Fallback to next candidate or seed data if file read fails
    }
  }

  if (fromSqlite) {
    return fromSqlite;
  }

  // 3. First boot: initialize from seed data
  const initial = createInitialDb();
  if (!isPostgresEnabled()) writeLocalDb(initial);
  return initial;
}

export function writeDb(db: RuntimeDatabase): RuntimeDatabase {
  return writeDbInternal(db, false);
}

/** เหมือน writeDb แต่โยน error ถ้าเขียนไฟล์ในเครื่องไม่สำเร็จ (โหมด Postgres ทำงานเหมือน writeDb) */
export function writeDbStrict(db: RuntimeDatabase): RuntimeDatabase {
  return writeDbInternal(db, true);
}

function writeDbInternal(db: RuntimeDatabase, strict: boolean): RuntimeDatabase {
  const next: RuntimeDatabase = {
    ...normalizeRuntimeDb(db),
    products: db.products.map((p) => ({
      ...p,
      published: p.published ?? true,
      featured: p.featured ?? false,
    })),
    updatedAt: new Date().toISOString(),
  };

  if (isPostgresEnabled() && !dbState.memoFromPg) {
    refreshFromPostgres();
    throw new Error("ฐานข้อมูลกำลังโหลด กรุณาลองใหม่อีกครั้งใน 2-3 วินาที");
  }
  if (isPostgresEnabled()) {
    dbState.memo = { db: next, at: Date.now() };
    persistToPostgres(next);
    return next;
  }
  if (!strict) dbState.memo = { db: next, at: Date.now() };
  writeLocalDb(next, strict);
  if (strict) dbState.memo = { db: next, at: Date.now() };
  return next;
}

function writeLocalDb(next: RuntimeDatabase, strict = false) {
  syncToSqlite(next);

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(next, null, 2), "utf8");
  } catch (err) {
    // Ignore write errors on read-only serverless file systems (unless strict)
    if (strict) throw err;
  }
}

// ---------------------------------------------------------------------------
// แคชในหน่วยความจำ + ฐานข้อมูลจริง (Postgres เช่น Neon / Supabase) เมื่อตั้ง DATABASE_URL
// ---------------------------------------------------------------------------
const PG_TTL_MS = 30_000;
// เก็บใน globalThis เพื่อให้ instrumentation กับ route ต่างๆ ใช้แคชเดียวกัน
const dbState = ((globalThis as unknown as { __compronextDb?: DbState }).__compronextDb ??= {
  memo: null,
  memoFromPg: false,
  pgRefreshing: null,
});
interface DbState {
  memo: { db: RuntimeDatabase; at: number } | null;
  /** JSON ของแต่ละหัวข้อ ณ ตอนโหลด/บันทึกล่าสุด — ใช้ส่งเฉพาะหัวข้อที่เปลี่ยน (กันเขียนทับงานของเครื่องอื่น) */
  pgKeys?: Map<string, string>;
  /** true เมื่อแคชมาจาก Postgres แล้ว — กันไม่ให้ข้อมูลจากไฟล์ในเครื่องไปทับฐานข้อมูลจริง */
  memoFromPg: boolean;
  pgRefreshing: Promise<void> | null;
}

function isPostgresEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

type Sql = import("postgres").Sql;
const globalForPg = globalThis as unknown as { __compronextSql?: Sql };

async function getPg(): Promise<Sql> {
  if (!globalForPg.__compronextSql) {
    const { default: postgres } = await import("postgres");
    globalForPg.__compronextSql = postgres(process.env.DATABASE_URL!, { max: 3, idle_timeout: 20, prepare: false });
    await globalForPg.__compronextSql`create table if not exists compronext_state (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )`;
  }
  return globalForPg.__compronextSql;
}

/** client Postgres ตัวเดียวกับที่ store ใช้ (null เมื่อไม่ได้ตั้ง DATABASE_URL) */
export async function getPgSql(): Promise<Sql | null> {
  return isPostgresEnabled() ? getPg() : null;
}

/** โหลดข้อมูลจาก Postgres เข้าแคช (เรียกตอนเซิร์ฟเวอร์เริ่ม และรีเฟรชทุก 30 วินาที) */
export async function loadFromPostgres(): Promise<void> {
  const sql = await getPg();
  const rows = await sql<{ data: Partial<RuntimeDatabase> }[]>`select data from compronext_state where id = 'main'`;
  if (rows.length > 0) {
    dbState.memo = { db: normalizeRuntimeDb(rows[0].data), at: Date.now() };
    dbState.pgKeys = keySnapshot(dbState.memo.db);
    dbState.memoFromPg = true;
    return;
  }
  // ครั้งแรก: ย้ายข้อมูลจากไฟล์ในโปรเจกต์ขึ้นฐานข้อมูล
  const initial = readLocalDb();
  await sql`insert into compronext_state (id, data) values ('main', ${sql.json(JSON.parse(JSON.stringify(initial)))}) on conflict (id) do nothing`;
  dbState.memo = { db: initial, at: Date.now() };
  dbState.memoFromPg = true;
}

function refreshFromPostgres() {
  if (dbState.pgRefreshing) return;
  dbState.pgRefreshing = loadFromPostgres()
    .catch((err) => console.error("[db] Postgres refresh failed", err))
    .finally(() => {
      dbState.pgRefreshing = null;
    });
}

function keySnapshot(db: RuntimeDatabase): Map<string, string> {
  return new Map(Object.entries(db).map(([k, v]) => [k, JSON.stringify(v)]));
}

/**
 * บันทึกลง Postgres เฉพาะหัวข้อที่เปลี่ยน แล้วรวมกับข้อมูลล่าสุดในฐานข้อมูลแบบ atomic (jsonb ||)
 * → เซิร์ฟเวอร์หลายเครื่องแก้คนละหัวข้อพร้อมกัน (เช่น แชท vs ตะกร้า) จะไม่ทับกัน
 */
function persistToPostgres(data: RuntimeDatabase) {
  const now = keySnapshot(data);
  const prev = dbState.pgKeys;
  const changed: Record<string, unknown> = {};
  for (const [k, json] of now) if (!prev || prev.get(k) !== json) changed[k] = JSON.parse(json);
  dbState.pgKeys = now;
  if (Object.keys(changed).length === 0) return;
  const task = getPg()
    .then((sql) =>
      sql`insert into compronext_state (id, data, updated_at) values ('main', ${sql.json(JSON.parse(JSON.stringify(data)))}, now())
          on conflict (id) do update set data = compronext_state.data || ${sql.json(changed as never)}, updated_at = now()`
    )
    .catch((err) => console.error("[db] Postgres save failed", err));
  try {
    // ให้ serverless รอจนบันทึกเสร็จหลังส่ง response
    after(() => task);
  } catch {
    // อยู่นอก request (เช่นสคริปต์) — ปล่อยให้ promise ทำงานต่อ
  }
}

export function readDb(): RuntimeDatabase {
  if (dbState.memo && (!isPostgresEnabled() || Date.now() - dbState.memo.at < PG_TTL_MS)) return dbState.memo.db;
  if (isPostgresEnabled()) {
    refreshFromPostgres();
    if (dbState.memo) return dbState.memo.db;
  }
  const db = readLocalDb();
  dbState.memo = { db, at: Date.now() };
  return db;
}

export function resetDbToSeed(): RuntimeDatabase {
  const fresh = createInitialDb();
  return writeDb(fresh);
}

export function getAllProducts(includeUnpublished = false): Product[] {
  const list = readDb().products;
  return includeUnpublished ? list : list.filter((p) => p.published !== false);
}

export function getAllCatalogProducts(includeUnpublished = false): Product[] {
  const list = readDb().products;
  return includeUnpublished ? list : list.filter((p) => p.published !== false);
}

export function getProductById(id: string): Product | null {
  return readDb().products.find((p) => p.id === id) ?? null;
}

/** ค่าสี/วัสดุตั้งต้นที่ทุกห้องเคยได้เหมือนกัน → แทนด้วยค่าที่คำนวณจากรูปห้อง + สินค้าจริง */
const PLACEHOLDER_ATTRS = '["black","white","wood","silver"]|["wood","aluminum","steel"]';
const DERIVED_ROOM_ATTRS = roomAttributes as Record<string, { colors: string[]; materials: string[] }>;
function withRealAttributes(room: Room): Room {
  const d = DERIVED_ROOM_ATTRS[room.id];
  if (!d || `${JSON.stringify(room.colors)}|${JSON.stringify(room.materials)}` !== PLACEHOLDER_ATTRS) return room;
  return { ...room, colors: d.colors, materials: d.materials };
}

export function getAllRooms(includeNonPublished = false): Room[] {
  const rooms = readDb().rooms.map(withRealAttributes);
  return includeNonPublished ? rooms : rooms.filter((r) => r.status === "published");
}

export function getRoomBySlugOrId(slugOrId: string, includeNonPublished = false): Room | null {
  const rooms = getAllRooms(includeNonPublished);
  return rooms.find((r) => r.slug === slugOrId || r.id === slugOrId) ?? null;
}

export function getAllCategories(includeInactive = false): CatalogCategoryRecord[] {
  const cats = [...readDb().categories].sort((a, b) => a.order - b.order);
  return includeInactive ? cats : cats.filter((c) => c.active !== false);
}

export function getAllBanners(includeInactive = false): SiteBannerRecord[] {
  const list = [...readDb().banners].sort((a, b) => a.order - b.order);
  return includeInactive ? list : list.filter((b) => b.active !== false);
}

export function getAllArticles(includeDrafts = false): SiteArticleRecord[] {
  const list = readDb().articles;
  return includeDrafts ? list : list.filter((a) => a.status === "published");
}

export function getArticleById(id: string): SiteArticleRecord | null {
  return readDb().articles.find((a) => a.id === id) ?? null;
}

export function getSiteSettings(): SiteSettingsRecord {
  return readDb().siteSettings;
}

/**
 * ร้านพาร์ตเนอร์ของผู้ใช้ที่ล็อกอินอยู่ (เฉพาะที่เปิดใช้งาน)
 * รับเฉพาะบัญชีที่ยืนยันอีเมลด้วย OTP ของเราเอง — ล็อกอินช่องทางอื่น (เช่น LINE) เข้าหลังร้านไม่ได้
 */
export function getActivePartnerByEmail(
  user: { email?: string | null; provider?: string } | string | null | undefined
): PartnerRecord | null {
  if (!user) return null;
  if (typeof user !== "string" && user.provider !== "email") return null;
  const email = typeof user === "string" ? user : user.email;
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return readDb().partners.find((p) => p.active && p.email.toLowerCase() === e) ?? null;
}

export interface ShippingRule {
  fee: number;
  freeMin: number | null;
}

/** ค่าส่งของร้านพาร์ตเนอร์ที่ตั้งไว้ (key = ชื่อร้าน ตรงกับ storeName ในตะกร้า) */
export function getShippingRules(): Record<string, ShippingRule> {
  const out: Record<string, ShippingRule> = {};
  for (const p of readDb().partners) {
    if (!p.active || typeof p.shippingFee !== "number") continue;
    out[p.name] = { fee: p.shippingFee, freeMin: typeof p.freeShippingMin === "number" ? p.freeShippingMin : null };
  }
  return out;
}


/** ผู้ใช้ถูกระงับไหม (ใช้กันโพสต์/รีวิว/แชท) */
export function isUserBanned(userId: string, db: RuntimeDatabase = readDb()): boolean {
  return db.users.some((u) => u.id === userId && u.banned);
}
