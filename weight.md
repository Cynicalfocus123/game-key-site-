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
