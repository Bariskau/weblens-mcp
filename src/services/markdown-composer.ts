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

    const body = article?.textContent ?? snapshot.text;
    if (body) {
      lines.push("");
      lines.push(this.normalizeText(body));
    }

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
