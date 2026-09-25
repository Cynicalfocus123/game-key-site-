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

Claude code review (2026-09-25), no code changed. Found:
- Global `keydown` listener changes hero slide on ArrowLeft/ArrowRight even while typing in search input.
- AMD Ryzen 7 9800X3D card uses `ram-placeholder-01.jpg`; Processors and Motherboards category tiles reuse RAM / gaming PC images.
- All links are `href="#"`. Search, Add to cart, hero CTA, footer email Join have no handler. Cart count fixed at `2`. Delivery location fixed to Bangkok.
- Drawer sub-levels exist only for `PC Parts` and `Digital Games`; other items close drawer.
- Static export (`output: "export"`) blocks server features; Phase 4 backend needs host with server runtime.

Detailed next-step plan (0–9) logged in `agents.md` 2026-09-25. No code change.

## Phase 2 accounts code (2026-09-25)

- Next.js upgraded 15.5.2 → 15.5.26, React 19.1.1 → 19.1.9 (security patches; needed before running a server).
- New packages: `better-auth` 1.7.6, `drizzle-orm` 0.45.3, `pg` 8.23.0, `@electric-sql/pglite` 0.5.8; dev: `drizzle-kit` 0.31.11, `@types/pg`.
- `next.config.ts`: GitHub Actions or `STATIC_DEMO=1` → static export, `trailingSlash`, `NEXT_PUBLIC_DEMO_MODE=true`, API routes excluded. Otherwise server mode with `pageExtensions` `tsx, ts, api.ts`.
- API routes use `route.api.ts` name so static build ignores them: `app/api/auth/[...all]`, `app/api/config`, `app/api/account/orders`, `app/api/account/payment-methods`.
- `lib/server/auth.ts`: Better Auth. Email + password (8–128 chars), required email verification, reset password (revokes sessions), Google when `GOOGLE_CLIENT_ID/SECRET` set, account linking, rate limit in database (sign-in/sign-up 5/min, reset + verify 3/min), user fields `role`, `termsAcceptedAt`, `marketingOptIn`, `stripeCustomerId`.
- `lib/server/db/`: Drizzle schema (user, session, account, verification, rate_limit, orders, order_items). `DATABASE_URL` set → PostgreSQL (Neon). Empty → local PGlite file DB in `.data/pglite` (Git-ignored). Migrations in `drizzle/`, applied automatically on first request. Schema change: edit `schema.ts`, run `npm run db:generate`.
- `lib/server/email.ts`: Resend via fetch when `RESEND_API_KEY` set; otherwise links print in terminal.
- `lib/server/stripe.ts`: Stripe REST via fetch. Cards saved only on Stripe-hosted Checkout (setup mode). CoreCart never stores card numbers.
- `lib/client/`: one `AccountApi` interface, two implementations: `server-api.ts` (Better Auth client + fetch) and `demo-api.ts` (localStorage, SHA-256 salted demo passwords, demo inbox links, sample orders + demo keys, test cards without card number input).
- Shared `app/components/site-header.tsx` (drawer moved here, account link shows signed-in name, mobile account icon), `site-footer.tsx`, `auth-provider.tsx`, `auth-ui.tsx`, `account-shell.tsx` (sign-in guard + sidebar).
- Fixed: hero arrow keys no longer change slides while typing in inputs or while drawer is open.
- Config: `.env.example` lists every key. Copy to `.env.local`.
- Verified 2026-09-25: typecheck, server build, Pages build; real flow tested (sign-up, 403 before verify, verify link, session, orders, 401 without session, change password, reset password, rate limit 429); demo flow tested in browser desktop + 390px mobile, no horizontal overflow.
- Known: `npm audit` still flags `postcss` inside Next (build-time only) and `esbuild` inside drizzle-kit (dev only).

D: drive rule (2026-09-25): `npm install` writes `node_modules` in project folder on D:. npm cache set to `D:\dev\npm-cache`. Local database `.data/pglite` stays inside project on D:. No code change.
`Claude outputs/` (files the Claude app saves when sending diffs/downloads) is Git-ignored and not mirrored to `live/`, same as `node_modules/`, `.next/`, `.git/`.

Handoff v3 logged 2026-09-25 (agents.md). No code change.
