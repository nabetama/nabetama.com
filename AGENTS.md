# AGENTS.md

nabetama.com (Astro の静的ブログ) で作業するエージェント (Claude Code, Codex など) 向けのルール。

## 変更の種類

- **記事の作成・編集** (`src/content/posts/`, `src/content/pages/`, 記事用の画像): 人が行う。E2E の確認は不要。
- **アプリケーションの実装** (上記以外の `src/`, `astro.config.mjs`): エージェントが行う。下記の E2E の確認が必須。

## 実装を変更したら必ず行うこと

1. **E2E テストの更新が必要か判断する。**
   - `pnpm e2e:check` を実行する。main から変更した実装ファイルごとに、関連する E2E シナリオテスト (`e2e/tests/*.spec.ts` のうち、そのファイルを `sources()` で参照しているもの) が更新されているかを表示する。
   - 表示されたファイルの変更内容 (`git diff main -- <ファイル>`) を読み、挙動・文言・表示・件数・並び順・画面幅ごとの見え方が変わったか判断する。
2. **変わった場合は E2E テストを追加・更新する。**
   - 関連テストを更新するか、`e2e/tests/` にシナリオテストを追加する。テストの書き方は `.claude/skills/e2e-check/SKILL.md` の「テストの書き方」に従う。
   - 新しいテストには、検証対象の実装ファイルを `sources()` に書く (この対応付けで更新漏れを検知している)。
   - `e2e/tests/generated/` は自動生成なので手で編集しない。
3. **変わらない場合** (リファクタリング・型の修正など) は、コミットメッセージに理由を trailer で書く。
   ```
   git commit -m "refactor: ..." --trailer "E2E-Not-Needed: 表示と挙動は変わらないリファクタリング"
   ```
4. **`pnpm e2e` を実行し、全テストが通ることを確認する。** UI 変更が検知され、それが意図どおりなら `pnpm e2e --skip-build --update-baseline` でベースライン (`e2e/ui-baseline.json`) を更新する。不具合による変化ならベースラインを更新せず実装を直す。
5. 作業の報告に、E2E テストを追加・更新したか (しなかった場合はその理由) と `pnpm e2e` の結果を含める。

依存パッケージを更新したときも、テストの更新は不要でも `pnpm e2e` を実行して結果を確認する。

## 確認を強制している箇所

- **git push**: `.githooks/pre-push` が `e2e/lib/check-coverage.mjs` を実行し、テストが更新されておらず `E2E-Not-Needed:` もない実装の変更があれば push を止める。`pnpm install` で `core.hooksPath` が設定される。`--no-verify` で回避しないこと。
- **PR**: GitHub Actions (`.github/workflows/e2e-check.yml`) が同じ確認を行う。
- **Claude Code**: Stop hook (`.claude/settings.json`) が作業終了時に同じ確認を行い、未対応なら作業を続けさせる。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm e2e` | ビルド → UI 変更検知 → E2E → `e2e-report/index.html` にレポート |
| `pnpm e2e:check` | E2E テストの更新が必要な実装の変更を表示する |
| `pnpm test` | `src/lib` の純粋な関数の単体テスト (`node --test`) |
| `pnpm build` | `astro check` と `astro build` |
| `pnpm check` | biome による format と lint |
