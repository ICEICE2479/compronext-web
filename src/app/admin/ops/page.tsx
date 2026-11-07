import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Ticket, LifeBuoy, PackageSearch, Activity, AlertTriangle, ArrowLeft, Database, Flag, MessageCircle, Rocket, Star, Store, Users } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";
import { getAllStats } from "@/lib/stats";
import { listBackups } from "@/lib/backup";
import { readOps } from "@/lib/ops-log";
import { expireBoosts } from "@/lib/boosts";
import { formatTHB } from "@/lib/format";
import { AdminStats } from "@/components/AdminStats";
import { FunnelView } from "@/components/FunnelView";
import { readFunnel } from "@/lib/funnel";
import { auditProducts, ISSUE_LABELS, type IssueKey } from "@/lib/data-quality";
import { CaseBoard } from "@/components/returns/CaseBoard";
import { mirrorPending } from "@/lib/image-mirror";
import { realImagePending } from "@/lib/real-image";
import { roomPinsPending } from "@/lib/room-pins";
import { extractDimensions } from "@/lib/dim-extract";
import { detectRoomPinsNow, findRealImagesNow, decideCreditOrder, applyExtractedDims, decidePartnerApplication, mirrorImagesNow, hideProducts, backupNow, decideBoost, deleteChat, deleteReview, deleteUser, restoreNow, runPriceCheck, setPartnerActive, setPostStatus, setUserBan, testAlert } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ศูนย์ควบคุม — หลังบ้าน", description: "จัดการผู้ใช้ รีวิว ชุมชน และการดันสินค้า", robots: { index: false, follow: false } };

const TABS = [
  ["overview", "ภาพรวม", Activity],
  ["users", "ผู้ใช้", Users],
  ["reviews", "รีวิว", Star],
  ["community", "ชุมชน", Flag],
  ["boosts", "ดันสินค้า", Rocket],
  ["credits", "เครดิต AI", Ticket],
  ["partners", "ร้านพาร์ตเนอร์", Store],
  ["chats", "แชท", MessageCircle],
  ["cases", "เคสหลังการขาย", LifeBuoy],
  ["data", "ข้อมูลสินค้า", PackageSearch],
  ["system", "ระบบ", Database],
] as const;
type Tab = (typeof TABS)[number][0];

/** เวลา ณ N ชั่วโมงก่อน (ISO) */
function isoHoursAgo(h: number) {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }) : "—");
const Btn = ({ children, danger, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) => (
  <button {...p} className={`rounded-full border px-3 py-1 text-xs font-semibold ${danger ? "border-bad/40 text-bad hover:bg-bad-bg" : "border-ink-300 text-ink-800 hover:bg-ink-100"}`}>
    {children}
  </button>
);

export default async function AdminOpsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; status?: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const sp = await searchParams;
  const tab: Tab = (TABS.find(([k]) => k === sp.tab)?.[0] ?? "overview") as Tab;
  const q = (sp.q ?? "").trim().toLowerCase();
  const db = readDb();
  if (expireBoosts(db)) writeDb(db);

  return (
    <div className="container-page space-y-5 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">ศูนย์ควบคุมหลังบ้าน</h1>
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm font-semibold text-info">
          <ArrowLeft className="h-4 w-4" /> จัดการสินค้า เนื้อหา หมวด ห้อง
        </Link>
      </div>
      <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="หมวดหลังบ้าน">
        {TABS.map(([k, label, Icon]) => (
          <Link key={k} href={`/admin/ops?tab=${k}`} data-active={tab === k} className="chip shrink-0 rounded-full">
            <Icon className="h-3.5 w-3.5" /> {label}
          </Link>
        ))}
      </nav>
      {tab === "overview" && <Overview />}
      {tab === "users" && <UsersTab q={q} />}
      {tab === "reviews" && <ReviewsTab />}
      {tab === "community" && <CommunityTab />}
      {tab === "boosts" && <BoostsTab />}
      {tab === "credits" && <CreditsTab />}
      {tab === "partners" && <PartnersTab />}
      {tab === "chats" && <ChatsTab />}
      {tab === "cases" && <CaseBoard cases={db.cases} filter={sp.status ?? "open"} baseHref="/admin/ops?tab=cases" showStore now={Date.parse(isoHoursAgo(0))} />}
      {tab === "data" && <DataTab />}
      {tab === "system" && <SystemTab />}
    </div>
  );
}

async function Overview() {
  const db = readDb();
  const [stats, ops, backups, funnel] = await Promise.all([getAllStats(), readOps(undefined, 200), listBackups(), readFunnel(14)]);
  const dayAgo = isoHoursAgo(24);
  const errors24 = ops.filter((o) => o.kind === "error" && o.at >= dayAgo).length;
  const pendingBoosts = db.boosts.filter((b) => b.status === "pending").length;
  const reported = db.community.filter((c) => c.reports.length > 0 || c.status === "hidden").length;
  const cards: Array<[string, number | string, string?]> = [
    ["สมาชิก", db.users.length],
    ["สินค้า", db.products.length],
    ["ห้อง", db.rooms.length],
    ["รีวิว", db.reviews.length],
    ["ห้องแชท", db.chats.length],
    ["โพสต์ชุมชน", db.community.length],
    ["ร้านพาร์ตเนอร์", db.partners.filter((p) => p.active).length],
    ["รับอีเมลรายสัปดาห์", Object.keys(db.digestSubs).length],
  ];
  const todo: Array<[string, number, string]> = [
    ["คำขอดันสินค้ารออนุมัติ", pendingBoosts, "boosts"],
    ["เติมเครดิต AI รอตรวจยอด", db.creditOrders.filter((o) => o.status === "pending").length, "credits"],
    ["โพสต์ถูกรายงาน/ซ่อน", reported, "community"],
    ["error 24 ชม.", errors24, "system"],
    ["ร้านสมัครรออนุมัติ", db.partnerApplications.filter((a) => a.status === "pending").length, "partners"],
    ["เคสหลังการขายยังไม่ปิด", db.cases.filter((c) => c.status !== "resolved" && c.status !== "rejected").length, "cases"],
  ];
  const fb = db.feedback;
  const fbAvg = fb.length ? Math.round((fb.reduce((s, f) => s + f.stars, 0) / fb.length) * 10) / 10 : null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(([label, v]) => (
          <div key={label} className="rounded-2xl border border-ink-200 bg-surface p-3.5">
            <p className="text-xs text-ink-600">{label}</p>
            <p className="font-display text-2xl font-bold text-ink-950">{typeof v === "number" ? v.toLocaleString("th-TH") : v}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {todo.map(([label, n, t]) => (
          <Link key={label} href={`/admin/ops?tab=${t}`} className={`flex items-center justify-between rounded-2xl border p-3.5 ${n ? "border-warn/50 bg-warn-bg" : "border-ink-200 bg-surface"}`}>
            <span className="text-sm text-ink-800">{label}</span>
            <span className="font-display text-xl font-bold text-ink-950">{n}</span>
          </Link>
        ))}
      </div>
      <section className="card space-y-2 p-4">
        <p className="font-semibold text-ink-950">
          ความเห็นผู้ใช้: {fbAvg === null ? "ยังไม่มี" : `★ ${fbAvg} จาก ${fb.length} คน`}
          {fb.length > 0 && <span className="ml-2 text-xs font-normal text-ink-600">ให้ 1–3 ดาว {fb.filter((f) => f.stars <= 3).length} คน</span>}
        </p>
        <ul className="max-h-56 divide-y divide-ink-100 overflow-y-auto text-sm">
          {fb.filter((f) => f.text).slice(0, 30).map((f) => (
            <li key={f.id} className="py-1.5">
              <span className="text-amber-500">{"★".repeat(f.stars)}</span> <span className="text-ink-800">{f.text}</span>
              <span className="ml-1 text-xs text-ink-500">· {f.page} · {when(f.at)}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-ink-600">สำรองข้อมูลล่าสุด: {when(backups[0]?.createdAt)} · cron ล่าสุด: {when(ops.find((o) => o.kind === "cron")?.at)}</p>
      <FunnelView {...funnel} />
      <AdminStats stats={stats} products={db.products} />
    </div>
  );
}

function UsersTab({ q }: { q: string }) {
  const db = readDb();
  const list = db.users.filter((u) => !q || `${u.fullName} ${u.email}`.toLowerCase().includes(q)).slice(0, 80);
  const count = (id: string) => ({
    reviews: db.reviews.filter((r) => r.userId === id).length,
    posts: db.community.filter((c) => c.userId === id).length,
  });
  return (
    <section className="card space-y-3 p-4">
      <form className="flex gap-2" action="/admin/ops">
        <input type="hidden" name="tab" value="users" />
        <input name="q" defaultValue={q} placeholder="ค้นหาชื่อหรืออีเมล" className="input h-10 flex-1" aria-label="ค้นหาผู้ใช้" />
        <button className="btn btn-primary h-10 rounded-full px-4">ค้นหา</button>
      </form>
      <p className="text-xs text-ink-600">ทั้งหมด {db.users.length} คน · แสดง {list.length}</p>
      <ul className="divide-y divide-ink-100">
        {list.map((u) => {
          const c = count(u.id);
          return (
            <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink-950">
                  {u.fullName} {u.banned && <span className="ml-1 rounded-full bg-bad-bg px-2 text-[11px] text-bad">ถูกระงับ</span>}
                </span>
                <span className="block truncate text-xs text-ink-600">
                  {u.email} · {u.authProvider} · สมัคร {u.joinedAt} · รีวิว {c.reviews} · โพสต์ {c.posts}
                </span>
              </span>
              <form action={setUserBan}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="ban" value={u.banned ? "0" : "1"} />
                <Btn danger={!u.banned}>{u.banned ? "ยกเลิกระงับ" : "ระงับ"}</Btn>
              </form>
              <form action={deleteUser} className="flex items-center gap-1">
                <input type="hidden" name="id" value={u.id} />
                <input name="confirm" placeholder="พิมพ์ ลบ" aria-label={`ยืนยันลบ ${u.email}`} className="h-7 w-20 rounded-full border border-ink-300 bg-surface px-2 text-xs" />
                <Btn danger>ลบข้อมูล</Btn>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReviewsTab() {
  const list = [...readDb().reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  return (
    <section className="card p-4">
      {list.length === 0 && <p className="text-sm text-ink-600">ยังไม่มีรีวิว</p>}
      <ul className="divide-y divide-ink-100">
        {list.map((r) => (
          <li key={r.id} className="flex items-start gap-3 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-ink-600">
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)} · {r.storeName} · {r.userName} · {when(r.createdAt)}
              </span>
              <span className="block whitespace-pre-line text-ink-900">{r.text || "—"}</span>
            </span>
            <form action={deleteReview}>
              <input type="hidden" name="id" value={r.id} />
              <Btn danger>ลบ</Btn>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommunityTab() {
  const list = [...readDb().community].sort((a, b) => b.reports.length - a.reports.length || Number(a.status === "visible") - Number(b.status === "visible") || b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  return (
    <section className="card p-4">
      <p className="mb-2 text-xs text-ink-600">โพสต์ที่ถูกรายงาน 3 ครั้งจะถูกซ่อนอัตโนมัติจนกว่าจะตรวจ</p>
      {list.length === 0 && <p className="text-sm text-ink-600">ยังไม่มีโพสต์</p>}
      <ul className="divide-y divide-ink-100">
        {list.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <Link href={`/community/${p.id}`} className="block truncate font-semibold text-ink-950 hover:text-info">
                {p.title}
              </Link>
              <span className="block text-xs text-ink-600">
                {p.kind === "build" ? "สเปก" : "ห้อง"} · {p.userName} · {when(p.createdAt)} · ♥ {p.likes.length} ·{" "}
                <span className={p.reports.length ? "font-semibold text-bad" : ""}>รายงาน {p.reports.length}</span> · {p.status === "visible" ? "แสดงอยู่" : "ซ่อนอยู่"}
              </span>
            </span>
            {(["visible", "hidden", "delete"] as const).map((s) => (
              <form key={s} action={setPostStatus}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="status" value={s} />
                <Btn danger={s !== "visible"}>{s === "visible" ? "แสดง" : s === "hidden" ? "ซ่อน" : "ลบ"}</Btn>
              </form>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BoostsTab() {
  const db = readDb();
  const list = [...db.boosts].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  const price = (id: string) => db.products.find((p) => p.id === id)?.price;
  return (
    <section className="card p-4">
      <p className="mb-2 text-xs text-ink-600">อนุมัติ = สินค้าขึ้น “แนะนำ” ตามจำนวนวัน แล้วปิดเองอัตโนมัติ · ถ้าตั้ง PROMPTPAY_ID ร้านจะสแกน QR จ่ายเองแล้วกดแจ้งโอน — เช็กยอดในแอปธนาคารก่อนกดอนุมัติ</p>
      {list.length === 0 && <p className="text-sm text-ink-600">ยังไม่มีคำขอ</p>}
      <ul className="divide-y divide-ink-100">
        {list.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <Link href={`/products/${b.productId}`} className="block truncate font-semibold text-ink-950 hover:text-info">
                {b.productName}
              </Link>
              <span className="block text-xs text-ink-600">
                {b.partnerName} · {b.days} วัน · {price(b.productId) ? formatTHB(price(b.productId)!) : ""} · ขอเมื่อ {when(b.createdAt)}
                {b.status === "active" && ` · ถึง ${when(b.endAt)}`} · <strong>{{ pending: "รออนุมัติ", active: "กำลังดัน", rejected: "ปฏิเสธ", ended: "จบแล้ว" }[b.status]}</strong>
                {b.note && ` · “${b.note}”`}
              </span>
              {b.amount ? (
                <span className={`mt-0.5 block text-xs font-semibold ${b.paidAt ? "text-ok" : "text-warn"}`}>
                  ยอด {formatTHB(b.amount)} · อ้างอิง {b.id} · {b.paidAt ? `ร้านแจ้งโอนแล้ว ${when(b.paidAt)}` : "ยังไม่แจ้งโอน"}
                  {b.slipUrl && (
                    <>
                      {" · "}
                      <a href={b.slipUrl} target="_blank" rel="noreferrer" className="underline">
                        ดูสลิป
                      </a>
                    </>
                  )}
                </span>
              ) : null}
            </span>
            {b.status === "pending" &&
              (["approve", "reject"] as const).map((d) => (
                <form key={d} action={decideBoost}>
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="decision" value={d} />
                  <Btn danger={d === "reject"}>{d === "approve" ? "อนุมัติ" : "ปฏิเสธ"}</Btn>
                </form>
              ))}
            {b.status === "active" && (
              <form action={decideBoost}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="decision" value="end" />
                <Btn danger>หยุดดัน</Btn>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CreditsTab() {
  const db = readDb();
  const order = { pending: 0, unpaid: 1, approved: 2, rejected: 3 } as const;
  const list = [...db.creditOrders].sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  return (
    <section className="card p-4">
      <p className="mb-2 text-xs text-ink-600">ลูกค้าสแกน QR พร้อมเพย์แล้วกดแจ้งโอน — เช็กยอดในแอปธนาคารก่อนกดอนุมัติ (อนุมัติแล้วเครดิตเข้าทันที) · แพ็กเกจตั้งที่ AI_CREDIT_PACKS เช่น 49:20,99:50,199:120</p>
      {list.length === 0 && <p className="text-sm text-ink-600">ยังไม่มีรายการ</p>}
      <ul className="divide-y divide-ink-100">
        {list.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink-950">
                {formatTHB(o.amount)} · {o.credits} เครดิต · <span className="font-mono text-xs">{o.id}</span>
              </span>
              <span className="block text-xs text-ink-600">
                {o.email} · สร้าง {when(o.createdAt)}
                {o.paidAt && ` · แจ้งโอน ${when(o.paidAt)}`} · <strong>{{ unpaid: "ยังไม่แจ้งโอน", pending: "รอตรวจยอด", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธ" }[o.status]}</strong>
                {o.slipUrl && (
                  <>
                    {" · "}
                    <a href={o.slipUrl} target="_blank" rel="noreferrer" className="underline">
                      ดูสลิป
                    </a>
                  </>
                )}
              </span>
            </span>
            {(o.status === "pending" || o.status === "unpaid") &&
              (["approve", "reject"] as const).map((d) => (
                <form key={d} action={decideCreditOrder}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="decision" value={d} />
                  <Btn danger={d === "reject"}>{d === "approve" ? "อนุมัติ" : "ปฏิเสธ"}</Btn>
                </form>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PartnersTab() {
  const db = readDb();
  const apps = [...db.partnerApplications].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
  return (
    <div className="space-y-4">
    {apps.length > 0 && (
      <section className="card p-4">
        <p className="mb-2 font-semibold text-ink-950">ร้านที่สมัครเข้ามา ({apps.filter((a) => a.status === "pending").length} รออนุมัติ)</p>
        <ul className="divide-y divide-ink-100">
          {apps.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink-950">
                  {a.storeName} <span className="text-xs font-normal text-ink-600">· {a.contactName} · {a.email} · {a.phone}{a.line ? ` · LINE ${a.line}` : ""}</span>
                </span>
                <span className="block text-xs text-ink-600">
                  {a.categories.join(", ") || "—"} · สินค้า {a.productCount || "?"} ชิ้น · {when(a.createdAt)}
                  {a.shopUrl && (
                    <>
                      {" · "}
                      <a href={a.shopUrl} target="_blank" rel="noreferrer" className="underline">ร้านเดิม</a>
                    </>
                  )}
                  {a.message && ` · “${a.message}”`}
                </span>
              </span>
              {a.status === "pending" ? (
                (["approve", "reject"] as const).map((d) => (
                  <form key={d} action={decidePartnerApplication}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="decision" value={d} />
                    <Btn danger={d === "reject"}>{d === "approve" ? "อนุมัติ เปิดร้าน" : "ปฏิเสธ"}</Btn>
                  </form>
                ))
              ) : (
                <span className={`text-xs font-semibold ${a.status === "approved" ? "text-ok" : "text-bad"}`}>{a.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธ"}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-ink-500">อนุมัติแล้ว ร้านล็อกอินด้วยอีเมลที่สมัครที่ /partner ได้ทันที</p>
      </section>
    )}
    <section className="card p-4">
      <p className="mb-2 text-xs text-ink-600">เพิ่มร้านใหม่ได้ที่หน้าจัดการเดิม (ปุ่มด้านบน)</p>
      <ul className="divide-y divide-ink-100">
        {db.partners.map((p) => {
          const own = db.products.filter((x) => x.partnerId === p.id).length;
          const threads = db.chats.filter((c) => c.partnerId === p.id).length;
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink-950">{p.name}</span>
                <span className="block text-xs text-ink-600">
                  {p.email} · สินค้า {own} · แชท {threads} · {p.active ? "เปิดใช้งาน" : "ปิดอยู่"}
                </span>
              </span>
              <form action={setPartnerActive}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="active" value={p.active ? "0" : "1"} />
                <Btn danger={p.active}>{p.active ? "ปิดร้าน" : "เปิดร้าน"}</Btn>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
    </div>
  );
}

function ChatsTab() {
  const list = [...readDb().chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 100);
  return (
    <section className="card p-4">
      <p className="mb-2 text-xs text-ink-600">แสดงเฉพาะข้อมูลสรุป (ไม่เปิดอ่านข้อความเพื่อความเป็นส่วนตัว) — ลบได้เมื่อมีการร้องเรียน</p>
      {list.length === 0 && <p className="text-sm text-ink-600">ยังไม่มีแชท</p>}
      <ul className="divide-y divide-ink-100">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink-950">
                {c.userName} ↔ {c.storeName}
              </span>
              <span className="block text-xs text-ink-600">
                {c.messages.length} ข้อความ · ล่าสุด {when(c.updatedAt)}
              </span>
            </span>
            <form action={deleteChat}>
              <input type="hidden" name="id" value={c.id} />
              <Btn danger>ลบห้องแชท</Btn>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function SystemTab() {
  const [backups, ops] = await Promise.all([listBackups(), readOps(undefined, 80)]);
  const env: Array<[string, boolean, string]> = [
    ["ฐานข้อมูลจริง (DATABASE_URL)", !!process.env.DATABASE_URL, "จำเป็น: ไม่ตั้ง = ข้อมูลหายทุกครั้งที่ Vercel รีสตาร์ท"],
    ["แจ้งลดราคาทาง LINE (LINE_MESSAGING_TOKEN)", !!process.env.LINE_MESSAGING_TOKEN, "สมาชิกที่ล็อกอินด้วย LINE + แอดเพื่อน OA จะได้ข้อความเมื่อของที่ติดตามลดราคา"],
    ["ที่อยู่เว็บ (NEXT_PUBLIC_SITE_URL)", !!process.env.NEXT_PUBLIC_SITE_URL, "ใช้กับ SEO/ลิงก์แชร์/ล็อกอิน"],
    ["คีย์คุกกี้ (ADMIN_SESSION_SECRET)", (process.env.ADMIN_SESSION_SECRET ?? "").length >= 32, "ตอนนี้ใช้คีย์สำรองอัตโนมัติ (ล็อกอินได้) — ตั้งเองยาว 32 ตัวขึ้นไปจะปลอดภัยกว่า"],
    ["Cron (CRON_SECRET)", (process.env.CRON_SECRET ?? "").length >= 16, "เช็กราคา/สำรองข้อมูล/อีเมลรายสัปดาห์"],
    [
      "สร้างภาพ AI (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN ฟรี / GEMINI_API_KEY)",
      !!(process.env.GEMINI_API_KEY || ((process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID) && (process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN))),
      "ลูกค้าจะได้ภาพวางสินค้าลงรูปห้องแทนภาพ AI",
    ],
    [
      "อีเมล OTP (GMAIL_USER + GMAIL_APP_PASSWORD ง่ายสุด / RESEND_API_KEY + โดเมน / Clerk)",
      !!(
        ((process.env.SMTP_USER || process.env.GMAIL_USER) && (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD)) ||
        process.env.RESEND_API_KEY ||
        (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
      ),
      "จำเป็น: ไม่ตั้ง = ลูกค้าล็อกอินไม่ได้",
    ],
    ["ล็อกอิน Google", !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), ""],
    ["ล็อกอิน LINE", !!(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET), ""],
    ["แจ้งเตือนมือถือ (VAPID_*)", !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY), ""],
    ["แจ้งเตือน error (ALERT_WEBHOOK_URL)", !!process.env.ALERT_WEBHOOK_URL, "Discord/Slack/Google Chat"],
    ["ไฟล์อัปโหลด (BLOB_READ_WRITE_TOKEN)", !!process.env.BLOB_READ_WRITE_TOKEN, "จำเป็น: รูปหลักฐานเคส/รูปสินค้าร้าน/บันทึกห้อง"],
    ["Affiliate", Object.keys(process.env).some((k) => k.startsWith("AFFILIATE_") && process.env[k]), "ได้ค่าคอมจากลิงก์ไปร้าน"],
    ["รับเงินค่าดันสินค้า (PROMPTPAY_ID)", /^\d{10}$|^\d{13}$|^\d{15}$/.test((process.env.PROMPTPAY_ID ?? "").replace(/\D/g, "")), "ร้านสแกน QR จ่ายเองได้ · ราคาตั้งที่ BOOST_PRICES เช่น 7:299,14:499,30:899"],
  ];
  return (
    <div className="space-y-4">
      <section className="card space-y-2 p-4">
        <p className="font-semibold text-ink-950">การตั้งค่า</p>
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {env.map(([label, ok, hint]) => (
            <li key={label} className="flex items-start gap-2">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-ok" : "bg-warn"}`} />
              <span>
                {label} <span className="text-xs text-ink-600">{ok ? "· ตั้งแล้ว" : `· ยังไม่ตั้ง${hint ? ` — ${hint}` : ""}`}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-ink-950">สำรองข้อมูล (เก็บ 7 ชุดล่าสุด · อัตโนมัติทุกวัน)</p>
          <div className="flex gap-2">
            <form action={backupNow}>
              <Btn>สำรองตอนนี้</Btn>
            </form>
            <form action={runPriceCheck}>
              <Btn>เช็กราคา 20 ชิ้น</Btn>
            </form>
            <form action={testAlert}>
              <Btn>ทดสอบแจ้งเตือน</Btn>
            </form>
          </div>
        </div>
        {backups.length === 0 && <p className="text-sm text-ink-600">ยังไม่มีข้อมูลสำรอง</p>}
        <ul className="divide-y divide-ink-100">
          {backups.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1">
                {when(b.createdAt)} · {b.reason} · {b.sizeKb.toLocaleString("th-TH")} KB
              </span>
              <form action={restoreNow} className="flex items-center gap-1">
                <input type="hidden" name="id" value={b.id} />
                <input name="confirm" placeholder="พิมพ์ กู้คืน" aria-label={`ยืนยันกู้คืน ${b.id}`} className="h-7 w-24 rounded-full border border-ink-300 bg-surface px-2 text-xs" />
                <Btn danger>กู้คืน</Btn>
              </form>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-ink-600">กู้คืนจะสำรองสถานะปัจจุบันไว้ก่อนเสมอ ย้อนกลับได้</p>
      </section>

      <section className="card space-y-2 p-4">
        <p className="flex items-center gap-1.5 font-semibold text-ink-950">
          <AlertTriangle className="h-4 w-4 text-warn" /> บันทึกระบบ (error · cron · แอดมิน)
        </p>
        {ops.length === 0 && <p className="text-sm text-ink-600">ยังไม่มีบันทึก</p>}
        <ul className="divide-y divide-ink-100 text-sm">
          {ops.map((o) => (
            <li key={o.id} className="py-2">
              <details>
                <summary className="cursor-pointer list-none">
                  <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.kind === "error" || o.ok === false ? "bg-bad-bg text-bad" : o.kind === "admin" ? "bg-info-bg text-info" : "bg-ok-bg text-ok"}`}>
                    {o.kind === "error" ? "error" : o.kind === "admin" ? "แอดมิน" : "cron"}
                  </span>
                  <span className="text-ink-900">{o.title}</span> <span className="text-xs text-ink-600">· {when(o.at)}</span>
                </summary>
                {o.detail && <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-2 text-[11px] text-ink-700">{o.detail}</pre>}
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DataTab() {
  const db = readDb();
  const audit = auditProducts(db.products);
  const live = db.products.filter((p) => p.published !== false).length;
  const pendingImages = mirrorPending();
  const illustrated = realImagePending();
  const pinRooms = roomPinsPending();
  const dimCandidates = db.products.filter((p) => !p.dimensions && extractDimensions([p.name, p.description, ...Object.values(p.specs ?? {})].join(" "), p.category));
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-700">สินค้าที่เผยแพร่ {live.toLocaleString("th-TH")} ชิ้น</p>
      <form action={findRealImagesNow} className="card flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-950">สินค้าที่ยังเป็นรูปวาด: {illustrated.toLocaleString("th-TH")} ชิ้น</p>
          <p className="text-xs text-ink-600">ระบบเปิดหน้าสินค้าของร้านแล้วดึงรูปจริงมาแทน (ร้านที่บล็อกบอทจะหาไม่เจอ) · cron ทำเองวันละ 25 ชิ้น · กดเพื่อทำครั้งละ ~40 ชิ้น แล้วกด “เก็บรูปเข้าระบบ” ต่อ</p>
        </div>
        <Btn disabled={!illustrated}>หารูปจริงตอนนี้</Btn>
      </form>
      <form action={detectRoomPinsNow} className="card flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-950">ห้องที่ยังไม่ได้จัดจุดสินค้าบนรูป: {pinRooms.toLocaleString("th-TH")} ห้อง</p>
          <p className="text-xs text-ink-600">AI หาจอ คีย์บอร์ด เมาส์ เก้าอี้ โต๊ะ ต้นไม้ ในรูป แล้ววางตัวเลขลงบนของจริง · cron ทำเองวันละ 10 ห้อง</p>
        </div>
        <Btn disabled={!pinRooms}>จัดจุดตอนนี้</Btn>
      </form>
      <form action={mirrorImagesNow} className="card flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-950">รูปสินค้าที่ยังดึงจากเว็บร้าน: {pendingImages.toLocaleString("th-TH")} รูป</p>
          <p className="text-xs text-ink-600">
            เก็บเข้าที่เก็บไฟล์ของเรา (ตัดพื้นหลังแล้ว) รูปจะไม่หายเมื่อร้านเปลี่ยนลิงก์ และโหลดเร็วขึ้น · ระบบทำเองวันละ 60 รูปทาง cron · กดเพื่อทำเพิ่มครั้งละ ~40 รูป
          </p>
        </div>
        <Btn disabled={!pendingImages}>เก็บรูปเข้าระบบตอนนี้</Btn>
      </form>
      <form action={applyExtractedDims} className="card flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-950">
            เติมขนาดสินค้าจากชื่อ/รายละเอียด: พบ {dimCandidates.length.toLocaleString("th-TH")} ชิ้น
            <span className="ml-1 text-xs font-normal text-ink-600">(มีขนาดแล้ว {db.products.filter((p) => p.dimensions).length.toLocaleString("th-TH")} / {db.products.length.toLocaleString("th-TH")})</span>
          </p>
          <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-ink-600">
            {dimCandidates.slice(0, 8).map((p) => {
              const d = extractDimensions([p.name, p.description, ...Object.values(p.specs ?? {})].join(" "), p.category)!;
              return (
                <li key={p.id} className="truncate">
                  {p.name.slice(0, 60)} → {d.width ?? "?"} × {d.depth ?? "?"} × {d.height ?? "?"} ซม.
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-[11px] text-ink-500">ใช้กับห้อง 3D และการเช็กว่าของใส่ห้องได้ · ดูตัวอย่างด้านบนก่อนกด</p>
        </div>
        <Btn disabled={!dimCandidates.length}>เติมขนาดทั้งหมด</Btn>
      </form>
      {(Object.keys(ISSUE_LABELS) as IssueKey[]).map((k) => {
        const list = audit[k];
        return (
          <details key={k} className="card p-4" open={list.length > 0 && list.length <= 20}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
              <span className="font-semibold text-ink-950">{ISSUE_LABELS[k]}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${list.length ? "bg-warn-bg text-ink-950" : "bg-ok-bg text-ok"}`}>{list.length}</span>
            </summary>
            {list.length > 0 && (
              <div className="mt-3 space-y-2">
                <form action={hideProducts}>
                  <input type="hidden" name="ids" value={list.map((p) => p.id).join(",")} />
                  <Btn danger>ซ่อนทั้ง {list.length} ชิ้นจากหน้าเว็บ</Btn>
                </form>
                <ul className="max-h-80 divide-y divide-ink-100 overflow-y-auto text-sm">
                  {list.slice(0, 200).map((p) => (
                    <li key={p.id} className="flex items-center gap-2 py-1.5">
                      <Link href={`/products/${p.id}`} className="min-w-0 flex-1 truncate hover:text-info">
                        {p.name}
                      </Link>
                      <span className="shrink-0 text-xs text-ink-600">
                        {formatTHB(p.price)} · {p.storeName || p.platform}
                      </span>
                      <form action={hideProducts}>
                        <input type="hidden" name="ids" value={p.id} />
                        <Btn>ซ่อน</Btn>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
