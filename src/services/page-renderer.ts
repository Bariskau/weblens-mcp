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
          if (img.naturalWidth > 0 && img.naturalWidth < 50) continue;
          if (img.naturalHeight > 0 && img.naturalHeight < 50) continue;
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
