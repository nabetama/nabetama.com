// e2e-report/ の JSON (results / build / ui-diff / analysis) から HTML レポートを生成する。
// 単体実行: node e2e/lib/render-report.mjs  (analysis.json を書き足した後の再生成に使う)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { diagnose, diagnoseBuild } from "./diagnose.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const REPORT_DIR = join(ROOT, "e2e-report");

const readJson = (name) => {
  const p = join(REPORT_DIR, name);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
};

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const inlineCode = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

const git = (args) => {
  try {
    return execFileSync("git", args, { cwd: ROOT }).toString().trim();
  } catch {
    return "";
  }
};

function changedFiles() {
  const files = new Set();
  const base = git(["merge-base", "HEAD", "main"]);
  if (base)
    for (const f of git(["diff", "--name-only", base]).split("\n"))
      if (f) files.add(f);
  for (const l of git(["status", "--porcelain"]).split("\n"))
    if (l) files.add(l.slice(3));
  return [...files].sort();
}

const STATUS = {
  passed: { label: "成功", cls: "ok" },
  failed: { label: "失敗", cls: "ng" },
  timedOut: { label: "失敗 (タイムアウト)", cls: "ng" },
  interrupted: { label: "中断", cls: "ng" },
  skipped: { label: "スキップ", cls: "skip" },
};

const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

export function renderReport() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const results = readJson("results.json") ?? { tests: [] };
  const build = readJson("build.json");
  const uiDiff = readJson("ui-diff.json");
  const analysis = readJson("analysis.json") ?? {};
  const meta = readJson("run.json") ?? {};
  const changed = changedFiles();

  const tests = results.tests.map((t, i) => {
    const key = `${t.file} › ${t.title}`;
    const d = diagnose(t, { changedFiles: changed, uiDiff });
    const a = analysis[key] ?? analysis[t.id] ?? null;
    return { ...t, no: i + 1, key, diagnosis: d, analysis: a };
  });
  const handwritten = tests.filter((t) => !t.generated);
  const generated = tests.filter((t) => t.generated);
  const count = (list, ...st) =>
    list.filter((t) => st.includes(t.status)).length;
  const failedStatuses = ["failed", "timedOut", "interrupted"];
  const summary = {
    total: tests.length,
    passed: count(tests, "passed"),
    failed: count(tests, ...failedStatuses),
    skipped: count(tests, "skipped"),
  };
  const buildFailed = build && !build.ok;
  const overallOk = !buildFailed && summary.failed === 0 && summary.total > 0;

  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>E2E レポート ${esc(meta.startedAt ?? results.startedAt ?? "")}</title>
<style>${CSS}</style></head>
<body>
<header class="top ${overallOk ? "ok" : "ng"}">
  <h1>E2E テストレポート <span class="badge ${overallOk ? "ok" : "ng"}">${overallOk ? "すべて成功" : buildFailed ? "ビルド失敗" : summary.total === 0 ? "テスト未実行" : `${summary.failed} 件失敗`}</span></h1>
  <dl class="meta">
    <div><dt>実行日時</dt><dd>${esc(new Date(meta.startedAt ?? results.startedAt ?? Date.now()).toLocaleString("ja-JP"))}</dd></div>
    <div><dt>対象ホスト</dt><dd>${esc(meta.baseURL ?? "-")}</dd></div>
    <div><dt>ブランチ / コミット</dt><dd>${esc(git(["rev-parse", "--abbrev-ref", "HEAD"]))} / ${esc(git(["rev-parse", "--short", "HEAD"]))}${git(["status", "--porcelain"]) ? " (未コミットの変更あり)" : ""}</dd></div>
    <div><dt>ビルド</dt><dd>${build ? (build.skipped ? "スキップ (既存の dist/ を使用)" : `${build.ok ? "成功" : "失敗"} (${fmtMs(build.durationMs)})`) : "-"}</dd></div>
  </dl>
  <div class="cards">
    <div class="card"><b>${summary.total}</b><span>テスト</span></div>
    <div class="card ok"><b>${summary.passed}</b><span>成功</span></div>
    <div class="card ng"><b>${summary.failed}</b><span>失敗</span></div>
    <div class="card skip"><b>${summary.skipped}</b><span>スキップ</span></div>
    <div class="card"><b>${handwritten.length}</b><span>シナリオテスト</span></div>
    <div class="card"><b>${generated.length}</b><span>自動生成テスト</span></div>
    <div class="card ${uiDiff?.changeCount ? "warn" : ""}"><b>${uiDiff?.hasBaseline ? (uiDiff.changeCount ?? 0) : "-"}</b><span>UI 変更</span></div>
  </div>
  <nav class="toc"><a href="#ui">UI 変更検知</a><a href="#scenarios">シナリオテスト</a><a href="#generated">自動生成テスト</a>${changed.length ? '<a href="#changed">変更ファイル</a>' : ""}</nav>
</header>
<main>
${buildFailed ? renderBuild(build) : ""}
${renderUiDiff(uiDiff, meta)}
<section id="scenarios">
  <h2>シナリオテスト <small>${handwritten.length} 件 / 失敗 ${count(handwritten, ...failedStatuses)} 件</small></h2>
  ${renderFilters("scenarios")}
  ${renderGroups(handwritten)}
</section>
<section id="generated">
  <h2>自動生成テスト (UI インベントリ) <small>${generated.length} 件 / 失敗 ${count(generated, ...failedStatuses)} 件</small></h2>
  <p class="note">e2e/tests/generated/ に UI インベントリから生成したテスト。ページ上の要素が PC 幅・スマホ幅で見えること、リンク先が 200 を返すこと、開閉ボタンの aria-expanded が切り替わることを確認する。<span class="new">新規</span> はベースラインになかった要素。</p>
  ${renderFilters("generated")}
  ${renderGroups(generated)}
</section>
${changed.length ? `<section id="changed"><h2>このブランチ・作業ツリーで変更されたファイル <small>${changed.length} 件</small></h2><p class="note">main との merge-base からの差分と未コミットの変更。失敗したテストが検証しているファイルと一致した場合、想定原因の先頭に表示している。</p><ul class="files">${changed.map((f) => `<li><code>${esc(f)}</code></li>`).join("")}</ul></section>` : ""}
</main>
<dialog id="lightbox"><form method="dialog"><button aria-label="閉じる">×</button></form><img alt=""><p></p></dialog>
<script>${JS}</script>
</body></html>`;
  const out = join(REPORT_DIR, "index.html");
  writeFileSync(out, html);
  writeFileSync(
    join(REPORT_DIR, "summary.md"),
    renderSummaryMd({ summary, tests, build, uiDiff }),
  );
  return out;
}

function renderBuild(build) {
  const d = diagnoseBuild(build.log ?? "");
  return `<section id="build" class="panel ng"><h2>ビルド失敗</h2>
  <p>コマンド: <code>${esc(build.command)}</code> (終了コード ${esc(build.exitCode)})。ビルドに失敗したため E2E テストは実行していない。</p>
  ${renderDiagnosis(d.causes, d.fixes)}
  <details open><summary>ビルドログ (末尾)</summary><pre>${esc((build.log ?? "").split("\n").slice(-80).join("\n"))}</pre></details></section>`;
}

function renderUiDiff(diff, meta) {
  if (!diff)
    return `<section id="ui"><h2>UI 変更検知</h2><p class="note">UI インベントリを収集していない (--skip-inventory)。</p></section>`;
  const gen = meta.generated ?? [];
  const genTotal = gen.reduce((n, g) => n + g.tests, 0);
  const head = `<p class="note">ビルド済みサイトを PC 幅・スマホ幅で巡回し、ページテンプレート (src/pages/ のファイル) ごとの UI 要素をベースライン <code>e2e/ui-baseline.json</code>${diff.baselineCommit ? ` (コミット <code>${esc(diff.baselineCommit.slice(0, 7))}</code> 時点)` : ""} と比較した。
  自動生成テストは ${gen.length} ファイル・約 ${genTotal} 件。</p>`;
  if (!diff.hasBaseline) {
    return `<section id="ui"><h2>UI 変更検知</h2>${head}<p>ベースラインがなかったため、今回のインベントリをベースラインとして保存した。次回以降の実行から差分を検知する。</p></section>`;
  }
  const sources = meta.changedSources ?? [];
  const srcHtml = sources.length
    ? `<details ${diff.changeCount ? "" : "open"}><summary>ベースライン以降に変更されたソース (${sources.length} 件)</summary><ul class="files">${sources.map((f) => `<li><code>${esc(f)}</code></li>`).join("")}</ul>
      ${diff.changeCount === 0 ? '<p class="note">ソースは変わっているが、画面上の UI 要素 (リンク・ボタン・ランドマーク・head 要素) の増減・表示状態の変化はなかった。文言・スタイル・挙動の変更はシナリオテストで確認する。</p>' : ""}</details>`
    : "";
  if (!diff.changeCount) {
    return `<section id="ui"><h2>UI 変更検知 <span class="badge ok">変更なし</span></h2>${head}${srcHtml}</section>`;
  }
  const rows = [];
  for (const t of diff.addedTemplates)
    rows.push(
      `<tr><td><code>${esc(t.file)}</code></td><td><span class="tag add">ページ追加</span></td><td>${esc(t.route)}</td><td>自動テストを生成した。ページ固有の操作・仕様はシナリオテストを追加する</td></tr>`,
    );
  for (const t of diff.removedTemplates)
    rows.push(
      `<tr><td><code>${esc(t.file)}</code></td><td><span class="tag del">ページ削除</span></td><td>${esc(t.route)}</td><td>このページを対象にした手書きテストを削除または修正する</td></tr>`,
    );
  for (const g of groupChanges(diff)) {
    rows.push(
      `<tr><td>${g.files.map((f) => `<code>${esc(f)}</code>`).join(" ")}${g.files.length > 1 ? `<br><small class="note">${g.files.length} テンプレート共通</small>` : ""}</td><td><span class="tag ${g.cls}">${g.label}</span></td><td><code>${esc(g.target)}</code></td><td>${g.action}</td></tr>`,
    );
  }
  return `<section id="ui" class="panel warn"><h2>UI 変更検知 <span class="badge warn">${diff.changeCount} 件の変更</span></h2>${head}
  <table class="diff"><thead><tr><th>テンプレート</th><th>種別</th><th>対象</th><th>対応</th></tr></thead><tbody>${rows.join("")}</tbody></table>
  <p class="note">変更が意図どおりなら <code>pnpm e2e --skip-build --update-baseline</code> でベースラインを更新する。更新するまで、この差分は毎回表示される。</p>
  ${srcHtml}</section>`;
}

const refsHtml = (refs) =>
  refs?.length
    ? `手書きテストが参照している: ${refs.map((x) => `<code>${esc(x)}</code>`).join(" ")}`
    : "参照している手書きテストはない";

/** 共通コンポーネントの変更は全テンプレートに同じ差分が出るため、同じ差分をまとめる。 */
export function groupChanges(diff) {
  const groups = new Map();
  const add = (sig, file, entry) => {
    const g = groups.get(sig) ?? { ...entry, files: [] };
    g.files.push(file);
    groups.set(sig, g);
  };
  for (const ch of diff.changes) {
    for (const k of ch.added)
      add(`add|${k}`, ch.file, {
        cls: "add",
        label: "要素追加",
        target: k,
        action:
          "表示確認の自動テストを生成した。操作や仕様を伴う要素ならシナリオテストを追加する",
      });
    for (const r of ch.removed)
      add(`del|${r.key}`, ch.file, {
        cls: "del",
        label: "要素削除",
        target: r.key,
        action: refsHtml(r.references),
      });
    for (const v of ch.visibility) {
      add(`vis|${v.key}|${v.viewport}|${v.after}`, ch.file, {
        cls: "mod",
        label: "表示変化",
        target: v.key,
        action: `${v.viewport === "desktop" ? "PC 幅" : "スマホ幅"}で ${v.before ? "表示" : "非表示"} → ${v.after ? "表示" : "非表示"}。${refsHtml(v.references)}`,
      });
    }
    for (const h of ch.headAdded)
      add(`hadd|${h}`, ch.file, {
        cls: "add",
        label: "head 追加",
        target: h,
        action: "",
      });
    for (const h of ch.headRemoved)
      add(`hdel|${h}`, ch.file, {
        cls: "del",
        label: "head 削除",
        target: h,
        action: "SEO・OGP への影響を確認する",
      });
    if (ch.statusChanged)
      add(`st|${ch.file}`, ch.file, {
        cls: "mod",
        label: "ステータス変化",
        target: ch.route,
        action: `${ch.statusChanged.before} → ${ch.statusChanged.after}`,
      });
  }
  return [...groups.values()];
}

function renderFilters(id) {
  return `<div class="filters" data-target="${id}">
    <button data-f="all" class="on">すべて</button><button data-f="ng">失敗</button><button data-f="ok">成功</button><button data-f="skip">スキップ</button>
    <input type="search" placeholder="テストケース・シナリオ名で絞り込み"></div>`;
}

function renderGroups(tests) {
  if (tests.length === 0) return `<p class="note">テストなし</p>`;
  const groups = new Map();
  for (const t of tests) {
    const g = groups.get(t.scenario) ?? [];
    g.push(t);
    groups.set(t.scenario, g);
  }
  return [...groups.entries()]
    .map(([scenario, list]) => {
      const ng = list.filter((t) => STATUS[t.status]?.cls === "ng").length;
      return `<details class="group" ${ng ? "open" : ""}><summary><span class="scenario">${esc(scenario)}</span>
        <span class="counts">${list.length} 件${ng ? ` / <b class="ngtxt">失敗 ${ng}</b>` : ""}</span></summary>
        <table class="tests"><thead><tr><th>#</th><th>テストケース</th><th>結果</th><th>時間</th></tr></thead>
        <tbody>${list.map(renderTest).join("")}</tbody></table></details>`;
    })
    .join("");
}

function renderTest(t) {
  const st = STATUS[t.status] ?? { label: t.status, cls: "skip" };
  const isNg = st.cls === "ng";
  const steps = t.steps.length
    ? `<ol class="steps">${t.steps
        .map(
          (
            s,
          ) => `<li class="${s.error ? "ng" : "ok"}" style="margin-left:${s.depth * 1.2}em">
          <span class="mark">${s.error ? "✗" : "✓"}</span> ${esc(s.title)} <small>${fmtMs(s.duration)}</small>
          ${s.error ? `<div class="err">${esc(s.error.split("\n")[0])}</div>` : ""}
          ${renderShots(s.screenshots)}</li>`,
        )
        .join("")}</ol>`
    : `<p class="note">記録された操作なし (HTTP リクエストのみで検証するテスト)</p>`;
  const diag = t.analysis
    ? renderDiagnosis(
        [t.analysis.cause].flat(),
        [t.analysis.fix].flat(),
        "Claude による分析",
      )
    : t.diagnosis
      ? renderDiagnosis(t.diagnosis.causes, t.diagnosis.fixes)
      : "";
  const issues = t.pageIssues
    ? `<details><summary>ページで起きた問題</summary><pre>${esc(JSON.stringify(t.pageIssues, null, 2))}</pre></details>`
    : "";
  const errors = t.errors.length
    ? `<details ${isNg ? "open" : ""}><summary>エラー詳細</summary><pre>${esc(t.errors.map((e) => `${e.message}\n${e.snippet}`).join("\n\n"))}</pre></details>`
    : "";
  const srcs = t.annotations
    .filter((a) => a.type === "source")
    .map((a) => `<code>${esc(a.description)}</code>`);
  const skipReason = t.annotations.find((a) => a.type === "skip")?.description;
  const search = `${t.scenario} ${t.title}`.toLowerCase();
  return `<tr class="row ${st.cls}" data-s="${st.cls}" data-q="${esc(search)}">
    <td class="no">${t.no}</td>
    <td><details ${isNg ? "open" : ""}><summary class="title">${esc(t.title)}</summary>
      <div class="detail">
        <div class="kv"><span>シナリオ</span><div>${esc(t.scenario)}</div></div>
        <div class="kv"><span>テストファイル</span><div><code>${esc(t.file)}:${t.line}</code></div></div>
        ${srcs.length ? `<div class="kv"><span>関連ソース</span><div>${srcs.join(" ")}</div></div>` : ""}
        ${skipReason ? `<div class="kv"><span>スキップ理由</span><div>${esc(skipReason)}</div></div>` : ""}
        <div class="kv"><span>実施した操作</span><div>${steps}</div></div>
        ${diag}
        ${errors}${issues}
        ${t.screenshots.length ? `<div class="kv"><span>スクリーンショット</span><div>${renderShots(t.screenshots)}</div></div>` : ""}
        ${t.trace ? `<div class="kv"><span>trace</span><div><code>pnpm exec playwright show-trace ${esc(t.trace)}</code></div></div>` : ""}
      </div></details></td>
    <td><span class="badge ${st.cls}">${st.label}</span></td>
    <td class="dur">${fmtMs(t.duration)}</td></tr>`;
}

function renderShots(shots = []) {
  if (!shots.length) return "";
  return `<div class="shots">${shots
    .map(
      (s) =>
        `<figure><img loading="lazy" src="${esc(s.path)}" alt="${esc(s.label)}" data-label="${esc(s.label)}"><figcaption>${esc(s.label)}</figcaption></figure>`,
    )
    .join("")}</div>`;
}

function renderDiagnosis(causes, fixes, source = "ルールによる推定") {
  return `<div class="diag"><div class="cause"><h4>想定原因 <small>${esc(source)}</small></h4><ul>${causes.map((c) => `<li>${inlineCode(c)}</li>`).join("")}</ul></div>
  <div class="fix"><h4>修正提案</h4><ul>${fixes.map((c) => `<li>${inlineCode(c)}</li>`).join("")}</ul></div></div>`;
}

function renderSummaryMd({ summary, tests, build, uiDiff }) {
  const lines = [
    "# E2E 結果サマリ",
    "",
    `- テスト: ${summary.total} 件 (成功 ${summary.passed} / 失敗 ${summary.failed} / スキップ ${summary.skipped})`,
    `- ビルド: ${build ? (build.skipped ? "スキップ" : build.ok ? "成功" : "失敗") : "-"}`,
    `- UI 変更: ${uiDiff?.hasBaseline ? `${uiDiff.changeCount ?? 0} 件` : "ベースラインなし"}`,
    "",
  ];
  if (uiDiff?.changeCount) {
    lines.push("## UI 変更", "");
    for (const t of uiDiff.addedTemplates)
      lines.push(`- ページ追加: ${t.file} (${t.route})`);
    for (const t of uiDiff.removedTemplates)
      lines.push(`- ページ削除: ${t.file} (${t.route})`);
    for (const g of groupChanges(uiDiff)) {
      lines.push(
        `- ${g.label}: \`${g.target}\` (${g.files.join(", ")})${g.action ? ` — ${g.action.replace(/<[^>]+>/g, "")}` : ""}`,
      );
    }
    lines.push("");
  }
  const failed = tests.filter((t) => STATUS[t.status]?.cls === "ng");
  if (failed.length) {
    lines.push("## 失敗したテスト", "");
    for (const t of failed) {
      lines.push(
        `### ${t.key}`,
        "",
        `- シナリオ: ${t.scenario}`,
        `- 場所: ${t.file}:${t.line}`,
      );
      lines.push(
        `- エラー: ${(t.errors[0]?.message ?? "").split("\n").slice(0, 6).join(" / ")}`,
      );
      const d = t.analysis ?? t.diagnosis;
      if (d) {
        lines.push(`- 想定原因: ${[d.cause ?? d.causes].flat().join(" / ")}`);
        lines.push(`- 修正提案: ${[d.fix ?? d.fixes].flat().join(" / ")}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

const CSS = `
:root{--ok:#15803d;--ng:#b91c1c;--warn:#b45309;--skip:#6b7280;--bg:#f8fafc;--line:#e2e8f0}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Hiragino Sans",sans-serif;background:var(--bg);color:#0f172a;font-size:14px;line-height:1.6}
header.top{background:#fff;border-bottom:4px solid var(--ok);padding:20px 32px}header.top.ng{border-color:var(--ng)}
h1{margin:0 0 12px;font-size:22px}h2{font-size:18px;margin:0 0 12px}h2 small{font-weight:normal;color:var(--skip);font-size:13px;margin-left:8px}
h4{margin:0 0 4px;font-size:13px}h4 small{font-weight:normal;color:var(--skip)}
.meta{display:flex;flex-wrap:wrap;gap:8px 32px;margin:0 0 16px}.meta dt{font-size:12px;color:var(--skip)}.meta dd{margin:0}
.cards{display:flex;flex-wrap:wrap;gap:12px}.card{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 16px;min-width:96px;text-align:center}
.card b{display:block;font-size:22px}.card span{font-size:12px;color:var(--skip)}.card.ok b{color:var(--ok)}.card.ng b{color:var(--ng)}.card.skip b{color:var(--skip)}.card.warn b{color:var(--warn)}
.toc{margin-top:12px;display:flex;gap:16px}.toc a{color:#4338ca}
main{padding:24px 32px;max-width:1400px}section{margin-bottom:32px}
.panel{background:#fff;border:1px solid var(--line);border-left:4px solid var(--skip);border-radius:8px;padding:16px 20px}.panel.ng{border-left-color:var(--ng)}.panel.warn{border-left-color:var(--warn)}
.badge{display:inline-block;padding:1px 10px;border-radius:999px;font-size:12px;font-weight:600;color:#fff;background:var(--skip);white-space:nowrap;vertical-align:middle}
.badge.ok{background:var(--ok)}.badge.ng{background:var(--ng)}.badge.warn{background:var(--warn)}
.note{color:#475569;font-size:13px}code{background:#f1f5f9;border-radius:4px;padding:0 4px;font-size:12px;word-break:break-all}
pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:6px;overflow:auto;font-size:12px;max-height:420px;white-space:pre-wrap}
table{width:100%;border-collapse:collapse;background:#fff}th,td{border-bottom:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}th{font-size:12px;color:var(--skip);background:#f1f5f9}
.tag{font-size:11px;padding:1px 8px;border-radius:4px;white-space:nowrap}.tag.add{background:#dcfce7;color:var(--ok)}.tag.del{background:#fee2e2;color:var(--ng)}.tag.mod{background:#fef3c7;color:var(--warn)}
.new{background:#dbeafe;color:#1d4ed8;padding:0 6px;border-radius:4px;font-size:12px}
details.group{background:#fff;border:1px solid var(--line);border-radius:8px;margin-bottom:12px;overflow:hidden}
details.group>summary{padding:10px 16px;cursor:pointer;display:flex;justify-content:space-between;background:#f8fafc;font-weight:600}
.counts{font-weight:normal;color:var(--skip)}.ngtxt{color:var(--ng)}
table.tests td.no{width:40px;color:var(--skip)}table.tests td.dur{width:72px;color:var(--skip);white-space:nowrap}table.tests td:nth-child(3){width:120px}
tr.row.ng{background:#fef2f2}summary.title{cursor:pointer;font-weight:500}
.detail{padding:8px 0 4px}.kv{display:grid;grid-template-columns:110px 1fr;gap:8px;margin:6px 0}.kv>span{font-size:12px;color:var(--skip)}
.steps{margin:0;padding-left:0;list-style:none}.steps li{padding:2px 0}.steps .mark{font-weight:bold}.steps li.ok .mark{color:var(--ok)}.steps li.ng .mark{color:var(--ng)}.steps small{color:var(--skip)}
.err{color:var(--ng);font-size:12px;margin-left:1.2em}
.shots{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 4px 1.2em}.shots figure{margin:0;width:200px}.shots img{width:200px;max-height:150px;object-fit:cover;object-position:top;border:1px solid var(--line);border-radius:4px;cursor:zoom-in;background:#fff}
.shots figcaption{font-size:11px;color:var(--skip);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.diag{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:8px 0}.diag>div{border-radius:6px;padding:8px 12px}.cause{background:#fef2f2;border:1px solid #fecaca}.fix{background:#f0fdf4;border:1px solid #bbf7d0}.diag ul{margin:0;padding-left:1.2em}
.filters{display:flex;gap:6px;margin-bottom:10px;align-items:center}.filters button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:3px 12px;cursor:pointer}.filters button.on{background:#0f172a;color:#fff}
.filters input{margin-left:auto;padding:4px 10px;border:1px solid var(--line);border-radius:6px;width:280px}
ul.files{columns:2;font-size:12px}
dialog{border:none;border-radius:8px;padding:12px;max-width:95vw;max-height:95vh}dialog img{max-width:90vw;max-height:82vh;display:block}dialog form{text-align:right}dialog button{border:none;background:none;font-size:22px;cursor:pointer}
@media (max-width:800px){.diag{grid-template-columns:1fr}main,header.top{padding:16px}}
`;

const JS = `
const box=document.getElementById('lightbox');
document.addEventListener('click',e=>{const img=e.target.closest('.shots img');if(!img)return;box.querySelector('img').src=img.src;box.querySelector('p').textContent=img.dataset.label;box.showModal();});
box.addEventListener('click',e=>{if(e.target===box)box.close();});
document.querySelectorAll('.filters').forEach(f=>{
  const sec=document.getElementById(f.dataset.target);let mode='all';const input=f.querySelector('input');
  const apply=()=>{const q=input.value.toLowerCase();sec.querySelectorAll('tr.row').forEach(r=>{r.hidden=!((mode==='all'||r.dataset.s===mode)&&(!q||r.dataset.q.includes(q)));});
    sec.querySelectorAll('details.group').forEach(g=>{const any=[...g.querySelectorAll('tr.row')].some(r=>!r.hidden);g.hidden=!any;if(mode!=='all'||q)g.open=any;});};
  f.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.f;f.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));apply();}));
  input.addEventListener('input',apply);
});
`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(`E2E レポート: ${renderReport()}`);
}
