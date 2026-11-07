import type { Metadata } from "next";
import { CompareClient } from "@/components/CompareClient";

export const metadata: Metadata = {
  title: "เปรียบเทียบคอม & อุปกรณ์",
  description: "เปรียบเทียบสเปคและราคาสินค้าคอมพิวเตอร์เคียงข้างกัน เพื่อเลือกตัวที่คุ้มที่สุด",
};

/** รายการสินค้าโหลดทีหลังผ่าน /api/compare-items — หน้าเปิดไว ไม่ต้องรอข้อมูล ~1,000 ชิ้น */
export default function ComparePage() {
  return <CompareClient />;
}
