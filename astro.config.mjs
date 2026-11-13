import { readdirSync, readFileSync } from "node:fs";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { MIN_POSTS_FOR_INDEXED_TAG } from "./src/site.config.ts";

const SITE_URL = "https://nabetama.com";
const POSTS_DIR = "./src/content/posts";

/** 記事ファイルのフロントマター (draft の記事を除く)。 */
function readFrontmatters() {
  return readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => ({
      id: file.replace(/\.mdx$/, ""),
      fm: readFileSync(`${POSTS_DIR}/${file}`, "utf8").split("---")[1] ?? "",
    }))
    .filter(({ fm }) => !/^draft:\s*true/m.test(fm));
}

/** sitemap から外すタグページ (記事数が MIN_POSTS_FOR_INDEXED_TAG 未満のもの) の URL。 */
function thinTagUrls() {
  const counts = new Map();
  for (const { fm } of readFrontmatters()) {
    const line = fm.match(/^tags:\s*(\[.*\])\s*$/m)?.[1];
    for (const tag of line ? JSON.parse(line) : []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return new Set(
    [...counts]
      .filter(([, n]) => n < MIN_POSTS_FOR_INDEXED_TAG)
      .map(([tag]) => new URL(`/tags/${tag}/`, SITE_URL).href),
  );
}

/**
 * sitemap の lastmod に使う、記事 URL ごとの最終更新日。
 * 設定ファイルからはコンテンツコレクションを読めないため、フロントマターの日付だけを直接読む。
 */
function postLastmods() {
  const map = new Map();
  for (const { id, fm } of readFrontmatters()) {
    const pick = (key) =>
      fm.match(new RegExp(`^${key}:\\s*["']?(\\d{4}-\\d{2}-\\d{2})`, "m"))?.[1];
    const date = pick("lastModDate") ?? pick("date");
    if (date) map.set(`${SITE_URL}/posts/${id}/`, date);
  }
  return map;
}

const lastmods = postLastmods();
const thinTags = thinTagUrls();

export default defineConfig({
  site: SITE_URL,
  output: "static",
  // リンクにカーソルを合わせた時点で遷移先を先読みし、ページ遷移を速くする
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !thinTags.has(page),
      serialize(item) {
        const lastmod = lastmods.get(item.url);
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
