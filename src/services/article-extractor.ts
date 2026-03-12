import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import type { ArticleSnapshot, RenderSnapshot } from "../types.js";

export class ArticleExtractor {
  extract(snapshot: RenderSnapshot): ArticleSnapshot | null {
    const dom = new JSDOM(snapshot.html, { url: snapshot.finalUrl });

    try {
      const article = new Readability(dom.window.document).parse();
      if (!article) {
        return null;
      }

      return {
        title: article.title ?? null,
        byline: article.byline ?? null,
        excerpt: article.excerpt ?? null,
        textContent: article.textContent ?? "",
        contentHtml: article.content ?? ""
      };
    } finally {
      dom.window.close();
    }
  }
}
