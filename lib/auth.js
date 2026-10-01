import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "admin_session";

function token() {
  const pw = process.env.ADMIN_PASSWORD || "change-me";
  return crypto.createHmac("sha256", pw).update("portfolio-admin").digest("hex");
}

export function checkPassword(input) {
  const pw = process.env.ADMIN_PASSWORD || "change-me";
  const a = Buffer.from(String(input));
  const b = Buffer.from(pw);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function setSession() {
  const jar = await cookies();
  jar.set(COOKIE, token(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAdmin() {
  const jar = await cookies();
  return jar.get(COOKIE)?.value === token();
}
