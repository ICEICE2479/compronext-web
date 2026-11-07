import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import { START_PATHS } from "./start-paths";

export function StartPaths() {
  return (
    <section className="container-page space-y-5" aria-labelledby="home-start-title">
      <h2 id="home-start-title" className="text-h2 text-ink-950">วันนี้อยากทำอะไร</h2>
      <Reveal stagger={60} className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {START_PATHS.map(({ href, icon: Icon, title, who }) => (
          <Link key={href} href={href} className="tile card-lift group gap-3 p-5 sm:p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-info-bg text-info" aria-hidden="true">
              <Icon className="h-6 w-6" />
            </span>
            <span className="block font-display text-lg font-bold text-ink-950">{title}</span>
            <span className="block text-sm leading-relaxed text-ink-600">{who}</span>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-info">
              เริ่มเลย <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </Reveal>
    </section>
  );
}
