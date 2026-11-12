# nabetama.com

The source code for nabetama.com.

## Getting Started

```sh
git clone git@github.com:nabetama/nabetama.com.git
npm install
npm run dev
```

dev server will starts on localhost:3000.

Next, You will be able to write some articles.
Writing articles is easy. Execute the following command.

```sh
npm run write
```

The above command will create `yyyy-MM-dd.mdx` in the `content/posts` directory.

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
