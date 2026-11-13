import { expect, sources, step, test } from "./fixtures";

const PAGES = [
  { path: "/about/", source: "src/pages/[page].astro", lang: "ja" },
  { path: "/roastnote/", source: "src/pages/[page].astro", lang: "en" },
];

test.describe("固定ページ", () => {
  for (const { path, source, lang } of PAGES) {
    test(
      `${path} にタイトル・パンくず・本文が表示される`,
      sources(
        source,
        "src/layouts/PageLayout.astro",
        `src/content/pages${path.replace(/\/$/, "")}.mdx`,
      ),
      async ({ page }) => {
        const res = await step(page, `${path} を開く`, () => page.goto(path));
        expect(res?.status()).toBe(200);
        const h1 = page.locator("article h1");
        await expect(h1).not.toBeEmpty();
        await expect(page.locator("main nav ol li").last()).toHaveText(
          (await h1.textContent()) ?? "",
        );
        // 本文の言語をフロントマターの lang で html に伝える
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        const text = (await page.locator("article .prose").textContent()) ?? "";
        expect(text.trim().length, "本文が空").toBeGreaterThan(20);
      },
    );

    test(
      `${path} の同一オリジンの画像がすべて読み込めている`,
      sources(source),
      async ({ page, baseURL }) => {
        await step(
          page,
          `${path} を開いて最下部までスクロールする`,
          async () => {
            await page.goto(path);
            await page.evaluate(() =>
              window.scrollTo(0, document.body.scrollHeight),
            );
            await page.waitForLoadState("networkidle");
          },
        );
        // 外部ホストの画像 (imgur など) は参照元制限でローカルから読めないことがあるため対象外
        const broken = await page.locator("main img").evaluateAll(
          (els, origin) =>
            (els as HTMLImageElement[])
              .filter((img) => img.src.startsWith(origin as string))
              .filter((img) => !(img.complete && img.naturalWidth > 0))
              .map((img) => img.src),
          new URL(baseURL ?? "http://localhost").origin,
        );
        expect(broken, "読み込めなかった画像").toEqual([]);
      },
    );
  }
});

test.describe("存在しないページ (404)", () => {
  test(
    "存在しない URL で 404 ページが表示され、トップへ戻れる",
    sources("src/pages/404.astro"),
    async ({ page }) => {
      const res = await step(page, "/this-page-does-not-exist/ を開く", () =>
        page.goto("/this-page-does-not-exist/"),
      );
      expect(res?.status()).toBe(404);
      await expect(page.locator("main h1")).toHaveText("404");
      await expect(
        page.getByText("お探しのページは見つかりませんでした"),
      ).toBeVisible();
      await expect(
        page.locator('meta[name="robots"]'),
        "404 ページは検索結果に出さない",
      ).toHaveAttribute("content", /noindex/);
      await expect(
        page.locator("main article.post-list-item").first(),
      ).toBeVisible();
      await step(page, "「トップページへ戻る」をクリックする", () =>
        page.getByRole("link", { name: "トップページへ戻る" }).click(),
      );
      await expect(page).toHaveURL(/\/$/);
    },
  );
});
