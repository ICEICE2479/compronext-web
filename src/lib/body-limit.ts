/** จำกัดขนาด body ก่อน parse form (กันอ่านไฟล์ใหญ่เข้าหน่วยความจำทั้งก้อน) */

export const MAX_AI_ROOM_BODY_BYTES = 4_718_592; // 4.5 MB (4 MB photo + form overhead)

export class BodyTooLargeError extends Error {
  constructor(message = "request body too large") {
    super(message);
    this.name = "BodyTooLargeError";
  }
}

export async function readFormDataLimited(request: Request, maxBytes: number): Promise<FormData> {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > maxBytes) {
    throw new BodyTooLargeError();
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new Response(bytes, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
}
