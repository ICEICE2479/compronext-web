import type { Metadata } from "next";
import { CaseDetail } from "@/components/returns/CaseDetail";

export const metadata: Metadata = { title: "ติดตามเคส", robots: { index: false } };

export default async function CasePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ new?: string }> }) {
  const { code } = await params;
  const { new: isNew } = await searchParams;
  return (
    <div className="container-page max-w-3xl py-8">
      <CaseDetail code={decodeURIComponent(code)} justCreated={isNew === "1"} />
    </div>
  );
}
