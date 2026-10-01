import { ICONS } from "./icons";

export const DEFAULT_SETTINGS = {
  name: "Choi Dam Eun",
  year: "2026",
  title: "Contact Me",
  contacts: [
    { icon: "auto", value: "010 3679 8491", url: "tel:01036798491" },
    { icon: "auto", value: "dameun0808@gmail.com", url: "mailto:dameun0808@gmail.com" },
    { icon: "blog", value: "Blog", url: "" },
  ],
};

const str = (v) => (typeof v === "string" ? v.slice(0, 2000) : "");

// Coerces anything (saved JSON, request bodies) into a valid settings object.
export function normalizeSettings(raw) {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  return {
    name: "name" in raw ? str(raw.name) : DEFAULT_SETTINGS.name,
    year: "year" in raw ? str(raw.year) : DEFAULT_SETTINGS.year,
    title: "title" in raw ? str(raw.title) : DEFAULT_SETTINGS.title,
    contacts: Array.isArray(raw.contacts)
      ? raw.contacts.slice(0, 12).map((c) => ({
          icon: ICONS.includes(c?.icon) ? c.icon : "auto",
          value: str(c?.value),
          url: str(c?.url),
        }))
      : DEFAULT_SETTINGS.contacts,
  };
}

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

// Link regions are fractions of the slide (0–1). External links are limited to
// safe schemes; internal links point at a 0-based slide index.
export function sanitizeLinks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).flatMap((l) => {
    const box = { x: clamp01(l?.x), y: clamp01(l?.y), w: clamp01(l?.w), h: clamp01(l?.h) };
    if (box.w <= 0 || box.h <= 0) return [];
    if (typeof l.url === "string" && /^(https?:|mailto:|tel:)/i.test(l.url) && l.url.length < 2000) {
      return [{ ...box, url: l.url }];
    }
    if (Number.isInteger(l.page) && l.page >= 0) return [{ ...box, page: l.page }];
    return [];
  });
}
