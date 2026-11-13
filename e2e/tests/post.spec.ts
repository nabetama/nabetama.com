import type { APIRequestContext, Page } from "@playwright/test";
import {
  expect,
  latestPostPath,
  listPostLinks,
  MOBILE,
  snap,
  sources,
  step,
  test,
} from "./fixtures";

/** 目次 (h2/h3 見出し) を持つ記事を新しい順に探す。 */
async function findPostWithToc(page: Page, request: APIRequestContext) {
  await page.goto("/posts/");
  for (const { href } of await listPostLinks(page)) {
    const html = await (await request.get(href)).text();
    if (html.includes("toc-link")) return href;
  }
  return null;
}

test.describe("記事ページ", () => {
  test(
    "最新記事のタイトル・公開日・パンくずが表示される",
    sources(
      "src/layouts/PostLayout.astro",
      "src/pages/posts/[...slug].astro",
      "src/components/Breadcrumbs.astro",
      "src/lib/date.ts",
    ),
    async ({ page }) => {
      const path = await latestPostPath(page);
      await step(page, `${path} を開く`, () => page.goto(path));
      const h1 = page.locator("article h1");
      await expect(h1).not.toBeEmpty();
      await expect(page.locator("article header time").first()).toHaveText(
        /^\d{4}年\d{2}月\d{2}日$/,
      );
      const crumbs = page.locator(
        "main nav[aria-label='パンくずリスト'] ol li",
      );
      await expect(crumbs).toHaveCount(3);
      await expect(crumbs.nth(0)).toHaveText("Home");
      await expect(crumbs.nth(1)).toHaveText("Archive");
      await expect(crumbs.last()).toHaveText((await h1.textContent()) ?? "");
      await expect(crumbs.last().locator("[aria-current='page']")).toHaveCount(
        1,
      );
      await expect(page.locator("article header")).toContainText(
        /約\d+分で読めます/,
      );
      await expect(page).toHaveTitle(
        `${(await h1.textContent())?.trim()} | nabetama.com`,
      );
    },
  );

  test(
    "パンくずの Archive と「すべての記事を見る」で記事一覧に戻れる",
    sources("src/layouts/PostLayout.astro"),
    async ({ page }) => {
      const path = await latestPostPath(page);
      await step(page, `${path} を開く`, () => page.goto(path));
      await step(page, "パンくずの Archive をクリックする", () =>
        page
          .locator("main nav[aria-label='パンくずリスト']")
          .getByRole("link", { name: "Archive" })
          .click(),
      );
      await expect(page).toHaveURL(/\/posts\/?$/);
      await step(page, `${path} に戻る`, () => page.goto(path));
      await step(page, "「すべての記事を見る」をクリックする", () =>
        page.getByRole("link", { name: "すべての記事を見る" }).click(),
      );
      await expect(page).toHaveURL(/\/posts\/?$/);
    },
  );

  test(
    "記事のタグからタグページに遷移でき、元の記事がそのタグページに載っている",
    sources("src/layouts/PostLayout.astro", "src/pages/tags/[tag].astro"),
    async ({ page }) => {
      const path = await latestPostPath(page);
      await step(page, `${path} を開く`, () => page.goto(path));
      const tag = page.locator('article header a[href^="/tags/"]').first();
      test.skip((await tag.count()) === 0, "最新記事にタグがない");
      const href = (await tag.getAttribute("href")) ?? "";
      const name = decodeURIComponent(href.replace(/^\/tags\/|\/$/g, ""));
      await expect(tag).toHaveText(`#${name}`);
      await step(page, `タグ「${name}」をクリックする`, () => tag.click());
      await expect(page.locator("main h1")).toHaveText(`${name} の記事`);
      await expect(page.locator(`main a[href="${path}"]`)).toHaveCount(1);
    },
  );

  test(
    "記事内の画像に alt があり、同一オリジンの画像が読み込めている",
    sources(
      "src/components/mdx/Image.astro",
      "src/components/mdx/LazyImg.astro",
      "src/components/mdx/index.ts",
      "src/components/Prose.astro",
    ),
    async ({ page, baseURL }) => {
      const path = await latestPostPath(page);
      await step(page, `${path} を開いて最下部までスクロールする`, async () => {
        await page.goto(path);
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        await page.waitForLoadState("networkidle");
      });
      const images = await page.locator("article .prose img").evaluateAll(
        (els, origin) =>
          (els as HTMLImageElement[]).map((img) => ({
            src: img.currentSrc || img.src,
            alt: img.getAttribute("alt"),
            loaded:
              !img.src.startsWith(origin as string) ||
              (img.complete && img.naturalWidth > 0),
          })),
        new URL(baseURL ?? "http://localhost").origin,
      );
      expect(
        images.filter((i) => !i.alt).map((i) => i.src),
        "alt なし",
      ).toEqual([]);
      expect(
        images.filter((i) => !i.loaded).map((i) => i.src),
        "読み込み失敗",
      ).toEqual([]);
    },
  );
});

test.describe("記事本文の表示", () => {
  test(
    "Markdown の画像は遅延読み込みになり、表は表だけが横スクロールする",
    sources(
      "src/components/mdx/LazyImg.astro",
      "src/components/mdx/ScrollTable.astro",
      "src/components/mdx/index.ts",
    ),
    async ({ page, request }) => {
      await page.goto("/posts/");
      let withTable = "";
      let withImage = "";
      for (const { href } of await listPostLinks(page)) {
        const html = await (await request.get(href)).text();
        if (!withTable && html.includes('class="table-scroll"'))
          withTable = href;
        if (!withImage && /<img loading="lazy"/.test(html)) withImage = href;
        if (withTable && withImage) break;
      }
      expect(withImage, "遅延読み込みの画像を持つ記事がない").not.toBe("");
      await step(page, `画像のある記事 ${withImage} を開く`, () =>
        page.goto(withImage),
      );
      await expect(
        page.locator("article .prose img[loading='lazy']").first(),
      ).toHaveAttribute("decoding", "async");
      test.skip(!withTable, "表を持つ記事がない");
      await step(page, `表のある記事 ${withTable} を開く`, () =>
        page.goto(withTable),
      );
      await expect(
        page.locator("article .prose .table-scroll > table").first(),
      ).toBeAttached();
      await expect(page.locator(".table-scroll").first()).toHaveCSS(
        "overflow-x",
        "auto",
      );
    },
  );
});

test.describe("記事本文の見出しリンク・コードのコピー", () => {
  test(
    "見出しの # リンクがその見出しの id を指し、クリックで URL に反映される",
    sources(
      "src/components/mdx/Heading.astro",
      "src/components/mdx/H2.astro",
      "src/components/mdx/H3.astro",
      "src/components/mdx/index.ts",
    ),
    async ({ page, request }) => {
      const path = await findPostWithToc(page, request);
      test.skip(!path, "見出しを持つ記事がない");
      await step(page, `${path} を開く`, () => page.goto(path as string));
      const heading = page.locator("article .prose h2[id]").first();
      const id = (await heading.getAttribute("id")) ?? "";
      const anchor = heading.locator("a.heading-anchor");
      await expect(anchor).toHaveAttribute("href", `#${id}`);
      await step(
        page,
        "見出しにカーソルを合わせて # をクリックする",
        async () => {
          await heading.hover();
          await anchor.click();
        },
      );
      await expect
        .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
        .toBe(`#${id}`);
    },
  );

  test(
    "コードブロックの「コピー」でコードがクリップボードに入る",
    sources("src/components/mdx/CodeBlock.astro"),
    async ({ page, request, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto("/posts/");
      let path = "";
      for (const { href } of await listPostLinks(page)) {
        if ((await (await request.get(href)).text()).includes("copy-code")) {
          path = href;
          break;
        }
      }
      test.skip(!path, "コードブロックを持つ記事がない");
      await step(page, `コードのある記事 ${path} を開く`, () =>
        page.goto(path),
      );
      const block = page.locator(".code-block").first();
      await block.scrollIntoViewIfNeeded();
      const code = await block.locator("pre").innerText();
      await step(page, "コードブロックの「コピー」をクリックする", async () => {
        await block.hover();
        await block.locator("button.copy-code").click();
      });
      await expect(block.locator("button.copy-code")).toHaveText(
        "コピーしました",
      );
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        code,
      );
    },
  );
});

test.describe("記事ページの目次 (PC)", () => {
  test(
    "目次の項目数が本文の h2/h3 見出し数と一致し、クリックで見出しへ移動する",
    sources(
      "src/components/post/TableOfContents.astro",
      "src/layouts/PostLayout.astro",
    ),
    async ({ page, request }) => {
      const path = await findPostWithToc(page, request);
      test.skip(!path, "目次を持つ記事がない");
      await step(page, `目次のある記事 ${path} を開く`, () =>
        page.goto(path as string),
      );
      const toc = page.locator("aside nav[aria-label='目次']");
      await expect(toc).toBeVisible();
      const links = toc.locator("a.toc-link");
      const headingCount = await page
        .locator("article .prose h2[id], article .prose h3[id]")
        .count();
      await expect(links).toHaveCount(headingCount);

      const last = links.last();
      const slug = (await last.getAttribute("data-slug")) ?? "";
      await step(
        page,
        `目次の最後の項目「${await last.textContent()}」をクリックする`,
        async () => {
          await last.click();
          await expect
            .poll(() => page.evaluate(() => decodeURIComponent(location.hash)))
            .toBe(`#${slug}`);
          await expect(page.locator(`[id="${slug}"]`)).toBeInViewport();
        },
      );
    },
  );

  test(
    "スクロール位置に応じて目次の現在位置がハイライトされる",
    sources("src/components/post/TableOfContents.astro"),
    async ({ page, request }) => {
      const path = await findPostWithToc(page, request);
      test.skip(!path, "目次を持つ記事がない");
      await step(page, `目次のある記事 ${path} を開く`, () =>
        page.goto(path as string),
      );
      const first = page.locator("aside a.toc-link").first();
      const slug = (await first.getAttribute("data-slug")) ?? "";
      await step(page, "最初の見出しまでスクロールする", async () => {
        // 目次スクリプトは IntersectionObserver の rootMargin "-80px 0px -80% 0px" で
        // 画面上端から 80px〜(高さの 20%) の帯に入った見出しをハイライトする。見出しを上端 120px に置く。
        await page.locator(`[id="${slug}"]`).evaluate((el) => {
          window.scrollTo({
            top: el.getBoundingClientRect().top + window.scrollY - 120,
            behavior: "instant",
          });
        });
        await expect(first).toHaveAttribute("aria-current", "location");
      });
    },
  );
});

test.describe("記事ページの目次 (スマホ)", () => {
  test.use(MOBILE);

  test(
    "目次バーのボタンで目次が開き、項目をタップすると見出しへ移動して閉じる",
    sources(
      "src/components/post/MobileToc.astro",
      "src/layouts/PostLayout.astro",
    ),
    async ({ page, request }) => {
      const path = await findPostWithToc(page, request);
      test.skip(!path, "目次を持つ記事がない");
      await step(page, `スマホ幅で ${path} を開く`, () =>
        page.goto(path as string),
      );
      const toggle = page.locator("#mobile-toc-toggle");
      const dropdown = page.locator("#mobile-toc-dropdown");
      await expect(toggle).toBeVisible();
      await expect(page.locator("aside nav[aria-label='目次']")).toBeHidden();
      await step(page, "目次ボタンをタップする", async () => {
        await toggle.click();
        await expect(dropdown).toHaveCSS("opacity", "1");
      });
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      const item = dropdown.locator("a.mobile-toc-link").first();
      const slug = (await item.getAttribute("data-slug")) ?? "";
      await step(
        page,
        `目次の「${await item.textContent()}」をタップする`,
        async () => {
          await item.click();
          await expect(dropdown).toHaveCSS("opacity", "0");
        },
      );
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator(`[id="${slug}"]`)).toBeInViewport();
      await snap(page, "見出しへ移動した後");
    },
  );

  test(
    "目次の「ページトップへ」でページ先頭に戻る",
    sources(
      "src/components/post/MobileToc.astro",
      "src/layouts/PostLayout.astro",
    ),
    async ({ page, request }) => {
      const path = await findPostWithToc(page, request);
      test.skip(!path, "目次を持つ記事がない");
      await step(
        page,
        `スマホ幅で ${path} を開いて下までスクロールする`,
        async () => {
          await page.goto(path as string);
          await page.evaluate(() =>
            window.scrollTo(0, document.body.scrollHeight),
          );
        },
      );
      await step(
        page,
        "目次を開いて「ページトップへ」をタップする",
        async () => {
          await page.locator("#mobile-toc-toggle").click();
          await page.getByRole("link", { name: "ページトップへ" }).click();
          await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
        },
      );
    },
  );
});

test.describe("記事ページの前後の記事・関連記事・シェア", () => {
  test(
    "前の記事・次の記事が記事一覧の並びで隣の記事を指す",
    sources("src/components/post/PostNav.astro", "src/lib/posts.ts"),
    async ({ page }) => {
      await step(page, "/posts/ を開く", () => page.goto("/posts/"));
      const links = await listPostLinks(page);
      test.skip(links.length < 3, "記事が 3 件未満");
      const [newer, current, older] = links;
      await step(page, `2 番目に新しい記事 ${current.href} を開く`, () =>
        page.goto(current.href),
      );
      const nav = page.locator("nav[aria-label='前後の記事']");
      await expect(nav.locator("a[rel='prev']")).toHaveAttribute(
        "href",
        older.href,
      );
      await expect(nav.locator("a[rel='next']")).toHaveAttribute(
        "href",
        newer.href,
      );
      await step(page, "「前の記事」をクリックする", () =>
        nav.locator("a[rel='prev']").click(),
      );
      await expect(page.locator("article h1").first()).toHaveText(older.title);
    },
  );

  test(
    "最新の記事には「次の記事」がない",
    sources("src/components/post/PostNav.astro"),
    async ({ page }) => {
      const path = await latestPostPath(page);
      await step(page, `${path} を開く`, () => page.goto(path));
      await expect(
        page.locator("nav[aria-label='前後の記事'] a[rel='next']"),
      ).toHaveCount(0);
    },
  );

  test(
    "関連する記事は自分以外で、共通のタグを持つ記事だけが載る",
    sources("src/layouts/PostLayout.astro", "src/lib/posts.ts"),
    async ({ page, request }) => {
      await page.goto("/posts/");
      let path = "";
      for (const { href } of await listPostLinks(page)) {
        if (
          (await (await request.get(href)).text()).includes("related-heading")
        ) {
          path = href;
          break;
        }
      }
      test.skip(!path, "関連記事を持つ記事がない");
      await step(page, `関連記事のある記事 ${path} を開く`, () =>
        page.goto(path),
      );
      const tags = await page
        .locator("article header ul[aria-label='タグ'] a")
        .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
      const related = page.locator(
        "section[aria-labelledby='related-heading'] article a",
      );
      const hrefs = await related.evaluateAll((els) =>
        els.map((e) => e.getAttribute("href") ?? ""),
      );
      expect(hrefs.length).toBeGreaterThan(0);
      expect(hrefs.length).toBeLessThanOrEqual(3);
      expect(hrefs).not.toContain(path);
      for (const href of hrefs) {
        const html = await (await request.get(href)).text();
        expect(
          tags.some((t) => html.includes(`href="${t}"`)),
          `${href} が ${tags.join(", ")} のどれも持たない`,
        ).toBe(true);
      }
    },
  );

  test(
    "シェアのリンクが記事の URL とタイトルを含む",
    sources("src/components/post/ShareLinks.astro"),
    async ({ page }) => {
      const path = await latestPostPath(page);
      await step(page, `${path} を開く`, () => page.goto(path));
      const url = `https://nabetama.com${path}`;
      const x = page.getByRole("link", { name: "ポスト" });
      const href = new URL((await x.getAttribute("href")) ?? "");
      expect(href.hostname).toBe("x.com");
      expect(href.searchParams.get("url")).toBe(url);
      expect(href.searchParams.get("text")).toBe(
        (await page.locator("article h1").textContent())?.trim(),
      );
      await expect(
        page.getByRole("link", { name: /はてなブックマーク/ }),
      ).toHaveAttribute(
        "href",
        `https://b.hatena.ne.jp/entry/s/${url.replace("https://", "")}`,
      );
    },
  );

  test(
    "「URL をコピー」で記事の URL がクリップボードに入る",
    sources("src/components/post/ShareLinks.astro"),
    async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      const path = await latestPostPath(page);
      await step(page, `${path} を開く`, () => page.goto(path));
      const button = page.getByRole("button", { name: "URL をコピー" });
      await step(page, "「URL をコピー」をクリックする", () => button.click());
      await expect(
        page.getByRole("button", { name: "コピーしました" }),
      ).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        `https://nabetama.com${path}`,
      );
    },
  );
});
