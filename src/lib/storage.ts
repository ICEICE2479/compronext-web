import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * เก็บไฟล์ที่อัปโหลด (รูปสินค้า / โมเดล 3D)
 * - ตั้ง BLOB_READ_WRITE_TOKEN (Vercel Blob) → เก็บถาวรบนคลาวด์ ใช้บน Vercel
 * - ไม่ตั้ง → เก็บใน .data/uploads แล้วเสิร์ฟผ่าน /api/files/<ชื่อไฟล์> (ใช้ตอน dev / เซิร์ฟเวอร์ของตัวเอง)
 */
export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

export const UPLOAD_KINDS = {
  image: { maxBytes: 8 * 1024 * 1024, exts: [".jpg", ".jpeg", ".png", ".webp"] },
  model: { maxBytes: 25 * 1024 * 1024, exts: [".glb"] },
} as const;

export type UploadKind = keyof typeof UPLOAD_KINDS;

export const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
};

/** ตรวจลายเซ็นไฟล์จริง ไม่เชื่อนามสกุล/MIME ที่ client ส่งมา */
export function detectExt(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return ".webp";
  if (buf.toString("ascii", 0, 4) === "glTF") return ".glb";
  return null;
}

export function isReadOnlyServerless(): boolean {
  return Boolean(process.env.VERCEL) && !process.env.BLOB_READ_WRITE_TOKEN;
}

export async function saveUpload(bytes: Buffer, kind: UploadKind, folder = "uploads"): Promise<{ url: string; ext: string }> {
  const ext = detectExt(bytes);
  const rule = UPLOAD_KINDS[kind];
  if (!ext || !(rule.exts as readonly string[]).includes(ext)) {
    throw new Error(kind === "model" ? "รองรับเฉพาะไฟล์ 3D .glb" : "รองรับเฉพาะรูป JPG / PNG / WEBP");
  }
  if (bytes.length > rule.maxBytes) {
    throw new Error(`ไฟล์ใหญ่เกิน ${Math.round(rule.maxBytes / 1024 / 1024)} MB`);
  }
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`${folder}/${name}`, bytes, {
      access: "public",
      contentType: MIME_BY_EXT[ext],
      addRandomSuffix: false,
    });
    return { url: blob.url, ext };
  }

  if (isReadOnlyServerless()) {
    throw new Error("ยังไม่ได้ตั้งค่าที่เก็บไฟล์ (BLOB_READ_WRITE_TOKEN)");
  }
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, name), bytes);
  return { url: `/api/files/${name}`, ext };
}
