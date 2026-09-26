import { defineConfig, devices } from "@playwright/test";

// Tests run against the static GitHub Pages demo build (out/), served by scripts/serve-out.mjs.
// Local: `npm run test:e2e` (builds first). CI: deploy workflow runs `npx playwright test` after its build.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://127.0.0.1:4173/game-key-site-/", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "node scripts/serve-out.mjs", url: "http://127.0.0.1:4173/game-key-site-/", reuseExistingServer: false, timeout: 30_000 },
});
