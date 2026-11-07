/** กล่องโครงหน้าแบบประกายวิ่ง (ใช้ในไฟล์ loading.tsx) */
export function Skel({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function TileGridSkel({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skel className="aspect-square rounded-2xl" />
          <Skel className="h-4 w-3/4 rounded" />
          <Skel className="h-4 w-1/3 rounded" />
        </div>
      ))}
    </div>
  );
}
