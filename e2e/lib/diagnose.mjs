// 失敗したテストのエラーメッセージ・ページで起きた問題・変更ファイルから
// 「想定原因」と「修正提案」を組み立てる。
// Claude が e2e-report/analysis.json に書いた分析があれば、render-report.mjs 側でそちらを優先表示する。

// 上から順に評価し、最初に一致したルールだけを採用する。
// expect のエラーには必ず "Timeout: 5000ms" や "waiting for locator" が含まれるため、
// それらの語ではなく、マッチャー名と Received の内容で判定する。
const RULES = [
  {
    when: (m) => /ERR_CONNECTION_REFUSED|ECONNREFUSED/.test(m),
    cause:
      "テスト対象のホストに接続できなかった。preview サーバーが起動していないか、起動直後に落ちている。",
    fix: "`pnpm build` が成功して dist/ が生成されているか確認し、`pnpm exec astro preview --ignore-lock` を単体で起動してエラーが出ないか確認する。",
  },
  {
    when: (m) =>
      /リンク切れ|読み込み失敗|読み込めなかった画像|alt なし/.test(m),
    cause:
      "リンク先・画像の参照先が存在しない、または画像に alt が付いていない。記事・ページ本文 (mdx) の記述ミスの可能性が高い。",
    fix: "エラーに出ている URL を src/content/ 配下で grep して記述を直す。画像なら public/ にファイルがあるか確認する。",
  },
  {
    when: (m) => /日付順/.test(m),
    cause:
      "記事の並び順が日付の降順になっていない。sort の比較関数か、フロントマターの date の書式が変わった。",
    fix: "compareDesc(new Date(a.data.date), new Date(b.data.date)) の sort と、該当記事の date が YYYY-MM-DD 形式か確認する。",
  },
  {
    when: (m) => /scrollWidth=/.test(m),
    cause:
      "スマホ幅でページの横幅がビューポートを超えている。固定幅の要素・長い URL・幅指定のある埋め込み (iframe / img) がはみ出している。",
    fix: "全画面スクリーンショットではみ出している要素を特定し、max-width: 100% や break-words / overflow-x-auto を付ける。",
  },
  {
    when: (m) => /JavaScript の例外|コンソールエラー/.test(m),
    cause:
      "ページのスクリプトが実行時エラーを出している、またはリソース読み込みエラーがコンソールに出ている。",
    fix: "エラー詳細の Received に出ているメッセージから該当の <script> またはリソースを特定する。DOM 要素が存在しない場合の null チェック漏れが多い。",
  },
  {
    when: (m) =>
      /Test timeout of \d+ms exceeded|page\.goto: Timeout|\.(click|fill|hover|tap): Timeout/.test(
        m,
      ),
    cause:
      "操作または待機がタイムアウトした。クリック対象が出てこない・他の要素に覆われている・ページ読み込みが終わらない (外部リソース待ち) のいずれか。",
    fix: "失敗時のスクリーンショットと trace (`pnpm exec playwright show-trace <trace.zip>`) で、どの時点で止まっているか確認する。",
  },
  {
    when: (m) =>
      /element\(s\) not found|resolved to 0 elements|が見つからない/.test(m),
    cause:
      "テストが探している要素がページに存在しない。マークアップ (タグ・id・class・aria-label・リンク文言) が変わったか、表示条件 (データの有無・画面幅) により描画されていない。",
    fix: "エラーに出ている Locator と、関連ソースのマークアップを突き合わせる。意図した UI 変更ならテストの Locator を新しいマークアップに合わせて更新し、意図しない変更ならマークアップを戻す。",
  },
  {
    when: (m) => /toHaveURL/.test(m),
    cause:
      "クリック後の遷移先 URL が期待と違う。リンクの href が変わったか、末尾スラッシュの有無が変わったか、クリック対象が別の要素に重なっている。",
    fix: "リンクの href と astro.config.mjs の trailingSlash 設定を確認する。クリックが別要素に吸われている場合はスクリーンショットで重なりを確認する。",
  },
  {
    when: (m) => /toHaveTitle/.test(m),
    cause:
      "ページの <title> が期待と違う。BaseLayout の pageTitle の組み立て (`<ページの title> | nabetama.com`) か、ページから渡す title が変わった。",
    fix: "src/layouts/BaseLayout.astro の pageTitle と、該当ページが BaseLayout に渡している title を確認する。",
  },
  {
    when: (m) => /toHaveCount/.test(m),
    cause:
      "要素の数が期待と違う。表示件数のロジック (slice の範囲・フィルタ条件) か、記事データの件数が変わった。",
    fix: "該当ページのフロントマター側スクリプト (getCollection 後の filter / slice) を確認する。記事数の増減による正常な変化ならテストの期待値を見直す。",
  },
  {
    when: (m) => /toBeInViewport/.test(m),
    cause:
      "要素が画面内にない。スクロール処理 (scrollIntoView・アンカー移動) が動いていないか、スムーズスクロールが終わる前に判定している、または固定ヘッダーの下に隠れている。",
    fix: "クリック後のスクリーンショットでスクロール位置を確認し、スクロールを行うスクリプトと scroll-margin-top を確認する。",
  },
  {
    when: (m) => /toBeHidden|toBeVisible|見えていない/.test(m),
    cause:
      "要素の表示・非表示の状態が期待と違う。CSS のブレークポイント (md: / xl:)、hidden クラス、開閉用スクリプトの動作が変わった可能性がある。",
    fix: "失敗時のスクリーンショットで要素の状態を確認し、Tailwind のレスポンシブ指定と開閉スクリプト (aria-expanded / style の切り替え) を確認する。",
  },
  {
    when: (m) => /toHaveClass/.test(m),
    cause:
      "要素のクラスが期待と違う。クラスを付け外しするスクリプト (スクロール連動のハイライトなど) が動いていないか、クラス名が変わった。",
    fix: "Received のクラス一覧と、クラスを書き換えるスクリプトの条件 (IntersectionObserver の rootMargin など) を確認する。",
  },
  {
    when: (m) => /toHaveAttribute|toHaveCSS/.test(m),
    cause:
      "要素の属性・スタイルが期待と違う。マークアップの属性変更、またはクリック時に属性を書き換えるスクリプトが動いていない。",
    fix: "エラーの Expected / Received を見て、対応するマークアップ・スクリプトの属性の書き換え処理を確認する。",
  },
  {
    when: (m) => /Expected: (200|404)\b|のステータス|status=/.test(m),
    cause:
      "ページまたはリソースが期待と違う HTTP ステータスを返した。ルートが生成されていない (getStaticPaths の対象外・ファイル名変更) か、リンク先の綴りが間違っている。",
    fix: "dist/ に該当パスの index.html があるか確認する。ない場合は src/pages/ のファイル名と getStaticPaths の戻り値を、ある場合はリンク元の href を確認する。",
  },
  {
    when: (m) => /toEqual|toBe\b|toContain|toMatch/.test(m),
    cause:
      "取得した値が期待値と一致しない。エラー詳細の Expected と Received の差分が直接の原因。",
    fix: "差分の値がどのソース (ページのスクリプト・コンテンツ・設定) から来ているかを関連ソースから確認する。",
  },
];

/**
 * @param {object} t results.json の 1 テスト
 * @param {{changedFiles: string[], uiDiff: object|null}} ctx
 */
export function diagnose(t, ctx) {
  if (t.status === "passed" || t.status === "skipped") return null;
  const message = t.errors.map((e) => e.message).join("\n");
  const causes = [];
  const fixes = [];
  const rule = RULES.find((r) => r.when(message));
  if (rule) {
    causes.push(rule.cause);
    fixes.push(rule.fix);
    const waited = message.match(
      /waiting for ((?:locator|getBy\w+)\(.*?\)(?:\.\w+\(.*?\))*)\s*$/m,
    );
    if (waited) causes.push(`待機していた要素: \`${waited[1]}\``);
  } else {
    causes.push("エラーメッセージから原因を特定できるルールに一致しなかった。");
    fixes.push("エラー詳細と失敗時のスクリーンショットを確認する。");
  }

  const issues = t.pageIssues;
  if (issues?.pageErrors?.length) {
    causes.push(
      `テスト中にページで JavaScript の例外が発生している: ${issues.pageErrors[0]}`,
    );
  }
  if (issues?.failedRequests?.length) {
    causes.push(
      `テスト中に読み込みに失敗したリソースがある: ${issues.failedRequests.slice(0, 3).join(", ")}`,
    );
  }

  const sources = t.annotations
    .filter((a) => a.type === "source")
    .map((a) => a.description);
  const touched = ctx.changedFiles.filter((f) =>
    sources.some((s) => f === s || f.startsWith(s)),
  );
  if (touched.length > 0) {
    causes.unshift(
      `このテストが検証している次のファイルが、このブランチまたは作業ツリーで変更されている: ${touched.join(", ")}`,
    );
    fixes.unshift(
      `\`git diff main -- ${touched.join(" ")}\` で変更内容を確認し、変更が意図どおりならテストを、意図しないものなら実装を直す。`,
    );
  }

  if (t.generated) {
    causes.push(
      "このテストは UI インベントリから自動生成されたもの。要素が削除・改名された場合、ベースライン更新前は失敗する。",
    );
    fixes.push(
      "要素の削除が意図どおりなら `pnpm e2e --update-baseline` でベースラインと自動テストを更新する。",
    );
  }
  return { causes, fixes, sources };
}

/** ビルド失敗時の原因推定。 */
export function diagnoseBuild(log) {
  const causes = [];
  const fixes = [];
  if (/error ts\(\d+\)|\berror\b.*TS\d+|Found \d+ error/i.test(log)) {
    causes.push("astro check で型エラーが出ている。");
    fixes.push("ログの `error ts(...)` の行に出ているファイル・行番号を直す。");
  }
  if (
    /InvalidContentEntryDataError|does not match collection schema|frontmatter/i.test(
      log,
    )
  ) {
    causes.push(
      "記事のフロントマターが content.config.ts のスキーマに合っていない。",
    );
    fixes.push(
      "ログに出ている記事ファイルの title / date / tags などの型を src/content.config.ts のスキーマに合わせる。",
    );
  }
  if (
    /Could not resolve|Cannot find module|Failed to resolve import/i.test(log)
  ) {
    causes.push("import しているモジュールやファイルが見つからない。");
    fixes.push(
      "import パス (@/ エイリアス含む) とファイル名の大文字小文字を確認する。依存なら `pnpm install` を実行する。",
    );
  }
  if (/MDX|mdx|Unexpected character|Could not parse expression/i.test(log)) {
    causes.push("MDX の構文エラーがある ({ } や < の扱いなど)。");
    fixes.push(
      "ログに出ている mdx の行を確認し、JSX として解釈される記号をエスケープする。",
    );
  }
  if (causes.length === 0) {
    causes.push("ビルドが失敗した。ログ末尾を参照。");
    fixes.push("ログの最初の error 行から確認する。");
  }
  return { causes, fixes };
}
