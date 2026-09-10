import { fetchSignedReleases } from "../src/lib/commerce/updates/registry.server";
const r = await fetchSignedReleases();
console.log("rejected", JSON.stringify(r.rejected, null, 1));
for (const rel of r.releases) console.log(rel.version, JSON.stringify({ch:(rel as any).channel, manual:(rel as any).requiresManualStep, min:(rel as any).minFromVersion, mig:(rel as any).migrations}));
