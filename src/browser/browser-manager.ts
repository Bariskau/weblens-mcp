import {
  chromium,
  type Browser,
  type BrowserContext,
  type LaunchOptions,
  type Page
} from "playwright";
import { Config } from "../config/config.js";

const LAUNCH_ARGS = ["--disable-dev-shm-usage", "--no-sandbox"];

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
      this.contextPromise = this.createContext().catch((error) => {
        this.contextPromise = undefined; // don't cache a failed launch
        throw error;
      });
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
      this.browserPromise = this.launchBrowser().catch((error) => {
        this.browserPromise = undefined; // don't cache a failed launch
        throw error;
      });
    }
    return this.browserPromise;
  }

  /**
   * Launch Chromium. An explicit CHROMIUM_PATH wins; otherwise we use
   * Playwright's bundled browser (auto-installed on `npm install`), and only
   * fall back to a system Chrome if the bundled browser is unavailable.
   */
  private async launchBrowser(): Promise<Browser> {
    const explicit = this.config.explicitChromiumPath();
    if (explicit) {
      return chromium.launch(this.launchOptions(explicit));
    }

    try {
      return await chromium.launch(this.launchOptions()); // bundled Chromium
    } catch (bundledError) {
      return this.launchSystemChrome(bundledError);
    }
  }

  /** Try each detected system browser in turn; throw a helpful error if none launch. */
  private async launchSystemChrome(bundledError: unknown): Promise<Browser> {
    for (const executablePath of this.config.detectSystemChromes()) {
      try {
        return await chromium.launch(this.launchOptions(executablePath));
      } catch {
        // Present on disk but not launchable — try the next candidate.
      }
    }
    throw new Error(
      "Could not launch Chromium. Run `npx playwright install chromium`, or " +
        "set CHROMIUM_PATH to a Chrome/Chromium executable. " +
        `(${bundledError instanceof Error ? bundledError.message : String(bundledError)})`
    );
  }

  private launchOptions(executablePath?: string): LaunchOptions {
    const options: LaunchOptions = { headless: true, args: LAUNCH_ARGS };
    return executablePath ? { ...options, executablePath } : options;
  }
}