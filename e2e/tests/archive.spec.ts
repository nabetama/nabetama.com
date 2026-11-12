import {
  expect,
  isSortedDesc,
  listPostLinks,
  sources,
  step,
  test,
} from "./fixtures";

test.describe("記事一覧 (Archive)", () => {
  test(
    "記事一覧の件数が RSS フィードの記事数と一致する",
    sources("src/pages/posts/index.astro", "src/pages/feed.xml.ts"),
    async ({ page, request }) => {
      await step(page, "/posts/ を開く", () => page.goto("/posts/"));
      await expect(page.locator("main h1")).toHaveText("Archive");
      const links = await listPostLinks(page);
      const feed = await (await request.get("/feed.xml")).text();
      const feedCount = (feed.match(/<item>/g) ?? []).length;
      expect(links.length).toBeGreaterThan(0);
      expect(links.length).toBe(feedCount);
    },
  );

  test(
    "記事一覧が日付の新しい順に並んでいる",
    sources("src/pages/posts/index.astro"),
    async ({ page }) => {
      await step(page, "/posts/ を開く", () => page.goto("/posts/"));
      const dates = (await listPostLinks(page)).map((l) => l.date);
      expect(isSortedDesc(dates), `日付順: ${dates.join(", ")}`).toBe(true);
    },
  );

  test(
    "記事一覧のすべてのリンク先が 200 を返す",
    sources("src/pages/posts/index.astro", "src/pages/posts/[...slug].astro"),
    async ({ page, request }) => {
      await step(page, "/posts/ を開く", () => page.goto("/posts/"));
      const links = await listPostLinks(page);
      const broken: string[] = [];
      for (const l of links) {
        const res = await request.get(l.href);
        if (res.status() !== 200) broken.push(`${res.status()} ${l.href}`);
      }
      expect(broken, "リンク切れの記事").toEqual([]);
    },
  );

  test(
    "記事一覧の項目をクリックすると記事ページに遷移し、タイトルが一致する",
    sources("src/pages/posts/index.astro", "src/layouts/PostLayout.astro"),
    async ({ page }) => {
      await step(page, "/posts/ を開く", () => page.goto("/posts/"));
      const [first] = await listPostLinks(page);
      await step(page, `「${first.title}」をクリックする`, () =>
        page.locator(`main a[href="${first.href}"]`).click(),
      );
      await expect(page).toHaveURL(first.href);
      await expect(page.locator("article h1")).toHaveText(first.title);
    },
  );
});
