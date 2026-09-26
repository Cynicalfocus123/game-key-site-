# Weight status — Phase 1

- Images live in `public/images/placeholders/`. Current sample files use 19 KB–1.8 MB source sizes; final hero replacements need AVIF/WebP and target under 350 KB desktop / 180 KB mobile where practical.
- `next/image` provides responsive image sizing, lazy loading below fold, reserved `fill` containers, and optimized output. First hero image uses `priority`.
- No animation library or image UI dependency installed. Drawer and slider use native CSS and React.
- Keep final LCP image dedicated, correctly sized, and preload only first hero. Target LCP <= 2.5s, INP <= 200ms, CLS <= 0.1.

- Latest review: no animation package; user interaction code remains scoped to drawer, carousel, and desktop/laptop tabs.

- GitHub Pages uses static export. Next image optimization is disabled only for hosted static output; placeholder source dimensions and responsive containers remain enforced.

- Slider control layout uses fixed bottom-right rail. It cannot overlap campaign CTA at narrow viewports.

- Quick-category icons are eight local SVG files, loaded as small vector assets. Promo placeholders stay in `public/images/placeholders/promos/`; current files are 212–353 KB. Use AVIF/WebP and target under 250 KB wide / 150 KB small banner when production art arrives.
- Promo images use `next/image` with fixed containers, `fill`, `sizes`, and separate mobile source hooks. Hover uses one CSS transform only; no added JavaScript or animation dependency.

- GitHub Pages asset prefix is injected into all local image paths, preventing broken placeholder icons in hosted build.

- Supplied Steam, Xbox, Sony, Nintendo, Netflix, Apple, and Spotify logo PNGs now replace prior generic SVG samples. Transparent backgrounds are retained where source supports cleanup; Nintendo and Netflix preserve supplied brand-color fields.

- Project layout now keeps mirrored live copy at `live/` inside Git folder. `live/` stays Git-ignored to avoid recursive repository content and duplicate tracked files.

- Claude audit build (2026-09-25): homepage route 10.1 kB, 112 kB first-load JS, shared 102 kB. No new dependencies added. Geist still loaded through Google Fonts `@import` in `globals.css`; consider `next/font` later to cut render-blocking request.

- Sync rule added 2026-09-25: no weight change.
- Correction: quick-category icons are now seven supplied PNG logos plus one eGift SVG, not eight SVG files.

- Token saving rules added to `agents.md` 2026-09-25: no weight change.

- Claude review 2026-09-25: no weight change. Open item: move Geist from CSS `@import` to `next/font`.

- Next-step plan logged 2026-09-25: no weight change. Auth, database, payment libraries not yet installed.

- Phase 2 (2026-09-25): homepage first-load JS 112 kB → 129 kB (Better Auth client + shared header). Account/auth pages 122–123 kB. Server-only packages (`pg`, `pglite`, `drizzle-orm`) stay out of browser bundles. No Stripe or email SDK; both use plain fetch.

- D: drive rule logged 2026-09-25: no weight change.

- Handoff v3 logged 2026-09-25: no weight change.

- Admin panel (2026-09-26): no new dependencies. Chart and bars are plain CSS. Admin routes 0.9–1.5 kB page JS, 127 kB first load (server build). Storefront code not touched; current server build: `/` 8.86 kB, 132 kB first load. New `login_event` table grows one row per sign-in; retention/cleanup not built yet.

- Playwright (2026-09-26): dev-only, never shipped to browsers. Chromium + headless shell + ffmpeg in `D:\dev\playwright` (707 MB). CI deploy adds roughly 1–2 minutes (browser install + tests).

- Live mirror excludes test files (2026-09-26): no weight change.

- Handoff v4 logged 2026-09-26: no weight change.

- Currency system (2026-09-26): no new dependencies. Server build homepage 8.87 kB, 139 kB first load (was 132 kB); admin currencies 2.27 kB page JS. Flags: 53 SVGs, 142 KB total (largest `mxn.svg` 85 KB), `loading="lazy"`; only the selected flag loads until the list opens. `public/rates.json` about 1.5 KB (demo only). Fallback rates JSON about 1.4 KB bundled for the first render. Server rate refresh = one outbound request per 12 h, none on page loads.

- Status 2026-09-26: currency work pushed in `39a21d8`; `live/` synced and verified.

- Admin lockdown (2026-09-26): no new dependencies. `/admin/register` now 377 B (redirect only); `/admin/login` 1.1 kB. `scripts/create-admin.mjs` is server-only, never shipped to browsers.
