import { handleUpload } from "@vercel/blob/client";
import { isAdmin } from "@/lib/auth";
import { USE_BLOB, STORAGE_MISSING_MESSAGE } from "@/lib/store";

export const runtime = "nodejs";

// Issues short-lived tokens so the admin's browser can upload slide images
// straight to Vercel Blob (bypassing the serverless request-size limit).
export async function POST(request) {
  if (!USE_BLOB) return Response.json({ error: STORAGE_MISSING_MESSAGE }, { status: 503 });
  const body = await request.json();
  if (body?.type === "blob.generate-client-token" && !(await isAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ["image/webp", "image/png", "image/jpeg", "image/gif", "image/avif"],
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.message === "Unauthorized" ? 401 : 400 });
  }
}
