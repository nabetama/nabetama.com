// 自動生成テスト (e2e/tests/generated/*.spec.ts) の本体。
// 生成ファイルは UI インベントリのデータだけを持ち、テストの手順はここで定義する。
import type { Page } from "@playwright/test";
import { isActuallyVisible } from "../lib/dom.mjs";
import { expect, MOBILE, sources, step, test } from "./fixtures";

export type InventoryElement = {
  key: string;
  type: "interactive" | "structure" | "landmark";
  selector: string;
  text: string;
  linkKind: string | null;
  href: string | null;
  ariaExpanded: boolean;
  /** その幅で見える要素が見つかったサンプル URL。見えない場合は null。 */
  desktop: string | null;
  mobile: string | null;
  /** ベースラインになかった (今回検知した) 要素か。 */
  isNew: boolean;
};

export type InventoryTemplate = {
  file: string;
  route: string;
  kind: string;
  sample: string;
  status: number | null;
  head: string[];
  elements: InventoryElement[];
};

type VisibleWindow = { __e2eIsVisible: (el: Element) => boolean };

async function installVisibility(page: Page) {
  await page.addInitScript(
    `window.__e2eIsVisible = ${isActuallyVisible.toString()};`,
  );
}

function locate(page: Page, el: InventoryElement) {
  const loc = page.locator(el.selector);
  return el.text ? loc.filter({ hasText: el.text }) : loc;
}

const label = (el: InventoryElement) =>
  el.isNew ? `[新規] ${el.key}` : el.key;

function defineVisibilityTests(
  t: InventoryTemplate,
  viewport: "desktop" | "mobile",
) {
  const vpName = viewport === "desktop" ? "PC 幅" : "スマホ幅";
  for (const el of t.elements) {
    const url = el[viewport];
    if (!url) continue;
    test(
      `${label(el)} が${vpName}で表示される`,
      sources(t.file),
      async ({ page }) => {
        await installVisibility(page);
        await test.step(`${vpName}で ${decodeURI(url)} を開く`, () =>
          page.goto(url));
        const loc = locate(page, el);
        await expect(
          loc.first(),
          `${el.selector} が見つからない`,
        ).toBeAttached();
        const index = await loc.evaluateAll((els) =>
          els.findIndex((e) =>
            (window as unknown as VisibleWindow).__e2eIsVisible(e),
          ),
        );
        expect(
          index,
          `${el.selector} が${vpName}で見えていない`,
        ).toBeGreaterThanOrEqual(0);
        await test.info().attach(`${el.key} (${vpName})`, {
          body: await loc.nth(index).screenshot({ type: "jpeg", quality: 70 }),
          contentType: "image/jpeg",
        });
      },
    );

    if (el.ariaExpanded) {
      test(
        `${label(el)} を${vpName}でクリックすると aria-expanded が切り替わる`,
        sources(t.file),
        async ({ page }) => {
          await installVisibility(page);
          await test.step(`${decodeURI(url)} を開く`, () => page.goto(url));
          const target = locate(page, el).first();
          const before = await target.getAttribute("aria-expanded");
          await test.step(`${el.key} をクリックする`, () => target.click());
          await expect(target).not.toHaveAttribute(
            "aria-expanded",
            before ?? "",
          );
          await test.step("もう一度クリックして元に戻す", () => target.click());
          await expect(target).toHaveAttribute("aria-expanded", before ?? "");
        },
      );
    }
  }
}

/** 生成ファイルから呼ばれ、1 テンプレート分のテストを定義する。 */
export function defineInventoryTests(t: InventoryTemplate) {
  // 要素ごとのテストが多いため、成功時の全画面キャプチャは取らず要素単位のキャプチャだけ添付する。
  // screenshot は describe 内で上書きできないため、生成ファイルのトップレベルで呼ばれるここで指定する。
  test.use({ screenshot: "only-on-failure" });
  test.describe(`[自動] ${t.route} (${t.file})`, () => {
    const expectedStatus = t.kind === "not-found" ? 404 : 200;
    test(
      `${t.route} が ${expectedStatus} を返し、記録した head 要素がそろっている`,
      sources(t.file),
      async ({ page }) => {
        const res = await step(page, `${decodeURI(t.sample)} を開く`, () =>
          page.goto(t.sample),
        );
        expect(res?.status()).toBe(expectedStatus);
        const missing: string[] = [];
        for (const h of t.head) {
          if ((await page.locator(`head ${h}`).count()) === 0) missing.push(h);
        }
        expect(missing, "head から消えた要素").toEqual([]);
      },
    );

    for (const el of t.elements) {
      if (el.linkKind !== "internal" && el.linkKind !== "dynamic") continue;
      const url = el.desktop ?? el.mobile;
      if (!url) continue;
      test(
        `${label(el)} のリンク先が 200 を返す`,
        sources(t.file),
        async ({ page, request }) => {
          await test.step(`${decodeURI(url)} を開いて href を取得する`, () =>
            page.goto(url));
          const href = await locate(page, el).first().getAttribute("href");
          expect(href).toBeTruthy();
          const res = await request.get(href as string);
          expect(res.status(), `${href} のステータス`).toBe(200);
        },
      );
    }

    test.describe("PC 幅", () => defineVisibilityTests(t, "desktop"));
    test.describe("スマホ幅", () => {
      test.use(MOBILE);
      defineVisibilityTests(t, "mobile");
    });
  });
}
