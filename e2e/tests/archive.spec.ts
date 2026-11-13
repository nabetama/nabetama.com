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

test.describe("記事一覧 (Archive) の年ごとの区切り", () => {
  test(
    "年の見出しごとに記事がまとまり、見出しの年と記事の公開年が一致する",
    sources("src/pages/posts/index.astro", "src/lib/posts.ts"),
    async ({ page }) => {
      await step(page, "/posts/ を開く", () => page.goto("/posts/"));
      const sections = await page.locator("main section").evaluateAll((els) =>
        els.map((el) => ({
          year: el.querySelector("h2")?.textContent?.trim() ?? "",
          dates: [...el.querySelectorAll("article.post-list-item time")].map(
            (t) => t.getAttribute("datetime") ?? "",
          ),
        })),
      );
      expect(sections.length).toBeGreaterThan(0);
      const mismatched = sections.flatMap((s) =>
        s.dates
          .filter((d) => !d.startsWith(s.year))
          .map((d) => `${s.year}: ${d}`),
      );
      expect(mismatched).toEqual([]);
      const years = sections.map((s) => Number(s.year));
      expect([...years].sort((a, b) => b - a)).toEqual(years);
    },
  );

  test(
    "年のリンクをクリックすると、その年の見出しへ移動する",
    sources("src/pages/posts/index.astro"),
    async ({ page }) => {
      await step(page, "/posts/ を開く", () => page.goto("/posts/"));
      const link = page.locator("nav[aria-label='年で移動'] a").last();
      const href = (await link.getAttribute("href")) ?? "";
      await step(page, `年のリンク ${href} をクリックする`, () => link.click());
      await expect(page.locator(href)).toBeInViewport();
      await expect(link).toContainText(
        `(${await page.locator(`section:has(${href}) article.post-list-item`).count()})`,
      );
    },
  );
});
