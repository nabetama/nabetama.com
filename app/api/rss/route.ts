import { Post, allPosts } from "contentlayer/generated";
import RSS from "rss";

export async function GET() {
  const feed = new RSS({
    title: "blog.nabetama.com",
    description: "nabetama が日々の生活をメモするウェブサイト",
    feed_url: "https://blog.nabetama.com/api/rss",
    site_url: "https://blog.nabetama.com",
    managingEditor: "Mao Nabeta",
    webMaster: "Mao Nabeta",
    copyright: "@2016 Mao Nabeta",
    language: "ja",
    pubDate: new Date().toString(),
    ttl: 60,
  });

  const posts = allPosts.map((post: Post) => ({
    title: post.title,
    description: post.description as string,
    url: `https://blog.nabetama.com/posts${post.slug}`,
    author: "Mao Nabeta",
    date: post.date,
  }));

  posts.forEach((post) => {
    feed.item(post);
  });

  return new Response(feed.xml({ indent: true }), {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
    },
  });
}
