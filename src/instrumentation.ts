export async function register() {
  // โหลดข้อมูลจาก Postgres เข้าแคชก่อนรับ request แรก (เมื่อตั้ง DATABASE_URL)
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DATABASE_URL) {
    const { loadFromPostgres } = await import("./lib/data/store");
    try {
      await loadFromPostgres();
    } catch (err) {
      console.error("[db] initial Postgres load failed", err);
    }
  }
}

/** error ฝั่งเซิร์ฟเวอร์ทุกจุด → บันทึกให้แอดมินดู + แจ้งเตือน webhook */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string }
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logOps } = await import("./lib/ops-log");
  const e = err as { message?: string; digest?: string; stack?: string };
  await logOps({
    kind: "error",
    title: `${request.method} ${request.path.split("?")[0]} — ${(e.message || String(err)).slice(0, 160)}`,
    detail: [context.routeType && `ประเภท: ${context.routeType} ${context.routePath ?? ""}`, e.digest && `digest: ${e.digest}`, e.stack?.split("\n").slice(0, 6).join("\n")].filter(Boolean).join("\n"),
  });
}
