import { existsSync } from "node:fs";
import { delimiter } from "node:path";
import path from "node:path";

const CHROMIUM_BINARY_NAMES = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "microsoft-edge",
  "microsoft-edge-stable"
];

export function resolveExecutablePath(
  explicitPath: string | undefined,
  envPath: string | undefined
): string {
  if (explicitPath) {
    if (!existsSync(explicitPath)) {
      throw new Error(`PLAYWRIGHT_EXECUTABLE_PATH does not exist: ${explicitPath}`);
    }

    return explicitPath;
  }

  const resolvedFromPath = resolveFromPath(envPath, CHROMIUM_BINARY_NAMES);
  if (resolvedFromPath) {
    return resolvedFromPath;
  }

  throw new Error(
    "Chrome/Chromium bulunamadi. PLAYWRIGHT_EXECUTABLE_PATH verin ya da browser binary'si PATH icinde olsun."
  );
}

function resolveFromPath(
  envPath: string | undefined,
  executableNames: string[]
): string | null {
  const searchDirs = (envPath ?? "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  for (const executableName of executableNames) {
    for (const searchDir of searchDirs) {
      const candidate = path.join(searchDir, executableName);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}
