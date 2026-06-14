import type {
  ArticleSnapshot,
  NavLink,
  RenderSnapshot,
  StoredAsset
} from "../types.js";

export class MarkdownComposer {
  compose(
    snapshot: RenderSnapshot,
    article: ArticleSnapshot | null,
    assets: Map<string, StoredAsset>
  ): string {
    const sections = [
      this.heading(snapshot, article),
      this.excerpt(article),
      this.body(snapshot, article),
      this.navigation(snapshot.navLinks),
      this.imageGallery(snapshot, assets)
    ];

    return sections.filter((section) => section.length > 0).join("\n\n");
  }

  private heading(
    snapshot: RenderSnapshot,
    article: ArticleSnapshot | null
  ): string {
    const title = article?.title ?? snapshot.title ?? "Untitled";
    return `# ${title}\n\nSource: ${snapshot.finalUrl}`;
  }

  private excerpt(article: ArticleSnapshot | null): string {
    return article?.excerpt ? `> ${article.excerpt}` : "";
  }

  private body(
    snapshot: RenderSnapshot,
    article: ArticleSnapshot | null
  ): string {
    const text = article?.textContent ?? snapshot.text;
    return text ? this.normalizeText(text) : "";
  }

  private navigation(navLinks: NavLink[]): string {
    if (navLinks.length === 0) return "";
    const items = navLinks.map((link) => `- [${link.text}](${link.url})`);
    return ["## Navigation", "", ...items].join("\n");
  }

  private imageGallery(
    snapshot: RenderSnapshot,
    assets: Map<string, StoredAsset>
  ): string {
    if (assets.size === 0) return "";
    const items = [...assets].map(([url, asset]) => {
      const alt = snapshot.images.find((image) => image.url === url)?.alt ?? "image";
      return `![${alt}](${asset.localPath})`;
    });
    return ["## Images", "", ...items].join("\n");
  }

  private normalizeText(value: string): string {
    return value
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.replace(/\s+\n/g, "\n").trim())
      .filter((paragraph) => paragraph.length > 0)
      .join("\n\n");
  }
}
