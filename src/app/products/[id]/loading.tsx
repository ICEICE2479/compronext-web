import { Skel, TileGridSkel } from "@/components/skeleton/Skel";

/** โครงหน้าสินค้า — รูปซ้าย ข้อมูลขวา ตรงกับหน้าจริง */
export default function Loading() {
  return (
    <div className="container-page space-y-10 py-6 sm:py-8" aria-busy="true" aria-label="กำลังโหลด">
      <Skel className="h-5 w-28 rounded" />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-10">
        <Skel className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Skel className="h-4 w-40 rounded" />
          <Skel className="h-8 w-full rounded-lg" />
          <Skel className="h-8 w-2/3 rounded-lg" />
          <Skel className="h-10 w-40 rounded-lg" />
          <Skel className="h-24 w-full rounded-2xl" />
          <div className="flex gap-2">
            <Skel className="h-12 flex-1 rounded-xl" />
            <Skel className="h-12 w-12 rounded-xl" />
            <Skel className="h-12 flex-1 rounded-xl" />
          </div>
          <Skel className="h-40 w-full rounded-2xl" />
        </div>
      </div>
      <TileGridSkel count={4} />
    </div>
  );
}
