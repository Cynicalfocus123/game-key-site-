import { defineConfig, devices } from "@playwright/test";

// Tests run against the static GitHub Pages demo build (out/), served by scripts/serve-out.mjs.
// Local: `npm run test:e2e` (builds first). CI: deploy workflow runs `npx playwright test` after its build.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // Local cap (2026-09-27): with the dev server running the PC has ~2.5 GB free RAM; 4-12 Chromiums starting at once page to disk
  // ("Create page" 26 s) and the first wave times out. 2 workers + 60 s passes; CI keeps its defaults.
  workers: process.env.CI ? undefined : 2,
  timeout: process.env.CI ? 30_000 : 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // Bangkok time zone everywhere (CI runs in UTC): region lines guess the visitor country from it.
  use: { baseURL: "http://127.0.0.1:4173/game-key-site-/", trace: "retain-on-failure", timezoneId: "Asia/Bangkok" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "node scripts/serve-out.mjs", url: "http://127.0.0.1:4173/game-key-site-/", reuseExistingServer: false, timeout: 30_000 },
});
