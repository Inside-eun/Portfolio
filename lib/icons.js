// Shared by the server (validation) and the client (admin picker, contact page).
export const ICON_LABELS = {
  auto: "자동 (링크로 판단)",
  phone: "전화",
  mail: "메일",
  blog: "블로그",
  web: "웹사이트",
  github: "GitHub",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  location: "위치",
  link: "링크",
};

export const ICONS = Object.keys(ICON_LABELS);

// Picks an icon from the link when the admin left it on "auto".
export function resolveIcon(icon, url = "") {
  if (icon && icon !== "auto") return icon;
  const u = url.toLowerCase();
  if (u.startsWith("tel:")) return "phone";
  if (u.startsWith("mailto:")) return "mail";
  if (u.includes("github.com")) return "github";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("linkedin.com")) return "linkedin";
  if (/(velog|tistory|brunch|blog|medium\.com|notion\.site)/.test(u)) return "blog";
  if (u.includes("maps.")) return "location";
  return u ? "web" : "link";
}
