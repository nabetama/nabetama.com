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
    sources("src/layouts/PostLayout.astro", "src/pages/posts/[...slug].astro"),
    async ({ page }) => {
      const path = await latestPostPath(page);
      await step(page, `${path} を開く`, () => page.goto(path));
      const h1 = page.locator("article h1");
      await expect(h1).not.toBeEmpty();
      await expect(page.locator("article header time").first()).toHaveText(
        /^\d{4}年\d{2}月\d{2}日$/,
      );
      const crumbs = page.locator("main nav ol li");
      await expect(crumbs.nth(0)).toHaveText("Home");
      await expect(crumbs.nth(2)).toHaveText("Blog");
      await expect(crumbs.last()).toHaveText((await h1.textContent()) ?? "");
      await expect(page).toHaveTitle(
        `${(await h1.textContent())?.trim()} | nabetama.com`,
      );
    },
  );

  test(
    "パンくずの Blog と「すべての記事を見る」で記事一覧に戻れる",
    sources("src/layouts/PostLayout.astro"),
    async ({ page }) => {
      const path = await latestPostPath(page);
      await step(page, `${path} を開く`, () => page.goto(path));
      await step(page, "パンくずの Blog をクリックする", () =>
        page.locator("main nav ol").getByRole("link", { name: "Blog" }).click(),
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
      const name = (await tag.textContent())?.trim() ?? "";
      await step(page, `タグ「${name}」をクリックする`, () => tag.click());
      await expect(page.locator("main h1")).toHaveText(`${name} の記事`);
      await expect(page.locator(`main a[href="${path}"]`)).toHaveCount(1);
    },
  );

  test(
    "記事内の画像に alt があり、同一オリジンの画像が読み込めている",
    sources("src/components/Image.astro", "src/layouts/PostLayout.astro"),
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

test.describe("記事ページの目次 (PC)", () => {
  test(
    "目次の項目数が本文の h2/h3 見出し数と一致し、クリックで見出しへ移動する",
    sources(
      "src/components/TableOfContents.astro",
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
    sources("src/components/TableOfContents.astro"),
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
        await expect(first).toHaveClass(/text-indigo-600/);
      });
    },
  );
});

test.describe("記事ページの目次 (スマホ)", () => {
  test.use(MOBILE);

  test(
    "目次バーのボタンで目次が開き、項目をタップすると見出しへ移動して閉じる",
    sources("src/layouts/PostLayout.astro"),
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
    sources("src/layouts/PostLayout.astro"),
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
