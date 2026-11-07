/**
 * QR พร้อมเพย์ (มาตรฐาน EMVCo ของธนาคารแห่งประเทศไทย) — สแกนจ่ายได้ทุกแอปธนาคาร
 * ไม่ต้องสมัครเกตเวย์ ไม่มีค่าธรรมเนียม เงินเข้าบัญชีพร้อมเพย์ที่ตั้งไว้ตรงๆ
 */
const f = (id: string, v: string) => id + String(v.length).padStart(2, "0") + v;

export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** เบอร์มือถือ 10 หลัก / เลขบัตรประชาชน-นิติบุคคล 13 หลัก / e-wallet 15 หลัก */
export function promptPayPayload(target: string, amount?: number): string {
  const id = target.replace(/\D/g, "");
  let acc: string;
  if (id.length >= 15) acc = f("03", id);
  else if (id.length >= 13) acc = f("02", id);
  else acc = f("01", ("0000000000000" + id.replace(/^0/, "66")).slice(-13));
  const body =
    f("00", "01") +
    f("01", amount ? "12" : "11") +
    f("29", f("00", "A000000677010111") + acc) +
    f("58", "TH") +
    f("53", "764") +
    (amount ? f("54", amount.toFixed(2)) : "") +
    "6304";
  return body + crc16(body);
}

export function isValidPromptPayId(raw: string | undefined): boolean {
  const n = (raw ?? "").replace(/\D/g, "").length;
  return n === 10 || n === 13 || n === 15;
}
