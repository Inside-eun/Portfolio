import * as blob from "./blob-store";
import * as local from "./local-store";

// Vercel Blob in production (when the store is connected, Vercel sets
// BLOB_READ_WRITE_TOKEN); the local /data folder otherwise.
export const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const backend = USE_BLOB ? blob : local;

// On Vercel the filesystem is read-only, so without a Blob store nothing can be saved.
export const STORAGE_MISSING = Boolean(process.env.VERCEL) && !USE_BLOB;
export const STORAGE_MISSING_MESSAGE =
  "Vercel Blob 저장소가 연결되지 않았습니다. Vercel 프로젝트의 Storage 탭에서 Blob(Public) 저장소를 연결한 뒤 Redeploy 해주세요.";

// Runs a write and turns failures into a JSON error the admin page can show.
export async function guardWrite(fn) {
  if (STORAGE_MISSING) return Response.json({ error: STORAGE_MISSING_MESSAGE }, { status: 503 });
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    return Response.json({ error: `저장 중 오류가 발생했습니다: ${e?.message ?? e}` }, { status: 500 });
  }
}

export const getSettings = () => backend.getSettings();
export const saveSettings = (settings) => backend.saveSettings(settings);
export const listSlideData = () => backend.listSlideData();
export const clearSlides = () => backend.clearSlides();

export { DEFAULT_SETTINGS, normalizeSettings, sanitizeLinks } from "./settings";
