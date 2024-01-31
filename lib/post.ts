import { Post } from 'contentlayer/generated'
import { remark } from 'remark'
import { MDX } from 'contentlayer/core'
import remarkHtml from 'node_modules/remark-html/lib'

type RenderedPost = Post & RenderResult

export async function renderPost(post: Post): Promise<RenderedPost> {
  const renderResult = await renderPostBody(post.body)
  return {
    ...post,
    ...renderResult,
  }
}

type RenderResult = {
  renderedHtml: string | null
}

export async function renderPostBody(mdxCode: MDX): Promise<RenderResult> {
  const result = await remark().use(remarkHtml).process(mdxCode.raw)

  return {
    renderedHtml: result.value.toString(),
  }
}
