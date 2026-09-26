// Local test run: builds the GitHub Pages demo, then runs Playwright. Keeps browsers and temp files on D: (Windows).
import { spawnSync } from "node:child_process";

const env = { ...process.env, GITHUB_ACTIONS: "true", NEXT_TELEMETRY_DISABLED: "1" };
if (process.platform === "win32") {
  env.PLAYWRIGHT_BROWSERS_PATH ||= "D:/dev/playwright";
  env.TEMP = env.TMP = "D:/dev/tmp";
}
const run = (args) => spawnSync("npx", args, { stdio: "inherit", env, shell: true }).status ?? 1;
const args = process.argv.slice(2);
const skipBuild = args.includes("--no-build");
if (!skipBuild && run(["--no-install", "next", "build"]) !== 0) process.exit(1);
process.exit(run(["--no-install", "playwright", "test", ...args.filter((a) => a !== "--no-build")]));
