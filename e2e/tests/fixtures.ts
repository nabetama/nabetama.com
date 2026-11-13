import {
  test as base,
  expect,
  type Page,
  type TestDetailsAnnotation,
} from "@playwright/test";

/** テスト中にページで発生した問題。レポートの「想定原因」の材料になる。 */
export type PageIssues = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
};

export const test = base.extend<{ issues: PageIssues }>({
  issues: [
    async ({ page, baseURL }, use, testInfo) => {
      const issues: PageIssues = {
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
      };
      const origin = baseURL ? new URL(baseURL).origin : "";
      // ページ遷移そのもののエラー (404 ページを開くテストなど) はリソースの読み込み失敗として扱わない。
      // 遷移先のステータスは各テストが response.status() で検証する。
      const navigationErrors = new Set<string>();
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const src = msg.location().url;
        if (/^Failed to load resource/.test(msg.text()) && src) {
          // 外部サイト (imgur など) のリソースはローカル検証の対象外
          if (!src.startsWith(origin) || navigationErrors.has(src)) return;
        }
        issues.consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => issues.pageErrors.push(err.message));
      page.on("response", (res) => {
        if (res.status() < 400 || !res.url().startsWith(origin)) return;
        const req = res.request();
        if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
          navigationErrors.add(res.url());
          return;
        }
        issues.failedRequests.push(`${res.status()} ${res.url()}`);
      });
      page.on("requestfailed", (req) => {
        if (req.url().startsWith(origin)) {
          issues.failedRequests.push(
            `${req.failure()?.errorText ?? "failed"} ${req.url()}`,
          );
        }
      });
      await use(issues);
      const total =
        issues.consoleErrors.length +
        issues.pageErrors.length +
        issues.failedRequests.length;
      if (total > 0) {
        await testInfo.attach("page-issues", {
          body: JSON.stringify(issues, null, 2),
          contentType: "application/json",
        });
      }
    },
    { auto: true },
  ],
});

export { expect };

/**
 * テストが検証している実装ファイル。失敗時にレポートの想定原因で
 * 「このファイルが作業ツリーで変更されている」と突き合わせるために使う。
 */
export function sources(...files: string[]): {
  annotation: TestDetailsAnnotation[];
} {
  return {
    annotation: files.map((f) => ({ type: "source", description: f })),
  };
}

/** 現在の画面をスクリーンショットとしてレポートに添付する。test.step の中で呼ぶとその操作に紐づく。 */
export async function snap(page: Page, label: string, fullPage = false) {
  await test.info().attach(label, {
    body: await page.screenshot({ fullPage, type: "jpeg", quality: 70 }),
    contentType: "image/jpeg",
  });
}

/** 操作 (test.step) を実行し、終わった時点の画面を添付する。 */
export async function step<T>(
  page: Page,
  title: string,
  body: () => Promise<T>,
): Promise<T> {
  return test.step(title, async () => {
    const result = await body();
    await snap(page, title);
    return result;
  });
}

export const MOBILE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};

/**
 * 一覧ページ (/posts/ など) の記事リンクを上から順に取得する。
 * 記事一覧の項目 (article.post-list-item) は見出しのリンクと公開日の time を持つ。
 */
export async function listPostLinks(page: Page) {
  return page.locator("main article.post-list-item").evaluateAll((els) =>
    els.map((el) => {
      const link = el.querySelector("a");
      return {
        href: link?.getAttribute("href") ?? "",
        title: link?.textContent?.trim() ?? "",
        date: el.querySelector("time")?.getAttribute("datetime") ?? "",
      };
    }),
  );
}

/** 記事一覧の先頭 (最新) の記事 URL。 */
export async function latestPostPath(page: Page): Promise<string> {
  await page.goto("/posts/");
  const links = await listPostLinks(page);
  expect(links.length, "記事一覧に記事が 1 件もない").toBeGreaterThan(0);
  return links[0].href;
}

/** 日付文字列の配列が新しい順 (降順) に並んでいるか。 */
export function isSortedDesc(dates: string[]): boolean {
  const t = dates.map((d) => new Date(d).getTime());
  return t.every((v, i) => i === 0 || t[i - 1] >= v);
}
