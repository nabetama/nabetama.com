import CodeBlock from "./CodeBlock.astro";
import H2 from "./H2.astro";
import H3 from "./H3.astro";
import Image from "./Image.astro";
import LazyImg from "./LazyImg.astro";
import ScrollTable from "./ScrollTable.astro";

/**
 * MDX の本文に渡すコンポーネント。`<Image>` と、Markdown が生成する要素の差し替え
 * (見出しへの直リンク・画像の遅延読み込み・表の横スクロール・コードのコピー)。
 */
export const mdxComponents = {
  Image,
  h2: H2,
  h3: H3,
  img: LazyImg,
  table: ScrollTable,
  pre: CodeBlock,
};

/** フィード (RSS) の本文に渡すコンポーネント。ボタンや見出しリンクなど画面操作用の要素は含めない。 */
export const feedMdxComponents = {
  Image,
};
