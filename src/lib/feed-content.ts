import { loadRenderers } from "astro:container";
import { render } from "astro:content";
import { getContainerRenderer } from "@astrojs/mdx/container-renderer";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { feedMdxComponents } from "@/components/mdx";
import { SITE } from "@/site.config";
import type { Post } from "./posts";

let container: AstroContainer | undefined;

async function getContainer() {
  container ??= await AstroContainer.create({
    renderers: await loadRenderers([getContainerRenderer()]),
  });
  return container;
}

/**
 * フィードリーダー向けの記事本文 HTML。
 * script (埋め込みの読み込み用) を取り除き、サイト内の相対 URL を絶対 URL にする。
 */
export async function renderFeedContent(post: Post): Promise<string> {
  const { Content } = await render(post.entry);
  const html = await (await getContainer()).renderToString(Content, {
    props: { components: feedMdxComponents },
  });
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\s(href|src)="\/(?!\/)/g, ` $1="${SITE.url}/`);
}
