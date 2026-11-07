import type { Metadata } from "next";
import { readDb } from "@/lib/data/store";
import { NewCaseForm } from "@/components/returns/NewCaseForm";
import { PageIntro } from "@/components/PageIntro";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "แจ้งปัญหาสินค้า", robots: { index: false } };

export default async function NewCasePage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product } = await searchParams;
  const db = readDb();
  const stores = db.partners
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      name: p.name,
      products: db.products.filter((x) => x.partnerId === p.id).map((x) => ({ id: x.id, name: x.name })),
    }));
  const pre = product ? db.products.find((p) => p.id === product && p.partnerId) : undefined;

  return (
    <div className="container-page max-w-2xl space-y-5 py-8">
      <div className="space-y-2">
        <p className="eyebrow">ReturnEase · แจ้งปัญหา</p>
        <h1 className="font-display text-2xl font-bold text-ink-950 sm:text-3xl">แจ้งปัญหาสินค้า</h1>
        <PageIntro what="ใช้ได้กับสินค้าจากร้านพาร์ตเนอร์ของ ComproNext" next="กรอก 4 ข้อ แนบรูป แล้วกดส่ง ร้านจะเห็นเรื่องทันที" />
      </div>
      <NewCaseForm stores={stores} initialStoreId={pre?.partnerId ?? null} initialProductId={pre?.id ?? null} />
    </div>
  );
}
