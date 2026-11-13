import {
  expect,
  isSortedDesc,
  listPostLinks,
  sources,
  step,
  test,
} from "./fixtures";

/** タグ一覧 (/tags/) からタグページの URL をすべて取得する。 */
async function tagPaths(request: import("@playwright/test").APIRequestContext) {
  const html = await (await request.get("/tags/")).text();
  const main = html.slice(html.indexOf("<main"));
  return [
    ...new Set(
      [...main.matchAll(/href="(\/tags\/[^"/]+\/)"/g)].map((m) => m[1]),
    ),
  ];
}

test.describe("タグページ", () => {
  test(
    "すべてのタグページが 200 を返し、記事が 1 件以上載っている",
    sources("src/pages/tags/[tag].astro"),
    async ({ page, request }) => {
      const paths = await tagPaths(request);
      expect(paths.length, "タグ一覧にタグがない").toBeGreaterThan(0);
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

test.describe("タグ一覧", () => {
  test(
    "タグ一覧にすべてのタグが記事数付きで載り、数がタグページの記事数と一致する",
    sources("src/pages/tags/index.astro", "src/components/TagLink.astro"),
    async ({ page, request }) => {
      await step(page, "/tags/ を開く", () => page.goto("/tags/"));
      await expect(page.locator("main h1")).toHaveText("Tags");
      const tags = await page
        .locator('main a[href^="/tags/"]')
        .evaluateAll((els) =>
          els.map((el) => ({
            href: el.getAttribute("href") ?? "",
            count: Number(el.querySelector("span:last-child")?.textContent),
          })),
        );
      expect(tags.length).toBe((await tagPaths(request)).length);
      const counts = tags.map((t) => t.count);
      expect(
        [...counts].sort((a, b) => b - a),
        "記事数の多い順に並んでいる",
      ).toEqual(counts);
      for (const t of [tags[0], tags.at(-1) ?? tags[0]]) {
        await step(page, `${decodeURIComponent(t.href)} を開く`, () =>
          page.goto(t.href),
        );
        expect((await listPostLinks(page)).length).toBe(t.count);
      }
      await expect(
        page.locator("main nav[aria-label='パンくずリスト'] a[href='/tags/']"),
      ).toBeVisible();
    },
  );
});

test.describe("タグページの検索エンジン向け設定", () => {
  test(
    "記事が 1 件のタグページは noindex で sitemap に載らず、2 件以上のタグページは sitemap に載る",
    sources(
      "src/pages/tags/[tag].astro",
      "src/layouts/ListLayout.astro",
      "astro.config.mjs",
      "src/site.config.ts",
    ),
    async ({ page, request }) => {
      const sitemap = decodeURI(
        await (await request.get("/sitemap-0.xml")).text(),
      );
      const problems: string[] = [];
      let thinCount = 0;
      for (const p of await tagPaths(request)) {
        await page.goto(p);
        const count = (await listPostLinks(page)).length;
        const noindex = await page
          .locator('meta[name="robots"][content*="noindex"]')
          .count();
        const inSitemap = sitemap.includes(`${decodeURI(p)}</loc>`);
        const thin = count < 2;
        if (thin) thinCount++;
        if (thin !== (noindex === 1) || thin === inSitemap) {
          problems.push(
            `${decodeURI(p)}: 記事数=${count} noindex=${noindex} sitemap=${inSitemap}`,
          );
        }
      }
      expect(problems).toEqual([]);
      expect(
        thinCount,
        "記事 1 件のタグがなく、確認できていない",
      ).toBeGreaterThan(0);
    },
  );
});
