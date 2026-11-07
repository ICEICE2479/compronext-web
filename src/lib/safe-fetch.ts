import "server-only";
import dns from "node:dns/promises";
import net from "node:net";

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

/** กัน SSRF: รับเฉพาะ http(s) ไปยังโฮสต์สาธารณะเท่านั้น */
export async function parsePublicImageUrl(raw: string | null): Promise<URL | null> {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  try {
    const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
    if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) return null;
  } catch {
    return null;
  }
  return u;
}


/**
 * ดึงไฟล์จาก URL สาธารณะแบบปลอดภัย: จำกัดขนาด และตาม redirect ได้ไม่เกิน 3 ครั้ง
 * โดยตรวจปลายทางใหม่ทุกครั้ง (กัน redirect ไปที่อยู่ภายใน)
 */
export async function fetchPublicBytes(
  raw: string,
  maxBytes: number,
  timeoutMs = 12000
): Promise<{ bytes: Buffer; contentType: string } | null> {
  let current = raw;
  const deadline = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop <= 3; hop++) {
    const u = await parsePublicImageUrl(current);
    if (!u) return null;
    try {
      const res = await fetch(u, {
        redirect: "manual",
        signal: deadline,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        current = new URL(loc, u).toString();
        continue;
      }
      if (!res.ok) return null;
      if (Number(res.headers.get("content-length") || 0) > maxBytes) return null;
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > maxBytes) return null;
      return { bytes, contentType: res.headers.get("content-type") || "application/octet-stream" };
    } catch {
      return null;
    }
  }
  return null;
}
