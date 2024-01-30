import { MetadataRoute } from 'next'
import { allPosts } from 'contentlayer/generated'
import { SITE_DOMAIN } from '@/constants'

export default function sitemap(): MetadataRoute.Sitemap {
  const blogPosts = allPosts.map((post) => ({
    url: `https://${SITE_DOMAIN}${post.slug}`,
    lastModified: post.lastModDate || post.date,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  return [
    {
      url: `https://${SITE_DOMAIN}`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    {
      url: `https://${SITE_DOMAIN}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    ...blogPosts,
  ]
}
