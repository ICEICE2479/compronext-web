/** อ่านรูปหลักจาก HTML หน้าสินค้า */
export function pickImageFromHtml(html: string, pageUrl: string): string | null {
  // ต้องเป็นหน้าสินค้าจริง (สินค้าเลิกขายมักเด้งไปหน้ารวม → รูปผิดชิ้น)
  const isProduct = /og:type["'][^>]*content=["'](?:og:)?product/i.test(html) || /content=["'](?:og:)?product["'][^>]*og:type/i.test(html) || /"@type"\s*:\s*"Product"/.test(html);
  if (!isProduct) return null;
  const metas = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
  ];
  const found: string[] = [];
  for (const re of metas) {
    const m = html.match(re);
    if (m) found.push(m[1]);
  }
  // JSON-LD Product.image
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const im = m[1].match(/"image"\s*:\s*(?:\[\s*)?(?:\{[^}]*?"url"\s*:\s*)?"([^"]+)"/);
    if (im) found.push(im[1]);
  }
  for (const raw of found) {
    try {
      const u = new URL(raw.replace(/&amp;/g, "&"), pageUrl);
      if (!/^https?:$/.test(u.protocol)) continue;
      // ข้ามโลโก้/ไอคอน/รูปแชร์ทั่วไปของเว็บ
      if (/logo|favicon|icon|placeholder|default[-_]?share|og[-_]default/i.test(u.pathname)) continue;
      return u.toString();
    } catch {
      /* ลองตัวถัดไป */
    }
  }
  return null;
}
