/** ลิงก์เปิดสเปกในหน้าจัดสเปก (รูปแบบเดียวกับ encodeBuildQuery ฝั่งเบราว์เซอร์) */
export function encodeBuildPayloadServer(selection: Record<string, string | null>): string {
  const clean = Object.fromEntries(Object.entries(selection).filter(([, v]) => v));
  return encodeURIComponent(Buffer.from(JSON.stringify(clean), "utf8").toString("base64"));
}
