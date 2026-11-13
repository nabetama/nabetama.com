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
      // トップページではヘッダーのサイト名がページの見出し (h1) になる
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("header h1")).toHaveText("nabetama.com");
    },
  );

  test(
    "最新記事がカードで 3 件表示され、公開日と読了時間が付いている",
    sources(
      "src/pages/index.astro",
      "src/components/PostCard.astro",
      "src/site.config.ts",
      "src/lib/date.ts",
    ),
    async ({ page }) => {
      await step(page, "/ を開く", () => page.goto("/"));
      const cards = page.locator("article.blog-card");
      await expect(cards).toHaveCount(3);
      for (const card of await cards.all()) {
        await expect(card.locator("h3 a")).not.toBeEmpty();
        await expect(card.locator("time")).toHaveText(
          /^\d{4}年\d{2}月\d{2}日$/,
        );
        await expect(card).toContainText(/約\d+分/);
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
    "4 件目以降の記事リストは最大 18 件で、Archive の 4 件目から同じ順に並んでいる",
    sources("src/pages/index.astro", "src/components/PostList.astro"),
    async ({ page }) => {
      await step(page, "/posts/ を開いて 4〜21 件目を取得する", () =>
        page.goto("/posts/"),
      );
      const archive = (await listPostLinks(page)).slice(3, 21);
      await step(page, "/ を開いて記事リストまでスクロールする", async () => {
        await page.goto("/");
        await page
          .locator("article.post-list-item")
          .first()
          .scrollIntoViewIfNeeded();
      });
      const list = await listPostLinks(page);
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(18);
      expect(isSortedDesc(list.map((l) => l.date))).toBe(true);
      expect(list.map((l) => l.href)).toEqual(archive.map((a) => a.href));
    },
  );

  test(
    "「すべての記事を見る」に全記事数が表示され、記事一覧に遷移する",
    sources("src/pages/index.astro"),
    async ({ page }) => {
      await step(page, "/posts/ を開いて記事数を取得する", () =>
        page.goto("/posts/"),
      );
      const total = (await listPostLinks(page)).length;
      await step(page, "/ を開く", () => page.goto("/"));
      const link = page.getByRole("link", { name: /すべての記事を見る/ });
      await expect(link).toContainText(`(${total}件)`);
      await step(page, "「すべての記事を見る」をクリックする", () =>
        link.click(),
      );
      await expect(page).toHaveURL(/\/posts\/$/);
    },
  );

  test(
    "タグの一覧に記事数が付き、「すべてのタグ」でタグ一覧に遷移する",
    sources("src/pages/index.astro", "src/components/TagLink.astro"),
    async ({ page }) => {
      await step(page, "/ を開いてタグまでスクロールする", async () => {
        await page.goto("/");
        await page.locator("#tags-heading").scrollIntoViewIfNeeded();
      });
      const section = page.locator("section", {
        has: page.locator("#tags-heading"),
      });
      const first = section.locator('a[href^="/tags/"]').first();
      await expect(first).toHaveText(/^#.+\s*\d+$/);
      await step(page, "「すべてのタグ」をクリックする", () =>
        section.getByRole("link", { name: "すべてのタグ" }).click(),
      );
      await expect(page).toHaveURL(/\/tags\/$/);
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
      const href = (await tag.getAttribute("href")) ?? "";
      const name = decodeURIComponent(href.replace(/^\/tags\/|\/$/g, ""));
      await step(page, `タグ「${name}」をクリックする`, () => tag.click());
      await expect(page).toHaveURL(new RegExp(`/tags/${encodeURI(name)}/$`));
      await expect(page.locator("main h1")).toHaveText(`${name} の記事`);
      await snap(page, "タグページ");
    },
  );
});
