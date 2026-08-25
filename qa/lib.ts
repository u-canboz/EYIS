/* QA harness helpers — temporary, removed after the phase 5 acceptance run. */
import { createClient } from "@supabase/supabase-js";

export const admin = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const results: { name: string; ok: boolean; detail: string }[] = [];

export function check(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

export async function expectThrow(name: string, fn: () => Promise<unknown>, match?: RegExp) {
  try {
    await fn();
    check(name, false, "kein Fehler geworfen");
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check(name, match ? match.test(msg) : true, msg.slice(0, 160));
    return msg;
  }
}

export function readState(): Record<string, string> {
  return JSON.parse(require("fs").readFileSync("qa/state.json", "utf8"));
}
export function writeState(s: Record<string, string>) {
  require("fs").writeFileSync("qa/state.json", JSON.stringify(s, null, 2));
}

export function summary() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n== ${results.length - failed.length}/${results.length} PASS ==`);
  if (failed.length) {
    console.log(failed.map((f) => `FAILED: ${f.name} — ${f.detail}`).join("\n"));
    process.exitCode = 1;
  }
}
