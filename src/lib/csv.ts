import type { Dimensions, Placement, Product, ProductCategory, ProductStatus } from "./types";
import { PLACEMENTS, PRODUCT_CATEGORIES, PRODUCT_STATUSES } from "./types";
import { searchLink } from "./links";

const CSV_HEADERS = [
  "id",
  "name",
  "category",
  "price",
  "status",
  "platform",
  "storeName",
  "buyUrl",
  "colors",
  "materials",
  "width_cm",
  "depth_cm",
  "height_cm",
  "placement",
  "ports",
  "priceUpdatedAt",
  "isSample",
  "description",
] as const;

function escapeCsvCell(val: string | number | boolean | null | undefined): string {
  const s = val === null || val === undefined ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function productsToCsv(products: Product[]): string {
  const rows: string[] = [CSV_HEADERS.join(",")];
  for (const p of products) {
    rows.push(
      [
        p.id,
        p.name,
        p.category,
        p.price,
        p.status,
        p.platform,
        p.storeName,
        p.buyUrl,
        p.colors.join("|"),
        p.materials.join("|"),
        p.dimensions?.width ?? "",
        p.dimensions?.depth ?? "",
        p.dimensions?.height ?? "",
        p.placement,
        p.ports.join("|"),
        p.priceUpdatedAt,
        p.isSample ? "true" : "false",
        p.description,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }
  return rows.join("\n");
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseProductsCsv(csvText: string): { products: Product[]; errors: string[] } {
  const lines = csvText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { products: [], errors: ["ไฟล์ CSV ต้องมีบรรทัดหัวตารางและข้อมูลอย่างน้อย 1 แถว"] };
  }

  const headers = parseCsvLine(lines[0]);
  const idx = (name: string) => headers.indexOf(name);
  const errors: string[] = [];
  const products: Product[] = [];

  for (let lineNo = 1; lineNo < lines.length; lineNo++) {
    const cols = parseCsvLine(lines[lineNo]);
    const get = (col: string) => {
      const i = idx(col);
      return i >= 0 ? (cols[i] ?? "").trim() : "";
    };

    const id = get("id") || `csv-item-${Date.now()}-${lineNo}`;
    const name = get("name");
    if (!name) {
      errors.push(`แถวที่ ${lineNo + 1}: ไม่มีชื่อสินค้า (name)`);
      continue;
    }

    const rawCat = get("category") as ProductCategory;
    const category: ProductCategory = PRODUCT_CATEGORIES.includes(rawCat) ? rawCat : "other";

    const priceNum = Number(get("price"));
    const price = Number.isFinite(priceNum) && priceNum >= 0 ? Math.round(priceNum) : 0;

    const rawStatus = get("status") as ProductStatus;
    const status: ProductStatus = PRODUCT_STATUSES.includes(rawStatus) ? rawStatus : "available";

    const rawPlacement = get("placement") as Placement;
    const placement: Placement = PLACEMENTS.includes(rawPlacement) ? rawPlacement : "desk";

    const w = get("width_cm") ? Number(get("width_cm")) : null;
    const d = get("depth_cm") ? Number(get("depth_cm")) : null;
    const h = get("height_cm") ? Number(get("height_cm")) : null;
    const dimensions: Dimensions | null =
      w !== null || d !== null || h !== null
        ? {
            width: Number.isFinite(w) ? w : null,
            depth: Number.isFinite(d) ? d : null,
            height: Number.isFinite(h) ? h : null,
            unit: "cm",
          }
        : null;

    const platform = get("platform") || "Shopee";
    const buyUrl = get("buyUrl") || searchLink("Shopee", name);

    products.push({
      id,
      name,
      description: get("description") || `${name} (นำเข้าจาก CSV)`,
      imageUrl: null,
      price,
      currency: "THB",
      buyUrl,
      storeName: get("storeName") || `${platform}`,
      platform,
      category,
      colors: get("colors")
        ? get("colors")
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean)
        : ["black"],
      materials: get("materials")
        ? get("materials")
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      dimensions,
      ports: get("ports")
        ? get("ports")
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      specs: {},
      placement,
      status,
      priceUpdatedAt: get("priceUpdatedAt") || new Date().toISOString().slice(0, 10),
      isSample: get("isSample") !== "false",
    });
  }

  return { products, errors };
}
