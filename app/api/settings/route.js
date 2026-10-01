import { isAdmin } from "@/lib/auth";
import { getSettings, guardWrite, saveSettings, normalizeSettings } from "@/lib/store";

export async function GET() {
  return Response.json(await getSettings());
}

export async function PUT(req) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const settings = normalizeSettings(await req.json().catch(() => null));
  return guardWrite(async () => {
    await saveSettings(settings);
    return Response.json(settings);
  });
}
