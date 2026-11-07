import type { MetadataRoute } from "next";

/** ให้ติดตั้งเว็บเป็นแอปบนมือถือได้ (Add to Home Screen) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ComproNext — AI จัดห้อง",
    short_name: "ComproNext",
    description: "ถ่ายรูปห้อง บอกสไตล์ แล้วให้ AI เลือกของแต่งห้องจากร้านพาร์ตเนอร์",
    start_url: "/",
    display: "standalone",
    background_color: "#f7fafc",
    theme_color: "#0050ff",
    lang: "th",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "AI จัดห้อง", url: "/design", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }],
  };
}
