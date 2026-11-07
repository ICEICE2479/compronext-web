import type { Metadata } from "next";
import Link from "next/link";
import { Cpu, Heart, LayoutGrid, Users } from "lucide-react";
import { readDb } from "@/lib/data/store";
import { visiblePosts } from "@/lib/community";
import { resolveBuildSelection, calculateBuildTotals } from "@/lib/builder/compat";
import { formatTHB, formatThaiDate } from "@/lib/format";
import { shareMeta } from "@/lib/seo";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";
export const metadata: Metadata = shareMeta({ title: "ชุมชน — สเปกคอมและห้องของผู้ใช้", description: "ดูสเปกคอมและห้องที่ผู้ใช้ ComproNext จัดเอง กดถูกใจ หรือก๊อปสเปกไปใช้ได้ทันที", path: "/community" });

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ kind?: string; sort?: string }> }) {
  const sp = await searchParams;
  const kind = sp.kind === "room" ? "room" : sp.kind === "build" ? "build" : undefined;
  const sort = sp.sort === "top" ? "top" : "new";
  const db = readDb();
  const posts = visiblePosts(db, kind, sort).slice(0, 60);
  const byId = new Map(db.products.map((p) => [p.id, p]));
  const tab = (k: string | undefined, label: string) => (
    <Link href={`/community?${new URLSearchParams({ ...(k ? { kind: k } : {}), ...(sort === "top" ? { sort } : {}) })}`} data-active={kind === k} className="chip tap-target rounded-full">
      {label}
    </Link>
  );

  return (
    <div className="container-page space-y-5 py-6 sm:py-8">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink-950 sm:text-3xl">
          <Users className="h-7 w-7 text-info" aria-hidden="true" /> ชุมชน
        </h1>
        <p className="text-sm text-ink-600">สเปกคอมและห้องที่ผู้ใช้จัดเอง · กดถูกใจ หรือก๊อปสเปกไปปรับต่อ · โพสต์ของคุณได้จากหน้าจัดสเปก หรือห้องที่ AI จัดในหน้าบัญชี</p>
      </div>
      <nav aria-label="กรองโพสต์" className="flex flex-wrap items-center gap-2">
        {tab(undefined, "ทั้งหมด")}
        {tab("build", "สเปกคอม")}
        {tab("room", "ห้อง")}
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-ink-200" />
        <Link href={`/community?${new URLSearchParams({ ...(kind ? { kind } : {}) })}`} data-active={sort === "new"} className="chip tap-target rounded-full">ล่าสุด</Link>
        <Link href={`/community?${new URLSearchParams({ ...(kind ? { kind } : {}), sort: "top" })}`} data-active={sort === "top"} className="chip tap-target rounded-full">ยอดนิยม</Link>
      </nav>
      {posts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users className="h-10 w-10 text-ink-400" aria-hidden="true" />}
            title="ยังไม่มีโพสต์"
            description="เป็นคนแรกที่แชร์สเปกคอมหรือห้องที่จัดเองให้ชุมชนดู"
            action={{ label: "จัดสเปกแล้วโพสต์เป็นคนแรก", href: "/builder" }}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => {
            const build = p.kind === "build" && p.selection ? resolveBuildSelection(p.selection) : null;
            const total = build ? calculateBuildTotals(build).totalPrice : (p.productIds ?? []).reduce((s, id) => s + (byId.get(id)?.price ?? 0), 0);
            return (
              <Link key={p.id} href={`/community/${p.id}`} className="card group flex min-w-0 flex-col gap-3 overflow-hidden p-4 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" width={800} height={600} loading="lazy" decoding="async" className="-mx-4 -mt-4 aspect-[4/3] w-[calc(100%+2rem)] max-w-none object-cover" />
                ) : null}
                <div className="flex items-center gap-2 text-xs text-ink-600">
                  {p.kind === "build" ? <Cpu className="h-3.5 w-3.5 shrink-0 text-info" aria-hidden="true" /> : <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-info" aria-hidden="true" />}
                  <span className="min-w-0 truncate">{p.kind === "build" ? "สเปกคอม" : "ห้อง"} · {p.userName} · {formatThaiDate(p.createdAt.slice(0, 10))}</span>
                </div>
                <p className="line-clamp-2 break-words font-semibold text-ink-950 group-hover:text-info">{p.title}</p>
                {build && (
                  <p className="line-clamp-2 text-xs text-ink-700">
                    {[build.cpu?.name, build.gpu?.name].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between text-sm">
                  <span className="font-bold text-ink-950">{formatTHB(total)}</span>
                  <span className="inline-flex items-center gap-1 text-ink-600">
                    <Heart className="h-3.5 w-3.5" aria-hidden="true" /> <span className="sr-only">ถูกใจ</span>{p.likes.length}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
