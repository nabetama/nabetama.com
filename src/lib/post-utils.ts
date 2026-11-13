/**
 * 記事の並び替え・グルーピング・関連付けを行う純粋な関数。
 * astro:content に依存しないため、Node.js のテストランナーで単体テストできる (post-utils.test.ts)。
 */
import type { Post } from "./posts.ts";

export function tagHref(tag: string): string {
  return `/tags/${tag}/`;
}

export type TagSummary = { name: string; href: string; posts: Post[] };

/** タグごとの記事 (新しい順)。記事数の多い順、同数ならタグ名順に並べる。 */
export function groupByTag(posts: Post[]): TagSummary[] {
  const map = new Map<string, Post[]>();
  for (const post of posts) {
    for (const tag of post.tags) {
      map.set(tag, [...(map.get(tag) ?? []), post]);
    }
  }
  return [...map]
    .map(([name, tagged]) => ({ name, href: tagHref(name), posts: tagged }))
    .sort(
      (a, b) =>
        b.posts.length - a.posts.length || a.name.localeCompare(b.name, "ja"),
    );
}

/** 年ごとのまとまり (新しい年から)。posts は新しい順に並んでいる前提。 */
export function groupByYear(
  posts: Post[],
  yearOf: (d: Date) => string,
): { year: string; posts: Post[] }[] {
  const groups: { year: string; posts: Post[] }[] = [];
  for (const post of posts) {
    const year = yearOf(post.date);
    const last = groups.at(-1);
    if (last?.year === year) last.posts.push(post);
    else groups.push({ year, posts: [post] });
  }
  return groups;
}

/**
 * 関連記事。共通するタグが多い記事を優先し、同数なら公開日が近い記事を選ぶ。
 * 共通タグのない記事は選ばない。
 */
export function relatedPosts(post: Post, posts: Post[], limit = 3): Post[] {
  const tags = new Set(post.tags);
  return posts
    .filter((p) => p.id !== post.id)
    .map((p) => ({
      post: p,
      shared: p.tags.filter((t) => tags.has(t)).length,
      distance: Math.abs(p.date.getTime() - post.date.getTime()),
    }))
    .filter((c) => c.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.distance - b.distance)
    .slice(0, limit)
    .map((c) => c.post);
}

/** 新しい順の posts における前後の記事。newer は 1 つ新しい記事、older は 1 つ古い記事。 */
export function adjacentPosts(
  post: Post,
  posts: Post[],
): { newer?: Post; older?: Post } {
  const i = posts.findIndex((p) => p.id === post.id);
  if (i < 0) return {};
  return { newer: posts[i - 1], older: posts[i + 1] };
}
