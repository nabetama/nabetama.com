import { type CollectionEntry, getCollection } from "astro:content";
import { SITE } from "../site.config.ts";
import { excerpt, firstImageUrl, readingMinutes } from "./text.ts";

export type PostEntry = CollectionEntry<"posts">;

/**
 * 画面・フィード・構造化データが使う記事の情報。
 * フロントマターの未設定値をここで補い、表示側では分岐しなくて済むようにする。
 */
export type Post = {
  id: string;
  href: string;
  title: string;
  /** フロントマターの description。未設定なら本文の冒頭から作った要約。 */
  description: string;
  date: Date;
  lastModDate?: Date;
  tags: string[];
  readingMinutes: number;
  /**
   * OGP に使う画像。thumbnail → 本文の最初の画像 → タイトル入りの生成画像 (/og/posts/<id>.png) の順で決める。
   * generated が true なら生成画像で、大きさは OG_IMAGE_SIZE。
   */
  ogImage: { url: string; generated: boolean };
  entry: PostEntry;
};

/** 記事ごとに生成する OGP 画像のパス (src/pages/og/posts/[slug].png.ts)。 */
export function ogImagePath(id: string): string {
  return `/og/posts/${id}.png`;
}

export function postHref(id: string): string {
  return `/posts/${id}/`;
}

function absoluteUrl(src: string): string {
  return new URL(src, SITE.url).toString();
}

function toPost(entry: PostEntry): Post {
  const body = entry.body ?? "";
  const image = entry.data.thumbnail ?? firstImageUrl(body);
  return {
    id: entry.id,
    href: postHref(entry.id),
    title: entry.data.title,
    description: entry.data.description ?? excerpt(body),
    date: entry.data.date,
    lastModDate: entry.data.lastModDate ?? undefined,
    tags: entry.data.tags,
    readingMinutes: readingMinutes(body),
    ogImage: image
      ? { url: absoluteUrl(image), generated: false }
      : { url: absoluteUrl(ogImagePath(entry.id)), generated: true },
    entry,
  };
}

const byDateDesc = (a: Post, b: Post) =>
  b.date.getTime() - a.date.getTime() || b.id.localeCompare(a.id);

/** 公開する記事を新しい順に返す。draft の記事は開発サーバーでのみ含める。 */
export async function getPosts(): Promise<Post[]> {
  const entries = await getCollection(
    "posts",
    (e) => import.meta.env.DEV || !e.data.draft,
  );
  return entries.map(toPost).sort(byDateDesc);
}

export {
  adjacentPosts,
  groupByTag,
  groupByYear,
  relatedPosts,
  type TagSummary,
  tagHref,
} from "./post-utils.ts";
