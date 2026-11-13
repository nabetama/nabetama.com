# nabetama.com

The source code for nabetama.com (Astro + Cloudflare Pages).

## Getting Started

```sh
git clone git@github.com:nabetama/nabetama.com.git
pnpm install
pnpm dev
```

The dev server starts on http://localhost:4321.

To write a new article, run:

```sh
pnpm write
```

This creates `src/content/posts/yyyy-MM-dd.mdx` (date in Asia/Tokyo). It refuses to overwrite an existing file.

### Frontmatter

| key | required | note |
| --- | --- | --- |
| `title` | yes | |
| `date` | yes | `"yyyy-MM-dd"` |
| `lastModDate` | | shown as 更新日, used for `article:modified_time` and sitemap `lastmod` |
| `description` | | meta description / list summary. If empty, the first ~120 chars of the body are used |
| `tags` | | `["日記"]` |
| `thumbnail` | | OGP image. If omitted, the first image in the body (or the site default) is used |
| `draft` | | `true` hides the post from production builds (still visible in `pnpm dev`) |

Static pages live in `src/content/pages/*.mdx` and are served at `/<file name>/`. Set `lang: en` for non-Japanese pages.

## Structure

| path | role |
| --- | --- |
| `src/site.config.ts` | site name, URL, author, navigation, social links |
| `src/lib/posts.ts` | loading posts and deriving data (summary, reading time, OGP image, tags, related / adjacent posts) |
| `src/lib/structured-data.ts` | JSON-LD (WebSite, Person, BlogPosting, BreadcrumbList, CollectionPage) |
| `src/lib/date.ts`, `src/lib/text.ts` | date formatting (Asia/Tokyo), MDX → plain text |
| `src/components/SEO.astro` | meta / OGP / Twitter card / JSON-LD in `<head>` |
| `src/components/mdx/` | components passed to MDX (`<Image>`, lazy `img`, scrollable `table`) |
| `src/layouts/` | `BaseLayout` (all pages), `PostLayout`, `PageLayout`, `ListLayout` |

## E2E (動作確認)

```sh
pnpm e2e               # build → preview → UI change detection → Playwright E2E → HTML report
pnpm e2e --skip-build  # reuse dist/
pnpm e2e --skip-build --update-baseline  # accept detected UI changes (e2e/ui-baseline.json)
pnpm e2e:report        # re-render the report (e.g. after writing e2e-report/analysis.json)
```

The report is written to `e2e-report/index.html` (screenshots, steps, result, probable cause and fix suggestion for each test case).
Tests are in `e2e/tests/`; `e2e/tests/generated/` is regenerated from the UI inventory on every run.
In Claude Code, `/e2e-check` runs this, analyzes failures, and adds tests for UI / spec changes.
