import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb, writeDb } from "@/lib/data/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

type SavedBuild = { id: string; name: string; selection: Record<string, string | null>; createdAt: string };
const SLOTS = ["cpu", "gpu", "motherboard", "ram", "storage", "cooler", "psu", "case", "monitor"];

/** ห้อง + สเปกคอมที่สมาชิกบันทึกไว้ — ซิงก์ข้ามเครื่อง */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const s = readDb().saved[user.id] ?? { rooms: [], builds: [] };
  return NextResponse.json({ ok: true, ...s });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!rateLimit(`saved:${user.id}:${clientIp(request)}`, 30, 60_000).ok) return NextResponse.json({ ok: false }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { rooms?: unknown; builds?: unknown };
  const db = readDb();
  const roomIds = new Set(db.rooms.map((r) => r.id));
  const rooms = (Array.isArray(body.rooms) ? body.rooms : []).filter((x): x is string => typeof x === "string" && roomIds.has(x)).slice(0, 200);
  const builds: SavedBuild[] = (Array.isArray(body.builds) ? body.builds : [])
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
    .slice(0, 50)
    .map((b) => {
      const sel = (b.selection && typeof b.selection === "object" ? b.selection : {}) as Record<string, unknown>;
      return {
        id: String(b.id ?? "").slice(0, 60),
        name: String(b.name ?? "สเปกของฉัน").slice(0, 80),
        createdAt: String(b.createdAt ?? new Date().toISOString()).slice(0, 30),
        selection: Object.fromEntries(SLOTS.map((k) => [k, typeof sel[k] === "string" ? String(sel[k]).slice(0, 80) : null])),
      };
    })
    .filter((b) => b.id);
  const next = { rooms, builds };
  if (JSON.stringify(db.saved[user.id] ?? null) !== JSON.stringify(next)) {
    db.saved = { ...db.saved, [user.id]: next };
    writeDb(db);
  }
  return NextResponse.json({ ok: true });
}
