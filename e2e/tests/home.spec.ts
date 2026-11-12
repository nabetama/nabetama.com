import {
  expect,
  isSortedDesc,
  listPostLinks,
  snap,
  sources,
  step,
  test,
} from "./fixtures";

test.describe("トップページ", () => {
  test(
    "トップページが表示され、ページタイトルがサイト名になっている",
    sources("src/pages/index.astro", "src/layouts/BaseLayout.astro"),
    async ({ page }) => {
      await step(page, "/ を開く", () => page.goto("/"));
      await expect(page).toHaveTitle("nabetama.com");
      await expect(
        page.getByRole("link", { name: "nabetama.com" }).first(),
      ).toBeVisible();
    },
  );

  test(
    "最新記事がカードで 3 件表示され、読了時間が付いている",
    sources("src/pages/index.astro"),
    async ({ page }) => {
      await step(page, "/ を開く", () => page.goto("/"));
      const cards = page.locator("article.blog-card");
      await expect(cards).toHaveCount(3);
      for (const card of await cards.all()) {
        await expect(card.locator("h3 a")).not.toBeEmpty();
        await expect(card).toContainText(/\d+ min read/);
      }
    },
  );

  test(
    "最新記事カードの 3 件が Archive の先頭 3 件と同じ順で一致する",
    sources("src/pages/index.astro", "src/pages/posts/index.astro"),
    async ({ page }) => {
      await step(page, "/posts/ を開いて先頭 3 件を取得する", () =>
        page.goto("/posts/"),
      );
      const archive = (await listPostLinks(page)).slice(0, 3);
      await step(page, "/ を開いてカードのリンクを取得する", () =>
        page.goto("/"),
      );
      const cardHrefs = await page
        .locator("article.blog-card h3 a")
        .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
      expect(cardHrefs).toEqual(archive.map((a) => a.href));
    },
  );

  test(
    "4 件目以降の記事リストは最大 18 件で、日付の新しい順に並んでいる",
    sources("src/pages/index.astro"),
    async ({ page }) => {
      await step(page, "/ を開いて記事リストまでスクロールする", async () => {
        await page.goto("/");
        await page.locator("section time").first().scrollIntoViewIfNeeded();
      });
      const dates = await page
        .locator("section time")
        .evaluateAll((els) => els.map((e) => e.getAttribute("datetime") ?? ""));
      expect(dates.length).toBeGreaterThan(0);
      expect(dates.length).toBeLessThanOrEqual(18);
      expect(isSortedDesc(dates), `日付順: ${dates.join(", ")}`).toBe(true);
    },
  );

  test(
    "記事カードをクリックすると、その記事ページに遷移する",
    sources("src/pages/index.astro", "src/layouts/PostLayout.astro"),
    async ({ page }) => {
      await step(page, "/ を開く", () => page.goto("/"));
      const link = page.locator("article.blog-card h3 a").first();
      const title = (await link.textContent())?.trim() ?? "";
      const href = (await link.getAttribute("href")) ?? "";
      await step(page, `カード「${title}」をクリックする`, () => link.click());
      await expect(page).toHaveURL(href);
      await expect(page.locator("h1").last()).toHaveText(title);
    },
  );

  test(
    "記事カードのタグをクリックすると、そのタグの記事一覧に遷移する",
    sources("src/pages/index.astro", "src/pages/tags/[tag].astro"),
    async ({ page }) => {
      await step(page, "/ を開く", () => page.goto("/"));
      const tag = page.locator('article.blog-card a[href^="/tags/"]').first();
      test.skip((await tag.count()) === 0, "タグ付きのカードがない");
      const name = (await tag.textContent())?.trim() ?? "";
      await step(page, `タグ「${name}」をクリックする`, () => tag.click());
      await expect(page).toHaveURL(new RegExp(`/tags/${encodeURI(name)}/$`));
      await expect(page.locator("main h1")).toHaveText(`${name} の記事`);
      await snap(page, "タグページ");
    },
  );
});
