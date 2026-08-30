import { runDoctor } from "@/lib/commerce/system/installation.server";
const rows = await runDoctor();
for (const r of rows) console.log(`${r.status.padEnd(15)} ${r.check} — ${r.detail}`);
