// Best-effort browser provisioning. Downloads the Chromium build that this
// Playwright version expects so `weblens-mcp` works out of the box. This is
// intentionally non-fatal: if the download fails (offline, firewall, CI with
// --ignore-scripts), install still succeeds and the server falls back to a
// system Chrome at runtime, or to CHROMIUM_PATH.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

try {
  const playwrightDir = path.dirname(require.resolve("playwright/package.json"));
  const cli = path.join(playwrightDir, "cli.js");
  const result = spawnSync(process.execPath, [cli, "install", "chromium"], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    warn("Chromium download did not complete. Run `npx playwright install chromium` or set CHROMIUM_PATH.");
  }
} catch (error) {
  warn(`could not provision Chromium: ${error instanceof Error ? error.message : String(error)}`);
}

function warn(message) {
  console.warn(`[weblens-mcp] ${message}`);
}
