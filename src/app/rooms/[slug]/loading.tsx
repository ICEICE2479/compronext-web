import { Skel, TileGridSkel } from "@/components/skeleton/Skel";

/** โครงหน้าห้อง — รูปห้องใหญ่ แล้วรายการของในห้อง */
export default function Loading() {
  return (
    <div className="container-page space-y-6 py-6" aria-busy="true" aria-label="กำลังโหลด">
      <Skel className="h-8 w-64 rounded-lg" />
      <Skel className="aspect-[16/9] w-full rounded-3xl" />
      <TileGridSkel count={4} />
    </div>
  );
}
