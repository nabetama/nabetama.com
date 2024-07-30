import { Post } from 'contentlayer/generated'
import { remark } from 'remark'
import { MDX } from 'contentlayer2/core'
import remarkHtml from 'remark-html'
import { select } from 'unist-util-select'

type RenderedPost = Post & RenderResult

export function allPosts(allPosts: Post[], ...excludePostDates: string[]) {
  return allPosts.filter((post) => !excludePostDates.includes(post.date))
}

export async function renderPost(post: Post): Promise<RenderedPost> {
  const renderResult = await renderPostBody(post.body)
  return {
    ...post,
    ...renderResult,
  }
}

type RenderResult = {
  renderedHtml: string | null
  firstImageUrl: string | null
}

export async function renderPostBody(mdxCode: MDX): Promise<RenderResult> {
  const result = await remark().use(remarkHtml).use(extractFirstImageFromPost).process(mdxCode.raw)

  return {
    renderedHtml: result.value.toString(),
    firstImageUrl: (result.data.imageUrl as string) || null,
  }
}

// This is a custom remark plugin that extracts the first image from the post
function extractFirstImageFromPost() {
  return (tree: any, file: any) => {
    const image = select('image', tree) as any
    if (image) {
      file.data.imageUrl = image.url
    }
  }
}
