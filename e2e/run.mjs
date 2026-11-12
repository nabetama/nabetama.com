#!/usr/bin/env node
// ローカルでビルドし、ビルドしたサイトに対して E2E テストを実行して HTML レポートを出力する。
//
//   pnpm e2e                         ビルド → UI 変更検知・自動テスト生成 → E2E → レポート
//   pnpm e2e --skip-build            既存の dist/ を使う
//   pnpm e2e --update-baseline       今回の UI インベントリをベースラインとして保存する
//   pnpm e2e --quick                 UI 巡回を各テンプレート 5 ページまでに絞る
//   pnpm e2e --skip-inventory        UI 変更検知と自動テスト生成を行わない
//   pnpm e2e --open                  終了後にレポートをブラウザで開く
//   pnpm e2e -- --grep "記事ページ"   以降の引数は playwright test にそのまま渡す
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  changedSourcesSince,
  collectInventory,
  diffInventory,
  generateTests,
  loadBaseline,
  saveBaseline,
} from "./lib/inventory.mjs";
import { REPORT_DIR, renderReport } from "./lib/render-report.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PORT = Number(process.env.E2E_PORT ?? 4329);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
const own = sep === -1 ? argv : argv.slice(0, sep);
const passThrough = sep === -1 ? [] : argv.slice(sep + 1);
const flag = (name) => own.includes(`--${name}`);
// `pnpm e2e --grep x` のように -- なしで渡された未知の引数も playwright に渡す
const known = new Set([
  "--skip-build",
  "--update-baseline",
  "--quick",
  "--skip-inventory",
  "--open",
]);
passThrough.unshift(...own.filter((a) => !known.has(a)));

const writeJson = (name, data) =>
  writeFileSync(join(REPORT_DIR, name), JSON.stringify(data, null, 2));

function run(cmd, args, { capture = false, env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let log = "";
    if (capture) {
      for (const s of [child.stdout, child.stderr]) {
        s.on("data", (d) => {
          log += d;
          process.stdout.write(d);
        });
      }
    }
    child.on("close", (code) => resolve({ code, log }));
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  rmSync(REPORT_DIR, { recursive: true, force: true });
  mkdirSync(REPORT_DIR, { recursive: true });
  const meta = {
    startedAt: new Date().toISOString(),
    baseURL: BASE_URL,
    args: argv,
  };
  writeJson("run.json", meta);

  // 1. ビルド
  if (flag("skip-build")) {
    writeJson("build.json", { ok: true, skipped: true });
  } else {
    console.log("\n▶ ビルド: pnpm build");
    const t0 = Date.now();
    const { code, log } = await run("pnpm", ["build"], { capture: true });
    const build = {
      ok: code === 0,
      command: "pnpm build",
      exitCode: code,
      durationMs: Date.now() - t0,
      log: log.slice(-50_000),
    };
    writeJson("build.json", build);
    if (!build.ok) {
      const out = renderReport();
      console.error(`\n✗ ビルドに失敗しました。レポート: ${out}`);
      return finish(1, out);
    }
  }

  // 2. ビルドしたサイトを配信する
  console.log(`\n▶ preview サーバー起動: ${BASE_URL}`);
  // --ignore-lock: Astro 7 の preview は TTY がないとバックグラウンド常駐になり終了しないため、
  // ロックを使わずフォアグラウンドで起動し、終了時にプロセスグループごと止める
  const server = spawn(
    "pnpm",
    [
      "exec",
      "astro",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(PORT),
      "--ignore-lock",
    ],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );
  let serverLog = "";
  server.stdout.on("data", (d) => {
    serverLog += d;
  });
  server.stderr.on("data", (d) => {
    serverLog += d;
  });
  const stopServer = () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
  };
  process.on("exit", stopServer);
  process.on("SIGINT", () => {
    stopServer();
    process.exit(130);
  });

  if (!(await waitForServer(BASE_URL))) {
    stopServer();
    console.error(`preview サーバーが起動しませんでした。\n${serverLog}`);
    writeJson("build.json", {
      ok: false,
      command: "astro preview",
      exitCode: null,
      durationMs: 0,
      log: serverLog,
    });
    return finish(1, renderReport());
  }

  try {
    // 3. UI 変更検知と自動テスト生成
    if (!flag("skip-inventory")) {
      console.log("\n▶ UI インベントリ収集 (PC 幅・スマホ幅で全ページを巡回)");
      const t0 = Date.now();
      const inv = await collectInventory({
        baseURL: BASE_URL,
        maxSamples: flag("quick") ? 5 : Infinity,
      });
      writeJson("ui-inventory.json", inv);
      const baseline = loadBaseline();
      const diff = diffInventory(baseline, inv);
      writeJson("ui-diff.json", diff);
      meta.changedSources = changedSourcesSince(baseline?.commit);
      meta.generated = generateTests(inv, diff);
      if (!baseline || flag("update-baseline")) {
        saveBaseline(inv);
        console.log(
          baseline
            ? "  ベースラインを更新しました: e2e/ui-baseline.json"
            : "  ベースラインを作成しました: e2e/ui-baseline.json",
        );
      }
      writeJson("run.json", meta);
      console.log(
        `  ${Object.keys(inv.templates).length} テンプレート / UI 変更 ${diff.changeCount ?? 0} 件 / 自動テスト ${meta.generated.length} ファイル (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
      );
    }

    // 4. E2E テスト
    console.log("\n▶ E2E テスト: playwright test");
    const { code } = await run(
      "pnpm",
      [
        "exec",
        "playwright",
        "test",
        "-c",
        "e2e/playwright.config.ts",
        ...passThrough,
      ],
      {
        env: { E2E_BASE_URL: BASE_URL, E2E_SERVER_RUNNING: "1" },
      },
    );
    const out = renderReport();
    return finish(code === 0 ? 0 : 1, out);
  } finally {
    stopServer();
  }
}

async function finish(code, reportPath) {
  console.log(`\n${code === 0 ? "✓" : "✗"} E2E レポート: ${reportPath}`);
  console.log(`  サマリ (Markdown): ${join(REPORT_DIR, "summary.md")}`);
  if (flag("open")) await run("open", [reportPath]);
  process.exitCode = code;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
