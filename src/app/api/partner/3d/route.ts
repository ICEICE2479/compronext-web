import { NextResponse } from "next/server";
import { getCurrentUser, isAdminAuthenticated } from "@/lib/auth";
import { getActivePartnerByEmail, readDb, writeDb } from "@/lib/data/store";
import { loadProductImage } from "@/lib/ai-room";
import { fetchPublicBytes } from "@/lib/safe-fetch";
import { saveUpload, UPLOAD_KINDS } from "@/lib/storage";

/**
 * สร้างโมเดล 3D (.glb) จากรูปสินค้าอัตโนมัติด้วย Meshy (MESHY_API_KEY)
 * POST เริ่มงาน → GET เช็กสถานะ (หน้าเว็บเรียกทุก 5 วินาที) → เสร็จแล้วเก็บไฟล์และผูกกับสินค้า
 */
export const maxDuration = 60;

const MESHY_BASE = () => process.env.MESHY_API_BASE || "https://api.meshy.ai";

async function findOwnedProduct(productId: string | null) {
  if (!productId) return null;
  const db = readDb();
  const product = db.products.find((p) => p.id === productId);
  if (!product) return null;
  if (await isAdminAuthenticated()) return { db, product };
  const partner = getActivePartnerByEmail(await getCurrentUser());
  return partner && product.partnerId === partner.id ? { db, product } : null;
}

export async function POST(request: Request) {
  const { productId } = (await request.json().catch(() => ({}))) as { productId?: string };
  const found = await findOwnedProduct(productId ?? null);
  if (!found) return NextResponse.json({ ok: false, error: "ไม่พบสินค้า" }, { status: 404 });
  const key = process.env.MESHY_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า MESHY_API_KEY" }, { status: 400 });
  const { db, product } = found;
  if (!product.imageUrl) return NextResponse.json({ ok: false, error: "ใส่รูปสินค้าก่อน" }, { status: 400 });
  if (product.model3dTaskId) return NextResponse.json({ ok: true, taskId: product.model3dTaskId, status: "PENDING" });

  const b64 = await loadProductImage(product.imageUrl, 1024);
  if (!b64) return NextResponse.json({ ok: false, error: "อ่านรูปสินค้าไม่ได้" }, { status: 400 });

  const res = await fetch(`${MESHY_BASE()}/openapi/v1/image-to-3d`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: `data:image/jpeg;base64,${b64}` }),
    signal: AbortSignal.timeout(30000),
  }).catch(() => null);
  if (!res?.ok) {
    const detail = res ? (await res.text()).slice(0, 200) : "เชื่อมต่อไม่ได้";
    console.error("[meshy] create failed", res?.status, detail);
    return NextResponse.json({ ok: false, error: `Meshy สร้างงานไม่สำเร็จ: ${detail}` }, { status: 502 });
  }
  const { result: taskId } = (await res.json()) as { result?: string };
  if (!taskId) return NextResponse.json({ ok: false, error: "Meshy ไม่ส่งรหัสงานกลับมา" }, { status: 502 });

  product.model3dTaskId = taskId;
  writeDb(db);
  return NextResponse.json({ ok: true, taskId, status: "PENDING" });
}

export async function GET(request: Request) {
  const key = process.env.MESHY_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า MESHY_API_KEY" }, { status: 400 });
  const found = await findOwnedProduct(new URL(request.url).searchParams.get("productId"));
  if (!found) return NextResponse.json({ ok: false, error: "ไม่พบสินค้า" }, { status: 404 });
  const { db, product } = found;
  if (!product.model3dTaskId) return NextResponse.json({ ok: true, status: product.modelUrl ? "SUCCEEDED" : "NONE", modelUrl: product.modelUrl ?? null });

  const res = await fetch(`${MESHY_BASE()}/openapi/v1/image-to-3d/${encodeURIComponent(product.model3dTaskId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  if (!res?.ok) return NextResponse.json({ ok: true, status: "PENDING", progress: null });
  const task = (await res.json()) as {
    status?: string;
    progress?: number;
    model_urls?: { glb?: string };
    task_error?: { message?: string };
  };

  if (task.status === "SUCCEEDED" && task.model_urls?.glb) {
    const file = await fetchPublicBytes(task.model_urls.glb, UPLOAD_KINDS.model.maxBytes, 60000);
    if (!file) return NextResponse.json({ ok: false, error: "ดาวน์โหลดไฟล์ 3D ไม่สำเร็จ ลองเช็กใหม่อีกครั้ง" }, { status: 502 });
    try {
      const saved = await saveUpload(file.bytes, "model", product.partnerId ? `partners/${product.partnerId}` : "uploads");
      product.modelUrl = saved.url;
      product.model3dTaskId = null;
      writeDb(db);
      return NextResponse.json({ ok: true, status: "SUCCEEDED", modelUrl: saved.url });
    } catch (err) {
      return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
    }
  }
  if (task.status === "FAILED" || task.status === "CANCELED" || task.status === "EXPIRED") {
    product.model3dTaskId = null;
    writeDb(db);
    return NextResponse.json({ ok: false, status: task.status, error: task.task_error?.message || "Meshy สร้าง 3D ไม่สำเร็จ" });
  }
  return NextResponse.json({ ok: true, status: task.status ?? "PENDING", progress: task.progress ?? null });
}
