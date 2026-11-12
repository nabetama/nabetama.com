// ブラウザ内で実行する関数。inventory.mjs (UI 収集) と自動生成テストの両方で同じ判定を使う。
// 関数は toString() でブラウザに送るため、外部の変数を参照しないこと。

/**
 * 利用者から実際に見える状態か。
 * Playwright の toBeVisible は opacity:0 や高さ 0 の overflow:hidden 親の中も「見える」と判定するため、
 * 開閉メニューの閉じた状態を区別できるよう独自に判定する。
 */
export function isActuallyVisible(el) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (Number.parseFloat(cs.opacity) === 0) return false;
    if (e !== el && (cs.overflow === "hidden" || cs.overflowY === "hidden")) {
      const pr = e.getBoundingClientRect();
      if (pr.height < 1 || pr.width < 1) return false;
    }
  }
  return true;
}

/**
 * ページの UI 要素を列挙する。本文 (.prose) 内の要素は記事ごとに変わるため除外する。
 * 記事・タグ・見出しアンカーへのリンクは href を :slug / :tag / :anchor に正規化して 1 件にまとめる。
 */
export function collectUi() {
  const visible = window.__e2eIsVisible;
  const regionOf = (el) => {
    for (const r of ["aside", "main", "header", "footer"]) {
      if (el.closest(r)) return r;
    }
    return "body";
  };
  const normalizeHref = (href) => {
    if (href === "#") return { href: "#", kind: "anchor-top" };
    if (href.startsWith("#")) return { href: "#:anchor", kind: "anchor" };
    if (/^https?:\/\//.test(href)) return { href, kind: "external" };
    if (/^\/posts\/[^/]+\/?$/.test(href) && href !== "/posts/") {
      return { href: "/posts/:slug/", kind: "dynamic", prefix: "/posts/" };
    }
    if (/^\/tags\/[^/]+\/?$/.test(href)) {
      return { href: "/tags/:tag/", kind: "dynamic", prefix: "/tags/" };
    }
    return { href, kind: "internal" };
  };
  const q = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const items = new Map();
  const add = (item) => {
    const prev = items.get(item.key);
    if (prev) prev.visible = prev.visible || item.visible;
    else items.set(item.key, item);
  };

  const interactive = document.querySelectorAll(
    'a[href], button, input, select, textarea, summary, [role="button"], [aria-expanded]',
  );
  for (const el of interactive) {
    if (el.closest(".prose")) continue;
    const region = regionOf(el);
    const tag = el.tagName.toLowerCase();
    const id = el.id || "";
    const aria = el.getAttribute("aria-label") || "";
    let selector = `${region} ${tag}`;
    let keyBody = tag;
    if (id) {
      selector += `#${CSS.escape(id)}`;
      keyBody += `#${id}`;
    }
    if (aria) {
      selector += `[aria-label="${q(aria)}"]`;
      keyBody += `[aria-label="${aria}"]`;
    }
    let link = null;
    if (tag === "a") {
      link = normalizeHref(el.getAttribute("href") || "");
      keyBody += `[href="${link.href}"]`;
      if (link.kind === "dynamic") selector += `[href^="${q(link.prefix)}"]`;
      else if (link.kind === "anchor") selector += '[href^="#"]';
      else selector += `[href="${q(el.getAttribute("href") || "")}"]`;
    }
    const dynamicText =
      link && (link.kind === "dynamic" || link.kind === "anchor");
    const text = dynamicText
      ? ""
      : (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (text && !id && !aria) keyBody += ` "${text}"`;
    add({
      key: `${region} ${keyBody}`,
      type: "interactive",
      region,
      tag,
      selector,
      text: !id && !aria ? text : "",
      linkKind: link?.kind ?? null,
      href: link && !dynamicText ? el.getAttribute("href") : null,
      ariaExpanded: el.hasAttribute("aria-expanded"),
      visible: visible(el),
    });
  }

  // id を持つ構造要素 (開閉パネルなど)。見出しの id は本文由来なので除く。
  for (const el of document.querySelectorAll("[id]")) {
    if (el.closest(".prose") || /^H[1-6]$/.test(el.tagName)) continue;
    if (el.matches("a[href], button, input, select, textarea")) continue;
    const region = regionOf(el);
    const tag = el.tagName.toLowerCase();
    add({
      key: `${region} ${tag}#${el.id}`,
      type: "structure",
      region,
      tag,
      selector: `#${CSS.escape(el.id)}`,
      text: "",
      linkKind: null,
      href: null,
      ariaExpanded: false,
      visible: visible(el),
    });
  }

  // ランドマークと見出し
  for (const sel of [
    "header",
    "nav",
    "main",
    "footer",
    "aside",
    "article",
    "h1",
  ]) {
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest(".prose")) continue;
      const region = regionOf(el) === sel ? "body" : regionOf(el);
      const aria = el.getAttribute("aria-label") || "";
      const selector = `${region === "body" ? "" : `${region} `}${sel}${aria ? `[aria-label="${q(aria)}"]` : ""}`;
      add({
        key: `${region} <${sel}${aria ? ` aria-label="${aria}"` : ""}>`,
        type: "landmark",
        region,
        tag: sel,
        selector,
        text: "",
        linkKind: null,
        href: null,
        ariaExpanded: false,
        visible: visible(el),
      });
    }
  }

  const head = [];
  for (const m of document.querySelectorAll(
    "head meta[name], head meta[property]",
  )) {
    head.push(
      `meta[${m.hasAttribute("name") ? "name" : "property"}="${m.getAttribute("name") || m.getAttribute("property")}"]`,
    );
  }
  for (const l of document.querySelectorAll("head link[rel]")) {
    head.push(`link[rel="${l.getAttribute("rel")}"]`);
  }
  return {
    title: document.title,
    hasH1: !!document.querySelector("h1"),
    items: [...items.values()],
    head: [...new Set(head)].sort(),
  };
}
