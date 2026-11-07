import type { Metadata } from "next";
import { getAllProducts, getAllRooms } from "@/lib/data/store";
import { enrichRoom } from "@/lib/pricing";
import { ROOM_STYLES, type RoomStyle } from "@/lib/types";
import { RoomsFilterClient } from "@/components/RoomsFilterClient";

export const metadata: Metadata = {
  title: "ห้องคอมตัวอย่าง",
  description: "ไอเดียห้องคอมพร้อมรายการอุปกรณ์และราคารวม เลือกซื้อทั้งชุดได้ในคลิกเดียว",
};

export const dynamic = "force-dynamic";

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; style?: string; maxBudget?: string }>;
}) {
  const sp = await searchParams;
  const products = getAllProducts();
  // ส่งไปหน้าเว็บเฉพาะที่การ์ด/ตัวกรองใช้ (ตัดรายการสินค้าเต็มๆ ออก — หน้าเบาลง)
  const rooms = getAllRooms(false).map((r) => ({ ...enrichRoom(r, products), items: [], coverProduct: null }));

  const initialStyle =
    sp.style && ROOM_STYLES.includes(sp.style as RoomStyle)
      ? (sp.style as RoomStyle)
      : null;
  const parsedBudget = sp.maxBudget ? Number(sp.maxBudget) : 400000;
  const initialMaxBudget =
    Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : 400000;

  return (
    <div className="container-page space-y-4 py-5 sm:py-7">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">ไอเดียห้องคอม</h1>
        <p className="text-sm text-ink-600">กรองตามงบ สไตล์ สี วัสดุ และแสงไฟ · ราคารวมคิดจากสินค้าที่ซื้อได้จริงตอนนี้</p>
      </div>

      <RoomsFilterClient
        rooms={rooms}
        initialQuery={sp.q ?? ""}
        initialStyle={initialStyle}
        initialMaxBudget={initialMaxBudget}
      />
    </div>
  );
}
