import type { NextConfig } from "next";

// Two build targets from one codebase:
// - GitHub Pages (GITHUB_ACTIONS=true or STATIC_DEMO=1): static export, demo mode, API routes (route.api.ts) excluded.
// - Server (local `npm run dev`, Vercel): real auth, database, API routes.
const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const isStaticDemo = isGitHubPages || process.env.STATIC_DEMO === "1";
const basePath = isGitHubPages ? "/game-key-site-" : "";

const nextConfig: NextConfig = {
  ...(isStaticDemo
    ? { output: "export", trailingSlash: true, pageExtensions: ["tsx", "ts"] }
    : { pageExtensions: ["tsx", "ts", "api.ts"], serverExternalPackages: ["@electric-sql/pglite"], outputFileTracingIncludes: { "/api/**/*": ["./drizzle/**/*"] } }),
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_DEMO_MODE: isStaticDemo ? "true" : "false" },
  images: { unoptimized: true },
};
export default nextConfig;
