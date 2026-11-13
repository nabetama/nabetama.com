/**
 * MDX 本文からプレーンテキストを取り出す。description が未設定の記事の要約と、
 * 読了時間の計算に使う。完全な MDX パーサーではなく、本文の文字数を見積もるための近似。
 */
export function toPlainText(mdx: string): string {
  return (
    mdx
      // import / export 文
      .replace(/^(import|export)\s.*$/gm, "")
      // コードブロック
      .replace(/```[\s\S]*?```/g, "")
      // HTML コメント・script
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      // 画像
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      // リンクはテキストだけ残す
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // JSX / HTML タグ
      .replace(/<\/?[A-Za-z][^>]*>/g, "")
      // 見出し・引用・リストの記号
      .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
      // 強調・インラインコード
      .replace(/(\*\*|__|\*|_|`)/g, "")
      // 表の区切り
      .replace(/\|/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** 先頭から maxLength 文字までの要約を作る。切った場合は末尾に「…」を付ける。 */
export function excerpt(mdx: string, maxLength = 120): string {
  const text = toPlainText(mdx);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

/** 日本語の黙読速度 (約 500 文字/分) で読了時間 (分) を見積もる。最小 1 分。 */
export function readingMinutes(mdx: string, charsPerMinute = 500): number {
  return Math.max(1, Math.round(toPlainText(mdx).length / charsPerMinute));
}

/** 本文中の最初の画像 URL (`<Image src>` / Markdown 画像 / `<img src>`)。 */
export function firstImageUrl(mdx: string): string | undefined {
  const patterns = [
    /<Image\s[^>]*src="([^"]+)"/,
    /!\[[^\]]*\]\(([^)\s]+)[^)]*\)/,
    /<img\s[^>]*src="([^"]+)"/,
  ];
  const found = patterns
    .map((re) => mdx.match(re))
    .filter((m): m is RegExpMatchArray => m !== null)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
  return found?.[1];
}
