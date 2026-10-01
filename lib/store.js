import * as blob from "./blob-store";
import * as local from "./local-store";

// Vercel Blob in production (when the store is connected, Vercel sets
// BLOB_READ_WRITE_TOKEN); the local /data folder otherwise.
export const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const backend = USE_BLOB ? blob : local;

export const getSettings = () => backend.getSettings();
export const saveSettings = (settings) => backend.saveSettings(settings);
export const listSlideData = () => backend.listSlideData();
export const clearSlides = () => backend.clearSlides();

export { DEFAULT_SETTINGS, normalizeSettings, sanitizeLinks } from "./settings";
