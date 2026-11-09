import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,
  allowedDevOrigins: ["*.trycloudflare.com"],
  // ให้ไฟล์ข้อมูลตั้งต้นติดไปกับ serverless function (ใช้ย้ายข้อมูลขึ้น Postgres ครั้งแรก)
  outputFileTracingIncludes: {
    "/**": ["./.data/compronext-db.json"],
  },
  // หัวข้อความปลอดภัยพื้นฐาน (กันฝังเว็บใน iframe คนอื่น, กันเดาชนิดไฟล์, จำกัดสิทธิ์อุปกรณ์)
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self' https://access.line.me https://accounts.google.com" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
    ];
    return [{ source: "/:path*", headers: security }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
