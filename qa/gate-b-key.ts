/**
 * Erzeugt einen kurzlebigen Publishable Key der Demo-Organisation für die
 * Gate-B-Browser-Harnesses (visuell, Accessibility). Nur Dev/Preview.
 *
 * Aufruf: bun run qa/gate-b-key.ts  → schreibt /tmp/gb/store-key.txt
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { admin } from "./lib";
import { createKey } from "../src/lib/commerce/store/keys.server";

const ORG = process.env["QA_DEMO_ORG"] ?? "5eebb5ba-0a22-4a34-9c28-5dfab7d48924";

const { data: shop, error } = await admin
  .from("shops")
  .select("id")
  .eq("organization_id", ORG)
  .limit(1)
  .maybeSingle();
if (error || !shop) throw new Error(`Kein Shop für Demo-Organisation ${ORG}: ${error?.message}`);

const key = await createKey({
  organizationId: ORG,
  shopId: shop.id,
  name: `gateb-ui-${Date.now()}`,
  environment: "test",
  allowedOrigins: ["*"],
  actorId: null,
});

mkdirSync("/tmp/gb", { recursive: true });
writeFileSync("/tmp/gb/store-key.txt", `${key.key}\n${key.id}\n`);
console.log(key.id);
