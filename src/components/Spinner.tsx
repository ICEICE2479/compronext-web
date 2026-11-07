/** วงหมุนเล็กสำหรับปุ่มที่กำลังโหลด (ใช้คู่กับ disabled + aria-busy) */
export default function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className ? `animate-spin motion-reduce:animate-none ${className}` : "animate-spin motion-reduce:animate-none"}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
