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
