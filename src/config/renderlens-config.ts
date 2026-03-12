import { existsSync } from "node:fs";
import path from "node:path";

const DEFAULT_CHROMIUM_PATHS = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
];

export class Config {
  readonly chromiumPath: string;
  readonly insecureTls: boolean;
  readonly tmpDir: string;
  readonly tmpTtlMs = 6 * 60 * 60 * 1000; // 6 hours
  readonly navTimeoutMs = 25_000;
  readonly maxAssetBytes = 20 * 1024 * 1024; // 20MB
  readonly maxImagesPerPage = 10;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.chromiumPath = this.resolveChromiumPath(env);
    this.insecureTls = env.INSECURE_TLS === "1";
    this.tmpDir = path.resolve("dist/.tmp/weblens");
  }

  private resolveChromiumPath(env: NodeJS.ProcessEnv): string {
    const explicit = env.CHROMIUM_PATH;
    if (explicit) {
      if (!existsSync(explicit)) {
        throw new Error(`CHROMIUM_PATH does not exist: ${explicit}`);
      }
      return explicit;
    }

    for (const candidate of DEFAULT_CHROMIUM_PATHS) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      "Chrome/Chromium not found. Set CHROMIUM_PATH env variable."
    );
  }
}