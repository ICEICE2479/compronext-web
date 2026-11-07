import { NextResponse } from "next/server";
import { getCurrentUser, isAdminAuthenticated } from "@/lib/auth";
import { getActivePartnerByEmail } from "@/lib/data/store";
import { MIME_BY_EXT, saveUpload, UPLOAD_KINDS, type UploadKind } from "@/lib/storage";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface UploadedFileRecord {
  id: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  url: string;
  storageProvider: "Cloudflare R2 / UploadThing (Sandbox)" | "Cloudflare R2 Live";
  uploadedAt: string;
}

const UPLOADS_META_FILE = process.env.VERCEL
  ? path.join(os.tmpdir(), "compronext-data", "uploads.json")
  : path.join(process.cwd(), ".data", "uploads.json");

export function readUploads(): UploadedFileRecord[] {
  try {
    if (fs.existsSync(UPLOADS_META_FILE)) {
      return JSON.parse(fs.readFileSync(UPLOADS_META_FILE, "utf8")) as UploadedFileRecord[];
    }
  } catch {
    // ignore
  }
  return [
    {
      id: "r2-sample-1",
      fileName: "room-01-a.jpg",
      sizeBytes: 312480,
      mimeType: "image/jpeg",
      url: "/rooms/room-01-a.jpg",
      storageProvider: "Cloudflare R2 / UploadThing (Sandbox)",
      uploadedAt: "2026-10-30",
    },
    {
      id: "r2-sample-2",
      fileName: "room-02-a.jpg",
      sizeBytes: 298120,
      mimeType: "image/jpeg",
      url: "/rooms/room-02-a.jpg",
      storageProvider: "Cloudflare R2 / UploadThing (Sandbox)",
      uploadedAt: "2026-10-30",
    },
    {
      id: "r2-sample-3",
      fileName: "room-06-a.jpg",
      sizeBytes: 304900,
      mimeType: "image/jpeg",
      url: "/rooms/room-06-a.jpg",
      storageProvider: "Cloudflare R2 / UploadThing (Sandbox)",
      uploadedAt: "2026-10-30",
    },
  ];
}

function writeUploads(list: UploadedFileRecord[]) {
  try {
    const dir = path.dirname(UPLOADS_META_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(UPLOADS_META_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch {
    // ignore
  }
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "ไม่อนุญาต (เฉพาะผู้ดูแลระบบ)" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, files: readUploads() });
}

export async function POST(request: Request) {
  const isAdmin = await isAdminAuthenticated();
  const partner = isAdmin ? null : getActivePartnerByEmail(await getCurrentUser());
  if (!isAdmin && !partner) {
    return NextResponse.json({ ok: false, error: "ไม่อนุญาต (เฉพาะผู้ดูแลระบบหรือร้านพาร์ตเนอร์)" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "กรุณาเลือกไฟล์ที่ต้องการอัปโหลด" }, { status: 400 });
  }
  const kind: UploadKind = formData?.get("kind") === "model" ? "model" : "image";
  if (file.size > UPLOAD_KINDS[kind].maxBytes) {
    return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกินกำหนด" }, { status: 400 });
  }

  let saved: { url: string; ext: string };
  try {
    saved = await saveUpload(Buffer.from(await file.arrayBuffer()), kind, partner ? `partners/${partner.id}` : "uploads");
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || "อัปโหลดไม่สำเร็จ" }, { status: 400 });
  }

  const record: UploadedFileRecord = {
    id: `file-${Date.now()}`,
    fileName: file.name.slice(0, 120),
    sizeBytes: file.size,
    mimeType: MIME_BY_EXT[saved.ext] ?? "application/octet-stream",
    url: saved.url,
    storageProvider: process.env.BLOB_READ_WRITE_TOKEN ? "Cloudflare R2 Live" : "Cloudflare R2 / UploadThing (Sandbox)",
    uploadedAt: new Date().toISOString().slice(0, 10),
  };

  if (!isAdmin) return NextResponse.json({ ok: true, file: record });

  const next = [record, ...readUploads()].slice(0, 40);
  writeUploads(next);
  return NextResponse.json({ ok: true, file: record, files: next });
}
