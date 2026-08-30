import { admin, readState } from "./lib";
import { resolveFromDatabase } from "@/lib/commerce/pricing.server";
const s = readState();
const { data: p } = await admin.from("products").select("id").ilike("handle","qa-smoke-%").limit(1).maybeSingle();
console.log("product", p);
const { data: v } = await admin.from("product_variants").select("id").eq("product_id", (p as any).id).limit(1).maybeSingle();
console.log("variant", v);
const { data: ps } = await admin.from("price_sets").select("*").eq("variant_id",(v as any).id);
console.log("price_sets", ps);
const { data: pr } = await admin.from("prices").select("*").eq("price_set_id",(ps as any)[0].id);
console.log("prices", pr);
try {
  const r = await resolveFromDatabase(admin as never, s["orgA"]!, { shopId: s["shopA"]!, productId: (p as any).id, variantId: (v as any).id, quantity: 1, currencyCode: undefined, customerGroupId: null, promotionCodes: [] } as never);
  console.log("resolved", r);
} catch(e){ console.log("throw", e); }
