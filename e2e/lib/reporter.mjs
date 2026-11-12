// Playwright のカスタムレポーター。
// テスト結果・操作 (test.step)・スクリーンショットを e2e-report/results.json に書き出し、
// 最後に render-report.mjs で HTML レポートを生成する。
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { REPORT_DIR, renderReport } from "./render-report.mjs";

const SHOT_DIR = join(REPORT_DIR, "screenshots");
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

// 制御文字 (ESC) を正規表現リテラルに書くと noControlCharactersInRegex に当たるため RegExp で組み立てる
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const stripAnsi = (s = "") => s.replace(ANSI, "");

export default class HtmlE2eReporter {
  constructor() {
    this.tests = [];
    this.stepsByResult = new Map();
    this.shotSeq = 0;
  }

  onBegin() {
    this.startedAt = new Date();
    mkdirSync(SHOT_DIR, { recursive: true });
  }

  onStepEnd(_test, result, step) {
    if (step.category !== "test.step") return;
    const list = this.stepsByResult.get(result) ?? [];
    list.push({
      title: step.title,
      depth: depthOf(step),
      startTime: step.startTime.getTime(),
      duration: step.duration,
      error: step.error ? stripAnsi(step.error.message) : null,
      attachments: step.attachments ?? [],
    });
    this.stepsByResult.set(result, list);
  }

  saveImage(att) {
    if (!att.contentType?.startsWith("image/")) return null;
    const ext = att.contentType === "image/jpeg" ? "jpg" : "png";
    const name = `${String(++this.shotSeq).padStart(4, "0")}.${ext}`;
    const dest = join(SHOT_DIR, name);
    if (att.path) copyFileSync(att.path, dest);
    else if (att.body) writeFileSync(dest, att.body);
    else return null;
    return relative(REPORT_DIR, dest);
  }

  onTestEnd(test, result) {
    const steps = (this.stepsByResult.get(result) ?? [])
      .sort((a, b) => a.startTime - b.startTime)
      .map((s) => ({ ...s, attachments: undefined, screenshots: [] }));

    // TestStep.attachments は空で届くことがあるため、添付名で操作に紐付ける。
    // fixtures.ts の step() は操作名と同じ名前でスクリーンショットを添付する。
    // 同名の操作が複数あるときは、まだ画像のない最初の操作に割り当てる。
    const loose = [];
    let pageIssues = null;
    for (const a of result.attachments) {
      if (a.name === "page-issues" && a.body) {
        pageIssues = JSON.parse(a.body.toString());
        continue;
      }
      const path = this.saveImage(a);
      if (!path) continue;
      const owner =
        steps.find((s) => s.title === a.name && s.screenshots.length === 0) ??
        steps.find((s) => s.title === a.name);
      if (owner && a.name !== "screenshot") {
        owner.screenshots.push({ label: a.name, path });
        continue;
      }
      loose.push({
        label:
          a.name === "screenshot"
            ? result.status === "passed"
              ? "終了時の画面"
              : "失敗時の画面"
            : a.name,
        path,
      });
    }
    const trace = result.attachments.find((a) => a.name === "trace")?.path;

    // 自動生成テストは test() の呼び出し位置が inventory-tests.ts になるため、
    // テストが属するファイル (file スイート) を基準にする
    const describes = [];
    let suite = test.parent;
    for (; suite && suite.type === "describe"; suite = suite.parent) {
      describes.unshift(suite.title);
    }
    const file = relative(ROOT, suite?.location?.file ?? test.location.file);
    this.tests.push({
      id: test.id,
      file,
      line: test.location.line,
      scenario: describes.join(" › ") || file,
      title: test.title,
      generated: file.includes("/generated/"),
      status: result.status,
      expectedStatus: test.expectedStatus,
      duration: result.duration,
      errors: result.errors.map((e) => ({
        message: stripAnsi(e.message ?? ""),
        stack: stripAnsi(e.stack ?? ""),
        snippet: stripAnsi(e.snippet ?? ""),
      })),
      annotations: dedupeAnnotations(
        test.annotations.concat(result.annotations ?? []),
      ),
      steps,
      screenshots: loose,
      pageIssues,
      trace: trace ? relative(ROOT, trace) : null,
    });
  }

  onEnd(result) {
    const data = {
      startedAt: this.startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      status: result.status,
      tests: this.tests,
    };
    writeFileSync(
      join(REPORT_DIR, "results.json"),
      JSON.stringify(data, null, 2),
    );
    const out = renderReport();
    console.log(`\nE2E レポート: ${out}`);
  }

  printsToStdio() {
    return false;
  }
}

function dedupeAnnotations(list) {
  const seen = new Set();
  return list.filter((a) => {
    const k = `${a.type}|${a.description}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function depthOf(step) {
  let d = 0;
  let p = step.parent;
  while (p) {
    if (p.category === "test.step") d++;
    p = p.parent;
  }
  return d;
}
