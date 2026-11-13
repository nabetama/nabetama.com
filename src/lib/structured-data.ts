/**
 * schema.org の構造化データ (JSON-LD)。検索結果のパンくず・記事の公開日・著者の表示に使われる。
 * https://developers.google.com/search/docs/appearance/structured-data
 */
import { AUTHOR, SITE } from "@/site.config";
import type { Post } from "./posts";

export type JsonLd = Record<string, unknown>;

export type Crumb = { label: string; href?: string };

const absolute = (path: string) => new URL(path, SITE.url).toString();

const WEBSITE_ID = `${SITE.url}/#website`;
const PERSON_ID = `${SITE.url}/#person`;

export function person(): JsonLd {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: AUTHOR.name,
    url: AUTHOR.url,
    sameAs: AUTHOR.sameAs,
  };
}

export function website(): JsonLd {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${SITE.url}/`,
    name: SITE.name,
    description: SITE.description,
    inLanguage: SITE.lang,
    publisher: { "@id": PERSON_ID },
  };
}

export function blogPosting(post: Post): JsonLd {
  const url = absolute(post.href);
  return {
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    mainEntityOfPage: url,
    url,
    headline: post.title,
    description: post.description,
    datePublished: post.date.toISOString(),
    dateModified: (post.lastModDate ?? post.date).toISOString(),
    image: post.ogImage.url,
    keywords: post.tags.join(", ") || undefined,
    inLanguage: SITE.lang,
    author: { "@id": PERSON_ID },
    publisher: { "@id": PERSON_ID },
    isPartOf: { "@id": WEBSITE_ID },
  };
}

/** 一覧ページ (Archive・タグ) を表す CollectionPage。記事の並びを ItemList で持つ。 */
export function collectionPage(
  name: string,
  path: string,
  posts: Post[],
): JsonLd {
  return {
    "@type": "CollectionPage",
    name,
    url: absolute(path),
    inLanguage: SITE.lang,
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: posts.length,
      itemListElement: posts.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absolute(p.href),
        name: p.title,
      })),
    },
  };
}

/** href のない要素 (現在のページ) は currentPath の URL を使う。 */
export function breadcrumbList(crumbs: Crumb[], currentPath: string): JsonLd {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      item: absolute(c.href ?? currentPath),
    })),
  };
}

/** 複数のノードを 1 つの @graph にまとめる。 */
export function graph(nodes: JsonLd[]): JsonLd {
  return { "@context": "https://schema.org", "@graph": nodes };
}
