import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4329);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// e2e/run.mjs から呼ばれたときは run.mjs が preview サーバーを起動済み (E2E_SERVER_RUNNING=1)。
// `pnpm exec playwright test -c e2e` で単体実行したときだけ webServer で dist を配信する。
const serverRunning = process.env.E2E_SERVER_RUNNING === "1";

export default defineConfig({
  testDir: "./tests",
  outputDir: "../e2e-report/.artifacts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["./lib/reporter.mjs"]],
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    locale: "ja-JP",
    colorScheme: "light",
    screenshot: "on",
    trace: "retain-on-failure",
  },
  webServer: serverRunning
    ? undefined
    : {
        command: `pnpm exec astro preview --host 127.0.0.1 --port ${PORT} --ignore-lock`,
        cwd: "..",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
