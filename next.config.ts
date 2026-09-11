import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const nextConfig: NextConfig = {
  output: "export",
  basePath: isGitHubPages ? "/game-key-site-" : "",
  images: { unoptimized: true },
};
export default nextConfig;
