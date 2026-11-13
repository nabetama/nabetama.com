import {
  expect,
  latestPostPath,
  listPostLinks,
  sources,
  step,
  test,
} from "./fixtures";

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

type JsonLdNode = Record<string, unknown> & { "@type": string };

async function jsonLdNodes(page: import("@playwright/test").Page) {
  const raw = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  return raw.flatMap(
    (r) => (JSON.parse(r) as { "@graph": JsonLdNode[] })["@graph"],
  );
}

test.describe("SEO・構造化データ", () => {
  test(
    "記事ページに BlogPosting と BreadcrumbList の構造化データがあり、記事の内容と一致する",
    sources(
      "src/lib/structured-data.ts",
      "src/layouts/PostLayout.astro",
      "src/components/SEO.astro",
    ),
    async ({ page }) => {
      const path = await latestPostPath(page);
      await step(page, `${path} を開く`, () => page.goto(path));
      const nodes = await jsonLdNodes(page);
      const types = nodes.map((n) => n["@type"]);
      expect(types).toEqual(
        expect.arrayContaining([
          "WebSite",
          "Person",
          "BlogPosting",
          "BreadcrumbList",
        ]),
      );
      const post = nodes.find((n) => n["@type"] === "BlogPosting");
      if (!post) throw new Error("BlogPosting がない");
      const title = (await page.locator("article h1").textContent())?.trim();
      expect(post.headline).toBe(title);
      expect(post.url).toBe(`${SITE}${path}`);
      expect(String(post.datePublished)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      const desc = await page
        .locator('meta[name="description"]')
        .getAttribute("content");
      expect(post.description).toBe(desc);
      const crumbs = nodes.find(
        (n) => n["@type"] === "BreadcrumbList",
      ) as unknown as {
        itemListElement: { name: string; item: string }[];
      };
      expect(crumbs.itemListElement.map((c) => c.name)).toEqual([
        "Home",
        "Archive",
        title,
      ]);
      expect(crumbs.itemListElement.at(-1)?.item).toBe(`${SITE}${path}`);
    },
  );

  test(
    "記事ページに公開日・タグの article メタと、サイト名を含まない og:title がある",
    sources("src/components/SEO.astro", "src/layouts/PostLayout.astro"),
    async ({ page }) => {
      const path = await latestPostPath(page);
      await step(page, `${path} を開く`, () => page.goto(path));
      const title = (await page.locator("article h1").textContent())?.trim();
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        title ?? "",
      );
      await expect(
        page.locator('meta[property="article:published_time"]'),
      ).toHaveAttribute("content", /^\d{4}-\d{2}-\d{2}T/);
      const tagCount = await page
        .locator("article header ul[aria-label='タグ'] a")
        .count();
      await expect(page.locator('meta[property="article:tag"]')).toHaveCount(
        tagCount,
      );
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        "content",
        "summary_large_image",
      );
    },
  );

  test(
    "すべての記事ページで description が空でない (未設定の記事は本文の冒頭から作る)",
    sources("src/lib/posts.ts", "src/lib/text.ts"),
    async ({ page, request }) => {
      await step(page, "/posts/ を開く", () => page.goto("/posts/"));
      const empty: string[] = [];
      for (const { href } of await listPostLinks(page)) {
        const html = await (await request.get(href)).text();
        const m = html.match(/<meta name="description" content="([^"]*)"/);
        if (!m || m[1].trim().length === 0) empty.push(href);
      }
      expect(empty, "description が空の記事").toEqual([]);
    },
  );

  test(
    "一覧ページに CollectionPage の構造化データがあり、記事数が一覧と一致する",
    sources("src/layouts/ListLayout.astro", "src/lib/structured-data.ts"),
    async ({ page }) => {
      await step(page, "/posts/ を開く", () => page.goto("/posts/"));
      const links = await listPostLinks(page);
      const nodes = await jsonLdNodes(page);
      const collection = nodes.find(
        (n) => n["@type"] === "CollectionPage",
      ) as unknown as {
        mainEntity: { numberOfItems: number };
      };
      expect(collection.mainEntity.numberOfItems).toBe(links.length);
    },
  );

  test(
    "draft の記事は公開されず、sitemap・フィードにも載らない",
    sources("src/lib/posts.ts", "src/content.config.ts"),
    async ({ request }) => {
      const res = await request.get("/posts/1999-01-01/");
      expect(res.status()).toBe(404);
      const sitemap = await (await request.get("/sitemap-0.xml")).text();
      expect(sitemap).not.toContain("/posts/1999-01-01/");
      const feed = await (await request.get("/feed.xml")).text();
      expect(feed).not.toContain("/posts/1999-01-01/");
    },
  );

  test(
    "sitemap の記事 URL に最終更新日 (lastmod) が付いている",
    sources("astro.config.mjs"),
    async ({ request }) => {
      const sitemap = await (await request.get("/sitemap-0.xml")).text();
      const posts = [
        ...sitemap.matchAll(
          /<url><loc>[^<]*\/posts\/[^<]+<\/loc>(<lastmod>)?/g,
        ),
      ];
      expect(posts.length).toBeGreaterThan(0);
      expect(posts.filter((m) => !m[1]).map((m) => m[0])).toEqual([]);
    },
  );

  test(
    "feed.xml に言語・自身の URL・記事のカテゴリが入っている",
    sources("src/pages/feed.xml.ts"),
    async ({ request }) => {
      const xml = await (await request.get("/feed.xml")).text();
      expect(xml).toContain("<language>ja</language>");
      expect(xml).toContain(`<atom:link href="${SITE}/feed.xml" rel="self"`);
      expect(xml).toMatch(/<category>[^<]+<\/category>/);
    },
  );
});

test.describe("フィードの本文・アイコン", () => {
  test(
    "feed.xml の新しい記事には本文全体が入り、script・画面操作用の要素・サイト内の相対 URL が残っていない",
    sources("src/pages/feed.xml.ts", "src/lib/feed-content.ts"),
    async ({ request }) => {
      const xml = await (await request.get("/feed.xml")).text();
      const contents = [
        ...xml.matchAll(/<content:encoded>([\s\S]*?)<\/content:encoded>/g),
      ].map((m) => m[1]);
      expect(contents.length).toBeGreaterThan(0);
      expect(contents.length).toBeLessThanOrEqual(20);
      for (const c of contents) {
        expect(c).not.toContain("&lt;script");
        expect(c).not.toMatch(/(href|src)=&quot;\/(?!\/)/);
        expect(c).not.toContain("copy-code");
        expect(c).not.toContain("heading-anchor");
      }
    },
  );

  test(
    "apple-touch-icon と manifest が配信されている",
    sources("src/layouts/BaseLayout.astro", "public/manifest.webmanifest"),
    async ({ page, request }) => {
      await step(page, "/ を開く", () => page.goto("/"));
      for (const sel of [
        'link[rel="apple-touch-icon"]',
        'link[rel="manifest"]',
      ]) {
        const href = (await page.locator(sel).getAttribute("href")) ?? "";
        expect((await request.get(href)).status(), `${sel} ${href}`).toBe(200);
      }
      const manifest = await (
        await request.get("/manifest.webmanifest")
      ).json();
      expect(manifest.name).toBe("nabetama.com");
    },
  );
});

test.describe("記事ごとの OGP 画像", () => {
  test(
    "画像のない記事の og:image はタイトル入りの生成画像 (1200×630 の PNG) を指し、大きい画像のカードになる",
    sources(
      "src/pages/og/posts/[slug].png.ts",
      "src/lib/og-image.ts",
      "src/lib/posts.ts",
      "src/layouts/PostLayout.astro",
    ),
    async ({ page, request }) => {
      await page.goto("/posts/");
      let path = "";
      let image = "";
      for (const { href } of await listPostLinks(page)) {
        const html = await (await request.get(href)).text();
        const m = html.match(/<meta property="og:image" content="([^"]+)"/);
        if (m && m[1].includes("/og/posts/")) {
          path = href;
          image = m[1];
          break;
        }
      }
      expect(path, "生成画像を使う記事がない").not.toBe("");
      const id = path.replace(/^\/posts\/|\/$/g, "");
      expect(image).toBe(`${SITE}/og/posts/${id}.png`);
      await step(page, `${path} を開く`, () => page.goto(path));
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        "content",
        "summary_large_image",
      );
      await expect(
        page.locator('meta[property="og:image:width"]'),
      ).toHaveAttribute("content", "1200");
      const res = await request.get(`/og/posts/${id}.png`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toMatch(/image\/png/);
      const png = await res.body();
      // PNG の IHDR から幅と高さを読む
      expect(png.readUInt32BE(16)).toBe(1200);
      expect(png.readUInt32BE(20)).toBe(630);
      await step(page, "生成画像を開く", () =>
        page.goto(`/og/posts/${id}.png`),
      );
    },
  );

  test(
    "記事内に画像がある記事の og:image は、その画像を指す",
    sources("src/lib/posts.ts", "src/lib/text.ts"),
    async ({ request }) => {
      const html = await (await request.get("/posts/2026-01-28/")).text();
      const m = html.match(/<meta property="og:image" content="([^"]+)"/);
      expect(m?.[1]).not.toContain("/og/posts/");
      expect(m?.[1]).toMatch(/^https:\/\//);
    },
  );
});
