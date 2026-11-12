import { expect, latestPostPath, sources, step, test } from "./fixtures";

const SITE = "https://nabetama.com";

test.describe("SEO・配信ファイル", () => {
  test(
    "主要ページに title / description / canonical / OGP / lang が設定されている",
    sources("src/layouts/BaseLayout.astro", "astro.config.mjs"),
    async ({ page }) => {
      const paths = ["/", "/posts/", "/about/", await latestPostPath(page)];
      for (const path of paths) {
        await step(page, `${path} を開いてメタ情報を確認する`, async () => {
          await page.goto(path);
          await expect(page.locator("html")).toHaveAttribute("lang", "ja");
          await expect(page).toHaveTitle(/nabetama\.com$/);
          const meta = (sel: string) =>
            page.locator(sel).getAttribute("content");
          expect(await meta('meta[name="description"]')).toBeTruthy();
          await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            "href",
            `${SITE}${path}`,
          );
          expect(await meta('meta[property="og:title"]')).toBeTruthy();
          expect(await meta('meta[property="og:url"]')).toBe(`${SITE}${path}`);
          expect(await meta('meta[property="og:image"]')).toMatch(
            /^https?:\/\//,
          );
          await expect(
            page.locator('link[rel="alternate"][type="application/rss+xml"]'),
          ).toHaveAttribute("href", "/feed.xml");
        });
      }
    },
  );

  test(
    "記事ページの og:type が article になっている",
    sources("src/layouts/PostLayout.astro"),
    async ({ page }) => {
      const path = await latestPostPath(page);
      await step(page, `${path} を開く`, () => page.goto(path));
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
        "content",
        "article",
      );
    },
  );

  test(
    "feed.xml が RSS として配信され、記事リンクが絶対 URL になっている",
    sources("src/pages/feed.xml.ts"),
    async ({ request }) => {
      const res = await request.get("/feed.xml");
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toMatch(/xml/);
      const xml = await res.text();
      expect(xml).toContain("<rss");
      const links = [
        ...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g),
      ].map((m) => m[1]);
      expect(links.length).toBeGreaterThan(0);
      for (const l of links)
        expect(l).toMatch(/^https:\/\/nabetama\.com\/posts\//);
    },
  );

  test(
    "sitemap と robots.txt が配信され、sitemap にトップと記事が含まれる",
    sources("astro.config.mjs", "public/robots.txt"),
    async ({ request }) => {
      const index = await request.get("/sitemap-index.xml");
      expect(index.status()).toBe(200);
      const sitemap = await (await request.get("/sitemap-0.xml")).text();
      expect(sitemap).toContain(`<loc>${SITE}/</loc>`);
      expect(sitemap).toMatch(
        /<loc>https:\/\/nabetama\.com\/posts\/[^<]+<\/loc>/,
      );
      const robots = await request.get("/robots.txt");
      expect(robots.status()).toBe(200);
    },
  );
});
