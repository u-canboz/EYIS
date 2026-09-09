/** Zuletzt angesehene Produkte — nur Handles, ausschließlich im Browser. */
const KEY = "storefront.recently-viewed";
const MAX = 8;

export function readRecentlyViewed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function rememberProduct(handle: string): void {
  if (typeof window === "undefined" || !handle) return;
  try {
    const next = [handle, ...readRecentlyViewed().filter((h) => h !== handle)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Speicher nicht verfügbar — Funktion ist rein optional. */
  }
}
