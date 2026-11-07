import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { getCurrentUser, sanitizeText } from "@/lib/auth";
import { getActivePartnerByEmail, readDb, writeDb } from "@/lib/data/store";
import { isSafeHttpUrl } from "@/lib/links";
import { applyPriceDropAlerts } from "@/lib/price-alerts";
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/format";
import { partnerRowsFromCsv } from "@/lib/partner-csv";
import { boostPrices, boostQrSvg, promptPayEnabled } from "@/lib/boost-pay";

async function requirePartner() {
  const user = await getCurrentUser();
  return getActivePartnerByEmail(user);
}

/** รับเฉพาะไฟล์ที่อัปโหลดผ่านเว็บเรา หรือ URL https สาธารณะ */
function cleanAssetUrl(raw: unknown, mustEndWith?: string): string | null {
  const v = sanitizeText(raw, 1000).trim();
  if (!v) return null;
  const ok = v.startsWith("/api/files/") || (isSafeHttpUrl(v) && v.startsWith("https://"));
  if (!ok) return null;
  if (mustEndWith && !v.split("?")[0].toLowerCase().endsWith(mustEndWith)) return null;
  return v;
}

type Partner = NonNullable<Awaited<ReturnType<typeof requirePartner>>>;
const LABEL_TO_CAT = new Map(Object.entries(CATEGORY_LABELS).map(([k, v]) => [v, k]));

/** ตรวจ + สร้างสินค้าของร้าน (ใช้ทั้งเพิ่มทีละชิ้นและอัปโหลด CSV) */
function buildPartnerProduct(input: Partial<Product>, partner: Partner, db: ReturnType<typeof readDb>): { product: Product; isNew: boolean } | { error: string } {
  const name = sanitizeText(input.name, 200);
  const category = (LABEL_TO_CAT.get(String(input.category ?? "").trim()) ?? String(input.category ?? "").trim().toLowerCase()) as ProductCategory;
  const price = Math.round(Number(input.price));
  const buyUrl = sanitizeText(input.buyUrl, 1000);

  if (name.length < 2) return { error: "กรอกชื่อสินค้า" };
  if (!PRODUCT_CATEGORIES.includes(category)) return { error: "เลือกหมวดสินค้า" };
  if (!Number.isFinite(price) || price < 1 || price > 10_000_000) return { error: "ราคาไม่ถูกต้อง" };
  if (!isSafeHttpUrl(buyUrl)) return { error: "ใส่ลิงก์หน้าสินค้าของร้าน (https://...)" };

  const existing = input.id ? db.products.find((p) => p.id === input.id) : undefined;
  if (input.id && (!existing || existing.partnerId !== partner.id)) return { error: "ไม่พบสินค้า" };

  const product: Product = {
    ...(existing ?? {
      colors: [],
      materials: [],
      dimensions: null,
      ports: [],
      specs: {},
      placement: "other",
      isSample: false,
      featured: false,
    }),
    id: existing?.id ?? `pt-${partner.id}-${crypto.randomBytes(5).toString("hex")}`,
    name,
    description: sanitizeText(input.description, 2000),
    imageUrl: cleanAssetUrl(input.imageUrl),
    modelUrl: cleanAssetUrl(input.modelUrl, ".glb"),
    price,
    currency: "THB",
    buyUrl,
    storeName: partner.name,
    platform: partner.name,
    category,
    status: input.status === "out_of_stock" ? "out_of_stock" : "available",
    published: input.published !== false,
    priceUpdatedAt: new Date().toISOString().slice(0, 10),
    partnerId: partner.id,
  };

  return { product, isNew: !existing };
}

export async function GET() {
  const partner = await requirePartner();
  if (!partner) return NextResponse.json({ ok: false, error: "ไม่ใช่บัญชีร้านพาร์ตเนอร์" }, { status: 403 });
  const products = readDb().products.filter((p) => p.partnerId === partner.id);
  return NextResponse.json({ ok: true, partner, products });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?:
      | "activate_demo_partner"
      | "upsert_product"
      | "delete_product"
      | "update_shipping"
      | "request_boost"
      | "bulk_csv"
      | "boost_payment"
      | "boost_paid";
    storeName?: unknown;
    slipUrl?: unknown;
    csvText?: unknown;
    dryRun?: boolean;
    days?: unknown;
    note?: unknown;
    product?: Partial<Product>;
    productId?: string;
    shippingFee?: unknown;
    freeShippingMin?: unknown;
  };

  if (body.action === "activate_demo_partner") {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนเปิดร้านพาร์ตเนอร์" }, { status: 401 });
    }
    const db = readDb();
    const email = user.email.toLowerCase();
    const defaultName = `ร้าน ${user.name || email.split("@")[0]} Official`;
    const name = sanitizeText(body.storeName, 120).trim() || defaultName;
    const partners = db.partners ?? [];
    let partnerRec = partners.find((p) => p.email.toLowerCase() === email);
    if (partnerRec) {
      partnerRec.active = true;
      partnerRec.name = name;
    } else {
      partnerRec = {
        id: `ptn-${crypto.randomBytes(4).toString("hex")}`,
        name,
        email,
        active: true,
        shippingFee: 50,
        freeShippingMin: 1500,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      partners.push(partnerRec);
    }
    db.partners = partners;
    const hasProducts = db.products.some((p) => p.partnerId === partnerRec.id);
    if (!hasProducts) {
      const today = new Date().toISOString().slice(0, 10);
      const demoItems: Product[] = [
        {
          id: `pt-${partnerRec.id}-desk01`,
          name: `${name} — โต๊ะปรับระดับไฟฟ้า Dual Motor 140×70 ซม.`,
          description: "โต๊ะปรับระดับไฟฟ้าคู่ ขึ้น-ลงนุ่มเงียบ จดจำความสูงได้ 4 ระดับ รับน้ำหนักได้ 120 กก.",
          imageUrl: "/furniture/desk-gaming-carbon-140.webp",
          modelUrl: null,
          price: 8990,
          currency: "THB",
          buyUrl: "https://shopee.co.th/",
          storeName: name,
          platform: name,
          category: "desk",
          colors: ["black", "walnut"],
          materials: ["wood", "steel"],
          dimensions: { width: 140, depth: 70, height: 75, unit: "cm" },
          ports: [],
          specs: { มอเตอร์: "Dual Motor", รับน้ำหนัก: "120 กก." },
          placement: "desk",
          status: "available",
          published: true,
          isSample: false,
          featured: false,
          priceUpdatedAt: today,
          partnerId: partnerRec.id,
        },
        {
          id: `pt-${partnerRec.id}-mon01`,
          name: `${name} — จอเกมมิ่ง 27" QHD 180Hz Fast IPS`,
          description: "จอภาพ 27 นิ้ว ความละเอียด 2K QHD (2560×1440) รีเฟรชเรต 180Hz รองรับ G-Sync / FreeSync",
          imageUrl: "https://www.jib.co.th/img_master/product/medium/20260811160417_0000084703_469_1.jpg",
          modelUrl: null,
          price: 6490,
          currency: "THB",
          buyUrl: "https://shopee.co.th/",
          storeName: name,
          platform: name,
          category: "monitor",
          colors: ["black"],
          materials: ["plastic", "metal"],
          dimensions: { width: 61.4, depth: 20, height: 45, unit: "cm" },
          ports: ["HDMI 2.0", "DisplayPort 1.4"],
          specs: { ขนาด: "27 นิ้ว", ความละเอียด: "QHD 2560×1440", รีเฟรชเรต: "180Hz", พาเนล: "IPS" },
          placement: "desk",
          status: "available",
          published: true,
          isSample: false,
          featured: false,
          priceUpdatedAt: today,
          partnerId: partnerRec.id,
        },
      ];
      db.products.unshift(...demoItems);
    }
    writeDb(db);
    revalidatePath("/partner");
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, partner: partnerRec });
  }

  const partner = await requirePartner();
  if (!partner) return NextResponse.json({ ok: false, error: "ไม่ใช่บัญชีร้านพาร์ตเนอร์" }, { status: 403 });

  const db = readDb();

  // ขอดันสินค้า → ได้ QR พร้อมเพย์ใส่ยอดไว้ (ถ้าตั้ง PROMPTPAY_ID) → ร้านแจ้งโอน → แอดมินกดอนุมัติ
  if (body.action === "request_boost") {
    const product = db.products.find((p) => p.id === body.productId && p.partnerId === partner.id);
    if (!product) return NextResponse.json({ ok: false, error: "ไม่พบสินค้าของร้าน" }, { status: 404 });
    const days = [7, 14, 30].includes(Number(body.days)) ? Number(body.days) : 7;
    if (db.boosts.some((b) => b.productId === product.id && (b.status === "pending" || b.status === "active")))
      return NextResponse.json({ ok: false, error: "สินค้านี้มีคำขอดันอยู่แล้ว" }, { status: 409 });
    const amount = promptPayEnabled() ? boostPrices()[days] : undefined;
    const boost = {
      id: `bst-${Date.now().toString(36)}`,
      partnerId: partner.id,
      partnerName: partner.name,
      productId: product.id,
      productName: product.name,
      days,
      note: String(body.note ?? "").slice(0, 300),
      status: "pending" as const,
      createdAt: new Date().toISOString(),
      amount,
    };
    db.boosts.unshift(boost);
    writeDb(db);
    return NextResponse.json({ ok: true, amount: amount ?? null, qrSvg: amount ? await boostQrSvg(amount) : null, ref: boost.id });
  }

  // เปิด QR อีกครั้ง (ยังไม่ได้โอน)
  if (body.action === "boost_payment") {
    const b = db.boosts.find((x) => x.productId === body.productId && x.partnerId === partner.id && x.status === "pending");
    if (!b?.amount) return NextResponse.json({ ok: false, error: "ไม่มียอดที่ต้องจ่าย" }, { status: 404 });
    return NextResponse.json({ ok: true, amount: b.amount, qrSvg: await boostQrSvg(b.amount), ref: b.id, paid: !!b.paidAt });
  }

  // ร้านกดแจ้งโอนแล้ว (แนบสลิปได้) → ขึ้นในหลังบ้านให้แอดมินเช็กยอดแล้วอนุมัติ
  if (body.action === "boost_paid") {
    const b = db.boosts.find((x) => x.productId === body.productId && x.partnerId === partner.id && x.status === "pending");
    if (!b) return NextResponse.json({ ok: false, error: "ไม่พบคำขอ" }, { status: 404 });
    const slip = cleanAssetUrl(body.slipUrl);
    b.paidAt = new Date().toISOString();
    b.slipUrl = slip;
    writeDb(db);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_shipping") {
    const money = (v: unknown) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 100000 ? Math.round(n) : undefined;
    };
    const fee = money(body.shippingFee);
    const freeMin = money(body.freeShippingMin);
    if (fee === undefined || freeMin === undefined) {
      return NextResponse.json({ ok: false, error: "ตัวเลขค่าส่งไม่ถูกต้อง" }, { status: 400 });
    }
    const rec = db.partners.find((p) => p.id === partner.id);
    if (!rec) return NextResponse.json({ ok: false, error: "ไม่พบร้าน" }, { status: 404 });
    rec.shippingFee = fee;
    rec.freeShippingMin = freeMin;
    writeDb(db);
    return NextResponse.json({ ok: true, shippingFee: fee, freeShippingMin: freeMin });
  }

  if (body.action === "delete_product") {
    const target = db.products.find((p) => p.id === body.productId);
    if (!target || target.partnerId !== partner.id) {
      return NextResponse.json({ ok: false, error: "ไม่พบสินค้า" }, { status: 404 });
    }
    db.products = db.products.filter((p) => p.id !== target.id);
    writeDb(db);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  }

  // อัปโหลดสินค้าทีละเยอะ (CSV) — dryRun = ตรวจก่อน ยังไม่บันทึก
  if (body.action === "bulk_csv") {
    const text = typeof body.csvText === "string" ? body.csvText.slice(0, 2_000_000) : "";
    const { rows, errors } = partnerRowsFromCsv(text);
    const ok: Product[] = [];
    let created = 0;
    let updated = 0;
    const seen = new Set<string>();
    for (const { line, input } of rows) {
      const prev = input.id ? db.products.find((p) => p.id === input.id && p.partnerId === partner.id) : undefined;
      // ช่องที่ไม่ได้ใส่ในไฟล์ = ใช้ค่าเดิม
      const given = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== "")) as Partial<Product>;
      const merged: Partial<Product> = prev ? { ...prev, ...given } : given;
      const built = buildPartnerProduct(merged, partner, db);
      if ("error" in built) {
        errors.push(`แถว ${line}: ${built.error}`);
        continue;
      }
      if (seen.has(built.product.id)) {
        errors.push(`แถว ${line}: รหัสสินค้าซ้ำในไฟล์`);
        continue;
      }
      seen.add(built.product.id);
      if (built.isNew) created++;
      else updated++;
      ok.push(built.product);
    }
    if (body.dryRun || !ok.length) return NextResponse.json({ ok: true, created, updated, errors, saved: false });
    const byId = new Map(ok.map((p) => [p.id, p]));
    db.products = db.products.map((p) => byId.get(p.id) ?? p);
    const fresh = ok.filter((p) => !db.products.some((x) => x.id === p.id));
    db.products.unshift(...fresh);
    applyPriceDropAlerts(db, ok.map((p) => p.id));
    writeDb(db);
    revalidatePath("/", "layout");
    return NextResponse.json({
      ok: true,
      created,
      updated,
      errors,
      saved: true,
      products: db.products.filter((p) => p.partnerId === partner.id),
    });
  }

  if (body.action !== "upsert_product" || !body.product) {
    return NextResponse.json({ ok: false, error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  }

  const built = buildPartnerProduct(body.product, partner, db);
  if ("error" in built) return NextResponse.json({ ok: false, error: built.error }, { status: built.error === "ไม่พบสินค้า" ? 404 : 400 });
  const { product } = built;
  const existing = !built.isNew;
  if (existing) db.products = db.products.map((p) => (p.id === product.id ? product : p));
  else db.products.unshift(product);
  applyPriceDropAlerts(db, [product.id]);
  writeDb(db);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, product });
}
