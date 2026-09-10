export const SETUP_STEPS = [
  "company",
  "shop",
  "administrator",
  "taxes",
  "invoices",
  "payments",
  "email",
  "shipping",
  "storefront",
  "systemcheck",
] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export function setupBlockers(checks: Array<{ check: string; status: string }>) {
  return checks.filter((check) => check.check !== "Setup" && check.status !== "PASS");
}

export function normalizeStorefrontOrigin(input: string, environment: string): string {
  const url = new URL(input);
  if (!["development", "staging", "production"].includes(environment))
    throw new Error("Die Umgebung muss vor dem Speichern festgelegt sein.");
  if (url.username || url.password || !["http:", "https:"].includes(url.protocol))
    throw new Error("Bitte eine HTTP- oder HTTPS-Adresse ohne Zugangsdaten eingeben.");
  if (environment === "production" && url.protocol !== "https:")
    throw new Error("Die produktive Storefront benötigt HTTPS.");
  return url.origin;
}
