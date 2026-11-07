import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Tag,
  BedDouble,
  Gamepad2,
  Lamp,
  Leaf,
  Library,
  Monitor,
  Armchair,
  Sofa,
  Store,
} from "lucide-react";
import { getAllArticles, getAllBanners, getAllCatalogProducts, getAllProducts, getAllRooms, getSiteSettings } from "@/lib/data/store";
import { enrichRoom } from "@/lib/pricing";
import { RoomCard } from "@/components/RoomCard";
import { ProductTile } from "@/components/ProductTile";
import { HomeHero } from "@/components/home/HomeHero";
import { StartPaths } from "@/components/home/StartPaths";
import { WhyUs } from "@/components/home/WhyUs";
import { FirstVisitGuide } from "@/components/home/FirstVisitGuide";
import Reveal from "@/components/Reveal";
import { isSafeHttpUrl } from "@/lib/links";
import type { Product } from "@/lib/types";

export const revalidate = 60;

export function generateMetadata(): Metadata {
  const settings = getSiteSettings();
  return {
    title: { absolute: settings.seoTitle || "ComproNext — ไอเดียจัดห้องคอม & จัดสเปกคอม 3D" },
    description:
      settings.seoDescription ||
      settings.heroDescription ||
      "ถ่ายรูปห้องให้ AI จัด เลือกไอเดียห้องคอม เปรียบเทียบสเปก และจัดสเปกคอม 3D ในที่เดียว",
    alternates: { canonical: "/" },
  };
}

const CATEGORY_SHORTCUTS = [
  { href: "/categories?cat=bed", label: "ห้องนอน", icon: BedDouble },
  { href: "/categories?cat=desk", label: "โต๊ะ", icon: Monitor },
  { href: "/categories?cat=chair", label: "เก้าอี้", icon: Armchair },
  { href: "/categories?cat=lighting", label: "โคมไฟ", icon: Lamp },
  { href: "/categories?cat=storage", label: "ชั้นเก็บของ", icon: Library },
  { href: "/categories?cat=decor", label: "ของแต่ง", icon: Sofa },
  { href: "/categories?cat=fake_plant", label: "ต้นไม้", icon: Leaf },
  { href: "/categories?macro=gaming-gear", label: "เกมมิ่ง", icon: Gamepad2 },
];

const HOME_CATEGORIES = ["desk", "chair", "lighting", "bed", "decor", "rug", "fake_plant", "storage", "monitor", "keyboard"];

/** หยิบหมวดละ 1 ชิ้น (สินค้าแนะนำก่อน) ให้หน้าแรกมีของหลากหลาย */
function mixCategories(list: Product[], n: number): Product[] {
  const out: Product[] = [];
  for (const cat of HOME_CATEGORIES) {
    const pool = list.filter((p) => p.category === cat);
    const pick = pool.find((p) => p.featured || p.partnerId) ?? pool[Math.floor(pool.length / 3)];
    if (pick) out.push(pick);
    if (out.length >= n) break;
  }
  return out;
}

export default function HomePage() {
  const baseProducts = getAllProducts();
  const settings = getSiteSettings();
  const rooms = getAllRooms(false).map((r) => enrichRoom(r, baseProducts));
  const featuredRooms = [...rooms].sort((a, b) => b.popularity - a.popularity).slice(0, 6);
  const products = mixCategories(
    getAllCatalogProducts().filter((p) => p.status === "available" && p.imageUrl),
    8
  );
  const lineUrl = settings.socialLinks?.line;
  const banners = getAllBanners(false).slice(0, 3);
  const articles = getAllArticles(false).slice(0, 3);

  return (
    <div className="space-y-16 pb-16 sm:space-y-20 sm:pb-20">
      <HomeHero />
      <StartPaths />
      <FirstVisitGuide />

      {/* หมวดแบบไอคอน */}
      <nav className="container-page" aria-label="หมวดสินค้ายอดนิยม">
        <Reveal stagger={40} className="grid grid-cols-4 gap-x-1 gap-y-3 sm:grid-cols-8 sm:gap-3">
          {CATEGORY_SHORTCUTS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="group flex min-h-11 flex-col items-center gap-2 rounded-2xl p-2 text-center text-xs font-semibold text-ink-800 transition-colors hover:bg-ink-100 hover:text-ink-950">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-info-bg text-info transition-transform group-hover:scale-105 group-active:scale-95" aria-hidden="true">
                <Icon className="h-6 w-6" />
              </span>
              {label}
            </Link>
          ))}
        </Reveal>
      </nav>

      {/* ไอเดียห้อง */}
      <Reveal as="section" className="container-page space-y-5" aria-labelledby="home-rooms-title">
        <div className="flex items-end justify-between gap-4">
          <h2 id="home-rooms-title" className="text-h2 text-ink-950">ไอเดียห้องยอดนิยม</h2>
          <Link href="/rooms" className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-sm font-semibold text-info hover:underline" aria-label="ดูไอเดียห้องทั้งหมด">
            ทั้งหมด <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <Reveal stagger={60} className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {featuredRooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </Reveal>
      </Reveal>

      {/* สินค้า */}
      <Reveal as="section" className="container-page space-y-5" aria-labelledby="home-products-title">
        <div className="flex items-end justify-between gap-4">
          <h2 id="home-products-title" className="text-h2 text-ink-950">ของแต่งห้องแนะนำ</h2>
          <Link href="/categories" className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-sm font-semibold text-info hover:underline" aria-label="ดูสินค้าทั้งหมด">
            ทั้งหมด <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <Reveal stagger={60} className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
          {products.map((p) => (
            <ProductTile key={p.id} product={p} />
          ))}
        </Reveal>
      </Reveal>

      {/* โปรโมชั่นจากร้านพาร์ตเนอร์ (แก้ได้ในหลังบ้าน) */}
      {banners.length > 0 && (
        <section className="container-page space-y-5" aria-labelledby="home-promo-title">
          <h2 id="home-promo-title" className="text-h2 flex items-center gap-2 text-ink-950">
            <Tag className="h-5 w-5 text-info" aria-hidden="true" /> โปรโมชั่น
          </h2>
          <Reveal stagger={60} className="grid gap-3 sm:gap-4 md:grid-cols-3">
            {banners.map((b) => {
              const external = isSafeHttpUrl(b.href);
              const inner = (
                <>
                  <span className="inline-flex w-fit rounded-full bg-info-bg px-2.5 py-0.5 text-[11px] font-bold text-info">{b.badge}</span>
                  <span className="font-display text-base font-bold text-ink-950">{b.title}</span>
                  <span className="text-xs leading-relaxed text-ink-600">{b.detail}</span>
                  <span className="mt-auto text-xs font-semibold text-ink-500">{b.partner}</span>
                </>
              );
              return external ? (
                <a key={b.id} href={b.href} target="_blank" rel="noopener noreferrer sponsored" className="tile card-lift gap-2 p-5">{inner}</a>
              ) : (
                <Link key={b.id} href={b.href.startsWith("/") ? b.href : "/categories"} className="tile card-lift gap-2 p-5">{inner}</Link>
              );
            })}
          </Reveal>
        </section>
      )}

      {/* บทความ (แก้ได้ในหลังบ้าน) */}
      {articles.length > 0 && (
        <section className="container-page space-y-5" aria-labelledby="home-articles-title">
          <h2 id="home-articles-title" className="text-h2 flex items-center gap-2 text-ink-950">
            <BookOpen className="h-5 w-5 text-info" aria-hidden="true" /> บทความแนะนำ
          </h2>
          <Reveal stagger={60} className="grid gap-3 sm:gap-4 md:grid-cols-3">
            {articles.map((a) => (
              <Link key={a.id} href={a.href.startsWith("/") ? a.href : "/rooms"} className="tile card-lift gap-2 p-5">
                <span className="text-[11px] font-bold text-info">{a.issue}</span>
                <span className="font-display text-base font-bold leading-snug text-ink-950">{a.title}</span>
                <span className="line-clamp-3 text-xs leading-relaxed text-ink-600">{a.summary}</span>
                <span className="mt-auto text-xs text-ink-500">{a.readTime}</span>
              </Link>
            ))}
          </Reveal>
        </section>
      )}

      <WhyUs />

      {/* ร้านพาร์ตเนอร์ */}
      <Reveal as="section" className="container-page" aria-labelledby="home-partner-title">
        <div className="flex flex-col items-start justify-between gap-5 rounded-3xl border border-ink-200 bg-surface p-6 shadow-card sm:flex-row sm:items-center sm:p-10">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-info-bg text-info" aria-hidden="true">
              <Store className="h-6 w-6" />
            </span>
            <div className="space-y-1">
              <h2 id="home-partner-title" className="text-h3 text-ink-950">มีร้านแต่งห้อง? มาเป็นพาร์ตเนอร์กัน</h2>
              <p className="text-sm leading-relaxed text-ink-600">ลงสินค้าพร้อมโมเดล 3D ให้ AI หยิบไปจัดห้องให้ลูกค้า</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
            {isSafeHttpUrl(lineUrl) && (
              <a href={lineUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary min-h-11 flex-1 px-5 sm:flex-none">
                ติดต่อทีมงาน<span className="sr-only"> (เปิดแท็บใหม่)</span>
              </a>
            )}
            <Link href="/partner" className="btn btn-outline min-h-11 flex-1 px-5 sm:flex-none">
              หลังร้าน
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
