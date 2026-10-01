import { isAdmin } from "@/lib/auth";
import { USE_BLOB, getPdfUrl, guardWrite } from "@/lib/store";
import { isPdfBlobUrl, setPdf } from "@/lib/blob-store";
import { deletePdf, readPdf, savePdf } from "@/lib/local-store";

export const runtime = "nodejs";

// Local mode: serves the saved PDF as a download. (In Blob mode the viewer
// links straight to the Blob URL.)
export async function GET() {
  if (USE_BLOB) {
    const url = await getPdfUrl();
    return url ? Response.redirect(url, 302) : new Response("Not found", { status: 404 });
  }
  try {
    return new Response(await readPdf(), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="portfolio.pdf"',
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

// Blob mode: JSON { url } of a PDF the browser already uploaded under pdf/.
// Local mode: multipart form data with a single "file".
export async function POST(req) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return guardWrite(async () => {
    if (USE_BLOB) {
      const body = await req.json().catch(() => null);
      if (!isPdfBlobUrl(body?.url)) return Response.json({ error: "잘못된 PDF 정보입니다" }, { status: 400 });
      await setPdf(body.url);
    } else {
      const file = (await req.formData()).get("file");
      if (typeof file !== "object" || file?.type !== "application/pdf") {
        return Response.json({ error: "PDF 파일만 올릴 수 있습니다" }, { status: 400 });
      }
      await savePdf(Buffer.from(await file.arrayBuffer()));
    }
    return Response.json({ pdf: await getPdfUrl() });
  });
}

export async function DELETE() {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return guardWrite(async () => {
    if (USE_BLOB) await setPdf(null);
    else await deletePdf();
    return Response.json({ pdf: null });
  });
}
