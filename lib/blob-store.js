import { put, list, del } from "@vercel/blob";
import { unstable_cache, revalidateTag } from "next/cache";
import { normalizeSettings } from "./settings";

// Vercel Blob backend. Slide images are uploaded straight from the browser
// (see /api/blob-upload); this module keeps the site state — settings plus the
// ordered slide list — in a single JSON blob.
//
// Each write creates a new, randomly-suffixed state file and deletes the old
// one, so a blob URL never changes content and CDN caching can't serve stale
// state. Reads are cached by Next and invalidated on every write, so page views
// don't hit the Blob API.

const STATE_PREFIX = "site/state";
const TAG = "portfolio-state";

async function fetchState() {
  const { blobs } = await list({ prefix: STATE_PREFIX });
  if (!blobs.length) return { slides: [] };
  const latest = blobs.reduce((a, b) => (new Date(a.uploadedAt) >= new Date(b.uploadedAt) ? a : b));
  const res = await fetch(latest.url);
  if (!res.ok) throw new Error(`Failed to read site state (${res.status})`);
  const state = await res.json();
  return { ...state, slides: Array.isArray(state.slides) ? state.slides : [] };
}

const cachedState = unstable_cache(fetchState, [TAG], { tags: [TAG] });

// Page views fall back to an empty deck rather than crashing if Blob is unreachable.
async function readState() {
  try {
    return await cachedState();
  } catch (e) {
    console.error("Failed to read portfolio state from Vercel Blob", e);
    return { slides: [] };
  }
}

async function writeState(state) {
  const { blobs: old } = await list({ prefix: STATE_PREFIX });
  await put(`${STATE_PREFIX}.json`, JSON.stringify(state), {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/json",
  });
  if (old.length) await del(old.map((b) => b.url));
  revalidateTag(TAG, { expire: 0 });
}

// Only URLs in a Vercel Blob store are accepted as slide sources.
export function isBlobUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

async function deleteImages(slides) {
  const urls = slides.map((s) => s.src).filter(isBlobUrl);
  if (urls.length) await del(urls);
}

export async function getSettings() {
  return normalizeSettings((await readState()).settings);
}

export async function saveSettings(settings) {
  const state = await fetchState();
  await writeState({ ...state, settings });
}

export async function listSlideData() {
  return (await readState()).slides;
}

// mode "replace" swaps the whole deck (and deletes the old images);
// "append" adds to the end.
export async function commitSlides(mode, newSlides) {
  const state = await fetchState();
  const slides = mode === "append" ? [...state.slides, ...newSlides] : newSlides;
  await writeState({ ...state, slides });
  if (mode !== "append") await deleteImages(state.slides);
  return slides;
}

export async function clearSlides() {
  const state = await fetchState();
  await writeState({ ...state, slides: [] });
  await deleteImages(state.slides);
}
