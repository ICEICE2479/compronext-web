import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { readDb } from "@/lib/data/store";
import { getCurrentUser } from "@/lib/auth";
import { calculateBuildTotals, resolveBuildSelection } from "@/lib/builder/compat";
import { encodeBuildPayloadServer } from "@/lib/community-share";
import { formatTHB, formatThaiDate } from "@/lib/format";
import { shareMeta } from "@/lib/seo";
import { CommunityActions } from "@/components/CommunityActions";
import { ProductTile, productToCartInput } from "@/components/ProductTile";
import { AddToCartButton } from "@/components/AddToCartButton";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = { cpu: "ซีพียู", gpu: "การ์ดจอ", motherboard: "เมนบอร์ด", ram: "แรม", storage: "SSD", cooler: "ระบายความร้อน", psu: "พาวเวอร์", case: "เคส", monitor: "จอ" };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = readDb().community.find((x) => x.id === id && x.status === "visible");
  return p ? shareMeta({ title: p.title, description: p.text || `${p.kind === "build" ? "สเปกคอม" : "ห้อง"}โดย ${p.userName}`, path: `/community/${p.id}`, image: p.imageUrl, type: "article" }) : {};
}

export default async function CommunityPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = readDb();
  const post = db.community.find((x) => x.id === id && x.status === "visible");
  if (!post) notFound();
  const user = await getCurrentUser();
  const build = post.kind === "build" && post.selection ? resolveBuildSelection(post.selection) : null;
  const totals = build ? calculateBuildTotals(build) : null;
  const products = (post.productIds ?? []).map((pid) => db.products.find((p) => p.id === pid)).filter((p): p is NonNullable<typeof p> => !!p && p.status === "available");

  return (
    <div className="container-page max-w-4xl space-y-5 py-6 sm:py-8">
      <Link href="/community" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-950">
        <ChevronLeft className="h-4 w-4" /> ชุมชน
      </Link>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">{post.title}</h1>
        <p className="text-sm text-ink-600">
          {post.kind === "build" ? "สเปกคอม" : "ห้อง"}โดย {post.userName} · {formatThaiDate(post.createdAt.slice(0, 10))}
        </p>
      </div>
      {post.text && <p className="whitespace-pre-line text-sm leading-relaxed text-ink-800">{post.text}</p>}
      <CommunityActions
        id={post.id}
        likeCount={post.likes.length}
        liked={!!user && post.likes.includes(user.id)}
        copies={post.copies}
        copyHref={post.selection ? `/builder?b=${encodeBuildPayloadServer(post.selection)}` : undefined}
      />
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt={post.title} width={1200} height={800} fetchPriority="high" decoding="async" className="h-auto w-full rounded-2xl border border-ink-200 object-cover" />
      )}
      {build && totals && (
        <div className="card divide-y divide-ink-100">
          {Object.entries(LABELS).map(([slot, label]) => {
            const part = build[slot as keyof typeof build];
            return part ? (
              <div key={slot} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="w-24 shrink-0 text-xs text-ink-600">{label}</span>
                <span className="min-w-0 flex-1 truncate text-ink-900">{part.name}</span>
                <span className="shrink-0 font-semibold text-ink-950">{formatTHB(part.price)}</span>
              </div>
            ) : null;
          })}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-ink-700">รวม · ~{totals.estimatedWatts}W</span>
            <span className="font-display text-xl font-bold text-ink-950">{formatTHB(totals.totalPrice)}</span>
          </div>
        </div>
      )}
      {products.length > 0 && (
        <div className="space-y-3">
          <AddToCartButton item={products.map((p) => productToCartInput(p, 1))} label={`ใส่ตะกร้าทั้งห้อง (${products.length} ชิ้น)`} className="h-11 w-full sm:w-auto" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((p) => (
              <ProductTile key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
