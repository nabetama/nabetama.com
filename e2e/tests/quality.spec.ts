import {
  expect,
  latestPostPath,
  MOBILE,
  snap,
  sources,
  step,
  test,
} from "./fixtures";

async function mainPaths(page: import("@playwright/test").Page) {
  return [
    "/",
    "/posts/",
    "/tags/",
    "/about/",
    "/roastnote/",
    await latestPostPath(page),
  ];
}

test.describe("品質チェック (PC)", () => {
  test(
    "主要ページで JavaScript エラーとコンソールエラーが出ない",
    sources(
      "src/components/Header.astro",
      "src/components/post/TableOfContents.astro",
      "src/layouts/PostLayout.astro",
    ),
    async ({ page, issues }) => {
      for (const path of await mainPaths(page)) {
        await step(page, `${path} を開く`, async () => {
          await page.goto(path);
          await page.waitForLoadState("networkidle");
        });
      }
      expect(issues.pageErrors, "JavaScript の例外").toEqual([]);
      expect(issues.consoleErrors, "コンソールエラー").toEqual([]);
    },
  );

  test(
    "主要ページで同一オリジンのリソース (CSS / JS / 画像) の読み込み失敗がない",
    sources("src/layouts/BaseLayout.astro", "public/"),
    async ({ page, issues }) => {
      for (const path of await mainPaths(page)) {
        await step(page, `${path} を開く`, async () => {
          await page.goto(path);
          await page.waitForLoadState("networkidle");
        });
      }
      expect(issues.failedRequests).toEqual([]);
    },
  );

  test(
    "サイト内リンクにリンク切れがない (sitemap の全ページを走査)",
    sources("src/pages/", "src/content/"),
    async ({ request }) => {
      const sitemap = await (await request.get("/sitemap-0.xml")).text();
      const pages = [
        ...sitemap.matchAll(/<loc>https?:\/\/[^/]+([^<]*)<\/loc>/g),
      ].map((m) => m[1]);
      const targets = new Map<string, string>();
      for (const p of pages) {
        const html = await (await request.get(p)).text();
        for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
          const href = m[1];
          if (!targets.has(href)) targets.set(href, p);
        }
      }
      const broken: string[] = [];
      for (const [href, from] of targets) {
        const res = await request.get(href);
        if (res.status() >= 400) {
          broken.push(
            `${res.status()} ${decodeURI(href)} (リンク元: ${decodeURI(from)})`,
          );
        }
      }
      expect(
        broken,
        `走査したリンク先 ${targets.size} 件のうちリンク切れ`,
      ).toEqual([]);
    },
  );

  test(
    "OS がダークモードのとき dark クラスが付き、保存したライト設定が優先される",
    sources("src/layouts/BaseLayout.astro", "src/styles/global.css"),
    async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await step(page, "ダークモードで / を開く", () => page.goto("/"));
      await expect(page.locator("html")).toHaveClass(/dark/);
      const bg = await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg, "ダークモードの背景色が白のまま").not.toBe(
        "rgb(255, 255, 255)",
      );
      await step(
        page,
        "localStorage に theme=light を保存して再読み込みする",
        async () => {
          await page.evaluate(() => localStorage.setItem("theme", "light"));
          await page.reload();
        },
      );
      await expect(page.locator("html")).not.toHaveClass(/dark/);
    },
  );
});

test.describe("品質チェック (スマホ)", () => {
  test.use(MOBILE);

  test(
    "スマホ幅で主要ページに横スクロール (はみ出し) が発生しない",
    sources("src/layouts/BaseLayout.astro", "src/styles/global.css"),
    async ({ page }) => {
      const overflow: string[] = [];
      for (const path of await mainPaths(page)) {
        await page.goto(path);
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        if (scrollWidth > clientWidth) {
          overflow.push(`${path}: scrollWidth=${scrollWidth} > ${clientWidth}`);
          await snap(page, `はみ出し ${path}`, true);
        }
      }
      expect(overflow).toEqual([]);
    },
  );
});

test.describe("表示テーマの切り替え", () => {
  test(
    "ヘッダーのボタンでダークモードが切り替わり、再読み込み後も保たれる",
    sources("src/components/ThemeToggle.astro", "src/layouts/BaseLayout.astro"),
    async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light" });
      await step(page, "ライトモードで / を開く", () => page.goto("/"));
      const button = page.locator("#theme-toggle");
      await expect(page.locator("html")).not.toHaveClass(/dark/);
      await expect(button).toHaveAttribute("aria-pressed", "false");
      await step(page, "テーマ切り替えボタンをクリックする", () =>
        button.click(),
      );
      await expect(page.locator("html")).toHaveClass(/dark/);
      await expect(button).toHaveAttribute("aria-pressed", "true");
      const bg = await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg, "ダークモードの背景色").not.toBe("rgb(255, 255, 255)");
      await step(page, "再読み込みする", () => page.reload());
      await expect(page.locator("html")).toHaveClass(/dark/);
    },
  );

  test(
    "OS がダークモードでもライトを保存していれば、ダーク用のスタイルが当たらない",
    sources("src/styles/global.css", "src/layouts/BaseLayout.astro"),
    async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await step(
        page,
        "ライト設定を保存してダークモードの OS で / を開く",
        async () => {
          await page.goto("/");
          await page.evaluate(() => localStorage.setItem("theme", "light"));
          await page.reload();
        },
      );
      const bg = await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toBe("rgb(255, 255, 255)");
    },
  );
});

test.describe("キーボード操作", () => {
  test(
    "最初の Tab で「本文へスキップ」が表示され、Enter で本文へ移動する",
    sources("src/layouts/BaseLayout.astro"),
    async ({ page }) => {
      await step(page, "/ を開く", () => page.goto("/"));
      await step(page, "Tab を押す", () => page.keyboard.press("Tab"));
      const skip = page.getByRole("link", { name: "本文へスキップ" });
      await expect(skip).toBeFocused();
      await expect(skip).toBeInViewport();
      await step(page, "Enter を押す", () => page.keyboard.press("Enter"));
      await expect(page).toHaveURL(/#main$/);
    },
  );
});

/**
 * 見えている文字のうち、WCAG AA のコントラスト比 (通常 4.5:1、大きい文字 3:1) を満たさないものを返す。
 * 背景色は祖先をたどって最初の不透明な背景色を使う (背景画像・グラデーションは考慮しない)。
 */
async function lowContrastTexts(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el: Element | null) => {
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c.a >= 1) return c;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    const opaque = (el: Element | null) => {
      for (let e = el; e; e = e.parentElement) {
        if (Number(getComputedStyle(e).opacity) < 1) return false;
      }
      return true;
    };
    const failures: string[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const seen = new Set<Element>();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent?.trim()) continue;
      seen.add(el);
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (
        rect.width === 0 ||
        rect.height === 0 ||
        style.visibility === "hidden"
      )
        continue;
      if (
        el.closest(".sr-only, [aria-hidden='true'], script, style") ||
        !opaque(el)
      )
        continue;
      const fg = parse(style.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      const ratio = (l1 + 0.05) / (l2 + 0.05);
      const size = Number.parseFloat(style.fontSize);
      const large =
        size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) {
        failures.push(
          `${ratio.toFixed(2)} "${n.textContent.trim().slice(0, 20)}" <${el.tagName.toLowerCase()} class="${el.className}">`,
        );
      }
    }
    return failures;
  });
}

test.describe("文字のコントラスト", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(
      `${scheme === "light" ? "ライト" : "ダーク"}モードで、主要ページの文字が WCAG AA のコントラスト比を満たす`,
      sources(
        "src/styles/global.css",
        "src/components/TagLink.astro",
        "src/components/Footer.astro",
        "src/components/mdx/Heading.astro",
        "src/pages/posts/index.astro",
        "src/pages/404.astro",
        "astro.config.mjs",
      ),
      async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        const paths = [
          ...(await mainPaths(page)),
          "/tags/",
          "/this-page-does-not-exist/",
        ];
        const failures: string[] = [];
        for (const path of paths) {
          await step(page, `${path} を開く`, () => page.goto(path));
          for (const f of await lowContrastTexts(page))
            failures.push(`${path}: ${f}`);
        }
        expect(failures).toEqual([]);
      },
    );
  }

  test(
    "CSS は HTML に埋め込まれ、外部スタイルシートを読み込まない",
    sources("astro.config.mjs"),
    async ({ page }) => {
      await step(page, "/ を開く", () => page.goto("/"));
      await expect(page.locator('link[rel="stylesheet"]')).toHaveCount(0);
      await expect(page.locator("head style").first()).toBeAttached();
    },
  );
});
