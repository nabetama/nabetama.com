// UI インベントリ: ビルド済みサイトを巡回して、ページテンプレート (src/pages/ のファイル) ごとに
// 「どの UI 要素が PC 幅・スマホ幅で見えるか」を記録する。
// ベースライン (e2e/ui-baseline.json) と比べて UI の追加・削除を検知し、
// 現在のインベントリから e2e/tests/generated/*.spec.ts を生成する。
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { chromium } from "@playwright/test";
import { collectUi, isActuallyVisible } from "./dom.mjs";

export const ROOT = new URL("../../", import.meta.url).pathname;
const PAGES_DIR = join(ROOT, "src/pages");
const DIST_DIR = join(ROOT, "dist");
export const BASELINE_PATH = join(ROOT, "e2e/ui-baseline.json");
const GENERATED_DIR = join(ROOT, "e2e/tests/generated");

export const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
};

const NOT_FOUND_PROBE = "/__e2e-not-found__/";

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** src/pages/ のファイルからルートのパターンを作る。 */
export function discoverTemplates() {
  return walk(PAGES_DIR)
    .filter((f) => /\.(astro|md|mdx|ts|js)$/.test(f))
    .map((file) => {
      const rel = relative(PAGES_DIR, file);
      const isEndpoint = /\.(ts|js)$/.test(rel);
      let route = `/${rel.replace(/\.(astro|md|mdx|ts|js)$/, "")}`;
      if (!isEndpoint)
        route = `${route.replace(/(^|\/)index$/, "")}/`.replace(/\/+$/, "/");
      const dynamic = /\[/.test(route);
      const pattern = new RegExp(
        `^${route
          .replace(/[.*+?^${}()|\\]/g, "\\$&")
          .replace(/\\\[\.\.\.[^\]]+\]/g, ".+")
          .replace(/\[[^\]]+\]/g, "[^/]+")}$`,
      );
      return {
        file: `src/pages/${rel}`,
        route,
        kind: isEndpoint
          ? "endpoint"
          : rel === "404.astro"
            ? "not-found"
            : "page",
        dynamic,
        pattern,
      };
    })
    .sort(
      (a, b) =>
        Number(a.dynamic) - Number(b.dynamic) || a.route.localeCompare(b.route),
    );
}

/** dist/ から実際に生成された URL を列挙する。 */
function builtUrls() {
  return walk(DIST_DIR)
    .map((f) => `/${relative(DIST_DIR, f)}`)
    .filter((p) => !p.startsWith("/_astro/"))
    .map((p) =>
      p.endsWith("/index.html") ? p.slice(0, -"index.html".length) : p,
    )
    .map((p) => (p === "/index.html" ? "/" : p));
}

function assignSamples(templates, maxSamples) {
  const urls = builtUrls();
  for (const t of templates) {
    if (t.kind === "not-found") {
      t.samples = [NOT_FOUND_PROBE];
      continue;
    }
    const matched = urls.filter((u) => t.pattern.test(u));
    t.samples = matched.slice(0, maxSamples);
    t.builtCount = matched.length;
  }
}

/**
 * @param {{baseURL: string, maxSamples?: number}} opts
 */
export async function collectInventory({ baseURL, maxSamples = Infinity }) {
  const templates = discoverTemplates();
  assignSamples(templates, maxSamples);
  const browser = await chromium.launch();
  const result = {
    generatedAt: new Date().toISOString(),
    commit: gitHead(),
    templates: {},
  };
  try {
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      const context = await browser.newContext({ ...vp, locale: "ja-JP" });
      await context.addInitScript(
        `window.__e2eIsVisible = ${isActuallyVisible.toString()};`,
      );
      await context.route(/\.(png|jpe?g|gif|webp|avif|svg|woff2?)$/, (r) =>
        r.abort(),
      );
      for (const t of templates) {
        result.templates[t.file] ??= {
          file: t.file,
          route: t.route,
          kind: t.kind,
          samples: t.samples.slice(0, 3),
          builtCount: t.builtCount ?? t.samples.length,
          status: null,
          head: [],
          elements: {},
        };
        const entry = result.templates[t.file];
        if (t.kind === "endpoint") {
          if (vpName !== "desktop") continue;
          const url = t.samples[0] ?? t.route;
          const res = await context.request.get(new URL(url, baseURL).href);
          entry.status = res.status();
          entry.contentType = res.headers()["content-type"] ?? "";
          continue;
        }
        await runPool(t.samples, 6, async (url) => {
          const page = await context.newPage();
          try {
            const res = await page.goto(
              new URL(encodeURI(decodeURI(url)), baseURL).href,
              {
                // UI はページ自身の DOM から集めるため、外部の埋め込み (imgur など) の読み込み完了は待たない。
                // 外部サイトが応答しないと load イベントが来ず、巡回全体が止まる。
                waitUntil: "domcontentloaded",
              },
            );
            entry.status ??= res?.status() ?? null;
            const ui = await page.evaluate(collectUi);
            entry.head = [...new Set([...entry.head, ...ui.head])].sort();
            for (const item of ui.items) {
              entry.elements[item.key] ??= {
                ...item,
                visible: undefined,
                sample: url,
                viewports: {},
              };
              const el = entry.elements[item.key];
              el.viewports[vpName] =
                (el.viewports[vpName] ?? false) || item.visible;
              if (item.visible && !el.viewports[`${vpName}Sample`]) {
                el.viewports[`${vpName}Sample`] = url;
              }
            }
          } finally {
            await page.close();
          }
        });
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  for (const t of Object.values(result.templates)) {
    for (const el of Object.values(t.elements)) {
      el.viewports.desktop ??= false;
      el.viewports.mobile ??= false;
      delete el.visible;
    }
    t.elements = Object.fromEntries(
      Object.entries(t.elements).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return result;
}

async function runPool(items, size, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift());
    }),
  );
}

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export function loadBaseline() {
  return existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
    : null;
}

export function saveBaseline(inv) {
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(stripVolatile(inv), null, 2)}\n`,
  );
}

/** ベースラインには実行ごとに変わる値 (サンプル URL・件数) を入れない。 */
function stripVolatile(inv) {
  const templates = {};
  for (const [file, t] of Object.entries(inv.templates)) {
    const elements = {};
    for (const [key, el] of Object.entries(t.elements)) {
      elements[key] = {
        type: el.type,
        selector: el.selector,
        text: el.text,
        linkKind: el.linkKind,
        href: el.href,
        ariaExpanded: el.ariaExpanded,
        viewports: {
          desktop: el.viewports.desktop,
          mobile: el.viewports.mobile,
        },
      };
    }
    templates[file] = {
      file,
      route: t.route,
      kind: t.kind,
      status: t.status,
      head: t.head,
      elements,
    };
  }
  return { commit: inv.commit, updatedAt: inv.generatedAt, templates };
}

/** ベースラインとの差分。 */
export function diffInventory(baseline, current) {
  const diff = {
    baselineCommit: baseline?.commit ?? null,
    baselineUpdatedAt: baseline?.updatedAt ?? null,
    hasBaseline: !!baseline,
    addedTemplates: [],
    removedTemplates: [],
    changes: [],
  };
  if (!baseline) return diff;
  const b = baseline.templates;
  const c = current.templates;
  for (const file of Object.keys(c))
    if (!b[file]) diff.addedTemplates.push({ file, route: c[file].route });
  for (const file of Object.keys(b))
    if (!c[file]) diff.removedTemplates.push({ file, route: b[file].route });
  for (const file of Object.keys(c)) {
    if (!b[file]) continue;
    const bt = b[file];
    const ct = c[file];
    const added = [];
    const removed = [];
    const visibility = [];
    for (const key of Object.keys(ct.elements)) {
      if (!bt.elements[key]) added.push(key);
      else {
        for (const vp of ["desktop", "mobile"]) {
          const before = bt.elements[key].viewports[vp];
          const after = ct.elements[key].viewports[vp];
          if (before !== after) {
            visibility.push({
              key,
              viewport: vp,
              before,
              after,
              references: findReferences(bt.elements[key]),
            });
          }
        }
      }
    }
    for (const key of Object.keys(bt.elements))
      if (!ct.elements[key]) removed.push(key);
    const headAdded = ct.head.filter((h) => !bt.head.includes(h));
    const headRemoved = bt.head.filter((h) => !ct.head.includes(h));
    const statusChanged =
      bt.status !== ct.status ? { before: bt.status, after: ct.status } : null;
    if (
      added.length ||
      removed.length ||
      visibility.length ||
      headAdded.length ||
      headRemoved.length ||
      statusChanged
    ) {
      diff.changes.push({
        file,
        route: ct.route,
        added,
        removed: removed.map((key) => ({
          key,
          references: findReferences(bt.elements[key]),
        })),
        visibility,
        headAdded,
        headRemoved,
        statusChanged,
      });
    }
  }
  diff.changeCount =
    diff.addedTemplates.length +
    diff.removedTemplates.length +
    diff.changes.reduce(
      (n, ch) =>
        n +
        ch.added.length +
        ch.removed.length +
        ch.visibility.length +
        ch.headAdded.length +
        ch.headRemoved.length +
        (ch.statusChanged ? 1 : 0),
      0,
    );
  return diff;
}

/** 削除された要素を参照している手書きテストの行を探す。 */
function findReferences(el) {
  const needles = [];
  const idMatch = el.selector.match(/#([\w-]+)/);
  if (idMatch) needles.push(`#${idMatch[1]}`);
  const aria = el.selector.match(/aria-label="([^"]+)"/);
  if (aria) needles.push(aria[1]);
  if (el.text) needles.push(`"${el.text}"`);
  if (el.href && el.linkKind === "internal") needles.push(`"${el.href}"`);
  const refs = [];
  const dir = join(ROOT, "e2e/tests");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".spec.ts"))) {
    const lines = readFileSync(join(dir, f), "utf8").split("\n");
    lines.forEach((line, i) => {
      if (needles.some((n) => line.includes(n)))
        refs.push(`e2e/tests/${f}:${i + 1}`);
    });
  }
  return refs;
}

/** ベースライン以降に変更されたソース (コミット済み + 作業ツリー)。 */
export function changedSourcesSince(commit) {
  const files = new Set();
  const run = (args) => {
    try {
      return execFileSync("git", args, { cwd: ROOT })
        .toString()
        .split("\n")
        .filter(Boolean);
    } catch {
      return [];
    }
  };
  if (commit)
    for (const f of run([
      "diff",
      "--name-only",
      commit,
      "--",
      "src",
      "public",
      "astro.config.mjs",
    ]))
      files.add(f);
  for (const line of run([
    "status",
    "--porcelain",
    "--",
    "src",
    "public",
    "astro.config.mjs",
  ]))
    files.add(line.slice(3));
  return [...files].sort();
}

const slugOf = (file) =>
  file
    .replace(/^src\/pages\//, "")
    .replace(/\.(astro|md|mdx|ts|js)$/, "")
    .replace(/\[\.\.\.([^\]]+)\]/g, "_$1")
    .replace(/\[([^\]]+)\]/g, "_$1")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-|-$/g, "") || "root";

/**
 * 現在のインベントリから自動テストを生成する。
 * @returns {{file: string, tests: number}[]}
 */
export function generateTests(inv, diff) {
  rmSync(GENERATED_DIR, { recursive: true, force: true });
  mkdirSync(GENERATED_DIR, { recursive: true });
  const newKeys = new Set();
  for (const ch of diff?.changes ?? [])
    for (const k of ch.added) newKeys.add(`${ch.file}|${k}`);
  const newTemplates = new Set((diff?.addedTemplates ?? []).map((t) => t.file));
  const out = [];
  for (const t of Object.values(inv.templates)) {
    if (t.kind === "endpoint") continue;
    const elements = Object.entries(t.elements).map(([key, el]) => ({
      key,
      type: el.type,
      selector: el.selector,
      text: el.text,
      linkKind: el.linkKind,
      href: el.href,
      ariaExpanded: el.ariaExpanded,
      desktop: el.viewports.desktop ? el.viewports.desktopSample : null,
      mobile: el.viewports.mobile ? el.viewports.mobileSample : null,
      isNew: newTemplates.has(t.file) || newKeys.has(`${t.file}|${key}`),
    }));
    const data = {
      file: t.file,
      route: t.route,
      kind: t.kind,
      sample: t.samples[0],
      status: t.status,
      head: t.head,
      elements,
    };
    const name = `${slugOf(t.file)}.spec.ts`;
    const count =
      1 +
      elements.reduce(
        (n, e) =>
          n +
          (e.desktop ? 1 : 0) +
          (e.mobile ? 1 : 0) +
          (e.ariaExpanded && e.desktop ? 1 : 0) +
          (e.ariaExpanded && e.mobile ? 1 : 0) +
          ((e.linkKind === "internal" || e.linkKind === "dynamic") &&
          (e.desktop || e.mobile)
            ? 1
            : 0),
        0,
      );
    writeFileSync(join(GENERATED_DIR, name), renderSpec(data));
    out.push({
      file: `e2e/tests/generated/${name}`,
      template: t.file,
      tests: count,
    });
  }
  return out;
}

function renderSpec(data) {
  return `// このファイルは e2e/lib/inventory.mjs が UI インベントリから自動生成する。手で編集しない。
// 再生成: pnpm e2e (ビルド・巡回のたびに上書きされる)
// 生成元テンプレート: ${data.file}
import { defineInventoryTests } from "../inventory-tests";

defineInventoryTests(${JSON.stringify(data, null, 2)});
`;
}
