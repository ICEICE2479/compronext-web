import fs from "node:fs/promises";
import path from "node:path";
import { LOCAL_UPLOAD_DIR, MIME_BY_EXT } from "@/lib/storage";

/** เสิร์ฟไฟล์ที่อัปโหลดไว้ในเครื่อง (.data/uploads) */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-z0-9]+-[a-f0-9]{12}\.(jpg|png|webp|glb)$/.test(name)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const bytes = await fs.readFile(path.join(LOCAL_UPLOAD_DIR, name));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": MIME_BY_EXT[path.extname(name)] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
