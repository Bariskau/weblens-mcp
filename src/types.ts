export interface RenderSnapshot {
  url: string;
  finalUrl: string;
  title: string;
  html: string;
  text: string;
  status: number | null;
  images: ImageCandidate[];
  navLinks: NavLink[];
}

export interface ImageCandidate {
  url: string;
  alt: string | null;
}

export interface NavLink {
  url: string;
  text: string;
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