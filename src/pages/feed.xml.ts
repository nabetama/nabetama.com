import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { renderFeedContent } from "@/lib/feed-content";
import { getPosts } from "@/lib/posts";
import { SITE } from "@/site.config";

/** 本文全体をフィードに載せる記事数 (新しい順) */
const FULL_CONTENT_LIMIT = 20;

export async function GET(context: APIContext) {
  const posts = await getPosts();
  const site = context.site ?? new URL(SITE.url);
  const feedUrl = new URL("/feed.xml", site).toString();
  const lastBuild = posts[0]?.date ?? new Date();

  return rss({
    title: SITE.name,
    description: SITE.description,
    site,
    xmlns: { atom: "http://www.w3.org/2005/Atom" },
    customData: [
      `<language>${SITE.lang}</language>`,
      `<atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>`,
      `<lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>`,
    ].join(""),
    items: await Promise.all(
      posts.map(async (post, i) => ({
        title: post.title,
        pubDate: post.date,
        description: post.description,
        // フィードが大きくなりすぎないよう、本文は新しい記事だけに付ける
        content:
          i < FULL_CONTENT_LIMIT ? await renderFeedContent(post) : undefined,
        link: post.href,
        categories: post.tags,
      })),
    ),
  });
}
