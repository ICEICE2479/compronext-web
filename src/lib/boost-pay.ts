import "server-only";
import QRCode from "qrcode";
import { isValidPromptPayId, promptPayPayload } from "./promptpay";

/** ราคาดันสินค้า: BOOST_PRICES="7:299,14:499,30:899" · บัญชีรับเงิน: PROMPTPAY_ID (เบอร์/เลขบัตร) */
export function boostPrices(): Record<number, number> {
  const out: Record<number, number> = { 7: 299, 14: 499, 30: 899 };
  for (const part of (process.env.BOOST_PRICES ?? "").split(",")) {
    const [d, p] = part.split(":").map((x) => Number(x.trim()));
    if ([7, 14, 30].includes(d) && Number.isFinite(p) && p > 0) out[d] = Math.round(p);
  }
  return out;
}

export function promptPayEnabled(): boolean {
  return isValidPromptPayId(process.env.PROMPTPAY_ID);
}

/** QR พร้อมเพย์ใส่ยอดไว้แล้ว (SVG) */
export async function boostQrSvg(amount: number): Promise<string | null> {
  if (!promptPayEnabled()) return null;
  return QRCode.toString(promptPayPayload(process.env.PROMPTPAY_ID!, amount), {
    type: "svg",
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
    color: { dark: "#0a192f", light: "#ffffff" },
  });
}
