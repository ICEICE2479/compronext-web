"use client";

import { BoostButton, type BoostState } from "./BoostButton";
import { useRef, useState } from "react";
import { useFocusTrap } from "@/components/useFocusTrap";
import { Box, ExternalLink, Eye, ImagePlus, Loader2, Pencil, Plus, ShoppingCart, Sparkles, Trash2, Truck, X } from "lucide-react";
import type { Product, ProductCategory } from "@/lib/types";
import { PRODUCT_CATEGORIES } from "@/lib/types";
import { CATEGORY_LABELS, formatTHB } from "@/lib/format";
import { ProductVisual } from "@/components/ProductVisual";
import { Auto3DButton } from "@/components/Auto3DButton";
import { PartnerCsvUpload } from "@/components/PartnerCsvUpload";

type Draft = {
  id?: string;
  name: string;
  category: ProductCategory;
  price: string;
  description: string;
  buyUrl: string;
  imageUrl: string;
  modelUrl: string;
  status: "available" | "out_of_stock";
  published: boolean;
};

const EMPTY: Draft = {
  name: "",
  category: "decor",
  price: "",
  description: "",
  buyUrl: "",
  imageUrl: "",
  modelUrl: "",
  status: "available",
  published: true,
};

function toDraft(p: Product): Draft {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: String(p.price),
    description: p.description,
    buyUrl: p.buyUrl,
    imageUrl: p.imageUrl ?? "",
    modelUrl: p.modelUrl ?? "",
    status: p.status === "out_of_stock" ? "out_of_stock" : "available",
    published: p.published !== false,
  };
}

type Stats = Record<string, { views: number; carts: number; aiPicks: number; clicks: number }>;

export function PartnerClient({
  partnerName,
  initialProducts,
  stats = {},
  shipping = { fee: null, freeMin: null },
  boosts = {},
  boostPrices = null,
}: {
  boosts?: Record<string, Exclude<BoostState, null>>;
  boostPrices?: Record<number, number> | null;
  partnerName: string;
  initialProducts: Product[];
  stats?: Stats;
  shipping?: { fee: number | null; freeMin: number | null };
}) {
  const [ship, setShip] = useState({ fee: shipping.fee?.toString() ?? "", freeMin: shipping.freeMin?.toString() ?? "" });
  const [shipSaved, setShipSaved] = useState(false);

  async function saveShipping(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/partner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_shipping", shippingFee: ship.fee, freeShippingMin: ship.freeMin }),
    });
    const data = await res.json().catch(() => ({ ok: false }));
    if (!data.ok) return setError(data.error || "บันทึกค่าส่งไม่สำเร็จ");
    setShipSaved(true);
    window.setTimeout(() => setShipSaved(false), 1500);
  }

  const [products, setProducts] = useState(initialProducts);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  useFocusTrap(dialogRef, draft !== null, () => setDraft(null));

  async function upload(file: File | undefined, kind: "image" | "model") {
    if (!file || !draft) return;
    setBusy(kind);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({ ok: false }));
    setBusy(null);
    if (!data.ok) return setError(data.error || "อัปโหลดไม่สำเร็จ");
    setDraft((d) => (d ? { ...d, [kind === "image" ? "imageUrl" : "modelUrl"]: data.file.url } : d));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy("save");
    setError(null);
    const res = await fetch("/api/partner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert_product", product: { ...draft, price: Number(draft.price) } }),
    });
    const data = await res.json().catch(() => ({ ok: false }));
    setBusy(null);
    if (!data.ok) return setError(data.error || "บันทึกไม่สำเร็จ");
    setProducts((list) =>
      list.some((p) => p.id === data.product.id)
        ? list.map((p) => (p.id === data.product.id ? data.product : p))
        : [data.product, ...list]
    );
    setDraft(null);
  }

  async function remove(id: string) {
    if (!window.confirm("ลบสินค้านี้?")) return;
    const res = await fetch("/api/partner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_product", productId: id }),
    });
    if ((await res.json().catch(() => ({}))).ok) setProducts((l) => l.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">
          ร้าน <strong className="text-ink-950">{partnerName}</strong> · {products.length} สินค้า
        </p>
        <button type="button" className="icon-btn icon-btn-primary" onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="h-4 w-4" /> <span className="text-sm font-semibold">เพิ่มสินค้า</span>
        </button>
      </div>

      {products.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ["views", "ยอดดู", Eye],
            ["carts", "ใส่ตะกร้า", ShoppingCart],
            ["aiPicks", "AI เลือกไปจัดห้อง", Sparkles],
            ["clicks", "คลิกไปร้าน", ExternalLink],
          ] as const).map(([key, label, Icon]) => (
            <div key={key} className="card p-4">
              <Icon className="h-5 w-5 text-info" />
              <p className="mt-2 font-display text-2xl font-bold text-ink-950">
                {products.reduce((sum, p) => sum + (stats[p.id]?.[key] ?? 0), 0).toLocaleString()}
              </p>
              <p className="text-xs text-ink-600">{label}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={saveShipping} className="card flex flex-wrap items-end gap-3 p-4">
        <Truck className="mb-2.5 h-5 w-5 text-info" />
        <label className="space-y-1 text-xs text-ink-600">
          ค่าส่ง (บาท/ออเดอร์)
          <input type="number" min={0} inputMode="numeric" className="input w-36" placeholder="ไม่ระบุ" value={ship.fee} onChange={(e) => setShip({ ...ship, fee: e.target.value })} />
        </label>
        <label className="space-y-1 text-xs text-ink-600">
          ส่งฟรีเมื่อซื้อครบ (บาท)
          <input type="number" min={0} inputMode="numeric" className="input w-36" placeholder="ไม่มี" value={ship.freeMin} onChange={(e) => setShip({ ...ship, freeMin: e.target.value })} />
        </label>
        <button type="submit" className="icon-btn tap-target">{shipSaved ? "บันทึกแล้ว" : "บันทึกค่าส่ง"}</button>
        {error && !draft && <p className="w-full text-xs font-semibold text-bad">{error}</p>}
      </form>

      <PartnerCsvUpload products={products} onSaved={setProducts} />

      {products.length === 0 ? (
        <div className="card empty-state" role="status">
          <Plus className="h-8 w-8 text-ink-500" aria-hidden="true" />
          <p className="font-semibold text-ink-900">ยังไม่มีสินค้า</p>
          <p className="text-sm text-ink-600">กด “เพิ่มสินค้า” เพื่อเริ่มลงขาย</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {products.map((p) => (
            <li key={p.id} className="card flex items-center gap-3 p-3">
              <ProductVisual productId={p.id} name={p.name} category={p.category} imageUrl={p.imageUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-ink-950">{p.name}</p>
                <p className="text-xs text-ink-600">
                  {CATEGORY_LABELS[p.category]} · {formatTHB(p.price)}
                  {p.modelUrl && " · 3D"}
                  {p.published === false && " · ซ่อนอยู่"}
                  {p.status === "out_of_stock" && " · ของหมด"}
                </p>
                {!p.modelUrl && p.imageUrl && (
                  <div className="mt-1.5">
                    <Auto3DButton
                      productId={p.id}
                      pending={!!p.model3dTaskId}
                      onDone={(modelUrl) => setProducts((l) => l.map((x) => (x.id === p.id ? { ...x, modelUrl, model3dTaskId: null } : x)))}
                    />
                  </div>
                )}
                <div className="mt-1">
                  <BoostButton productId={p.id} status={boosts[p.id] ?? null} prices={boostPrices} />
                </div>
                {stats[p.id] && (
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-600">
                    <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{stats[p.id].views}</span>
                    <span className="inline-flex items-center gap-1"><ShoppingCart className="h-3 w-3" />{stats[p.id].carts}</span>
                    <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" />{stats[p.id].aiPicks}</span>
                    <span className="inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" />{stats[p.id].clicks}</span>
                  </p>
                )}
              </div>
              <button type="button" className="icon-btn tap-target" aria-label={`แก้ไข ${p.name}`} onClick={() => setDraft(toDraft(p))}>
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" className="icon-btn tap-target" aria-label={`ลบ ${p.name}`} onClick={() => remove(p.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <form ref={dialogRef} onSubmit={save} aria-label={draft.id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"} className="max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-2xl bg-white p-5 shadow-[var(--shadow-pop)] sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink-950">{draft.id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</h2>
              <button type="button" className="icon-btn tap-target border-transparent" aria-label="ปิด" onClick={() => setDraft(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 block">
                <span className="label">ชื่อสินค้า</span>
                <input className="input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="block">
                <span className="label">หมวด</span>
                <select className="select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as ProductCategory })}>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">ราคา (บาท)</span>
                <input className="input" type="number" min={1} required value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
              </label>
              <label className="col-span-2 block">
                <span className="label">ลิงก์หน้าสินค้าในร้านของคุณ</span>
                <input className="input" type="url" required placeholder="https://" value={draft.buyUrl} onChange={(e) => setDraft({ ...draft, buyUrl: e.target.value })} />
              </label>
              <label className="col-span-2 block">
                <span className="label">รายละเอียดสั้นๆ</span>
                <textarea className="input resize-none" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="icon-btn h-auto flex-col gap-1 rounded-xl py-3 text-center">
                {busy === "image" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <span className="text-xs font-semibold">{draft.imageUrl ? "เปลี่ยนรูป ✓" : "รูปสินค้า"}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0], "image")} />
              </label>
              <label className="icon-btn h-auto flex-col gap-1 rounded-xl py-3 text-center">
                {busy === "model" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Box className="h-5 w-5" />}
                <span className="text-xs font-semibold">{draft.modelUrl ? "เปลี่ยน 3D ✓" : "ไฟล์ 3D (.glb)"}</span>
                <input type="file" accept=".glb,model/gltf-binary" hidden onChange={(e) => upload(e.target.files?.[0], "model")} />
              </label>
            </div>
            <p className="text-xs text-ink-600">ไฟล์ 3D ใช้ให้ลูกค้าหมุนดูและวางในห้องจริงผ่าน AR · .glb ไม่เกิน 25MB</p>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={draft.status === "available"} onChange={(e) => setDraft({ ...draft, status: e.target.checked ? "available" : "out_of_stock" })} />
                มีของพร้อมขาย
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} />
                แสดงบนเว็บ
              </label>
            </div>

            {error && <p role="alert" className="rounded-lg bg-bad-bg p-3 text-sm font-semibold text-bad">{error}</p>}
            <button type="submit" disabled={busy !== null} aria-busy={busy === "save"} className="btn btn-primary w-full py-2.5">
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              บันทึก
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
