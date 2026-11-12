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
  return ["/", "/posts/", "/about/", "/roastnote/", await latestPostPath(page)];
}

test.describe("品質チェック (PC)", () => {
  test(
    "主要ページで JavaScript エラーとコンソールエラーが出ない",
    sources(
      "src/components/Header.astro",
      "src/components/TableOfContents.astro",
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
