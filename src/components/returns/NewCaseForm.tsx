"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { useSession } from "@/lib/use-session";
import { EmailOtpLogin } from "@/components/EmailOtpLogin";
import EmptyState from "@/components/EmptyState";
import { CASE_TYPES, CASE_WISHES, type CaseType, type CaseWish } from "@/lib/returns";
import { EvidencePicker } from "./EvidencePicker";

type Store = { id: string; name: string; products: Array<{ id: string; name: string }> };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-1 flex items-center gap-2 font-semibold text-ink-950">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-info text-xs font-bold text-white">{n}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/** ระบบแจ้งปัญหา: เลือกร้าน+สินค้า → ปัญหาอะไร → อยากให้ร้านทำอะไร → เล่า + แนบรูป */
export function NewCaseForm({ stores, initialStoreId, initialProductId }: { stores: Store[]; initialStoreId: string | null; initialProductId: string | null }) {
  const { user } = useSession();
  const router = useRouter();
  const [storeId, setStoreId] = useState(initialStoreId ?? stores[0]?.id ?? "");
  const [productId, setProductId] = useState(initialProductId ?? "");
  const [productName, setProductName] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [type, setType] = useState<CaseType>("defect");
  const [wish, setWish] = useState<CaseWish>("replace");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user)
    return (
      <div className="mx-auto max-w-md">
        <p className="mb-3 text-center text-sm text-ink-600">เข้าสู่ระบบก่อนแจ้งปัญหา ร้านจะได้ติดต่อกลับได้</p>
        <EmailOtpLogin />
      </div>
    );
  if (!stores.length) return <EmptyState title="ยังไม่มีร้านพาร์ตเนอร์ที่รับเรื่อง" description="สินค้าจากร้านอื่น ติดต่อร้านที่ซื้อโดยตรงได้เลย" />;

  const store = stores.find((s) => s.id === storeId);
  const needPhoto = type === "defect" || type === "damaged" || type === "wrong_item";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (needPhoto && !evidence.length) return setError("ปัญหาแบบนี้ต้องแนบรูปอย่างน้อย 1 รูป ร้านจะตรวจได้เร็วขึ้น");
    setBusy(true);
    const r = await fetch("/api/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId: storeId, productId: productId || null, productName, orderRef, type, wish, description, evidence }),
    })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: "ส่งไม่สำเร็จ เช็กอินเทอร์เน็ต" }));
    setBusy(false);
    if (!r.ok) return setError(r.error || "ส่งไม่สำเร็จ");
    router.push(`/returns/${r.case.code}?new=1`);
  }

  return (
    <form onSubmit={submit} className="card space-y-6 p-5 sm:p-6">
      <Step n={1} title="ซื้อจากร้านไหน สินค้าอะไร">
        <select aria-label="ร้าน" value={storeId} onChange={(e) => { setStoreId(e.target.value); setProductId(""); }} className="input h-11 w-full">
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select aria-label="สินค้า" value={productId} onChange={(e) => setProductId(e.target.value)} className="input h-11 w-full">
          <option value="">— สินค้าไม่อยู่ในรายการ (พิมพ์ชื่อเอง) —</option>
          {store?.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {!productId && <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="ชื่อสินค้า" className="input h-11 w-full" required maxLength={200} />}
        <input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} placeholder="เลขคำสั่งซื้อ (ถ้ามี — ช่วยให้ร้านหาเจอเร็ว)" className="input h-11 w-full" maxLength={80} />
      </Step>

      <Step n={2} title="ปัญหาคืออะไร">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CASE_TYPES) as CaseType[]).map((k) => (
            <button key={k} type="button" data-active={type === k} onClick={() => setType(k)} className="chip min-h-11">
              {CASE_TYPES[k]}
            </button>
          ))}
        </div>
      </Step>

      <Step n={3} title="อยากให้ร้านช่วยอย่างไร">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CASE_WISHES) as CaseWish[]).map((k) => (
            <button key={k} type="button" data-active={wish === k} onClick={() => setWish(k)} className="chip min-h-11">
              {CASE_WISHES[k]}
            </button>
          ))}
        </div>
      </Step>

      <Step n={4} title="เล่าปัญหา + แนบรูปหลักฐาน">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder="เช่น เปิดเครื่องแล้วไฟไม่ติด ลองเปลี่ยนสาย/ปลั๊กแล้ว ได้รับของเมื่อวาน"
          className="input w-full py-2.5"
        />
        <p className="text-xs text-ink-600">{needPhoto ? "ต้องมีรูปอย่างน้อย 1 รูป: " : "แนะนำ: "}รูปตัวสินค้า จุดที่เสีย กล่อง/ใบปะหน้า (สูงสุด 6 รูป)</p>
        <EvidencePicker value={evidence} onChange={setEvidence} />
      </Step>

      {error && (
        <p role="alert" className="rounded-xl bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn btn-primary h-12 w-full rounded-full disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ส่งเรื่องให้ร้าน
      </button>
    </form>
  );
}
