import Head from 'next/head'
import { SITE_DOMAIN } from '@/constants'
import { Post } from 'contentlayer/generated'

type CustomHeadProps = Post & {
  rendererdHtml: string
  ogType: string
}

export default function CustomHead({ title, description, slug, ogType }: CustomHeadProps) {
  const canonicalUrl = `${SITE_DOMAIN}/${slug}`

  return (
    <Head>
      <title>{title}</title>
      <link href={canonicalUrl} rel="canonical" />
      <meta name="description" content={description || ''} />
      <meta name="og:description" content={description || ''} />
      <meta name="og:title" content={title} />
      <meta name="og:url" content={canonicalUrl} />
      <meta name="og:type" content={ogType} />
      <meta name="og:image" content={`${SITE_DOMAIN}/public/default_og_image.jpg`} />
      <meta name="twitter:card" content="summary" />
    </Head>
  )
}
