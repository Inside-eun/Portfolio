import { checkPassword, setSession, clearSession } from "@/lib/auth";

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  if (!checkPassword(password ?? "")) {
    return Response.json({ error: "비밀번호가 올바르지 않습니다" }, { status: 401 });
  }
  await setSession();
  return Response.json({ ok: true });
}

export async function DELETE() {
  await clearSession();
  return Response.json({ ok: true });
}
