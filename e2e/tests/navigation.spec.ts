import { expect, MOBILE, sources, step, test } from "./fixtures";

test.describe("ヘッダー・フッターのナビゲーション (PC)", () => {
  test(
    "ヘッダーの Archive リンクで記事一覧に遷移する",
    sources("src/components/Header.astro"),
    async ({ page }) => {
      await step(page, "/ を開く", () => page.goto("/"));
      await step(page, "ヘッダーの Archive をクリックする", () =>
        page
          .locator("header nav")
          .getByRole("link", { name: "Archive" })
          .click(),
      );
      await expect(page).toHaveURL(/\/posts\/?$/);
      await expect(page.locator("main h1")).toHaveText("Archive");
    },
  );

  test(
    "ヘッダーの About me リンクで About ページに遷移する",
    sources("src/components/Header.astro", "src/pages/about.astro"),
    async ({ page }) => {
      await step(page, "/ を開く", () => page.goto("/"));
      await step(page, "ヘッダーの About me をクリックする", () =>
        page
          .locator("header nav")
          .getByRole("link", { name: "About me" })
          .click(),
      );
      await expect(page).toHaveURL(/\/about\/?$/);
      await expect(page.locator("main h1")).toBeVisible();
    },
  );

  test(
    "ヘッダーの Tags リンクでタグ一覧に遷移し、現在のページとして示される",
    sources("src/components/Header.astro", "src/pages/tags/index.astro"),
    async ({ page }) => {
      await step(page, "/ を開く", () => page.goto("/"));
      await step(page, "ヘッダーの Tags をクリックする", () =>
        page.locator("header nav").getByRole("link", { name: "Tags" }).click(),
      );
      await expect(page).toHaveURL(/\/tags\/$/);
      await expect(page.locator("main h1")).toHaveText("Tags");
      await expect(
        page.locator("header nav").first().getByRole("link", { name: "Tags" }),
      ).toHaveAttribute("aria-current", "page");
    },
  );

  test(
    "ヘッダーのサイト名をクリックするとトップページに戻る",
    sources("src/components/Header.astro"),
    async ({ page }) => {
      await step(page, "/about/ を開く", () => page.goto("/about/"));
      // トップページ以外ではサイト名は見出しにしない (ページの h1 は 1 つだけ)
      await expect(page.locator("h1")).toHaveCount(1);
      await step(page, "ヘッダーのサイト名をクリックする", () =>
        page.locator('header a[rel="home"]').click(),
      );
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator("article.blog-card").first()).toBeVisible();
    },
  );

  test(
    "PC 幅ではハンバーガーメニューのボタンが表示されない",
    sources("src/components/Header.astro"),
    async ({ page }) => {
      await step(page, "/ を開く", () => page.goto("/"));
      await expect(page.locator("#menu-toggle")).toBeHidden();
      await expect(page.locator("header nav").first()).toBeVisible();
    },
  );

  test(
    "フッターのリンク (Archive / Tags / About me / GitHub / X / RSS) の遷移先が正しい",
    sources(
      "src/components/Footer.astro",
      "src/components/Icon.astro",
      "src/site.config.ts",
    ),
    async ({ page }) => {
      await step(page, "/ を開いてフッターまでスクロールする", async () => {
        await page.goto("/");
        await page.locator("footer").scrollIntoViewIfNeeded();
      });
      const footer = page.locator("footer");
      for (const [label, href] of [
        ["Archive", "/posts/"],
        ["Tags", "/tags/"],
        ["About me", "/about/"],
        ["RSS フィード", "/feed.xml"],
      ]) {
        await expect(footer.getByRole("link", { name: label })).toHaveAttribute(
          "href",
          href,
        );
      }
      for (const [label, href] of [
        ["GitHub", "https://github.com/nabetama"],
        ["X (Twitter)", "https://x.com/nabetama"],
      ]) {
        const link = footer.getByRole("link", { name: label });
        await expect(link).toHaveAttribute("href", href);
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", /noopener/);
      }
      await step(page, "フッターの Archive をクリックする", () =>
        footer.getByRole("link", { name: "Archive" }).click(),
      );
      await expect(page).toHaveURL(/\/posts\/?$/);
    },
  );
});

test.describe("ハンバーガーメニュー (スマホ)", () => {
  test.use(MOBILE);

  test(
    "スマホ幅ではヘッダーのナビが隠れ、ハンバーガーボタンが表示される",
    sources("src/components/Header.astro"),
    async ({ page }) => {
      await step(page, "スマホ幅で / を開く", () => page.goto("/"));
      await expect(page.locator("#menu-toggle")).toBeVisible();
      await expect(page.locator("#menu-toggle")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(page.locator("#mobile-menu")).toHaveCSS("opacity", "0");
    },
  );

  test(
    "ハンバーガーボタンでメニューが開閉する",
    sources("src/components/Header.astro"),
    async ({ page }) => {
      await step(page, "スマホ幅で / を開く", () => page.goto("/"));
      const toggle = page.locator("#menu-toggle");
      const menu = page.locator("#mobile-menu");
      await step(
        page,
        "ハンバーガーボタンをタップしてメニューを開く",
        async () => {
          await toggle.click();
          await expect(menu).toHaveCSS("opacity", "1");
        },
      );
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(
        menu.getByRole("link", { name: "Archive" }),
      ).toBeInViewport();
      await step(page, "もう一度タップしてメニューを閉じる", async () => {
        await toggle.click();
        await expect(menu).toHaveCSS("opacity", "0");
      });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    },
  );

  test(
    "メニュー内のリンクをタップすると遷移する",
    sources("src/components/Header.astro"),
    async ({ page }) => {
      await step(page, "スマホ幅で / を開く", () => page.goto("/"));
      await step(page, "ハンバーガーボタンをタップする", async () => {
        await page.locator("#menu-toggle").click();
        await expect(page.locator("#mobile-menu")).toHaveCSS("opacity", "1");
      });
      await step(page, "メニューの About me をタップする", () =>
        page
          .locator("#mobile-menu")
          .getByRole("link", { name: "About me" })
          .click(),
      );
      await expect(page).toHaveURL(/\/about\/?$/);
    },
  );

  test(
    "メニューを開いた状態で Escape を押すと閉じ、ボタンにフォーカスが戻る",
    sources("src/components/Header.astro"),
    async ({ page }) => {
      await step(page, "スマホ幅で / を開いてメニューを開く", async () => {
        await page.goto("/");
        await page.locator("#menu-toggle").click();
        await expect(page.locator("#mobile-menu")).toHaveCSS("opacity", "1");
      });
      await step(page, "Escape を押す", () => page.keyboard.press("Escape"));
      await expect(page.locator("#menu-toggle")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(page.locator("#menu-toggle")).toBeFocused();
    },
  );
});
