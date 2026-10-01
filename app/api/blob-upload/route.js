import { handleUpload, handleUploadPresigned } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { isAdmin } from "@/lib/auth";
import { BLOB_OIDC, USE_BLOB, STORAGE_MISSING_MESSAGE } from "@/lib/store";

export const runtime = "nodejs";

const UPLOAD_RULES = {
  allowedContentTypes: ["image/webp", "image/png", "image/jpeg", "image/gif", "image/avif"],
  maximumSizeInBytes: 50 * 1024 * 1024,
};

// The browser picks a unique name under slides/ (see AdminPanel).
const validPathname = (p) => /^slides\/[\w.-]+\.(webp|png|jpe?g|gif|avif)$/i.test(p);

// Lets the admin's browser upload slide images straight to Vercel Blob
// (bypassing the serverless request-size limit). OIDC-connected stores use
// presigned URLs; stores with a read-write token use client tokens.
export async function POST(request) {
  if (!USE_BLOB) return Response.json({ error: STORAGE_MISSING_MESSAGE }, { status: 503 });
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  try {
    const result = BLOB_OIDC
      ? await handleUploadPresigned({
          body,
          request,
          getSignedToken: async (pathname) => {
            if (!validPathname(pathname)) throw new Error("Invalid pathname");
            const token = await issueSignedToken({ pathname, operations: ["put"], ...UPLOAD_RULES });
            return { token, urlOptions: { ...UPLOAD_RULES, addRandomSuffix: false } };
          },
        })
      : await handleUpload({
          body,
          request,
          onBeforeGenerateToken: async (pathname) => {
            if (!validPathname(pathname)) throw new Error("Invalid pathname");
            return { ...UPLOAD_RULES, addRandomSuffix: false };
          },
        });
    return Response.json(result);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 400 });
  }
}
