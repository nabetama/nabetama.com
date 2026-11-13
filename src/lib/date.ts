import { SITE } from "../site.config.ts";

const parts = new Intl.DateTimeFormat("ja-JP", {
  timeZone: SITE.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function ymd(date: Date) {
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.formatToParts(date).find((p) => p.type === type)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** 画面表示用の日付 (例: 2026年01月28日)。ビルド環境のタイムゾーンに依存しない。 */
export function formatDate(date: Date): string {
  const { y, m, d } = ymd(date);
  return `${y}年${m}月${d}日`;
}

/** `<time datetime>` 用の日付 (例: 2026-01-28)。 */
export function isoDate(date: Date): string {
  const { y, m, d } = ymd(date);
  return `${y}-${m}-${d}`;
}

/** サイトのタイムゾーンでの年 (アーカイブの年見出し用)。 */
export function yearOf(date: Date): string {
  return ymd(date).y;
}
