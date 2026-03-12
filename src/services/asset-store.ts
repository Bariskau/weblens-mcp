import { createHash } from "node:crypto";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Config } from "../config/renderlens-config.js";
import type { StoredAsset } from "../types.js";

export class AssetStore {
  private initialized = false;
  private lastSweepAt = 0;

  constructor(private readonly config: Config) {}

  get dir(): string {
    return this.config.tmpDir;
  }

  async downloadImage(url: string): Promise<StoredAsset | null> {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) return null;

      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      if (!contentType.startsWith("image/")) return null;

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > this.config.maxAssetBytes) return null;

      const ext = this.inferExtension(contentType, url);
      const filePath = path.join(
        this.config.tmpDir,
        `${createHash("sha1").update(url).digest("hex")}${ext}`
      );

      await this.ensureDir();
      await writeFile(filePath, bytes);

      return {
        sourceUrl: url,
        localPath: filePath,
        contentType,
        byteLength: bytes.byteLength
      };
    } catch {
      return null;
    }
  }

  async writeMarkdown(url: string, content: string): Promise<string> {
    await this.ensureDir();
    const hash = createHash("sha1").update(url).digest("hex");
    const filePath = path.join(this.config.tmpDir, `${hash}.md`);
    await writeFile(filePath, content, "utf-8");
    return filePath;
  }

  async sweep(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSweepAt < 300_000) return;

    await this.ensureDir();
    const entries = await readdir(this.config.tmpDir, { withFileTypes: true });

    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isFile()) return;
        const entryPath = path.join(this.config.tmpDir, entry.name);
        const s = await stat(entryPath).catch(() => null);
        if (s && now - s.mtimeMs > this.config.tmpTtlMs) {
          await rm(entryPath, { force: true }).catch(() => undefined);
        }
      })
    );

    this.lastSweepAt = now;
  }

  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    await mkdir(this.config.tmpDir, { recursive: true });
    this.initialized = true;
  }

  private inferExtension(contentType: string, url: string): string {
    const map: Record<string, string> = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "image/svg+xml": ".svg",
      "image/avif": ".avif"
    };
    if (map[contentType]) return map[contentType]!;
    try {
      const ext = path.extname(new URL(url).pathname).toLowerCase();
      if (ext) return ext;
    } catch {}
    return ".bin";
  }
}
