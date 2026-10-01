import { isAdmin } from "@/lib/auth";
import { USE_BLOB, clearSlides, guardWrite, listSlideData, sanitizeLinks } from "@/lib/store";
import { commitSlides, isBlobUrl } from "@/lib/blob-store";
import { addSlide, clearSlides as clearLocalSlides, MIME } from "@/lib/local-store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ slides: await listSlideData() });
}

// Blob mode: JSON { mode, slides: [{ src, links }] } where each src is an image
// the browser already uploaded to Vercel Blob.
// Local mode: multipart form data with one or more "files" (images, in order),
// a "links" entry per file (JSON array of link regions, same order) and "mode".
// mode is "replace" (default) or "append".
export async function POST(req) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return guardWrite(() => (USE_BLOB ? commitBlob(req) : uploadLocal(req)));
}

async function commitBlob(req) {
  const body = await req.json().catch(() => null);
  const incoming = Array.isArray(body?.slides) ? body.slides : [];
  if (!incoming.length || incoming.some((s) => !isBlobUrl(s?.src))) {
    return Response.json({ error: "잘못된 슬라이드 정보입니다" }, { status: 400 });
  }
  const slides = incoming.map((s) => ({ src: s.src, links: sanitizeLinks(s.links) }));
  return Response.json({ slides: await commitSlides(body.mode === "append" ? "append" : "replace", slides) });
}

async function uploadLocal(req) {
  const form = await req.formData();
  const files = form.getAll("files").filter((f) => typeof f === "object");
  if (!files.length) return Response.json({ error: "업로드할 파일이 없습니다" }, { status: 400 });

  const exts = files.map((f) => Object.keys(MIME).find((k) => MIME[k] === f.type));
  if (exts.some((e) => !e)) {
    return Response.json({ error: "이미지 파일만 업로드할 수 있습니다" }, { status: 400 });
  }

  const links = form.getAll("links");
  const parse = (v) => {
    try {
      return sanitizeLinks(JSON.parse(v));
    } catch {
      return [];
    }
  };

  if (form.get("mode") !== "append") await clearLocalSlides();
  for (let i = 0; i < files.length; i++) {
    const ext = exts[i] === "jpeg" ? "jpg" : exts[i];
    await addSlide(Buffer.from(await files[i].arrayBuffer()), ext, parse(links[i]));
  }
  return Response.json({ slides: await listSlideData() });
}

export async function DELETE() {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return guardWrite(async () => {
    await clearSlides();
    return Response.json({ slides: [] });
  });
}
