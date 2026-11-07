import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminAuthenticated, sanitizeText } from "@/lib/auth";
import {
  getAllArticles,
  getAllBanners,
  getAllCatalogProducts,
  getAllCategories,
  getSiteSettings,
  readDb,
  writeDb,
} from "@/lib/data/store";
import type { CatalogCategoryRecord, Product } from "@/lib/types";

export async function GET() {
  return NextResponse.json({
    ok: true,
    products: getAllCatalogProducts(false),
    categories: getAllCategories(false),
    banners: getAllBanners(false),
    articles: getAllArticles(false),
    siteSettings: getSiteSettings(),
  });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "ไม่อนุญาต (เฉพาะผู้ดูแลระบบ)" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: "create_product" | "create_category";
    product?: Product;
    customCategory?: {
      slug?: string;
      labelTh?: string;
      labelEn?: string;
      macroSlug?: CatalogCategoryRecord["macroSlug"];
    };
  };

  const db = readDb();

  if (body.customCategory && body.customCategory.labelTh) {
    const cleanLabel = sanitizeText(body.customCategory.labelTh, 120);
    const cleanSlug = sanitizeText(
      body.customCategory.slug || cleanLabel.toLowerCase().replace(/\s+/g, "_"),
      80
    );
    if (
      cleanLabel &&
      !db.categories.some((c) => c.slug === cleanSlug || c.labelTh === cleanLabel)
    ) {
      db.categories.push({
        id: `cat-custom-${Date.now()}`,
        slug: cleanSlug,
        labelTh: cleanLabel,
        labelEn: sanitizeText(body.customCategory.labelEn || cleanSlug.toUpperCase(), 120),
        macroSlug: body.customCategory.macroSlug || "furniture",
        order: db.categories.length + 1,
        active: true,
        isCustom: true,
      });
    }
  }

  if (body.product && body.product.name) {
    const p = body.product;
    const newProduct: Product = {
      ...p,
      id: sanitizeText(p.id || `prod-${Date.now()}`, 120),
      name: sanitizeText(p.name, 300),
      description: sanitizeText(p.description, 2000),
      price: Math.max(10, Number(p.price) || 0),
      buyUrl: sanitizeText(p.buyUrl, 1000) || "https://shopee.co.th/",
      platform: sanitizeText(p.platform, 120) || "Shopee",
      storeName: sanitizeText(p.storeName || p.platform, 120) || "Shopee",
      imageUrl: p.imageUrl ? sanitizeText(p.imageUrl, 1000) : null,
      published: true,
      featured: false,
      priceUpdatedAt: new Date().toISOString().slice(0, 10),
    };
    const existingIdx = db.products.findIndex((x) => x.id === newProduct.id);
    if (existingIdx >= 0) {
      db.products[existingIdx] = newProduct;
    } else {
      db.products.unshift(newProduct);
    }
  }

  const saved = writeDb(db);
  try {
    revalidatePath("/", "layout");
    revalidatePath("/");
    revalidatePath("/categories");
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    products: saved.products.filter((p) => p.published !== false),
    categories: saved.categories.filter((c) => c.active !== false),
  });
}
