import { NextResponse } from "next/server";
import { checkPasswordPolicy } from "@/lib/admin/password-policy";
import { AdminError } from "@/lib/admin/types";

const STATUS: Record<string, number> = {
  weak_password: 400,
  invalid: 400,
  self: 403,
  last_superadmin: 403,
  bad_token: 403,
  not_found: 404,
  exists: 409,
  setup_closed: 409,
  wrong_password: 401,
};

/** Maps AdminError to the contract HTTP response; unknown errors become a generic 500. */
export function adminErrorResponse(
  err: unknown,
  pw?: { password?: string; username?: string; email?: string }
): NextResponse {
  if (err instanceof AdminError) {
    const body: { ok: false; error: string; code: string; errors?: string[] } = {
      ok: false,
      error: err.message,
      code: err.code,
    };
    if (err.code === "weak_password") {
      body.errors = checkPasswordPolicy(pw?.password ?? "", {
        username: pw?.username,
        email: pw?.email,
      }).errors;
    }
    return NextResponse.json(body, { status: STATUS[err.code] ?? 400 });
  }
  return NextResponse.json({ ok: false, error: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 });
}
