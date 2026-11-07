import type { Metadata } from "next";
import { getAllProducts, getAllRooms } from "@/lib/data/store";
import { enrichRoom } from "@/lib/pricing";
import { SavedPageClient } from "@/components/SavedPageClient";

export const metadata: Metadata = {
  title: "รายการที่บันทึกไว้",
  description: "ดูสินค้า ห้องคอม และชุดสเปคที่คุณบันทึกไว้ในที่เดียว",
};

export const revalidate = 60;

export default function SavedPage() {
  const products = getAllProducts();
  const rooms = getAllRooms(false).map((r) => ({ ...enrichRoom(r, products), items: [], coverProduct: null }));

  return (
    <div className="container-page space-y-6 py-8">
      <div className="space-y-2">
        <p className="eyebrow">WISHLIST & SAVED BUILDS</p>
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">
          ห้องคอมพิวเตอร์และสเปกที่บันทึกไว้
        </h1>
        <p className="text-sm text-ink-600">
          เปิดดูห้องตัวอย่างและสเปกคอมที่คุณชื่นชอบ พร้อมคำนวณราคารวมล่าสุดทุกครั้งที่เปิดดู
        </p>
      </div>

      <SavedPageClient allRooms={rooms} />
    </div>
  );
}
