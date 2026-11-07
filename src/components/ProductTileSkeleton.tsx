/** กรองเทาแทนการ์ดสินค้าระหว่างโหลด (กันหน้ากระโดด) — โครงเดียวกับ ProductTile */
export function ProductTileSkeleton() {
  return (
    <div className="tile" aria-hidden>
      <div className="tile-media skeleton" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* ชื่อสินค้า 2 บรรทัด (text-sm leading-snug) */}
        <div className="space-y-1.5 py-0.5">
          <div className="skeleton h-3.5 w-11/12 rounded" />
          <div className="skeleton h-3.5 w-2/3 rounded" />
        </div>
        {/* ชื่อร้าน */}
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="mt-auto flex items-center gap-1.5 pt-1">
          <div className="skeleton mr-auto h-5 w-16 rounded" />
          <div className="skeleton h-10 w-10 rounded-full sm:h-9 sm:w-9" />
        </div>
      </div>
    </div>
  );
}
