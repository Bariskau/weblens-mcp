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
            const asset = await this.assetStore.downloadImage(img.url);
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
