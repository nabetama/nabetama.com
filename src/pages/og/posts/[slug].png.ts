import type { APIContext } from "astro";
import { formatDate } from "@/lib/date";
import { renderOgImage } from "@/lib/og-image";
import { getPosts, type Post } from "@/lib/posts";

/** 記事ごとの OGP 画像。記事に画像がない場合に Post.ogImage がここを指す。 */
export async function getStaticPaths() {
  const posts = await getPosts();
  return posts
    .filter((post) => post.ogImage.generated)
    .map((post) => ({ params: { slug: post.id }, props: { post } }));
}

export async function GET({ props }: APIContext<{ post: Post }>) {
  const { post } = props;
  const png = await renderOgImage({
    title: post.title,
    date: formatDate(post.date),
    tags: post.tags,
  });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
}
