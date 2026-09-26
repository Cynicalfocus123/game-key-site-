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

## Admin panel code (2026-09-26)

- `lib/server/db/schema.ts`: new `login_event` (user_id FK cascade, method, ip_address, user_agent, created_at; indexes on user_id, created_at). Migration `drizzle/0001_admin_login_events.sql` (generated by `drizzle-kit generate`), auto-applied on first request.
- `lib/server/auth.ts`: `databaseHooks.user.create.before` sets `role` admin for `ADMIN_EMAILS`; `session.create.after` inserts `login_event` (method from endpoint path: `/sign-in/email` → email, `/verify-email` → email-verify, `/callback/google` → google) and promotes allowlisted users. Errors logged, never block sign-in.
- `lib/server/admin.ts`: `isAdmin`, `adminEmails`, `loginMethod`, queries `adminStats`, `adminUsers` (search/filter/sort/page, 25 per page, max 100), `adminUserDetail` (never selects session tokens). Drizzle leaves columns unqualified in single-table selects, so correlated subqueries use explicit `"user"."id"` / aliased tables. Day buckets in `Asia/Bangkok`.
- `lib/server/session.ts`: `requireAdmin(req)` → 401 signed out, 403 not admin.
- API: `app/api/admin/me`, `stats`, `users`, `user` (`route.api.ts`, server mode only).
- Client: `AdminApi` in `lib/client/types.ts`; `serverAdminApi` (fetch) and `demoAdminApi` (localStorage + 36 sample users, login events recorded on demo sign-in/Google/verify); `adminApi` export in `lib/client/api.ts`. `signUp`/`signIn` accept `callbackPath`; demo `signUp` accepts `admin`. Verify page honours `next=/admin`.
- UI: `app/components/admin-shell.tsx` (`AdminAuthShell`, `AdminShell` guard via `/api/admin/me`, `UserTable`, `MethodBadge`, `dateTime`, `device`), pages under `app/admin/`, styles `app/admin.css` (imported in `app/layout.tsx`). User detail uses `?id=` because static export cannot pre-render per-user pages.
- `.env.example`: `ADMIN_EMAILS`.
- Builds on this PC need `NEXT_TELEMETRY_DISABLED=1` (Next telemetry config write on C: fails with EXDEV).

## Playwright tests (2026-09-26)

- `@playwright/test` 1.63.0 (dev). `playwright.config.ts`: `testDir: e2e`, projects `desktop` (Desktop Chrome) + `mobile` (Pixel 7), baseURL `http://127.0.0.1:4173/game-key-site-/`, `webServer` = `node scripts/serve-out.mjs` (dependency-free static server for `out/` under the Pages base path, binds 127.0.0.1 only).
- `scripts/e2e.mjs` (`npm run test:e2e`, add `--no-build` to skip build, other args pass to Playwright): builds with `GITHUB_ACTIONS=true` + `NEXT_TELEMETRY_DISABLED=1`, sets `PLAYWRIGHT_BROWSERS_PATH=D:/dev/playwright` and `TEMP=D:/dev/tmp` on Windows (forward slashes; backslashes got mangled by the shell).
- Tests (demo mode, fresh localStorage per test): `e2e/home.spec.ts` (sections, no horizontal scroll, slider, drawer + Escape), `e2e/auth.spec.ts` (register → demo inbox → verify → overview → sign out → wrong/right password; validation; signed-out redirect), `e2e/admin.spec.ts` (signed-out redirect, customer denied, admin register → overview 37 users → Google filter 12 → search → detail history). `e2e/helpers.ts`: `registerAndVerify` waits for `verified=1` redirect (fixes race), inputs selected by `name` (labels include hint text).
- Result: 18 tests × 2 projects pass; `--repeat-each=5` = 90/90 pass.
- Live mirror: test-only files (`e2e/`, `scripts/e2e.mjs`, `scripts/serve-out.mjs`, `playwright.config.ts`) are kept out of `live/` (user rule 2026-09-26). Main folder + Git only.
- CI: `.github/workflows/deploy-pages.yml` runs `npx playwright install --with-deps chromium` + `npx playwright test` after build; uploads `playwright-report` + `test-results` on failure (7 days). `.gitignore`: `test-results/`, `playwright-report/`.

Handoff v4 logged 2026-09-26 (agents.md). No code change.

## Currency system (2026-09-26)

- `lib/currency/currencies.ts`: 53 currencies (code, name, symbol, decimals 0 JPY KRW CLP ISK / 3 BHD JOD KWD TND / else 2), `BASE_CURRENCY` THB, `DEFAULT_CURRENCY` USD, launch defaults (`DEFAULT_DISABLED` BGN RUB, `DEFAULT_CHARGEABLE` USD THB AED), country → currency map (euro area → EUR), `guessCountry(timeZone, languages)` for demo.
- `lib/currency/money.ts`: integer minor units. `scaleRate` parses rates to BigInt × 10^12 (no BigInt literals: tsconfig target ES2017). `convertMinor(thbMinor, base, to)` = amount / rate(THB) × rate(X), half-up, then `roundStep` (minor units). `crossRate` = rate used on orders. `formatMoney` = the one formatter (Intl grouping on an integer-built decimal string, own symbols). `chargeCurrency` = chosen if chargeable, else USD.
- `lib/currency/rules.ts`: `applyCurrencyPatch` (USD always enabled + chargeable + rate 1; disable → not chargeable; chargeable → enabled; override positive, up to 12 decimals; step 1–100000). Shared by server and demo admin.
- `lib/currency/fallback-rates.json`: committed rates (2026-09-26). Used for DB seed, first render (USD, so static HTML matches hydration), demo fallback, demo sample orders.
- DB (`drizzle/0002_currencies.sql`, `0003_order_fx_user_currency.sql`): `currency` (enabled, chargeable, auto_rate, override_rate numeric(24,12), round_step, rate_updated_at, updated_at), `rate_status` (last attempt/success/error, provider time), `user.currency`, `orders.base_currency/base_total_minor/fx_rate/rates_at`.
- `lib/server/rates.ts`: `ensureCurrencies` (seed, `onConflictDoNothing`), `refreshRates(force)` (one conditional UPDATE claims the refresh across instances; 12 h interval, 1 h retry; 10 s timeout; validates USD/THB present; failure stores `last_error`, keeps rates), `publicCurrencies(country)`, `adminCurrencies`, `updateCurrency`.
- API: `GET /api/currencies` (`x-vercel-ip-country`, schedules refresh with `after()`), `GET/PATCH /api/admin/currencies`, `POST /api/admin/currencies/refresh`. Sample orders (`/api/account/orders` POST) price in THB and store charged currency, amount, rate.
- Better Auth: `currency` user field (`input: true`), validated in `databaseHooks.user.create/update.before`.
- Client: `AccountApi.currencies/setCurrency`, `AdminApi.currencies/updateCurrency/refreshRates`; demo in `lib/client/demo-currency.ts` (build `rates.json` → fallback; admin settings + browser "Update rates now" in localStorage `corecart-demo-currency-v1`). `money()` in `lib/client/api.ts` now calls `formatMoney`.
- UI: `app/components/currency-provider.tsx` (`CurrencyProvider` in layout, `useCurrency`, `Price`, `ChargeNotice`, `Flag`); choice order: account → localStorage `corecart-currency` → country → USD. `app/components/currency-menu.tsx` (`CurrencyDropdown`, `CurrencyList`, `CurrencyDrawerRow`, `CurrencySheet`; `inert` on hidden panes; drawer focus trap skips `[inert]`; Escape closes sheet before drawer). `app/admin/currencies/page.tsx`. Storefront prices are THB satang via `<Price>`; topbar free-shipping threshold ฿1,200.
- Build: `npm run build` runs `scripts/fetch-rates.mjs` first (static demo only; writes Git-ignored `public/rates.json`, falls back to committed file). `scripts/e2e.mjs` runs it too.
- Tests: `e2e/currency.spec.ts` (routes `rates.json` to fixed rates; selector tests pin `America/New_York` because this PC is in Bangkok). 27 passed.

- Status 2026-09-26: currency work pushed in `39a21d8`; `live/` synced and verified.

- Admin lockdown (2026-09-26): `lib/server/admin.ts` `isAdmin` = verified + `role === "admin"` (ADMIN_EMAILS code removed). `lib/server/auth.ts`: sign-up always `customer`; `databaseHooks.account.create.before` returns false for non-credential accounts on admin users; session hook only logs sign-ins. `scripts/create-admin.mjs` (`npm run admin:create`): loads `.env.local`, runs migrations, creates/promotes admin with `better-auth/crypto` `hashPassword`, sets email verified, clears sessions on new password or demote. `/admin/login`: no Google, no sign-up link, demo-only "Fill demo admin". `/admin/register`: client redirect to `/admin/login`. Demo: `DEMO_ADMIN` in `lib/client/demo-api.ts`, seeded into every demo store (id `demo-admin`, fixed salt + SHA-256 hash); `signUp` lost the `admin` flag. Tests: `signInDemoAdmin` helper; `registerAndVerify` customer only.
