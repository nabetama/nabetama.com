import {
  expect,
  isSortedDesc,
  listPostLinks,
  sources,
  step,
  test,
} from "./fixtures";

/** sitemap からタグページの URL をすべて取得する。 */
async function tagPaths(request: import("@playwright/test").APIRequestContext) {
  const xml = await (await request.get("/sitemap-0.xml")).text();
  return [...xml.matchAll(/<loc>https?:\/\/[^/]+(\/tags\/[^<]+)<\/loc>/g)].map(
    (m) => m[1],
  );
}

test.describe("タグページ", () => {
  test(
    "すべてのタグページが 200 を返し、記事が 1 件以上載っている",
    sources("src/pages/tags/[tag].astro"),
    async ({ page, request }) => {
      const paths = await tagPaths(request);
      expect(paths.length, "sitemap にタグページがない").toBeGreaterThan(0);
      const problems: string[] = [];
      for (const p of paths) {
        const res = await page.goto(p);
        const count = (await listPostLinks(page)).length;
        if (res?.status() !== 200 || count === 0) {
          problems.push(`${p}: status=${res?.status()} 記事数=${count}`);
        }
      }
      expect(problems).toEqual([]);
    },
  );

  test(
    "タグページの見出しがタグ名で、記事が日付の新しい順に並んでいる",
    sources("src/pages/tags/[tag].astro"),
    async ({ page, request }) => {
      const [p] = await tagPaths(request);
      const name = decodeURIComponent(p.replace(/^\/tags\/|\/$/g, ""));
      await step(page, `${decodeURIComponent(p)} を開く`, () => page.goto(p));
      await expect(page.locator("main h1")).toHaveText(`${name} の記事`);
      await expect(page).toHaveTitle(`${name} の記事 | nabetama.com`);
      const dates = (await listPostLinks(page)).map((l) => l.date);
      expect(isSortedDesc(dates), `日付順: ${dates.join(", ")}`).toBe(true);
    },
  );

  test(
    "タグページに載っている記事は、すべてそのタグを持っている",
    sources("src/pages/tags/[tag].astro", "src/layouts/PostLayout.astro"),
    async ({ page, request }) => {
      const [p] = await tagPaths(request);
      await step(page, `${decodeURIComponent(p)} を開く`, () => page.goto(p));
      const links = await listPostLinks(page);
      const missing: string[] = [];
      for (const { href } of links) {
        const html = await (await request.get(href)).text();
        if (
          !html.includes(`href="${decodeURIComponent(p)}"`) &&
          !html.includes(`href="${p}"`)
        ) {
          missing.push(href);
        }
      }
      expect(missing, "タグを持たない記事").toEqual([]);
    },
  );
});
