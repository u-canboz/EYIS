/**
 * Privacy helpers for the public Store API.
 * IPs are never stored. They are hashed with a salt that rotates every day,
 * so a hash is neither reversible nor linkable across days. The salt itself
 * lives in a table only the backend can read and is dropped after two days.
 */
import { getAdmin } from "../core.server";

let cached: { day: string; salt: string } | null = null;

async function currentSalt(): Promise<string | null> {
  const day = new Date().toISOString().slice(0, 10);
  if (cached && cached.day === day) return cached.salt;
  const admin = await getAdmin();
  const { data, error } = await admin.rpc("store_current_ip_salt" as never);
  if (error || typeof data !== "string") return null;
  cached = { day, salt: data };
  return data;
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? null;
}

/** Non-reversible, day-scoped hash. Returns null when no IP or no salt is available. */
export async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const salt = await currentSalt();
  if (!salt) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${ip}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/** Coarse browser family only — never the raw user agent. */
export function summarizeUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  const family = /bot|crawler|spider/i.test(ua)
    ? "bot"
    : /edg\//i.test(ua)
      ? "edge"
      : /chrome|chromium/i.test(ua)
        ? "chrome"
        : /firefox/i.test(ua)
          ? "firefox"
          : /safari/i.test(ua)
            ? "safari"
            : "other";
  const platform = /android/i.test(ua)
    ? "android"
    : /iphone|ipad|ios/i.test(ua)
      ? "ios"
      : /windows/i.test(ua)
        ? "windows"
        : /mac os/i.test(ua)
          ? "macos"
          : /linux/i.test(ua)
            ? "linux"
            : "other";
  return `${family}/${platform}`;
}
