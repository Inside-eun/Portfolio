import fs from "node:fs/promises";
import path from "node:path";
import { normalizeSettings, DEFAULT_SETTINGS } from "./settings";

// Local backend: uploaded slides and site settings live on disk under /data.
// Used when no Vercel Blob token is configured (e.g. local development).
export const DATA_DIR = process.env.PORTFOLIO_DATA_DIR || path.join(process.cwd(), "data");
export const SLIDES_DIR = path.join(DATA_DIR, "slides");
const SETTINGS_FILE = path.join(DATA_DIR, "site.json");

export async function getSettings() {
  try {
    return normalizeSettings(JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8")));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)$/i;

export async function listSlides() {
  try {
    const files = await fs.readdir(SLIDES_DIR);
    return files.filter((f) => IMAGE_EXT.test(f)).sort();
  } catch {
    return [];
  }
}

// Each slide: a versioned image URL (mtime, so a re-upload never serves a stale
// cached image) plus any clickable regions saved from the source PDF.
export async function listSlideData() {
  const names = await listSlides();
  return Promise.all(
    names.map(async (n) => {
      const { mtimeMs } = await fs.stat(path.join(SLIDES_DIR, n));
      let links = [];
      try {
        links = JSON.parse(await fs.readFile(path.join(SLIDES_DIR, metaName(n)), "utf8")).links ?? [];
      } catch {}
      return { src: `/api/slides/${n}?v=${Math.round(mtimeMs)}`, links };
    })
  );
}

const metaName = (imageName) => imageName.replace(/\.[^.]+$/, ".json");

export async function clearSlides() {
  await fs.rm(SLIDES_DIR, { recursive: true, force: true });
  await fs.mkdir(SLIDES_DIR, { recursive: true });
}

// Slide files are named by zero-padded order, e.g. 0003.webp
export async function addSlide(buffer, ext, links = []) {
  await fs.mkdir(SLIDES_DIR, { recursive: true });
  const existing = await listSlides();
  const next = existing.length ? parseInt(existing[existing.length - 1], 10) + 1 : 1;
  const name = `${String(next).padStart(4, "0")}.${ext}`;
  await fs.writeFile(path.join(SLIDES_DIR, name), buffer);
  if (links.length) {
    await fs.writeFile(path.join(SLIDES_DIR, metaName(name)), JSON.stringify({ links }));
  }
  return name;
}

export function isSafeSlideName(name) {
  return /^\d{4}\.(png|jpe?g|webp|gif|avif)$/i.test(name);
}

export const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};
