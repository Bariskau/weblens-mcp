# WebLens Simplification Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify WebLens MCP to a single `fetch_page` tool that returns a local markdown file path containing rendered page content with downloaded image paths embedded.

**Architecture:** Single tool receives URL, renders via Playwright, extracts content with Readability, downloads `<img>` assets to `dist/.tmp/weblens/`, composes markdown with local image paths, writes markdown to same tmp dir, returns the md file path. 6-hour TTL sweep cleans old files.

**Tech Stack:** TypeScript, Playwright, Mozilla Readability, jsdom, MCP SDK, LRU cache

---

### Task 1: Simplify types

**Files:**
- Modify: `src/types.ts` (full rewrite)

**Step 1: Rewrite types.ts**

```typescript
export interface RenderSnapshot {
  url: string;
  finalUrl: string;
  title: string;
  html: string;
  text: string;
  status: number | null;
  images: ImageCandidate[];
}

export interface ImageCandidate {
  url: string;
  alt: string | null;
}

export interface StoredAsset {
  sourceUrl: string;
  localPath: string;
  contentType: string;
  byteLength: number;
}

export interface ArticleSnapshot {
  title: string | null;
  byline: string | null;
  excerpt: string | null;
  textContent: string;
  contentHtml: string;
}
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "simplify: reduce types to minimal set"
```

---

### Task 2: Simplify config

**Files:**
- Modify: `src/config/renderlens-config.ts` (full rewrite)

**Step 1: Rewrite config to only read 2 env vars + hardcoded defaults**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/config/renderlens-config.ts
git commit -m "simplify: config to 2 env vars with hardcoded defaults"
```

---

### Task 3: Simplify BrowserManager

**Files:**
- Modify: `src/browser/browser-manager.ts` (full rewrite)
- Delete: `src/browser/request-scheduler.ts`

**Step 1: Rewrite BrowserManager — remove user agent detection, request scheduling, asset headers**

```typescript
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { Config } from "../config/renderlens-config.js";

export class BrowserManager {
  private browserPromise: Promise<Browser> | undefined;
  private contextPromise: Promise<BrowserContext> | undefined;

  constructor(private readonly config: Config) {}

  async newPage(): Promise<Page> {
    const context = await this.getContext();
    return context.newPage();
  }

  async dispose(): Promise<void> {
    if (this.contextPromise) {
      const ctx = await this.contextPromise.catch(() => null);
      await ctx?.close().catch(() => undefined);
      this.contextPromise = undefined;
    }
    if (this.browserPromise) {
      const browser = await this.browserPromise.catch(() => null);
      await browser?.close().catch(() => undefined);
      this.browserPromise = undefined;
    }
  }

  private async getContext(): Promise<BrowserContext> {
    if (!this.contextPromise) {
      this.contextPromise = this.createContext();
    }
    return this.contextPromise;
  }

  private async createContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    return browser.newContext({
      viewport: { width: 1440, height: 960 },
      ignoreHTTPSErrors: this.config.insecureTls
    });
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({
        executablePath: this.config.chromiumPath,
        headless: true,
        args: ["--disable-dev-shm-usage", "--no-sandbox"]
      });
    }
    return this.browserPromise;
  }
}
```

**Step 2: Delete request-scheduler.ts**

**Step 3: Commit**

```bash
git add src/browser/browser-manager.ts
git rm src/browser/request-scheduler.ts
git commit -m "simplify: minimal browser manager, remove request scheduler"
```

---

### Task 4: Simplify PageRenderer

**Files:**
- Modify: `src/services/page-renderer.ts` (full rewrite)

**Step 1: Rewrite — render page, extract title/text/html/images from DOM, no metadata/OG/cache**

```typescript
import { BrowserManager } from "../browser/browser-manager.js";
import { Config } from "../config/renderlens-config.js";
import type { ImageCandidate, RenderSnapshot } from "../types.js";

export class PageRenderer {
  constructor(
    private readonly browserManager: BrowserManager,
    private readonly config: Config
  ) {}

  async render(url: string): Promise<RenderSnapshot> {
    const page = await this.browserManager.newPage();

    await page.route("**/*", async (route) => {
      const type = route.request().resourceType();
      if (type === "media" || type === "font") {
        await route.abort();
        return;
      }
      await route.continue();
    });

    page.setDefaultNavigationTimeout(this.config.navTimeoutMs);

    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded" });

      await page
        .waitForLoadState("networkidle", { timeout: 5000 })
        .catch(() => undefined);

      const data = await page.evaluate((maxImages: number) => {
        const images: { url: string; alt: string | null }[] = [];
        for (const img of document.querySelectorAll<HTMLImageElement>("img")) {
          const src = img.currentSrc || img.src || img.getAttribute("data-src");
          if (!src || !src.startsWith("http")) continue;
          const alt = img.getAttribute("alt")?.trim() || null;
          if (!images.some((i) => i.url === src)) {
            images.push({ url: src, alt });
          }
          if (images.length >= maxImages) break;
        }

        return {
          title: document.title.trim(),
          html: document.documentElement.outerHTML,
          text: (document.body?.innerText ?? "").trim(),
          images
        };
      }, this.config.maxImagesPerPage);

      return {
        url,
        finalUrl: page.url(),
        title: data.title,
        html: data.html,
        text: data.text,
        status: response?.status() ?? null,
        images: data.images as ImageCandidate[]
      };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async dispose(): Promise<void> {
    await this.browserManager.dispose();
  }
}
```

**Step 2: Commit**

```bash
git add src/services/page-renderer.ts
git commit -m "simplify: minimal page renderer, no cache/metadata/OG"
```

---

### Task 5: Simplify AssetStore + remove AssetResolver

**Files:**
- Modify: `src/services/asset-store.ts` (full rewrite)
- Delete: `src/services/asset-resolver.ts`

**Step 1: Rewrite AssetStore — download URL to file, sweep old files, write markdown files**

```typescript
import { createHash } from "node:crypto";
import { mkdir, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
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

  async downloadImage(url: string, insecureTls: boolean): Promise<StoredAsset | null> {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        ...(insecureTls ? { dispatcher: undefined } : {})
      });

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
    if (now - this.lastSweepAt < 300_000) return; // 5 min throttle

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
```

**Step 2: Delete asset-resolver.ts**

**Step 3: Commit**

```bash
git add src/services/asset-store.ts
git rm src/services/asset-resolver.ts
git commit -m "simplify: unified asset store with download + markdown write + sweep"
```

---

### Task 6: Simplify MarkdownComposer

**Files:**
- Modify: `src/services/markdown-composer.ts` (full rewrite)

**Step 1: Rewrite — compose markdown with local image paths**

```typescript
import type { ArticleSnapshot, RenderSnapshot, StoredAsset } from "../types.js";

export class MarkdownComposer {
  compose(
    snapshot: RenderSnapshot,
    article: ArticleSnapshot | null,
    assets: Map<string, StoredAsset>
  ): string {
    const lines: string[] = [];
    const title = article?.title ?? snapshot.title ?? "Untitled";

    lines.push(`# ${title}`);
    lines.push("");
    lines.push(`Source: ${snapshot.finalUrl}`);

    if (article?.excerpt) {
      lines.push("");
      lines.push(`> ${article.excerpt}`);
    }

    // Body text with image paths replaced
    const body = article?.textContent ?? snapshot.text;
    if (body) {
      lines.push("");
      lines.push(this.normalizeText(body));
    }

    // Append downloaded images
    if (assets.size > 0) {
      lines.push("");
      lines.push("## Images");
      lines.push("");
      for (const [url, asset] of assets) {
        const alt = snapshot.images.find((i) => i.url === url)?.alt ?? "image";
        lines.push(`![${alt}](${asset.localPath})`);
      }
    }

    return lines.join("\n");
  }

  private normalizeText(value: string): string {
    return value
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+\n/g, "\n").trim())
      .filter((p) => p.length > 0)
      .join("\n\n");
  }
}
```

**Step 2: Commit**

```bash
git add src/services/markdown-composer.ts
git commit -m "simplify: markdown composer with embedded local image paths"
```

---

### Task 7: Simplify ArticleExtractor

**Files:**
- Modify: `src/services/article-extractor.ts` (no change needed, already simple)

This file stays as-is. It's already minimal.

---

### Task 8: Rewrite MCP server — single fetch_page tool

**Files:**
- Modify: `src/mcp/renderlens-mcp-server.ts` (full rewrite)

**Step 1: Rewrite — single tool, returns md file path**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { ArticleExtractor } from "../services/article-extractor.js";
import { AssetStore } from "../services/asset-store.js";
import { MarkdownComposer } from "../services/markdown-composer.js";
import { PageRenderer } from "../services/page-renderer.js";
import type { StoredAsset } from "../types.js";

export class WebLensMcpServer {
  private readonly server: McpServer;

  constructor(
    private readonly pageRenderer: PageRenderer,
    private readonly articleExtractor: ArticleExtractor,
    private readonly assetStore: AssetStore,
    private readonly markdownComposer: MarkdownComposer
  ) {
    this.server = new McpServer({
      name: "weblens-mcp",
      version: "0.3.0"
    });

    this.registerTool();
  }

  async connect(transport: StdioServerTransport): Promise<void> {
    await this.server.connect(transport);
  }

  async dispose(): Promise<void> {
    await this.pageRenderer.dispose();
  }

  private registerTool(): void {
    this.server.registerTool(
      "fetch_page",
      {
        description:
          "Fetch and render a web page. Returns the absolute path to a local markdown file containing the page content with downloaded images embedded as local file paths.",
        inputSchema: {
          url: z.string().url().describe("Target page URL.")
        }
      },
      async ({ url }) => {
        await this.assetStore.sweep();

        const snapshot = await this.pageRenderer.render(url);
        const article = this.articleExtractor.extract(snapshot);

        // Download images in parallel
        const assetEntries = await Promise.all(
          snapshot.images.map(async (img) => {
            const asset = await this.assetStore.downloadImage(
              img.url,
              true // insecureTls handled at config level
            );
            return asset ? ([img.url, asset] as const) : null;
          })
        );

        const assets = new Map<string, StoredAsset>(
          assetEntries.filter((e): e is NonNullable<typeof e> => e !== null)
        );

        const markdown = this.markdownComposer.compose(snapshot, article, assets);
        const mdPath = await this.assetStore.writeMarkdown(url, markdown);

        return {
          content: [{ type: "text", text: mdPath }]
        };
      }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/mcp/renderlens-mcp-server.ts
git commit -m "simplify: single fetch_page tool returning md file path"
```

---

### Task 9: Rewrite index.ts + cleanup

**Files:**
- Modify: `src/index.ts` (rewrite)
- Delete: `src/utils/text.ts`
- Delete: `src/utils/url.ts`
- Delete: `src/utils/asset-types.ts`
- Delete: `src/jsdom.d.ts`

**Step 1: Rewrite index.ts**

```typescript
#!/usr/bin/env node

import process from "node:process";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BrowserManager } from "./browser/browser-manager.js";
import { Config } from "./config/renderlens-config.js";
import { WebLensMcpServer } from "./mcp/renderlens-mcp-server.js";
import { ArticleExtractor } from "./services/article-extractor.js";
import { AssetStore } from "./services/asset-store.js";
import { MarkdownComposer } from "./services/markdown-composer.js";
import { PageRenderer } from "./services/page-renderer.js";

async function main(): Promise<void> {
  const config = new Config();
  const browserManager = new BrowserManager(config);
  const pageRenderer = new PageRenderer(browserManager, config);
  const articleExtractor = new ArticleExtractor();
  const assetStore = new AssetStore(config);
  const markdownComposer = new MarkdownComposer();
  const mcpServer = new WebLensMcpServer(
    pageRenderer,
    articleExtractor,
    assetStore,
    markdownComposer
  );

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void mcpServer.dispose().finally(() => process.exit(0));
    });
  }

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

void main().catch((error) => {
  console.error("WebLens MCP failed:", error);
  process.exit(1);
});
```

**Step 2: Delete unused files**

```bash
git rm src/utils/text.ts src/utils/url.ts src/utils/asset-types.ts src/jsdom.d.ts
```

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "simplify: minimal index.ts, remove unused utils"
```

---

### Task 10: Update package.json + build + test

**Files:**
- Modify: `package.json` (remove undici dep if no longer needed, bump version)

**Step 1: Update package.json version to 0.3.0**

**Step 2: Build**

```bash
npm run build
```

**Step 3: Manual test**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}' | timeout 10 node dist/index.js
```

**Step 4: Commit**

```bash
git add package.json
git commit -m "simplify: bump version to 0.3.0"
```

---

## Summary of deletions

| File | Reason |
|---|---|
| `src/browser/request-scheduler.ts` | Unnecessary rate limiter |
| `src/services/asset-resolver.ts` | Merged into AssetStore |
| `src/utils/text.ts` | truncate no longer needed |
| `src/utils/url.ts` | normalizeUrl no longer needed |
| `src/utils/asset-types.ts` | Merged into AssetStore |
| `src/jsdom.d.ts` | Unnecessary type override |

## File count: 14 → 8