/**
 * Phase-16 UI-Harness (Runner).
 *
 * Die Viewport-Matrix wird mit Playwright gefahren; der eigentliche Lauf liegt in
 * `qa/phase16-ui.py`, weil in dieser Umgebung ausschließlich das Python-Playwright
 * mit gebündeltem Chromium verfügbar ist.
 *
 * Nur gegen Dev/Preview ausführen — niemals gegen Production.
 */
import { spawnSync } from "node:child_process";

if (process.env["APP_ENV"] === "production") {
  console.error("QA-Harness läuft niemals gegen Production.");
  process.exit(1);
}

const run = spawnSync("python3", ["qa/phase16-ui.py"], { stdio: "inherit" });
process.exit(run.status ?? 1);
