import Link from "next/link";
import { Home, Search, Sparkles } from "lucide-react";

/** หน้าไม่พบ — พาไปต่อได้ทันที ไม่ทิ้งให้ลูกค้าหลงทาง */
export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="font-display text-6xl font-bold text-info">404</p>
      <h1 className="font-display text-2xl font-bold text-ink-950">ไม่พบหน้านี้</h1>
      <p className="max-w-md text-sm text-ink-600">ลิงก์อาจเก่าหรือพิมพ์ผิด ลองไปต่อจากตรงนี้ได้เลย</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn btn-primary h-11 rounded-full px-5">
          <Home className="h-4 w-4" /> หน้าแรก
        </Link>
        <Link href="/categories" className="btn btn-outline h-11 rounded-full px-5">
          <Search className="h-4 w-4" /> ดูสินค้าทั้งหมด
        </Link>
        <Link href="/design" className="btn btn-outline h-11 rounded-full px-5">
          <Sparkles className="h-4 w-4" /> AI จัดห้อง
        </Link>
      </div>
    </div>
  );
}
