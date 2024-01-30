import { remark } from 'remark'
import remarkMdx from 'remark-mdx'

type RenderResult = {
  renderedHtml: string
}

export async function renderPostBody(mdxCode: string): Promise<RenderResult> {
  const result = await remark().use(remarkMdx).process(mdxCode)

  return {
    renderedHtml: result.toString(),
  }
}
