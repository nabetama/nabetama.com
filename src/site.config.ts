/**
 * サイト全体で共有する設定。サイト名・URL・著者・ナビゲーションはここだけで定義し、
 * レイアウトやフィード、構造化データはこの値を参照する。
 */
export const SITE = {
  name: "nabetama.com",
  url: "https://nabetama.com",
  description:
    "購入したものや気になったものを紹介したり学んだことをメモするブログです。",
  lang: "ja",
  locale: "ja_JP",
  timeZone: "Asia/Tokyo",
  defaultOgImage: {
    path: "/default_og_image.jpg",
    width: 640,
    height: 640,
  },
  themeColor: { light: "#ffffff", dark: "#0a0a0a" },
} as const;

export const AUTHOR = {
  name: "nabetama",
  url: `${SITE.url}/about/`,
  twitter: "@nabetama",
  sameAs: ["https://github.com/nabetama", "https://x.com/nabetama"],
} as const;

export type NavItem = { label: string; href: string };

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Archive", href: "/posts/" },
  { label: "Tags", href: "/tags/" },
  { label: "About me", href: "/about/" },
];

export type SocialLink = {
  label: string;
  href: string;
  icon: "github" | "x" | "rss";
};

export const SOCIAL_LINKS: readonly SocialLink[] = [
  { label: "GitHub", href: "https://github.com/nabetama", icon: "github" },
  { label: "X (Twitter)", href: "https://x.com/nabetama", icon: "x" },
];

/**
 * タグページを検索エンジンに登録させる最小の記事数。これ未満のタグページは中身が薄いため
 * noindex にし、sitemap にも載せない (ページ自体は残し、記事からのリンクは有効なまま)。
 */
export const MIN_POSTS_FOR_INDEXED_TAG = 2;

/** トップページで一覧に出す記事数。先頭 FEATURED 件はカード、残りはリストで表示する。 */
export const HOME = {
  featured: 3,
  total: 21,
} as const;
