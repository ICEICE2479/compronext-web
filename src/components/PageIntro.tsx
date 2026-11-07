/** บรรทัดสั้นๆ บนหัวหน้า: หน้านี้ทำอะไร · ทำต่อยังไง */
export function PageIntro({ what, next, className = "" }: { what: string; next: string; className?: string }) {
  return (
    <p className={`text-sm leading-relaxed text-ink-600 ${className}`}>
      <span className="font-semibold text-ink-800">{what}</span>
      <span aria-hidden="true"> · </span>
      <span className="sr-only"> — </span>
      {next}
    </p>
  );
}
