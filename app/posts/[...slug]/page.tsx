import { notFound } from 'next/navigation'
import { Post, allPosts } from 'contentlayer/generated'

import { Metadata } from 'next'
import { Mdx } from 'components/mdx-components'

import { format } from 'date-fns'
import { SITE_DOMAIN } from '@/constants'
import { renderPost } from 'lib/post'

interface PostProps {
  params: {
    slug: string[]
  }
}

async function getPostFromParams(params: PostProps['params']) {
  const slug = params?.slug?.join('/')
  const post = allPosts.find((post) => post.slugParams === slug)

  if (!post) {
    null
  }
  return post
}

export async function generateMetadata({ params }: PostProps): Promise<Metadata> {
  const post = await getPostFromParams(params)
  const url = `https://${SITE_DOMAIN}${post?.slug}`
  const imageURL = `https://${SITE_DOMAIN}/default_og_image.jpg`
  const renderedPost = await renderPost(post as Post)

  if (!post) {
    return {}
  }

  return {
    metadataBase: new URL(url),
    title: post.title,
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      type: 'article',
      siteName: SITE_DOMAIN,
      images: [{ url: renderedPost.firstImageUrl || imageURL }],
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description: post.description,
      images: [{ url: renderedPost.firstImageUrl || imageURL }],
    },
    alternates: {
      canonical: url,
    },
  }
}

export async function generateStaticParams(): Promise<PostProps['params'][]> {
  return allPosts.map((post) => ({ slug: post.slugParams.split('/') }))
}

export default async function PostPage({ params }: PostProps) {
  const post = await getPostFromParams(params)

  if (!post) {
    notFound()
  }

  return (
    <article className="py-6 prose dark:prose-invert dark:text-gray-200 text-lg">
      <time
        className="dark:text-gray-400 no-underline my-3 p-0 inline-block text-[.8rem]"
        dateTime={post.date}
      >
        公開: {format(new Date(post.date), 'yyyy年MM月dd日')}
      </time>
      {post.lastModDate && (
        <time
          className="dark:text-gray-400 no-underline mt-3 ml-3 p-0 inline-block text-[.8rem]"
          dateTime={post.lastModDate}
        >
          更新: {format(post.lastModDate, 'yyyy年MM月dd日')}
        </time>
      )}
      <h1 className="mb-2 text-3xl">{post.title}</h1>
      {post.description && <p className="text-base mt-0 text-slate-700">{post.description}</p>}
      <hr className="my-4" />
      <Mdx code={post.body.code} />
    </article>
  )
}
