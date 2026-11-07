import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "เลือกจอคอมตามสายงาน",
  description: "แนะนำจอคอมตามการใช้งาน ทั้งงานออฟฟิศ ตัดต่อ กราฟิก และเล่นเกม พร้อมเปรียบเทียบราคา",
};

export default function MonitorsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
