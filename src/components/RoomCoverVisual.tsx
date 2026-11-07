import FadeImg from "@/components/FadeImg";
import { roomImageProps } from "@/lib/links";
import type { RoomStyle } from "@/lib/types";
import { STYLE_EN } from "@/lib/format";

const GRADIENTS: Record<RoomStyle, string> = {
  gaming: "from-sky-900 via-blue-900 to-indigo-950",
  work: "from-slate-800 via-blue-900 to-slate-900",
  health: "from-teal-800 via-cyan-900 to-blue-950",
  creator: "from-blue-900 via-indigo-900 to-slate-900",
  student: "from-sky-800 via-blue-900 to-slate-900",
  minimal: "from-slate-700 via-sky-900 to-slate-900",
};

export function RoomCoverVisual({
  src,
  alt,
  style,
  title,
  className = "h-52 w-full",
  priority = false,
}: {
  src?: string | null;
  alt: string;
  style: RoomStyle;
  title: string;
  className?: string;
  /** ภาพหลักบนจอแรก — โหลดทันที */
  priority?: boolean;
}) {
  if (src) {
    return (
      <FadeImg
        {...roomImageProps(src)}
        alt={alt}
        width={1200}
        height={800}
        priority={priority}
        className={`img-zoom ${className} object-cover`}
      />
    );
  }

  return (
    <div
      className={`${className} relative flex flex-col justify-between overflow-hidden bg-gradient-to-br ${GRADIENTS[style]} p-5 text-white`}
      role="img"
      aria-label={alt}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-sky-200">
        <span>COMPRONEXT ROOM BLUEPRINT</span>
        <span>{STYLE_EN[style]}</span>
      </div>
      {/* Schematic SVG of desk + monitor setup */}
      <svg
        viewBox="0 0 320 120"
        className="my-auto h-24 w-full stroke-sky-100/90"
        fill="none"
        strokeWidth="2"
      >
        <rect x="20" y="82" width="280" height="8" rx="3" fill="rgba(255,255,255,0.22)" />
        <line x1="45" y1="90" x2="45" y2="116" />
        <line x1="275" y1="90" x2="275" y2="116" />
        <rect x="75" y="24" width="82" height="48" rx="4" fill="rgba(56,189,248,0.28)" />
        <rect x="163" y="24" width="82" height="48" rx="4" fill="rgba(255,255,255,0.14)" />
        <line x1="116" y1="72" x2="116" y2="82" />
        <line x1="204" y1="72" x2="204" y2="82" />
        <rect x="255" y="34" width="32" height="48" rx="3" fill="rgba(255,255,255,0.18)" />
      </svg>
      <div className="text-xs font-medium text-sky-100 truncate">{title}</div>
    </div>
  );
}
