/**
 * 記事の OGP 画像 (1200×630 の PNG) をビルド時に作る。
 * 記事に画像がない場合、SNS でシェアされたときにタイトル入りの大きなカードを出すために使う。
 *
 * フォントは @fontsource/noto-sans-jp の分割ファイルから、描く文字を含むものだけを読む
 * (全ファイルを読むと 1 枚あたり数十 MB になるため)。ネットワークには依存しない。
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import satori from "satori";
import sharp from "sharp";
import { OG_IMAGE_SIZE, SITE } from "../site.config.ts";

type FontFace = { file: string; ranges: [number, number][] };

const require = createRequire(join(process.cwd(), "package.json"));
const cssPath = require.resolve("@fontsource/noto-sans-jp/700.css");
const fontDir = dirname(cssPath);

/** 700.css の @font-face から、woff ファイルと unicode-range の対応を読む。 */
function readFontFaces(): FontFace[] {
  const css = readFileSync(cssPath, "utf8");
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].flatMap(([, body]) => {
    const file = body.match(
      /url\((\.\/files\/[^)]+\.woff)\)\s*format\('woff'\)/,
    )?.[1];
    const range = body.match(/unicode-range:\s*([^;]+);/)?.[1];
    if (!file || !range) return [];
    const ranges = range.split(",").map((r): [number, number] => {
      const [from, to] = r.trim().replace(/^U\+/i, "").split("-");
      return [Number.parseInt(from, 16), Number.parseInt(to ?? from, 16)];
    });
    return [{ file: join(fontDir, file), ranges }];
  });
}

let faces: FontFace[] | undefined;
const fontCache = new Map<string, Buffer>();

/** text の文字を描くのに必要なフォントファイルだけを返す。 */
function fontsFor(text: string) {
  faces ??= readFontFaces();
  const codePoints = new Set(
    [...text].map((c) => c.codePointAt(0) ?? 0).filter((c) => c > 0x20),
  );
  const needed = faces.filter((face) =>
    [...codePoints].some((cp) =>
      face.ranges.some(([from, to]) => cp >= from && cp <= to),
    ),
  );
  // satori は同じ名前の複数フォントの間で字形を補い合わないため、分割ファイルごとに別名を付け、
  // font-family に列挙して順に探させる
  return needed.map((face, i) => {
    let data = fontCache.get(face.file);
    if (!data) {
      data = readFileSync(face.file);
      fontCache.set(face.file, data);
    }
    return {
      name: `NotoSansJP-${i}`,
      data,
      weight: 700 as const,
      style: "normal" as const,
    };
  });
}

type Node = {
  type: string;
  props: { style?: Record<string, unknown>; children?: unknown };
};
const el = (
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
): Node => ({ type, props: { style, children } });

/** タイトルの長さに合わせて文字の大きさを決める (3 行に収める)。 */
function titleFontSize(title: string): number {
  const length = [...title].length;
  if (length <= 20) return 68;
  if (length <= 36) return 58;
  return 48;
}

export type OgImageInput = { title: string; date: string; tags: string[] };

export async function renderOgImage({
  title,
  date,
  tags,
}: OgImageInput): Promise<Buffer> {
  const tagText = tags.map((t) => `#${t}`).join("  ");
  const footer = `${SITE.name}${date}${tagText}`;

  const fonts = fontsFor(`${title}${footer}`);
  const tree = el(
    "div",
    {
      width: "100%",
      height: "100%",
      display: "flex",
      backgroundColor: "#ffffff",
      fontFamily: fonts.map((f) => f.name).join(", "),
    },
    [
      el("div", { width: 24, height: "100%", backgroundColor: "#4f46e5" }),
      el(
        "div",
        {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
        },
        [
          el(
            "div",
            {
              display: "flex",
              fontSize: titleFontSize(title),
              lineHeight: 1.4,
              color: "#111827",
              letterSpacing: "0.02em",
              lineClamp: 3,
            },
            title,
          ),
          el(
            "div",
            {
              display: "flex",
              gap: 32,
              fontSize: 28,
              color: "#6b7280",
              borderTop: "2px solid #e5e7eb",
              paddingTop: 28,
            },
            [SITE.name, date, tagText]
              .filter(Boolean)
              .map((text) => el("div", { display: "flex" }, text)),
          ),
        ],
      ),
    ],
  );

  const svg = await satori(tree as Parameters<typeof satori>[0], {
    ...OG_IMAGE_SIZE,
    fonts,
  });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
