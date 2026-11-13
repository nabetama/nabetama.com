import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { excerpt, firstImageUrl, readingMinutes, toPlainText } from "./text.ts";

describe("toPlainText", () => {
  it("import 文・コードブロック・画像・タグ・Markdown の記号を取り除き、リンクはテキストを残す", () => {
    const mdx = [
      'import X from "./x"',
      "## 見出し",
      "本文の **強調** と `code` と [リンク](https://example.com)。",
      "![alt](https://example.com/a.png)",
      "```js\nconst a = 1;\n```",
      '<Image src="/a.png" alt="a" />',
      "- 項目",
    ].join("\n");
    assert.equal(
      toPlainText(mdx),
      "見出し 本文の 強調 と code と リンク。 項目",
    );
  });
});

describe("excerpt", () => {
  it("上限以下ならそのまま、超えたら切って末尾に … を付ける", () => {
    assert.equal(excerpt("短い本文", 10), "短い本文");
    assert.equal(
      excerpt("あいうえおかきくけこさしす", 10),
      "あいうえおかきくけこ…",
    );
  });
});

describe("readingMinutes", () => {
  it("500 文字/分で四捨五入し、最小 1 分にする", () => {
    assert.equal(readingMinutes(""), 1);
    assert.equal(readingMinutes("あ".repeat(1000)), 2);
    assert.equal(readingMinutes("あ".repeat(1300)), 3);
  });
});

describe("firstImageUrl", () => {
  it("<Image>・Markdown 画像・<img> のうち本文で最初に出てくるものを返す", () => {
    const mdx =
      'text\n![a](https://example.com/md.png)\n<Image src="https://example.com/c.png" alt="c" />';
    assert.equal(firstImageUrl(mdx), "https://example.com/md.png");
    assert.equal(firstImageUrl('<img src="/x.png" alt="x" />'), "/x.png");
    assert.equal(firstImageUrl("画像なし"), undefined);
  });
});
