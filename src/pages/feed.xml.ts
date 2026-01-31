import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { compareDesc } from "date-fns";

const EXCLUDE_POST_ID = "1999-01-01";

export async function GET(context: APIContext) {
  const allPosts = await getCollection("posts");
  const posts = allPosts
    .filter((post) => post.id !== EXCLUDE_POST_ID)
    .sort((a, b) => compareDesc(new Date(a.data.date), new Date(b.data.date)));

  return rss({
    title: "nabetama.com",
    description: "nabetama が日々の生活をメモするウェブサイト",
    site: context.site ?? new URL("https://nabetama.com"),
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: new Date(post.data.date),
      description: post.data.description,
      link: `/posts/${post.id}/`,
    })),
  });
}
