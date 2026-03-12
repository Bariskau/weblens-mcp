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