import type { Product } from "./types";

/** อ่าน CSV ทั้งไฟล์ (รองรับช่องที่มี , " และขึ้นบรรทัดใหม่ในเครื่องหมายคำพูด + BOM จาก Excel) */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cur.trim());
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cur.trim());
      cur = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

/** หัวคอลัมน์ที่รับ (อังกฤษหรือไทย) */
const COLUMNS: Record<string, keyof PartnerCsvInput> = {
  id: "id",
  รหัส: "id",
  name: "name",
  ชื่อ: "name",
  ชื่อสินค้า: "name",
  category: "category",
  หมวด: "category",
  price: "price",
  ราคา: "price",
  buyurl: "buyUrl",
  ลิงก์: "buyUrl",
  ลิงก์สินค้า: "buyUrl",
  imageurl: "imageUrl",
  รูป: "imageUrl",
  ลิงก์รูป: "imageUrl",
  status: "status",
  สถานะ: "status",
  description: "description",
  รายละเอียด: "description",
};

export interface PartnerCsvInput {
  id?: string;
  name?: string;
  category?: string;
  price?: number;
  buyUrl?: string;
  imageUrl?: string;
  status?: "available" | "out_of_stock";
  description?: string;
}

export const MAX_CSV_ROWS = 500;

export function partnerRowsFromCsv(text: string): { rows: Array<{ line: number; input: PartnerCsvInput }>; errors: string[] } {
  const all = parseCsv(text);
  if (all.length < 2) return { rows: [], errors: ["ไฟล์ต้องมีแถวหัวตาราง และสินค้าอย่างน้อย 1 แถว"] };
  const head = all[0].map((h) => COLUMNS[h.trim().toLowerCase().replace(/[\s_]/g, "")]);
  if (!head.includes("name") || !head.includes("price"))
    return { rows: [], errors: ["ไม่พบคอลัมน์ name และ price (ดาวน์โหลดไฟล์ตัวอย่างไปแก้ได้)"] };
  const body = all.slice(1);
  const errors: string[] = [];
  if (body.length > MAX_CSV_ROWS) errors.push(`อัปโหลดได้ครั้งละไม่เกิน ${MAX_CSV_ROWS} แถว (ตัดส่วนเกินทิ้ง)`);
  const rows = body.slice(0, MAX_CSV_ROWS).map((cols, i) => {
    const input: PartnerCsvInput = {};
    head.forEach((key, c) => {
      const v = cols[c] ?? "";
      if (!key || !v) return;
      if (key === "price") input.price = Number(v.replace(/[,฿\s]|บาท/g, ""));
      else if (key === "status") input.status = /out|หมด/i.test(v) ? "out_of_stock" : "available";
      else input[key] = v;
    });
    return { line: i + 2, input };
  });
  return { rows, errors };
}

function cell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** ไฟล์ตัวอย่าง = สินค้าปัจจุบันของร้าน (แก้ราคาแล้วอัปกลับได้เลย) */
export function partnerProductsToCsv(products: Product[]): string {
  const head = ["id", "name", "category", "price", "buyUrl", "imageUrl", "status", "description"];
  const lines = products.map((p) =>
    [p.id, p.name, p.category, p.price, p.buyUrl, p.imageUrl ?? "", p.status === "out_of_stock" ? "out_of_stock" : "available", p.description]
      .map(cell)
      .join(",")
  );
  if (!lines.length) lines.push(["", "ตัวอย่าง: คีย์บอร์ดไร้สาย", "keyboard", 1290, "https://ร้านของคุณ/สินค้า", "", "available", ""].map(cell).join(","));
  return "﻿" + [head.join(","), ...lines].join("\n");
}
