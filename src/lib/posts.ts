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
  /** OGP に使う画像の絶対 URL。thumbnail → 本文の最初の画像 → サイト既定画像の順で決める。 */
  ogImage: string;
  /** ogImage が記事固有の画像か (false ならサイト既定画像)。Twitter カードの大きさの判定に使う。 */
  hasOwnImage: boolean;
  entry: PostEntry;
};

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
    ogImage: absoluteUrl(image ?? SITE.defaultOgImage.path),
    hasOwnImage: image !== undefined,
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
