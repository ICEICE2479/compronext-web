import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fetchPublicBytes, parsePublicImageUrl } from "@/lib/safe-fetch";
import sharp from "sharp";
import { cutoutProductImage } from "@/lib/image-cutout";

/**
 * รูปสินค้าตัดพื้นหลัง
 * - ดึงจากเว็บร้านครั้งเดียว แล้วเก็บไฟล์ไว้ในดิสก์ (.data/img-cache) ใช้ซ้ำได้แม้รีสตาร์ท
 * - ดึงไม่ได้ → จำไว้ 10 นาที ไม่ต้องรอ timeout ซ้ำ แล้วให้เบราว์เซอร์ลองโหลดจากร้านเอง
 */
const VERSION = "v9";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const CUTOUT_CACHE_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "compronext-img-cache")
  : path.join(process.cwd(), ".data", "img-cache");

const KNOWN_IMAGE_HOSTS = [
  "ikea.com", "amazonaws.com", "corsair.com", "jib.co.th", "cdn-apple.com", "unsplash.com",
  "sony.co.th", "neweggimages.com", "gigabyte.com", "achieva.co.th", "monitorgarage.com",
  "signify.com", "benq.com", "appmifile.com", "asus.com", "andtradition.com", "logitechg.com",
  "nanoleaf.me", "lg.com", "bnn.in.th", "dell.com", "imgix.net", "louispoulsen.dk",
];

const mem = new Map<string, Buffer>();
const MEM_MAX = 300;
const failedUntil = new Map<string, number>();
const inflight = new Map<string, Promise<Buffer | null>>();

function fallback(u: URL): NextResponse {
  const host = u.hostname.toLowerCase();
  if (KNOWN_IMAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return NextResponse.redirect(u.toString(), 302);
  }
  return new NextResponse("Image unavailable", { status: 502 });
}

function respond(buf: Buffer): NextResponse {
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=2592000, stale-while-revalidate=604800",
    },
  });
}

function remember(key: string, buf: Buffer) {
  if (mem.size >= MEM_MAX) {
    const first = mem.keys().next().value;
    if (first) mem.delete(first);
  }
  mem.set(key, buf);
}

/** raw=1: ไม่ตัดพื้นหลัง แค่ย่อ (ด้านยาว ≤ 800px) + webp — รูปเบาลง โหลดไว ของไม่ขาดหาย */
async function shrink(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

async function produce(url: string, file: string, raw = false): Promise<Buffer | null> {
  const src = await fetchPublicBytes(url, MAX_IMAGE_BYTES, 12000);
  if (!src || (src.contentType && !src.contentType.startsWith("image/") && src.contentType !== "application/octet-stream")) {
    return null;
  }
  try {
    const buffer = raw ? await shrink(src.bytes) : (await cutoutProductImage(src.bytes)).buffer;
    await fs.mkdir(CUTOUT_CACHE_DIR, { recursive: true }).catch(() => {});
    await fs.writeFile(file, buffer).catch(() => {});
    return buffer;
  } catch (err) {
    console.error("[cutout] process failed", url, (err as Error).message);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const parsed = await parsePublicImageUrl(req.nextUrl.searchParams.get("url"));
  if (!parsed) return new NextResponse("Invalid url parameter", { status: 400 });
  const url = parsed.toString();
  const raw = req.nextUrl.searchParams.get("raw") === "1";
  const key = crypto.createHash("sha1").update(`${raw ? "raw1" : VERSION}:${url}`).digest("hex");

  const hit = mem.get(key);
  if (hit) return respond(hit);

  const file = path.join(CUTOUT_CACHE_DIR, `${key}.webp`);
  const onDisk = await fs.readFile(file).catch(() => null);
  if (onDisk) {
    remember(key, onDisk);
    return respond(onDisk);
  }

  if ((failedUntil.get(key) ?? 0) > Date.now()) return fallback(parsed);

  let job = inflight.get(key);
  if (!job) {
    job = produce(url, file, raw).finally(() => inflight.delete(key));
    inflight.set(key, job);
  }
  const buf = await job;
  if (!buf) {
    failedUntil.set(key, Date.now() + 10 * 60 * 1000);
    return fallback(parsed);
  }
  remember(key, buf);
  return respond(buf);
}
