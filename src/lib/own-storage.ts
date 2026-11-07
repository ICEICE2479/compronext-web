/** รูปที่อยู่ในที่เก็บไฟล์ของเราแล้ว (ตัดพื้นหลังแล้ว ไม่ต้องผ่าน /api/cutout ซ้ำ) */
export function isOwnStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("/")) return true;
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".public.blob.vercel-storage.com") || host.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** ลิงก์รูปสำหรับแสดง: รูปจากเว็บร้าน → ผ่านตัวตัดพื้นหลัง · รูปของเราเอง → ใช้ตรงๆ */
export function displayImageSrc(url: string): string {
  return /^https?:\/\//.test(url) && !isOwnStorageUrl(url) ? `/api/cutout?url=${encodeURIComponent(url)}&v=v9` : url;
}

/**
 * ลิงก์รูปสำหรับโชว์สินค้า (การ์ด หน้าสินค้า เทียบ): ไม่ตัดพื้นหลัง เห็นของครบทุกส่วน
 * รูปจากเว็บร้าน → ย่อขนาดผ่านเซิร์ฟเวอร์เรา (โหลดไว + เก็บแคช) · รูปของเราเอง → ใช้ตรงๆ
 */
export function displayPhotoSrc(url: string): string {
  return /^https?:\/\//.test(url) && !isOwnStorageUrl(url) ? `/api/cutout?url=${encodeURIComponent(url)}&raw=1&v=r1` : url;
}
