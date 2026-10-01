import fs from "node:fs/promises";
import path from "node:path";
import { SLIDES_DIR, isSafeSlideName, MIME } from "@/lib/local-store";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  const { name } = await params;
  if (!isSafeSlideName(name)) return new Response("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(path.join(SLIDES_DIR, name));
    const ext = name.split(".").pop().toLowerCase();
    return new Response(buf, {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        // URLs are versioned by mtime (see listSlideData), so they can be cached long.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
