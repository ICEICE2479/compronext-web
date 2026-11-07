"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import type { Product } from "@/lib/types";
import { partnerProductsToCsv } from "@/lib/partner-csv";

type Check = { created: number; updated: number; errors: string[]; saved: boolean; products?: Product[] };

/** อัปโหลดสินค้าทีละเยอะด้วยไฟล์ CSV (Excel / Google Sheets → Save as CSV) — ตรวจก่อน แล้วค่อยยืนยันบันทึก */
export function PartnerCsvUpload({ products, onSaved }: { products: Product[]; onSaved: (list: Product[]) => void }) {
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function send(csvText: string, dryRun: boolean) {
    setBusy(true);
    const res = await fetch("/api/partner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk_csv", csvText, dryRun }),
    });
    const data = (await res.json().catch(() => ({ ok: false }))) as Check & { ok: boolean; error?: string };
    setBusy(false);
    if (!data.ok) return setCheck({ created: 0, updated: 0, errors: [data.error || "อัปโหลดไม่สำเร็จ"], saved: false });
    setCheck(data);
    if (data.saved && data.products) {
      onSaved(data.products);
      setText(null);
      setFileName("");
      if (input.current) input.current.value = "";
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([partnerProductsToCsv(products)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "สินค้าของร้าน.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <details className="card group p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink-950">
        <FileSpreadsheet className="h-5 w-5 text-info" /> อัปโหลดสินค้าทีละเยอะ (CSV)
        <span className="ml-auto text-xs font-normal text-ink-500 group-open:hidden">แตะเพื่อเปิด</span>
      </summary>
      <div className="mt-3 space-y-3 text-sm text-ink-700">
        <ol className="list-decimal space-y-1 pl-5 text-xs text-ink-600">
          <li>ดาวน์โหลดไฟล์ (มีสินค้าเดิมของร้านอยู่แล้ว) เปิดด้วย Excel หรือ Google Sheets</li>
          <li>แก้ราคา/สถานะ หรือเพิ่มแถวใหม่ (เว้นช่อง id ว่าง = สินค้าใหม่) · คอลัมน์ที่ต้องมี: name, price, category, buyUrl</li>
          <li>บันทึกเป็น CSV แล้วเลือกไฟล์ ระบบจะตรวจให้ก่อน แล้วค่อยกดยืนยัน</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={download} className="icon-btn">
            <Download className="h-4 w-4" /> <span className="text-sm font-semibold">ดาวน์โหลดไฟล์</span>
          </button>
          <label className="icon-btn cursor-pointer">
            <Upload className="h-4 w-4" /> <span className="text-sm font-semibold">{fileName || "เลือกไฟล์ CSV"}</span>
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2_000_000) return setCheck({ created: 0, updated: 0, errors: ["ไฟล์ใหญ่เกิน 2MB"], saved: false });
                const t = await f.text();
                setFileName(f.name);
                setText(t);
                send(t, true);
              }}
            />
          </label>
        </div>

        {busy && (
          <p className="flex items-center gap-2 text-xs text-ink-600">
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังตรวจ...
          </p>
        )}
        {check && !busy && (
          <div className={`rounded-xl px-3 py-2 ${check.errors.length ? "bg-warn-bg" : "bg-ok-bg"}`}>
            <p className="font-semibold text-ink-950">
              {check.saved ? "บันทึกแล้ว" : "ผลตรวจ"}: เพิ่มใหม่ {check.created} · แก้ไข {check.updated}
              {check.errors.length > 0 && ` · มีปัญหา ${check.errors.length} แถว (จะข้ามไป)`}
            </p>
            {check.errors.length > 0 && (
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-ink-800">
                {check.errors.slice(0, 50).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {text && check && !check.saved && check.created + check.updated > 0 && (
          <button type="button" disabled={busy} onClick={() => send(text, false)} className="btn btn-primary h-11 w-full rounded-full disabled:opacity-50">
            ยืนยันบันทึก {check.created + check.updated} รายการ
          </button>
        )}
      </div>
    </details>
  );
}
