import { SITE_DOMAIN } from '@/constants'
import { allPosts } from 'contentlayer/generated'
import { renderPost } from 'lib/post'
import Rss from 'rss'

export async function generateFeed(): Promise<string> {
  const rss = new Rss({
    title: SITE_DOMAIN,
    description: 'nabetama が日々の生活をメモするウェブサイト',
    feed_url: `https://${SITE_DOMAIN}/api/feed.xml`,
    site_url: `https://${SITE_DOMAIN}`,
    managingEditor: 'Mao Nabeta',
    webMaster: 'Mao Nabeta',
    copyright: '@2016 Mao Nabeta',
    language: 'ja',
    pubDate: new Date().toString(),
    ttl: 60,
  })

  const renderedPosts = await Promise.all(
    allPosts.map(async (post) => {
      const renderedPost = await renderPost(post)

      return {
        ...post,
        ...renderedPost,
      }
    }),
  )

  // biome-ignore lint/complexity/noForEach: <explanation>
  renderedPosts.forEach((post) => {
    rss.item({
      title: post.title,
      description: post.description as string,
      url: `https://${SITE_DOMAIN}${post.slug}`,
      date: new Date(post.date),
      custom_elements: [
        {
          'content:encoded': {
            _cdata: post.renderedHtml,
          },
        },
      ],
    })
  })

  return rss.xml()
}
