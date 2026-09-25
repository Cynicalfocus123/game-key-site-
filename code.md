# Code status — Phase 1

- `app/storefront.tsx`: client homepage composition, mock data, slider, category drawer, reusable `Section` and `ProductCard`.
- `app/globals.css`: global token values and responsive storefront styles.
- `app/page.tsx`: homepage route. `app/layout.tsx`: font and metadata.
- Placeholder assets: `public/images/placeholders/`. Mock data references local image paths, so production assets can replace files with no component redesign.

Run `npm install`, then `npm run build` for production validation. Local assets use `next/image` with `fill`, `sizes`, fixed aspect-ratio wrappers, first hero `priority`, and lazy loading below fold.

Drawer opens from left, locks page scroll, closes with backdrop/Escape, moves focus into drawer, and traps Tab focus while open.

`.github/workflows/deploy-pages.yml` builds static `out/` and deploys it to GitHub Pages. `next.config.ts` applies repository base path only in GitHub Actions.

Hero slider keeps CTA and controls separate: `.hero-controls` anchors bottom-right, while CTA keeps a minimum touch target.

`QuickCategoryStrip` maps `quickCategories` data to reusable icon links. `quick-track` uses native horizontal overflow and scroll snap; desktop arrows call `scrollBy`, mobile hides arrows and keeps swipe scrolling. `PromoBannerSection` maps `promos` data to reusable `PromoBanner` components. Each promo stores `desktopImage` and `mobileImage`; local placeholder files live under `public/images/placeholders/categories/` and `public/images/placeholders/promos/`. CSS clips banner image zoom with `overflow: hidden` and stacks banners under 640px.

Current render order places `QuickCategoryStrip` before `Shop by category`, with no quick-strip heading. `PromoBannerSection` follows hardware categories. `assetPath()` adds `/game-key-site-` during GitHub Pages builds to local SVG, JPG, and PNG paths.

`quickCategories` now references supplied `*-logo-placeholder.png` files. Image component keeps `object-fit: contain`, fixed dimensions, and accessible text labels. Unused original SVG samples remain available as fallback references but are not rendered.

Git source root is `D:\mstar companies\Game keys and ecommerce pc site`. Live mirror is `D:\mstar companies\Game keys and ecommerce pc site\live`. `.gitignore` excludes nested `live/`; mirror updates use explicit copy and hash verification.

Stack audit (2026-09-25, Claude): frontend only — Next.js 15.5.2 App Router with static export, React 19.1.1, TypeScript 5.9.2, plain global CSS, `next/image`. No backend, API routes, database, auth, or payment code exists yet. Local `node_modules` already installed (Windows SWC binary, sharp). Clean clone of `origin/main` builds with Node 22 + `npm ci` + `npm run build`: `/` 10.1 kB, 112 kB first-load JS. Git remote `https://github.com/Cynicalfocus123/game-key-site-.git`, branch `main`; local commit author still `Codex <codex@local>` in `.git/config`.

Sync procedure: every changed file is written to both `D:\mstar companies\Game keys and ecommerce pc site\` and `...\live\` in same step, then compared for byte match. Generated/installed folders (`node_modules/`, `.next/`, `.git/`) exist only in main folder by design.

Token saving rules and project workflow rules added to `agents.md` (2026-09-25). No code change.
