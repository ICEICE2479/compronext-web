import fs from "node:fs/promises";
import path from "node:path";
import { readDb } from "@/lib/data/store";
import { caseFiles } from "@/lib/returns";
import { caseViewer, findCase } from "@/lib/returns-server";
import { LOCAL_UPLOAD_DIR, MIME_BY_EXT } from "@/lib/storage";

/** เปิดรูปหลักฐานของเคส — เฉพาะลูกค้าเจ้าของเคส ร้านเจ้าของเคส หรือแอดมิน (ไม่เปิดลิงก์ไฟล์จริงให้ใคร) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  const c = findCase(readDb(), id);
  if (!c || !(await caseViewer(c))) return new Response("Not found", { status: 404 });
  const url = caseFiles(c)[Number(n)];
  if (!url) return new Response("Not found", { status: 404 });
  const headers = { "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" };
  try {
    if (url.startsWith("/api/files/")) {
      const name = url.slice("/api/files/".length);
      if (!/^[a-z0-9]+-[a-f0-9]{12}\.(jpg|png|webp)$/.test(name)) return new Response("Not found", { status: 404 });
      const bytes = await fs.readFile(path.join(LOCAL_UPLOAD_DIR, name));
      return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": MIME_BY_EXT[path.extname(name)] ?? "image/jpeg" } });
    }
    // ไฟล์ใน Vercel Blob (ลิงก์สุ่มยาว ไม่ส่งให้เบราว์เซอร์)
    if (!/^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//.test(url)) return new Response("Not found", { status: 404 });
    const res = await fetch(url);
    if (!res.ok) return new Response("Not found", { status: 404 });
    return new Response(res.body, { headers: { ...headers, "Content-Type": res.headers.get("content-type") ?? "image/jpeg" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
