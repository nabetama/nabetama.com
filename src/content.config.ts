import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/** フロントマターの空文字 (`description: ""`) は未設定として扱う。 */
const optionalText = z
  .string()
  .nullish()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

const posts = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    lastModDate: z.coerce.date().nullish(),
    description: optionalText,
    tags: z.array(z.string()).default([]),
    thumbnail: optionalText,
    /** true の記事は本番ビルドで一覧・フィード・ページのいずれにも出さない (開発サーバーでは表示する)。 */
    draft: z.boolean().default(false),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: optionalText,
    /** 本文の言語。省略時はサイトの言語 (ja)。 */
    lang: z.string().optional(),
  }),
});

export const collections = { posts, pages };
