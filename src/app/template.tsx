/** เปลี่ยนหน้าแบบจางเข้าเบาๆ (template จะ mount ใหม่ทุกครั้งที่เปลี่ยนหน้า) */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
