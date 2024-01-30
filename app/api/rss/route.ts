import { Post, allPosts } from 'contentlayer/generated'
import RSS from 'rss'

export async function GET() {
  const feed = new RSS({
    title: 'nabetama.com',
    description: 'nabetama が日々の生活をメモするウェブサイト',
    feed_url: 'https://nabetama.com/api/rss',
    site_url: 'https://nabetama.com',
    managingEditor: 'Mao Nabeta',
    webMaster: 'Mao Nabeta',
    copyright: '@2016 Mao Nabeta',
    language: 'ja',
    pubDate: new Date().toString(),
    ttl: 60,
  })

  const posts = allPosts.map((post: Post) => ({
    title: post.title,
    description: post.description as string,
    url: `https://nabetama.com/posts${post.slug}`,
    author: 'Mao Nabeta',
    date: post.date,
    custom_elements: [{ 'content:encoded': post.body.raw }],
  }))

  // biome-ignore lint/complexity/noForEach: <explanation>
  posts.forEach((post) => {
    feed.item(post)
  })

  return new Response(feed.xml({ indent: true }), {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
    },
  })
}
