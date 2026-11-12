---
name: e2e-check
description: nabetama.com をローカルでビルドし、ビルドしたサイトに E2E テストを実行して、スクリーンショット付きの HTML レポート (テストケース・シナリオ名・実施した操作・成功/失敗・想定原因・修正提案) を出す。UI やページ仕様の変更を検知し、不足しているテストを追加する。「動作確認して」「E2E を回して」「画面が壊れていないか見て」「UI を変えたのでテストして」「レポートを出して」などの依頼や、src/ 配下を変更した後の確認で使う。
---

# e2e-check

ローカルビルド → preview サーバー → UI 変更検知と自動テスト生成 → Playwright による E2E → HTML レポート、を `pnpm e2e` 1 コマンドで実行する。
この skill では、そのレポートを読んで失敗原因を調べ、UI・仕様の変更に合わせてテストを追加し、結果をユーザーに報告する。

## 構成

| パス | 役割 |
| --- | --- |
| `e2e/run.mjs` | `pnpm e2e` の本体。ビルド・サーバー起動・UI 収集・テスト実行・レポート出力を順に行う |
| `e2e/tests/*.spec.ts` | 手書きのシナリオテスト。`test.describe` の名前がレポートの「シナリオ」、`test` の名前が「テストケース」になる |
| `e2e/tests/fixtures.ts` | `test` / `step` / `snap` / `sources` などのテスト用ヘルパー |
| `e2e/tests/generated/*.spec.ts` | UI インベントリから毎回自動生成されるテスト。**手で編集しない** |
| `e2e/tests/inventory-tests.ts` | 自動生成テストの手順 (要素の表示・リンク先・aria-expanded の切り替え) |
| `e2e/ui-baseline.json` | UI インベントリのベースライン。コミットして共有する |
| `e2e/lib/inventory.mjs` | 全ページを PC 幅・スマホ幅で巡回して UI 要素を収集し、ベースラインと比較する |
| `e2e/lib/diagnose.mjs` | エラーメッセージと変更ファイルから「想定原因」「修正提案」を作るルール |
| `e2e-report/` | 出力先 (git 管理外)。`index.html` がレポート、`summary.md` が Markdown のサマリ |

## 手順

### 1. 実行する

```sh
pnpm e2e                    # ビルドから全部 (約 1 分)
pnpm e2e --skip-build       # dist/ が最新のとき
pnpm e2e --quick            # UI 巡回を各テンプレート 5 ページに絞る
pnpm e2e -- --grep "記事ページ"   # 一部のシナリオだけ実行 (UI 検知は行われる)
```

Bash の timeout は 600000 にする。テストが失敗すると終了コード 1 になるが、レポートは必ず出力される。

### 2. 結果を読む

`e2e-report/summary.md` を Read する。HTML は大きいので直接読まない。

- **ビルド失敗**: `e2e-report/build.json` の `log` を読み、型エラー・フロントマターのスキーマ違反・MDX 構文エラーのどれかを特定する。
- **テスト失敗**: 3 へ。
- **UI 変更あり**: 4 へ。

### 3. 失敗したテストの原因を調べる

summary.md の想定原因はエラーメッセージに対するルールベースの推定なので、必ず裏付けを取る。

1. 失敗時の画面を見る。`e2e-report/results.json` の該当テストの `screenshots[].path` と `steps[].screenshots[].path` (`e2e-report/` からの相対パス) を Read で開く。
2. テストの `annotations` の `source` にある関連ソースと、`git diff main -- <そのファイル>` を読む。
3. 次の 3 つのどれかに分類する。
   - **実装の不具合**: 実装を直す案を出す。直すかどうかはユーザーに確認する (この skill の目的は動作確認なので、勝手に実装を変えない)。
   - **意図した変更にテストが追従していない**: テストを直す。
   - **環境要因** (外部サイトの画像、タイミング依存): テストの待ち方や検証範囲を直す。
4. 分析結果を `e2e-report/analysis.json` に書き、`pnpm e2e:report` でレポートを再生成する。レポートでは「Claude による分析」としてルールベースの推定の代わりに表示される。

```json
{
  "e2e/tests/post.spec.ts › 目次バーのボタンで目次が開き、項目をタップすると見出しへ移動して閉じる": {
    "cause": ["src/layouts/PostLayout.astro の close() が scrollIntoView の直後にドロップダウン (高さ約 370px) を閉じるため、スクロール中にページが詰まり見出しが画面上端より上に行き過ぎる"],
    "fix": ["close() を先に呼び、ドロップダウンが閉じてから (transitionend 後に) scrollIntoView する"]
  }
}
```

キーは summary.md の `###` 見出し (`<テストファイル> › <テストケース名>`) と同じ文字列にする。

### 4. UI・仕様の変更に合わせてテストを追加する

`pnpm e2e` は UI インベントリをベースラインと比べ、差分を summary.md の「UI 変更」とレポートの「UI 変更検知」に出す。
**要素が追加された場合、表示確認・リンク先・開閉の自動テストは `e2e/tests/generated/` に生成済み**。ここでは自動テストで確かめられない操作と仕様のテストを手で追加する。

1. 差分を見る: 要素追加・要素削除・表示変化 (PC 幅/スマホ幅で見える/見えないが変わった)・head 要素の増減・ページ追加/削除。
2. インベントリに出ない仕様変更も拾う: `git diff main -- src/ astro.config.mjs` を読み、文言・件数 (`slice` の範囲)・並び順・フィルタ条件・スクリプトの挙動の変更を探す。
3. 変更ごとに次を判断してテストを追加・修正する。
   - 新しいボタン・開閉 UI → 操作した結果 (開く・閉じる・遷移・表示内容) を確かめるシナリオテスト
   - 新しいページ → そのページ固有の内容 (見出し・一覧の件数や順序・パンくず) のシナリオテスト
   - 文言・リンク先の変更 → それを参照している既存テストの更新 (要素削除・表示変化の行に、参照している手書きテストの `ファイル:行` が出る)
   - 要素・ページの削除 → 参照しているテストの削除または修正
4. 追加先は対象ページに対応する既存の spec (`home` / `navigation` / `archive` / `post` / `tags` / `static-pages` / `seo` / `quality`)。どれにも当たらなければ新しい spec を作る。
5. `pnpm e2e --skip-build` で追加したテストが通ることを確かめる。
6. 変更が意図どおりなら `pnpm e2e --skip-build --update-baseline` でベースラインを更新する。**意図しない変更 (不具合) ならベースラインを更新しない**。更新するまで差分は毎回表示される。

### テストの書き方

```ts
import { expect, MOBILE, snap, sources, step, test } from "./fixtures";

test.describe("シナリオ名 (例: ハンバーガーメニュー (スマホ))", () => {
  test.use(MOBILE); // スマホ幅のシナリオのみ

  test(
    "テストケース名 (何をすると何が起きるかを 1 文で)",
    sources("src/components/Header.astro"), // 失敗時に変更ファイルと突き合わせる関連ソース
    async ({ page }) => {
      await step(page, "/ を開く", () => page.goto("/"));          // 操作 + 終了時のスクリーンショット
      await step(page, "ハンバーガーボタンをタップする", () =>
        page.locator("#menu-toggle").click(),
      );
      await expect(page.locator("#menu-toggle")).toHaveAttribute("aria-expanded", "true");
      await snap(page, "メニューを開いた状態");                       // 任意の時点のスクリーンショット
    },
  );
});
```

- 操作は必ず `step(page, "<日本語の操作>", ...)` で包む。レポートの「実施した操作」とスクリーンショットになる。
- `sources(...)` には検証対象の実装ファイルを書く。
- 記事の件数・タイトルなどコンテンツに依存する値は固定値にせず、一覧や RSS から取得して突き合わせる (記事を追加してもテストが壊れないようにする)。
- 開閉メニューの「閉じている」は `toBeHidden` では判定できない (opacity:0 / max-height:0 の要素は Playwright では visible 扱い)。`toHaveCSS("opacity", "0")` か `aria-expanded` で判定する。
- 外部サイト (imgur など) のリソースはローカルから読めないことがあるので検証対象にしない。

### 5. 報告する

ユーザーには次をまとめて伝える。

- 実行結果 (テスト数・成功・失敗・UI 変更の件数) とレポートのパス `e2e-report/index.html`
- 失敗ごとに: 分類 (実装の不具合 / テストの追従漏れ / 環境要因)、原因、修正案
- 追加・修正したテストと、ベースラインを更新したかどうか

ユーザーがレポートを見たいと言ったら `open e2e-report/index.html` を実行する。

## 原因推定ルールを増やす

同じ種類の失敗が繰り返し出て、ルールベースの推定が外れる場合は `e2e/lib/diagnose.mjs` の `RULES` にルールを追加する。上から順に評価し、最初に一致したルールだけを使う。expect のエラーには必ず `Timeout: 5000ms` と `waiting for locator` が含まれるので、これらの語では判定しない。
