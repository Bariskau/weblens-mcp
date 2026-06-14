import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Default install locations for Chrome / Chromium / Edge, per platform.
 * Checked in order when CHROMIUM_PATH is not set.
 */
function chromeCandidates(env: NodeJS.ProcessEnv): string[] {
  switch (process.platform) {
    case "darwin":
      return [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
      ];
    case "win32": {
      const local = env.LOCALAPPDATA;
      return [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        ...(local
          ? [
              path.join(local, "Google\\Chrome\\Application\\chrome.exe"),
              path.join(local, "Chromium\\Application\\chrome.exe")
            ]
          : []),
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
      ];
    }
    default:
      return [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/microsoft-edge",
        "/snap/bin/chromium"
      ];
  }
}

export class Config {
  readonly insecureTls: boolean;
  readonly tmpDir: string;
  readonly tmpTtlMs = 6 * 60 * 60 * 1000; // 6 hours
  readonly navTimeoutMs = 25_000;
  readonly maxAssetBytes = 20 * 1024 * 1024; // 20MB
  readonly maxImagesPerPage = 10;
  readonly maxNavLinks = 50;

  private readonly env: NodeJS.ProcessEnv;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.env = env;
    this.insecureTls = env.INSECURE_TLS === "1";
    this.tmpDir = path.join(os.tmpdir(), "weblens-mcp");
  }

  /** Explicit browser override via CHROMIUM_PATH. Throws if set but missing. */
  explicitChromiumPath(): string | undefined {
    const explicit = this.env.CHROMIUM_PATH;
    if (!explicit) return undefined;
    if (!existsSync(explicit)) {
      throw new Error(`CHROMIUM_PATH does not exist: ${explicit}`);
    }
    return explicit;
  }

  /** First Chrome/Chromium/Edge in a standard OS install location, if any. */
  detectSystemChrome(): string | undefined {
    return chromeCandidates(this.env).find((candidate) => existsSync(candidate));
  }
}
