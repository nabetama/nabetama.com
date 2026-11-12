#!/usr/bin/env node
// 実装の変更に対して E2E テストの更新が必要かを判定する。
//
// main から分岐した後に変更された実装ファイル (記事などのコンテンツを除く) ごとに、
// そのファイルを sources() で参照している手書きのシナリオテストが同じ範囲で更新されているかを見る。
// 更新されていないファイルは「E2E の確認が必要」として報告する。
//
// テストの更新が不要な変更 (リファクタリングなど) は、コミットメッセージに
//   E2E-Not-Needed: <理由>
// の trailer を付けると、そのコミットで変更したファイルは確認済みとして扱う。
//
//   node e2e/lib/check-coverage.mjs                  作業ツリーを含めて判定し、結果を表示する (終了コード 0)
//   node e2e/lib/check-coverage.mjs --strict         確認が必要なファイルがあれば終了コード 1
//   node e2e/lib/check-coverage.mjs --commits-only --base <ref> --head <ref> --strict
//                                                    コミットだけで判定する (pre-push・CI 用)
//   node e2e/lib/check-coverage.mjs --claude-stop-hook
//                                                    Claude Code の Stop hook として動く (stdin に hook の入力 JSON)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SPEC_DIR = join(ROOT, "e2e/tests");

/** E2E の確認対象とする実装ファイル。記事・固定ページの本文 (src/content/) は対象外。 */
export function isImplementation(file) {
  if (file.startsWith("src/content/")) return false;
  return file.startsWith("src/") || file === "astro.config.mjs";
}

/** 手書きのシナリオテスト (自動生成テストは除く)。 */
const isHandwrittenSpec = (file) => /^e2e\/tests\/[^/]+\.spec\.ts$/.test(file);

const git = (args) => {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trimEnd(); // git status --porcelain の先頭の空白は意味を持つので trim() しない
  } catch {
    return "";
  }
};
const lines = (s) => s.split("\n").filter(Boolean);

function parseArgs(argv) {
  const get = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : argv[i + 1];
  };
  return {
    strict: argv.includes("--strict"),
    commitsOnly: argv.includes("--commits-only"),
    claudeStopHook: argv.includes("--claude-stop-hook"),
    json: argv.includes("--json"),
    base: get("base"),
    head: get("head") ?? "HEAD",
  };
}

function resolveBase(base, head) {
  if (base) return git(["merge-base", base, head]) || base;
  for (const ref of ["origin/main", "main"]) {
    const mb = git(["merge-base", ref, head]);
    if (mb) return mb;
  }
  return null;
}

/** 各手書きテストが sources() で参照しているパス。 */
function specSources() {
  const map = new Map();
  for (const name of readdirSync(SPEC_DIR).filter((n) =>
    n.endsWith(".spec.ts"),
  )) {
    const text = readFileSync(join(SPEC_DIR, name), "utf8");
    const paths = new Set();
    for (const call of text.matchAll(/sources\(([\s\S]*?)\)/g)) {
      for (const m of call[1].matchAll(/["'`]([^"'`]+)["'`]/g)) paths.add(m[1]);
    }
    // static-pages.spec.ts のように配列から組み立てる場合に備え、"src/..." の文字列も拾う
    for (const m of text.matchAll(
      /["'`](src\/[^"'`$]+|astro\.config\.mjs)["'`]/g,
    )) {
      paths.add(m[1]);
    }
    map.set(`e2e/tests/${name}`, [...paths]);
  }
  return map;
}

/** 実装ファイルに関連するテスト。完全一致を優先し、なければディレクトリ指定 (src/pages/ など) で探す。 */
function relatedSpecs(file, sources) {
  const exact = [];
  const prefix = [];
  for (const [spec, paths] of sources) {
    if (paths.includes(file)) exact.push(spec);
    else if (paths.some((p) => p.endsWith("/") && file.startsWith(p)))
      prefix.push(spec);
  }
  return exact.length ? exact : prefix;
}

export function analyze({ base, head = "HEAD", commitsOnly = false }) {
  const mergeBase = resolveBase(base, head);
  if (!mergeBase)
    return { error: "main との分岐点が見つからない", needsReview: [], ok: [] };

  const changed = new Set(lines(git(["diff", "--name-only", mergeBase, head])));
  const acked = new Map();
  for (const sha of lines(git(["rev-list", `${mergeBase}..${head}`]))) {
    const reason = git([
      "log",
      "-1",
      "--format=%(trailers:key=E2E-Not-Needed,valueonly)",
      sha,
    ]);
    if (!reason) continue;
    for (const f of lines(
      git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha]),
    )) {
      acked.set(f, reason.split("\n")[0]);
    }
  }
  const uncommitted = new Set();
  if (!commitsOnly) {
    for (const l of lines(git(["status", "--porcelain", "-uall"]))) {
      const f = l.slice(3).replace(/^.* -> /, "");
      changed.add(f);
      uncommitted.add(f);
    }
  }

  const sources = specSources();
  const changedSpecs = [...changed].filter(isHandwrittenSpec);
  const needsReview = [];
  const ok = [];
  for (const file of [...changed].filter(isImplementation).sort()) {
    const related = relatedSpecs(file, sources);
    const updated = related.filter((s) => changedSpecs.includes(s));
    const ack = !uncommitted.has(file) ? acked.get(file) : undefined;
    if (updated.length)
      ok.push({ file, reason: `テスト更新あり: ${updated.join(", ")}` });
    else if (ack) ok.push({ file, reason: `E2E-Not-Needed: ${ack}` });
    else
      needsReview.push({ file, related, uncommitted: uncommitted.has(file) });
  }
  return { mergeBase, changedSpecs, needsReview, ok };
}

function formatReport(result) {
  if (result.error) return `E2E カバレッジ確認: ${result.error}`;
  const out = [];
  if (result.needsReview.length === 0) {
    out.push("E2E カバレッジ確認: 確認が必要な実装の変更はありません。");
    for (const o of result.ok) out.push(`  ✓ ${o.file} (${o.reason})`);
    return out.join("\n");
  }
  out.push(
    `E2E カバレッジ確認: 次の実装の変更に対して、関連する E2E シナリオテストが更新されていません (${result.needsReview.length} 件)。`,
  );
  for (const n of result.needsReview) {
    out.push(
      `  - ${n.file}${n.uncommitted ? " (未コミット)" : ""}: ${
        n.related.length
          ? `関連テスト ${n.related.join(", ")}`
          : "このファイルを sources() で参照しているテストがない"
      }`,
    );
  }
  for (const o of result.ok) out.push(`  ✓ ${o.file} (${o.reason})`);
  out.push(
    "",
    "対応:",
    "  1. 変更内容 (git diff main -- <ファイル>) を読み、挙動・文言・表示・件数などの仕様が変わったか判断する。",
    "  2. 変わった場合: 関連テストを更新するか、e2e/tests/ にシナリオテストを追加する (sources() に実装ファイルを書く)。",
    "     手順は .claude/skills/e2e-check/SKILL.md の「4. UI・仕様の変更に合わせてテストを追加する」。",
    "  3. 変わらない場合 (リファクタリング・型修正など): コミットメッセージに `E2E-Not-Needed: <理由>` を書く。",
    "  4. どちらの場合も `pnpm e2e` を実行して全テストが通ることを確認する。",
  );
  return out.join("\n");
}

/** 変更内容 (実装ファイルとテストの中身) の指紋。同じ状態で何度も止めないために使う。 */
function fingerprint(result) {
  const h = createHash("sha256");
  for (const f of [
    ...result.needsReview.map((n) => n.file),
    ...result.changedSpecs,
  ].sort()) {
    h.update(f);
    const p = join(ROOT, f);
    h.update(existsSync(p) ? readFileSync(p) : "deleted");
  }
  return h.digest("hex");
}

function runClaudeStopHook(base) {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {}
  // Stop hook で一度止めた後の停止は通す (無限に止めない)
  if (input.stop_hook_active) return;
  const result = analyze({ base });
  if (result.error || result.needsReview.length === 0) return;
  const gitDir = git(["rev-parse", "--absolute-git-dir"]);
  const stateFile = join(gitDir, "e2e-check-reviewed");
  const fp = fingerprint(result);
  if (existsSync(stateFile) && readFileSync(stateFile, "utf8").trim() === fp)
    return;
  writeFileSync(stateFile, fp);
  const reason = [
    formatReport(result),
    "",
    "作業を終える前に上の対応を行い、E2E の更新が必要か判断した結果をユーザーに報告すること。",
    "テストを追加・更新した場合は pnpm e2e --skip-build ではなく pnpm e2e (ビルド込み) で確認する。",
  ].join("\n");
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
}

const args = parseArgs(process.argv.slice(2));
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (args.claudeStopHook) {
    runClaudeStopHook(args.base);
  } else {
    const result = analyze(args);
    console.log(
      args.json ? JSON.stringify(result, null, 2) : formatReport(result),
    );
    if (args.strict && result.needsReview.length > 0) process.exitCode = 1;
  }
}
