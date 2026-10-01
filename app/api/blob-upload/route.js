import { handleUpload, handleUploadPresigned } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { isAdmin } from "@/lib/auth";
import { BLOB_OIDC, USE_BLOB, STORAGE_MISSING_MESSAGE } from "@/lib/store";

export const runtime = "nodejs";

const IMAGE_RULES = {
  allowedContentTypes: ["image/webp", "image/png", "image/jpeg", "image/gif", "image/avif"],
  maximumSizeInBytes: 50 * 1024 * 1024,
};
const PDF_RULES = { allowedContentTypes: ["application/pdf"], maximumSizeInBytes: 200 * 1024 * 1024 };

// The browser picks a unique name under slides/ or pdf/ (see AdminPanel).
function rulesFor(pathname) {
  if (/^slides\/[\w.-]+\.(webp|png|jpe?g|gif|avif)$/i.test(pathname)) return IMAGE_RULES;
  if (/^pdf\/[\w.-]+\.pdf$/i.test(pathname)) return PDF_RULES;
  throw new Error("Invalid pathname");
}

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
            const rules = rulesFor(pathname);
            const token = await issueSignedToken({ pathname, operations: ["put"], ...rules });
            return { token, urlOptions: { ...rules, addRandomSuffix: false } };
          },
        })
      : await handleUpload({
          body,
          request,
          onBeforeGenerateToken: async (pathname) => {
            return { ...rulesFor(pathname), addRandomSuffix: false };
          },
        });
    return Response.json(result);
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 400 });
  }
}
