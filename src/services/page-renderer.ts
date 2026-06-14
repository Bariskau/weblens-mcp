import { BrowserManager } from "../browser/browser-manager.js";
import { Config } from "../config/config.js";
import type { ImageCandidate, NavLink, RenderSnapshot } from "../types.js";

interface ExtractLimits {
  maxImages: number;
  maxNavLinks: number;
}

/**
 * Runs inside the rendered page (serialized by Playwright), so it must be
 * self-contained — no references to module scope. Collects the page title,
 * full HTML, visible text, content images, and same-site navigation links.
 */
function extractInPage(limits: ExtractLimits) {
  const NAV_REGION_SELECTOR =
    "nav, header, aside, [role='navigation'], [role='menu'], [role='menubar'], .sidebar, .menu, .navbar";

  function collectImages(max: number) {
    const images: { url: string; alt: string | null }[] = [];
    for (const img of document.querySelectorAll<HTMLImageElement>("img")) {
      if (img.naturalWidth > 0 && img.naturalWidth < 50) continue;
      if (img.naturalHeight > 0 && img.naturalHeight < 50) continue;
      const src = img.currentSrc || img.src || img.getAttribute("data-src");
      if (!src || !src.startsWith("http")) continue;
      const alt = img.getAttribute("alt")?.trim() || null;
      if (!images.some((existing) => existing.url === src)) {
        images.push({ url: src, alt });
      }
      if (images.length >= max) break;
    }
    return images;
  }

  function collectNavLinks(max: number) {
    const links: { url: string; text: string }[] = [];
    const seen = new Set<string>();
    for (const region of document.querySelectorAll(NAV_REGION_SELECTOR)) {
      for (const anchor of region.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        let parsed: URL;
        try {
          parsed = new URL(anchor.href);
        } catch {
          continue;
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
        if (parsed.hostname !== location.hostname) continue;
        parsed.hash = "";
        if (seen.has(parsed.href)) continue;
        const text = (anchor.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        seen.add(parsed.href);
        links.push({ url: parsed.href, text });
        if (links.length >= max) return links;
      }
    }
    return links;
  }

  return {
    title: document.title.trim(),
    html: document.documentElement.outerHTML,
    text: (document.body?.innerText ?? "").trim(),
    images: collectImages(limits.maxImages),
    navLinks: collectNavLinks(limits.maxNavLinks)
  };
}

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

      const data = await page.evaluate(extractInPage, {
        maxImages: this.config.maxImagesPerPage,
        maxNavLinks: this.config.maxNavLinks
      });

      return {
        url,
        finalUrl: page.url(),
        title: data.title,
        html: data.html,
        text: data.text,
        status: response?.status() ?? null,
        images: data.images as ImageCandidate[],
        navLinks: data.navLinks as NavLink[]
      };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async dispose(): Promise<void> {
    await this.browserManager.dispose();
  }
}
