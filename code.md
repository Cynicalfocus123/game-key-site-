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

Handoff v6 logged 2026-09-26 (agents.md). No code change.

Handoff v7 logged 2026-09-26 (agents.md): next = cart + customer dashboard (keys library, key detail, balance, tickets) wireframes. Reference images in `Claude outputs/references/` (Git-ignored). No code change.

Handoff v8 logged 2026-09-26 (agents.md): approved spec + 2-part build plan (Part 1 cart + checkout gate; Part 2 dashboard, keys, balance + gift cards, tickets, polish). No code change.

## Cart + checkout gate (2026-09-26, Handoff v8 Part 1)

- `lib/catalog.ts`: homepage mock products moved here with stable ids (`hw-*`, `key-*`), `kind`, platform/region/os, hardware `stock`. Shared rules: `maxQty` (5 per key, hardware ≤ stock), `cleanCart` (drop unknown/bad, cap, dedupe), `mergeCarts` (same product → higher qty capped; new guest items first), `COUPONS` (`WELCOME10` 10 %), `cartTotals`. Used by storefront, client, demo and server.
- DB: `cart_item` (user_id FK cascade, product_id, quantity, created_at, updated_at, PK user_id+product_id). Migration `drizzle/0004_cart.sql` (drizzle-kit generate --name cart).
- `lib/server/cart.ts` (`getCart`, `setCartItem` upsert/delete with cap, `mergeCart`, `clearCart`); `app/api/cart/route.api.ts`: GET list, PUT {productId, qty} (0 removes), POST {items} merge (max 50), DELETE clear. Server-side caps; prices always from catalog.
- `AccountApi`: `cart`, `setCartItem`, `mergeCart`, `clearCart`; `signIn` takes `rememberMe` (Better Auth); `resendVerification(email, callbackPath)`; demo `signUp`/resend pass `callbackPath` into the demo verify link. Demo store gains `carts` per user.
- `app/components/cart-provider.tsx` (`CartProvider` in layout inside Auth + Currency providers, `useCart`): guest cart in localStorage `corecart-cart-v1` (exact items: productId, qty, title, platform, region, thb); signed in = account cart; on user change merges guest cart via `api.mergeCart` then clears it; `storage` listener on guest key, demo store key and `corecart-cart-ping` keeps every tab live; coupon in `corecart-coupon`; popup kind (added | cart); gate state {view, next}; `checkout()` = verified user → /checkout, else gate.
- `app/components/cart-ui.tsx`: `AddToCartButton`, `CartHeaderButton` (desktop popup / mobile sheet), `useMedia`, `PaymentLogos`, `TrustList`, `productMeta`, `assetPath`.
- `app/components/checkout-gate.tsx`: `CheckoutGate` (rendered once in layout). Register name = email local part. Unverified sign-in → check-email view (demo re-sends link; server Better Auth re-sends on sign-in).
- Pages: `app/cart/page.tsx`, `app/checkout/page.tsx`; styles `app/cart.css` (imported in layout).
- `safeNext` in `auth-ui.tsx` (same-site path, no `//`, no backslash) used by /login and /verify-email (verify now honours any safe `next`, e.g. /checkout). Fixes known issue "/login next accepts /\evil.com".
- Header: fixed cart count removed (known issue fixed); signed-out desktop "Hello, sign in" opens gate sign-in view.
- Tests: `e2e/cart.spec.ts` (add + popup + count + reload exact items, desktop hover/3 rows/other tab, cart page limit/coupon/remove/empty, gate register → verify → checkout same items + guest cart merged, gate sign in wrong password + merge higher qty, header Sign in desktop popup / mobile page). Full suite 42 passed, 6 skipped. First run with build had load timeouts; reruns clean.
- Not tested: server-mode cart API at runtime (typecheck only).

- Breadcrumb fix (2026-09-26): global `nav` rules in `app/globals.css` scoped to `header nav` (desktop bar, 900px link hide, 640px hide). `.crumbs` in `app/cart.css` = flex, wrap, 6px gap, hover blue, `[aria-current]` ink. Sidebars (`.acct-nav`) unaffected (class rules already overrode). Tests 42 passed.

## Customer dashboard step 1 (2026-09-26, Handoff v8 Part 2)

- `lib/profile.ts`: `AVATARS` (preset colour ids), `isAvatar`, `isCountry`, `countryName` (Intl.DisplayNames), `initials`, `profileTasks` (6: verified email, name ≠ email local part, avatar, country, currency, deals choice), `maskIp` (IPv4 first 2 octets, IPv6 first 2 groups), `LOGIN_HISTORY_DAYS` 90. `COUNTRY_CODES` exported from `lib/currency/currencies.ts`.
- DB: `user.avatar`, `user.country`, `user.marketing_choice_at` (`drizzle/0005_profile.sql`). Better Auth additionalFields avatar/country (input), marketingChoiceAt (not input). `databaseHooks.user.create` validates avatar/country, sets marketingChoiceAt when opted in; `update.before` rejects bad currency/avatar/country/name (1–80 chars) and stamps marketingChoiceAt whenever marketingOptIn is sent.
- API: `GET /api/account/logins` (own `login_event` rows, 90 days, max 200, masked IP). `AccountApi.updateProfile({name, avatar, country, marketingOptIn})` (server = `client.updateUser`) and `loginHistory()`; demo versions in `demo-api.ts` (demo IP shows "demo"). `SessionUser` + avatar/country/marketingOptIn/marketingChoiceAt; `OrderItem.revealedAt` (filled in step 2).
- `app/components/account-shell.tsx`: new nav list, `isActive` (exact or child path), mobile `<select>` (`.acct-picker`), breadcrumb, `crumb`/`unread` props, `Avatar`, `Cover` (catalog image by name via `coverFor` in `lib/catalog.ts`, else lettered tile; class `.thumb` because `.cover` is taken by `cart.css`). `agoText` in `lib/client/api.ts`.
- Pages: `app/account/page.tsx` (ProfileCard, BalanceCard display only, RecentPurchases from orders: game_key items, revealed = `revealedAt`), `login-history/`, `orders/` (table + expandable detail row, `KeyReveal` stays until step 2), `settings/` (ProfileForm, CurrencyForm, DealsForm, PasswordForm; anchors #profile #currency #deals #password #email), placeholders `balance/`, `keys/`, `tickets/`. Styles appended to `app/account.css` (dashboard section). Card footer is a `div` (global `footer` rule is the site footer).
- Tests: `e2e/dashboard.spec.ts` (overview cards, profile tasks to 100%, login history, orders details + reveal + mobile cards, sidebar vs mobile select, empty state via demo admin); `signOutFromAccount` helper (mobile uses the select). Suite 54 passed, 6 skipped. Server-mode profile update + logins API: typecheck only (not run).

Handoff v11 logged 2026-09-27 (agents.md): step 2 split into 2a fixes, 2b keys library, 2c product page + favorites (`favorite` table, `/api/favorites`), 2d payment page UI (provider hosted card fields later). No code change.

Handoff v11 update logged 2026-09-27 (agents.md): header favorites/profile task added to 2a, favorites dashboard page to 2c, payment methods fixed for 2d. No code change.

Handoff v11 update 2 logged 2026-09-27 (agents.md): step 3b admin promo codes (`promo_code` table, admin + validate APIs, demo store) replaces hard-coded `COUPONS` in `lib/catalog.ts`. No code change.

Handoff v11 update 3 logged 2026-09-27 (agents.md): promo codes get applies_to/categories/max_discount/once_per_customer; catalog products need a category field. No code change.

Handoff v12 logged 2026-09-27 (agents.md): two self-contained handoffs, PART A + PART B. No code change.

## Step 2a quick fixes (2026-09-27, Handoff v12 Part A)

- `app/components/site-header.tsx`: order CurrencyDropdown · Returns & Orders (desktop-utility) · `.hdr-icon` ♡ → `/account/favorites` · `CartHeaderButton` · `.hdr-profile` (`.hdr-account` link with `UserIcon` + `.hdr-profile-text`; signed out adds `.hdr-register`). `popupFor(view)` opens gate signin/register on ≥768. Exports `HeartIcon({filled})` for later favorites. `.mobile-account` removed (markup + `account.css`).
- `app/globals.css`: `.cur-toggle` border removed; `.hdr-*` rules; ≤640 `.hdr-profile-text` visually hidden (clip), `.hdr-sep/.hdr-register` hidden, ♡ `margin-left: auto`. `.charge-notice` amber.
- `app/components/checkout-gate.tsx`: dialog class `gate-view-{view}` (was `gate-{view}`, which gave the choice modal the `.gate-choice` 3-column grid). `app/cart.css`: `.gate.gate-view-choice` 720px, `.gate .btn` nowrap, `.region.bad` red, `.limit-note` #b45309, `.coupon-line dt` green.
- `lib/catalog.ts`: `Product.only?` / `excluded?` (ISO codes), `ASIA` list, Black Myth: Wukong region "ROW" excluded ASIA, `regionWorks(p, country)` (null for hardware/unknown).
- `app/components/cart-ui.tsx`: `useVisitorCountry()` (user.country → `guessCountry(timeZone, languages)`, null before mount), `RegionLine` (used in /cart and /checkout review rows). Cart limit text "Max 5 per order"; checkout rows show it at the limit too.
- `app/account/favorites/page.tsx`: placeholder until 2c.
- Tests: `e2e/fixes.spec.ts` (header order at 390/640/768/900/1280, Register popup, signed-in Hello, currency button no border + focus ring, gate widths 768/1024/1280, coloured text + checkout, EUR charge notice). `playwright.config.ts` pins `timezoneId: Asia/Bangkok` (CI is UTC; region line uses it). `e2e/cart.spec.ts` updated (header "Sign in" link, "Max 5 per order"). Suite 64 passed, 8 skipped.

## Step 2b keys library + key detail (2026-09-27, Handoff v12 Part A)

- `lib/keys.ts`: `GameKey` (id, order + item ids, name, platform, region, priceMinor, currency, createdAt, revealedAt, code = null until revealed), `KEYS_PER_PAGE` 20, `maskedKey`, `GUIDES` (6 platforms: slug, name, redeem url, site, worksOn, steps), `guideFor(platform)` (aliases), `filterKeys(keys, q, filter)`.
- DB (`drizzle/0006_keys.sql`): `order_key` (id, order_item_id FK cascade, user_id FK cascade, code, revealed_at, created_at) + `key_reveal` audit (key_id, user_id, ip_address, user_agent, created_at). `lib/server/keys.ts`: `listKeys` (creates missing `SAMPLE-…` keys for sample orders only), `getKey`, `revealKey` (stamps revealed_at once, logs every reveal). The code never leaves the server before reveal.
- API `app/api/account/keys/route.api.ts`: GET (list), GET ?id=, POST {id} reveal (IP from x-forwarded-for / x-real-ip, user-agent capped 500).
- `AccountApi.listKeys/getKey/revealKey`: server (fetch) + demo (`Store.keys` per user, `Store.reveals` audit; `ensureKeys` makes one key per unit, first unit reuses sample `demoKey`).
- Pages: `app/account/keys/page.tsx` (library), `keys/view/page.tsx` (detail, `CopyButton` with clipboard fallback to text selection), `keys/print/page.tsx` (no AccountShell; own sign-in redirect), `app/help/activate/page.tsx` + `[platform]/page.tsx` (server components, `generateStaticParams`, `dynamicParams = false`). `AccountShell` gains a `parent` breadcrumb prop.
- Overview `RecentPurchases` uses `listKeys` (counts per key unit). Orders page: `KeyReveal` removed; `KeyLinks` per order item from `listKeys`.
- CSS appended to `app/account.css` (keys, detail, tooltip, gift/print `@media print`, guides).
- Tests: `e2e/keys.spec.ts` (library search/filter/reveal/copy/reload, overview links + counts, print page + print media, 6 guides, empty state + unknown id, 21 keys → 2 pages); `e2e/dashboard.spec.ts` orders test follows the key link. Suite 75 passed, 8 skipped. Server-mode keys API: typecheck only (not run).

## Step 2c product page + favorites (2026-09-27, Handoff v12 Part A)

- `lib/catalog.ts`: `MAX_FAVORITES` 200, `cleanFavorites`, `mergeFavorites` (guest-only ids first). `lib/product-info.ts`: placeholder description, minimum requirements (games), warranty (hardware) per product id.
- DB `favorite` (user_id FK cascade, product_id, created_at, PK user+product), `drizzle/0007_favorites.sql`. `lib/server/favorites.ts` (get, add, remove, merge). API `app/api/favorites/route.api.ts`: GET, PUT {productId}, DELETE ?productId=, POST {ids} merge (max 200).
- `AccountApi.favorites/addFavorite/removeFavorite/mergeFavorites` (server fetch; demo `Store.favorites`).
- `app/components/favorites-provider.tsx`: `FavoritesProvider` (layout, inside CartProvider): guest localStorage `corecart-favorites-v1` (also reads + clears old `corecart-saved`), account list when signed in, merge on sign-in, `storage` sync (guest key, demo store, `corecart-fav-ping`), toast with role=status. `FavoriteButton` variants title / card / row (classes `fav-v-*`; `.fav-title` is the favorites page link).
- `app/components/icons.tsx`: `HeartIcon`, `UserIcon` (moved from site-header). Header ♡ shows count (`data-fav-count`), label "Favorites, N saved".
- `app/product/page.tsx` (client, `?id=`), `productHref` in `cart-ui.tsx`; storefront cards + cart rows link to it. Buy now = add (if not in cart) + `checkout()` (gate when signed out). `app/account/favorites/page.tsx` real page; `account-shell.tsx` nav item Favorites.
- CSS appended to `app/cart.css`.
- Tests `e2e/product.spec.ts` (card link + facts + sticky bar, ROW warning + hardware + unknown id, Buy now gate, guest favorites → reload → merge on register → dashboard remove/add to cart → sign out, cart row ♡ + other tab live). Suite 85 passed, 8 skipped. Server favorites API: typecheck only.

## Step 2d payment page UI (2026-09-27, Handoff v12 Part A)

- `app/checkout/payment/page.tsx`: `METHODS` (paypal, card, apple, google); radio group state only; card fields are `disabled` inputs with no `name` (never submitted, nothing leaves the browser); Pay always disabled until a provider (Stripe / Omise / 2C2P) is chosen and wired as hosted fields / redirect. Signed out or unverified → gate with next `/checkout/payment`. Summary rendered twice (mobile `<details>` + desktop aside), CSS shows one.
- `app/checkout/page.tsx`: "Continue to payment" link replaces the disabled Pay button; note text changed.
- `app/help/gift-card-fraud/page.tsx` (static). CSS in `app/cart.css` (`.pm-*`, `.pay-*`); mobile `scroll-padding-bottom` when a sticky bar is on the page.
- Tests `e2e/payment.spec.ts` (4 methods only, card fields disabled + unnamed, Pay disabled, method label, summary lines, qty change updates header, gate when signed out, fraud page). `e2e/cart.spec.ts` checkout assertion updated. Suite 89 passed, 8 skipped.

Handoff v13 logged 2026-09-27 (agents.md): Part A done, Part B next; sync helper `Claude outputs/tools/sync-live.mjs` (Git-ignored). No code change.

## Step 3 balance + gift cards (2026-09-27, Handoff v12 Part B, spec C3)

- `lib/gift-cards.ts` (shared): types `LedgerRow`, `BalanceData`, `GiftCard`, `NewGiftCards`; `normalizeCode` (spaces/dashes ignored, upper case → XXXX-XXXX-XXXX-XXXX), `formatTyping`, `generateCode` (16 chars from 32-char alphabet, no 0/O/1/I), `hashCode` (SHA-256 with prefix, Web Crypto), `maskedCode`, `giftCardStatus` (redeemed > disabled > expired > active), `REDEEM_ERRORS`, `REDEEM_LIMIT` (5 / 10 min per user), `checkNewGiftCards` (฿1–฿100,000, 1–50 cards, future expiry, note ≤120), `withBalances` (running total, newest first), `typeLabel`.
- DB (`drizzle/0008_gift_cards.sql`): `gift_card` (code_hash unique, last4, amount_minor THB satang, note, expires_at, disabled, created_by, redeemed_by, redeemed_at; FKs set null) + `wallet_ledger` (user_id cascade, bucket wallet|gift, type, signed amount_minor, ref, gift_card_id). Full code never stored; shown once to the admin.
- `lib/server/gift-cards.ts`: `hitLimit(key, max, windowMs)` (atomic upsert into Better Auth `rate_limit` table, keys prefixed `giftcard:`), `getBalance`, `redeemGiftCard` (transaction: UPDATE … WHERE redeemed_at IS NULL AND not disabled AND not expired RETURNING, then ledger insert; failure → reason), `listGiftCards` (redeemer email via join, max 1000), `createGiftCards`, `setGiftCardDisabled` (not when redeemed).
- API: `app/api/account/balance/route.api.ts` GET balance, POST {code} redeem (429 after 5 per user or 20 per IP in 10 min). `app/api/admin/gift-cards/route.api.ts` GET list, POST create → { created: [{ id, code }] }, PATCH { id, disabled }.
- Client: `AccountApi.balance/redeemGiftCard`, `AdminApi.giftCards/createGiftCards/setGiftCardDisabled` (server fetch + demo). Demo store: `giftCards` (shared in the browser, hashed), `ledger` per user, `redeemTries` per user; built-in `DEMO_GIFT` `CCDM-GIFT-2026-0500` ฿500 seeded lazily (`seedGift`).
- Pages: `app/account/balance/page.tsx` (replaces placeholder; `#redeem` scrolls + focuses the field), Overview `BalanceCard` real numbers (`data-testid` total-balance / overview-gift), `app/admin/gift-cards/page.tsx` + admin nav item. CSS: `app/account.css` (`.bal-*`), `app/admin.css` (`.gc-*`); `.adm-table-wrap` now `position: relative` (sr-only text in a scrolled table widened the mobile page).
- Tests `e2e/balance.spec.ts` (admin creates 2 → disables 1 → customer redeems via Overview + link, balances, transaction row, already redeemed, disabled, overview totals, admin sees Redeemed + filter; demo code, not found, rate limit 6th attempt). Server balance + gift card APIs: typecheck only (not run).

## Future task logged — search + filters + card region (2026-09-27)

Not built yet. Plan: `lib/search.ts` (normalise, Roman numerals, joined/split words, prefix, 1-typo, ranking) shared client + server; `/search?q=` (query params, static export safe); filter state in URL; tables `filter_group`, `filter_option` (later `product_filter`); `/api/admin/filters` admin-only; demo store version. Spec in agents.md.

- 2026-09-27 add-on S6: logos processed once by a Git-ignored sharp script (sharp already in node_modules, no install) → `public/images/payments/*.webp`; shared `PaymentLogos` component used by cart summary, checkout, payment page, footer strip.

## Step 3b promo codes + server-mode fixes (2026-09-27, Handoff v12 Part B)

- Research (Shopify discounts, WooCommerce coupons, Stripe promotion codes): same pattern as the spec — code, amount/percent, applies to, minimum requirement, usage limits (total, once per customer), active dates with optional end, summary panel.
- `lib/promo.ts` (shared): `PromoCode`, `PromoInput`, `PublicPromo` (no ids/uses), `PROMO_CATEGORIES` (Digital games + platform subs from `GUIDES`, PC parts, Monitors, Gaming hardware), `eligible`, `promoStatus` (disabled > expired > used_up > scheduled > active), `PROMO_ERRORS`, `promoDiscount` (eligible lines only, percent cap, fixed ≤ eligible subtotal; issue scope | min), `livePromo`, `checkPromoInput` / `parsePromoInput`, `promoSummary`, Bangkok `toBkkInput` / `fromBkkInput`, `randomPromoCode`, `WELCOME10` seed, `VALIDATE_LIMIT` 10/min.
- `lib/catalog.ts`: `category` on every product (`ProductCategory`); old `COUPONS` / `findCoupon` / `cartTotals` removed → `cartSubtotal`, `cartCount`. `cartTotals(entries, promo)` now lives in `cart-provider.tsx`.
- DB `promo_code` (`drizzle/0009_promo_codes.sql`; categories text[] default '{}'; deleted_at soft delete once uses > 0). `lib/server/promo.ts` (list, get, find, create/update with code-taken check incl. soft-deleted, enable, delete hard/soft, dev-only WELCOME10 seed). `lib/server/rate-limit.ts` (`hitLimit`, `isLimited` peek, `clientIp`; gift cards moved to it).
- API: `app/api/admin/promo-codes/route.api.ts` (GET list / ?id=, POST, PATCH {id, enabled} or full edit, DELETE ?id=; 400 { errors } per field). Public `app/api/promo/validate/route.api.ts` (POST {code, items?} → { promo, result? }; unknown codes count 10/min per IP, blocked IP gets 429 for every code; valid re-checks free).
- Client: `AccountApi.validatePromo` (gone flag), `AdminApi.promoCodes/promoCode/savePromo/setPromoEnabled/deletePromo` (server + demo; demo store `promos`, `promoMisses`, WELCOME10 seeded once in `load()`). `call()` in server-api returns status + field errors.
- Cart: `cart-provider.tsx` keeps the applied code + its public rules; re-check on load, focus/visibilitychange, other-tab `storage` (coupon, demo store), cart change (400 ms debounce), expiry timer. Removed codes → `couponNote`; `corecart-coupon-gone` key shows the note in every tab. `applyCoupon` async (min order → error with amount). `CouponLine` / `CouponNotes` in `cart-ui.tsx` used by /cart, /checkout, /checkout/payment.
- Admin UI: `app/admin/promo-codes/page.tsx` (search, status segment, table, ⋯ menu, delete `<dialog>`, copy code; cards under 1000px) and `app/admin/promo-codes/edit/page.tsx` (?id= edit, ?from= duplicate; option cards, live Summary, inline errors after first Save, beforeunload + Discard confirm). Admin nav "Promo codes"; active link now matches child paths. CSS `.pc-*` in `app/admin.css`, `.coupon-note` / `.coupon-idle` in `app/cart.css`.
- Not built yet: once-per-customer and total-uses enforcement (needs real orders / `promo_redemption`, payments step). Stored and shown only.
- Server-mode fix (`lib/server/auth.ts`): user update hook treated fields that were not sent (undefined) as invalid and returned false → Better Auth answered 200 but saved nothing. No profile/currency/country/avatar/deal-email save ever worked in server mode. Now only sent fields are checked and bad values throw `APIError` 400 with a message.
- Server smoke test `scripts/smoke-server.mjs` (test-only): 47 API checks incl. saved values. Run 2026-09-27 on localhost: all promo, gift card, balance, cart, favorites, keys, logins, profile checks passed after the fix; separate customer run 15/15 (sign-up → emailed verify link → redeem, limits, 403 on admin APIs, parallel double redeem credits once). Server UI (Playwright against `npm run dev`, desktop + mobile): admin creates promo → shopper applies → admin disables → cart drops it; gift card redeem — passed.
- Tests: `e2e/promo.spec.ts` (3 tests × desktop + mobile), cart/fixes updated. Unskipped on mobile: admin currencies table, keys paging. Last full run: 99 passed, 2 failed (desktop: balance "Check your email" timeout, cart gate sign-in popup timeout), 7 skipped. Reruns of those files under load failed more desktop tests with timeouts; user asked to stop testing and commit. OPEN: re-run the full suite on a quiet machine and fix any real desktop failure.

`CODEBASE.md` added 2026-09-27: full frontend + backend map for code review (modes, folders, providers, API table, tables, security model, run/test, coverage, known issues). No code change.

Handoff v14 logged 2026-09-27 (agents.md): next = rerun failed desktop tests, Returns & Orders, tickets 4a/4b, polish. No code change.

- 2026-09-27 add-on S7 (bug): only one DB `.data/pglite`; Pages demo users are localStorage only (`lib/client/demo-api.ts`), never in server DB; register always `role: "customer"`, nothing sets seller. Plan: reproduce in server mode, e2e register → admin list, admin create user + role change API (admin-only, rate limited) + demo version.

Local backend fix (2026-09-27): `npm run dev` → `scripts/dev.mjs` (sets NEXT_TELEMETRY_DISABLED=1 — Next telemetry write on C: crashed the dev server, every page 500 — and TEMP/TMP=D:/dev/tmp; refuses to start when port 3000 is already in use, because two servers on one PGlite database break it; prints the links). `start-backend.cmd` = double-click start from the project folder. Checked: second start refused; fresh start → /api/config, /admin, /admin/users, /admin/currencies, /admin/gift-cards, /admin/promo-codes all 200.

- 2026-09-27 S7 update: Pages build is static + localStorage demo, no DB possible there. Plan A: Vercel server build + Neon `DATABASE_URL`, migrations at build/one-off (not runtime race), Pages `deploy-pages.yml` → redirect. Plan B: `NEXT_PUBLIC_API_BASE`, CORS allow-list, Better Auth `trustedOrigins` + bearer plugin (third-party cookies blocked). User creates accounts + sets secrets in Vercel dashboard.

- 2026-09-27 S7 update 2 (user decision): one Neon `DATABASE_URL` in `.env.local` of main + `live/` (Git-ignored, identical) and on the real server; no dev branch, no test database, no new env names. PGlite only when `DATABASE_URL` is empty.

- 2026-09-27 future task order (user): S1 → S6 first, S7 after. Not started.

## Handoff v14 task 1 — flaky desktop tests (2026-09-27)

- Cause 1: `app/globals.css` loaded Geist with `@import url(fonts.googleapis.com…)`. The `load` event waited for Google (TLS ~8 s with 12 parallel browsers) → `page.goto` 27 s → 30 s test timeout. Fix: `next/font/google` `Geist({ subsets: ["latin"], variable: "--font-geist" })` in `app/layout.tsx` on `<html>`; body `font-family: var(--font-geist), Arial, sans-serif`. Font files are downloaded at build time and served from `/_next/static/media` (works with the Pages base path). No third-party request at page load.
- Cause 2: low free RAM (~2.5 GB with a long-running `next dev` at 3.4 GB). 4–12 Chromiums starting together paged to disk ("Create page" 26 s). `playwright.config.ts`: local `workers: 2`, `timeout: 60_000`; CI keeps defaults (30 s, auto workers).
- Result: 101 passed, 0 failed, 7 skipped (by design). `e2e/balance.spec.ts` gift card flow + `e2e/cart.spec.ts` gate sign-in: 10/10 at 1 worker.

- 2026-09-27 future task answers: listing = one filter-driven page (URL params genre / platform / q …); On sale = `old > price`; PayPal file `images (4).png`; AMEX + PromptPay text badges until files arrive; S7 Option A (Pages forwards to real server, no demo), seller = register + login only.

## Handoff v14 task 2 — Returns & Orders (2026-09-27)

- `lib/returns.ts` (shared by UI, demo, server): reasons per kind (keys: Key not revealed – no longer needed, Wrong item, Other; hardware: Damaged, Wrong item, Not as described, Changed my mind within 14 days of the order, Other), `eligibility()` (order paid/completed; keys = unrevealed units minus units held by returns; hardware = qty minus held), `checkNewReturn`, `checkStatusChange` (requested → approved | rejected, approved → refunded | rejected; reject needs a note; rejected/refunded final), `RETURN_HOLD`, `returnNumber()` (RT-XXXXXXXX).
- DB: `return_request` (migration `0010_return_request`): one order line + quantity per request (simpler than a separate items table; the form returns one line at a time). Indexes on user and order item.
- Server `lib/server/returns.ts`: create in a transaction with the order line `FOR UPDATE` (parallel requests cannot take the same units), list own / all (admin, with email), update status, `revealBlocked()`. `POST /api/account/keys` → 409 "This key is part of a return request…" when every unrevealed unit of the line is held.
- APIs: `/api/account/returns` GET POST (404 unknown line, 409 not eligible, 400 form errors), `/api/admin/returns` GET PATCH.
- Demo (`lib/client/demo-api.ts`): `returns` in the store, same rules, same reveal guard; `AccountApi.listReturns/requestReturn`, `AdminApi.returns/updateReturn`.
- UI: `app/account/orders/page.tsx` = "Returns & Orders" with tabs (role=tablist; `?tab=returns` kept in the URL), "Request return" per line in Details (inline form: quantity, reason, message; amber note for keys), not-eligible text + "Open a ticket" link (`/account/tickets?new=1&key=`) for shown keys; Returns table (Date, Return ID, Item + order, Qty, Reason, Status chip + admin note). `app/admin/returns/page.tsx`: search, status filter with counts, row Open → facts + status select + note + Save.
- Tests: `e2e/returns.spec.ts` (customer flow; admin flow incl. reject-needs-note, approve → refunded, rejected frees key) desktop + mobile; `e2e/dashboard.spec.ts` nav label. Server: `scripts/smoke-server.mjs returns` 34/34; server UI spec in `Claude outputs/shots-src/server/`.

## Handoff v14 task 3 — customer tickets (2026-09-27, spec C9, C10)

- `lib/tickets.ts`: categories (Order problem, Key invalid or used, Payment, Account, Other), statuses (open amber, answered green, closed grey), `checkNewTicket`, `checkBody` (subject ≤ 120, message ≤ 4000), `NEW_TICKET_LIMIT` 5 per hour, `ticketNo` (#1001).
- DB (migration `0011_tickets`): `ticket` (number = identity starting 1001, user, category, subject, status, order_id / key_id set null on delete, customer_unread, last_reply_at, last_reply_by) + `ticket_message` (ticket, author, from_support, body).
- `lib/server/tickets.ts`: list (joined order number, key name, key revealed time), unread count, thread (marks read), create (order / key must be the customer's; a key sets its order), customer reply (always → open), close. Shared `ticketBase`, `toTicket`, `ticketMessages` for the admin step.
- `/api/account/tickets`: GET list + unread, ?id= thread, ?unread=1 count; POST new (form check first, then `hitLimit("ticket:"+user)`); PATCH reply / close.
- Demo store: `tickets`, `ticketMessages`, `ticketTries`; same rules.
- UI `app/account/tickets/page.tsx`: views in the query string with pushState + popstate (list / `?new=1` / `?id=`); key detail "Report a problem" and Returns & Orders "Open a ticket" prefill category Key + the key + subject. `AccountShell` now fetches the unread count (`api.ticketUnread`) and refreshes on `TICKETS_EVENT`; the `unread` prop is gone.
- Tests: `e2e/tickets.spec.ts` (new → validation → thread → reply → close → reopen → list → back; Report a problem prefill with a revealed key; links from Returns; 6th ticket in an hour refused) desktop + mobile.

## Handoff v15 task 3 — simplified customer ticket form (2026-09-28)

- User decision: New ticket = 3 fields only. **Subject** select (Order issue, Return/refund, General support, Questions; id saved in `ticket.category` = `order_issue | return_refund | general_support | questions`, label saved in `ticket.subject`), **Order number** text, **Description** textarea (≤ 4000). Old Category select, order/key picker and free Subject input removed.
- Order number: `cleanOrderRef` (trim, upper-case, no spaces), `ORDER_REF_RE` letters/digits/dash, ≤ 40. Required for Order issue + Return/refund (`CATEGORIES[].needsOrder`), optional for the other two (default chosen; user asked, no answer yet). Not required when a key is attached (key gives the order).
- DB: migration `0012_ticket_order_ref` adds `ticket.order_ref` (typed number, always kept). Backfills `order_ref` from the linked order and maps old categories (order/key → order_issue, others → general_support). 0011 untouched.
- Server `createTicket`: key (hidden `keyId`, from "Report a problem") must be the customer's → its order number fills an empty order_ref and links `order_id`; a typed number matching one of the customer's orders links `order_id`; any other text is kept as typed, not linked, no warning. Demo store same rules. `Ticket.orderRef` added; `orderShown(t)` = orderRef ?? joined order number.
- `checkBody(body, word)`: "Write a description." for new tickets, "Write a message." for replies.
- UI: prefill `?new=1&key={id}` → Order issue + key's order number; `&subject={id}`; `&order={number}`. Returns tab "Open a ticket" → `&subject=return_refund`. List columns # · Subject · Order number · Status · Last reply · View. Thread H2 "#1001 Order issue", meta "Order CC-… · Key: … · Opened …".
- Tests: `e2e/tickets.spec.ts` rewritten (3 fields only, 4 options, errors, upper-case, prefills) → tickets 6/6, full run 111 passed, 0 failed, 7 skipped (by design, same as before). `scripts/smoke-server.mjs tickets` updated (subject errors, required order number, bad number, key prefill → order_ref, own lower-case number → linked, unknown number kept not linked) — NOT RUN yet: user rule 2026-09-28, no server until the user opens it.

## Fix — rate limits wiped by Better Auth (2026-09-28, found in the task 3 server test)
- Symptom: real server let a customer open new tickets 3 minutes after a 429 (5/hour limit). Probe: one `GET /api/auth/get-session` reset the counter.
- Cause: `lib/server/rate-limit.ts` kept our counters in Better Auth's `rate_limit` table. Better Auth (`dist/api/rate-limiter/index.mjs` `deleteExpiredRows`) deletes every row older than its longest window (~60 s) whenever it resets one of its own windows → gift card redeem (5/10 min user, 20 IP), promo validate and ticket limits were effectively ~1 minute on the server. Demo mode not affected.
- Fix: own table `app_rate_limit` (key PK, count, window_start ms), migration `0013_app_rate_limit`; same fixed-window SQL (checked in memory: fresh key, expired window reset, counting). Old custom rows in `rate_limit` are pruned by Better Auth itself.
- Tests: full server smoke 99/99 (before the new check); probe: 429 stays after get-session, admin/me, tickets GETs; new smoke check "limit still 429 after a Better Auth request". Server UI `Claude outputs/shots-src/server/tickets-server.spec.ts` desktop + mobile 2/2 (3 fields, prefills, saved order numbers in list + thread, server 429 message).

## Future task S1–S3: search + listing pages (2026-09-28)

- `lib/search.ts`: `normalize` (strip ™®©, fold accents, lower case, punctuation → space, Roman I–XX → 1–20), `searchProducts(products, q)` scores: exact joined title 1000, title starts with 800, every word starts a title word 600, initials ("gta") 450, joined words inside title ("lastof") 500, words in platform/region/type/genres 300, one typo per word (4+ letters, swap counts as one) 150. Sold out always last, then score, then popularity. Min 2 characters. `discountPercent`.
- `lib/catalog.ts`: `Product` gets `type`, `genres`, `soldOut`, `added`, `popularity`; `sampleGames` (21 placeholder keys: GTA IV ×3 regions, The Last of Us LATAM / US / Asia / Global / PSN US, FPS, horror, DLC, one sold out), `allGames`, `allProducts` (used by `productById`, `coverFor`). `maxQty` = 0 when sold out; `AddToCartButton` shows disabled "Sold out". Home page still shows only the 4 original keys.
- `app/components/search-box.tsx` (header, replaces the dead input): combobox + listbox ARIA, 150 ms debounce, 20 rows max, ↑ ↓ Enter Esc, outside click closes, ✕ clears, highlight resets on typing. `RegionTag` (GLOBAL green / other red) exported for S5. `SiteHeader` takes `searchInitial` (listing passes ?q=).
- `lib/listing.ts`: `GROUPS` (type, os, sale, platform, genre, region), `parseState` / `stateQuery` (URL ↔ state; repeated params per value), `applyFilters` (OR inside a group, AND between, price in the visitor currency via `convert`, country via `regionWorks`, sort, sold out last), `facets` (counts ignoring the group's own picks; 0-count options hidden unless picked), `listingTitle`.
- `app/components/listing-page.tsx` + routes `app/search`, `app/games`, `app/hardware` (static export safe: `useSearchParams` inside `Suspense`). Filter changes = `history.pushState("?…")` (Next keeps `useSearchParams` in sync, back button steps back). Desktop renders the sidebar only, mobile (≤900px, `useMedia`) the sheet only (no duplicate fields). Group open state in localStorage `corecart-filter-open` (try/catch).
- `app/components/product-card.tsx`: `ProductCard` moved out of `storefront.tsx` (home + listing share it).
- CSS: `globals.css` `.search-*`, `.region-tag`, `.lst-*`; old `.search span` rule narrowed to `.search > span` (it squashed every span in the dropdown).
- Tests `e2e/search.spec.ts` (desktop + mobile, 8 each): dropdown rows, matching cases, inner scroll + Show all → results page, keyboard, Enter + ✕, genre page + On sale + back button + chips + Clear all, sort + price + country + load more, long group search + hardware hides game-only groups.

- Future task S5 (2026-09-28): `ProductCard` → `CardRegion` (`RegionTag` from `search-box.tsx` + `regionWorks` with `useVisitorCountry`), `.card-off` discount from `discountPercent`. CSS `.card-region`, `.card-region-no`, `.card-off` in `globals.css`. Test "cards: region in capitals…" in `e2e/search.spec.ts`.
- Handoff v16 logged 2026-09-28 (agents.md): next S4, S6, then S7.

- 2026-09-28: admin has no wallet view yet (ledger only read by `/api/account/balance`). Proposed S8: admin read of `wallet_ledger` per user + adjust = new ledger row (type adjustment, admin id, reason), rate limited, admin-only, demo version. Real payments out of scope for now.

- 2026-09-28 S8 approved: admin read of `wallet_ledger` + gift balance per user, adjustment rows (type adjustment, admin id, reason, no negative balance), users list balance column, overview total owed; `AdminApi` + server + demo. Top-up later via payment webhook (idempotent).

- Future task S4 admin filter manager (2026-09-28): `lib/filters.ts` (shared): `FILTER_GROUPS` (Genres, Platforms, Regions, Product types, Operating systems, Countries, Sale, Price range; Countries + Sale: no add / delete), `catalogOptions` + `mergeCatalog` (catalog values become options, new ones appended), `productCount`, pure edits `addOption` (re-adds a deleted value) / `updateOption` (label, hidden, move ±1) / `deleteOption` (soft) / `updateGroup`, `checkLabel` (1–40 chars, unique per group), `filterView` (storefront: shown, label, position, group shown / startOpen). Option `value` = catalog value = URL id (renames keep links), `label` = admin name.
- Server: tables `filter_group`, `filter_option` (migration 0014, unique group + value, soft delete `deleted_at`, `updated_by` audit). `lib/server/filters.ts`: `getFilters` (stores missing catalog values on read), `editFilters` (transaction + `pg_advisory_xact_lock`, applies the same pure edit, writes changed rows only). Routes `/api/filters` (public GET) and `/api/admin/filters` (GET, POST {group,label}, PATCH {id,label?,hidden?,move?} | {group,shown?,startOpen?}, DELETE ?id=; admin only; writes 120/min per admin in `app_rate_limit` key `filters:`). Every write returns the whole config.
- Client: `AccountApi.filters()`, `AdminApi.filters/addFilterOption/updateFilterOption/deleteFilterOption/updateFilterGroup` (server + demo store `filters` in localStorage, same limit per page load). `app/components/filter-config.tsx` (`useFilterView`: one load per page, shared; `reloadFilterConfig` after admin saves). `lib/listing.ts` `Opts.view`: hidden groups ignored (URL filter too), hidden / deleted values leave products + facets, facets in admin order with labels, `listingTitle` uses labels. `listing-page.tsx`: chips + country select use labels, admin "Starts open" default (shopper's own toggle wins), hidden price / country groups. `RegionTag` shows the admin region label (cards + search rows).
- `app/admin/filters/page.tsx` + nav item "Filters". CSS `.flt-*` in `admin.css`. Tests `e2e/filters.spec.ts` (3 × desktop + mobile). Server smoke: `node scripts/smoke-server.mjs filters` (15 checks, undoes its changes) — not run yet (needs the user to open the server).

- Future task S6 payment logos (2026-09-28): `Claude outputs/tools/payment-logos.mjs` (Git-ignored, sharp from node_modules): flood-fills the background from the edges to transparent (white, UnionPay fake checkerboard, Discover black bars), trims, fits 176×72 (2x), WebP lossless or q72 (smaller wins) → `public/images/payments/{visa,mastercard,paypal,apple-pay,google-pay,alipay,unionpay,jcb,discover,klarna}.webp`. Originals in `site image/` untouched (not committed). `app/components/payment-logos.tsx`: `PAYMENT_BRANDS` (order Visa, Mastercard, PayPal, Apple Pay, Google Pay, Alipay, UnionPay, JCB, Discover, Klarna; no AMEX / PromptPay), `PaymentLogos` (lock + "Safe and secure payment methods" + tiles; cart, checkout, payment summaries) and `PaymentStrip` (lazy, in `SiteFooter` above `<footer>`). Old text badges `PaymentLogos` in `cart-ui.tsx` + `.pay-logos` CSS removed. CSS `.pay-methods`, `.pay-tiles`, `.pay-strip` in `cart.css`. Tests `e2e/payment-logos.spec.ts` (2 × desktop + mobile: every logo loaded + inside its tile, equal 2:1 tiles, 4 per row in cart, strip directly above the footer, no AMEX / PromptPay).

- Future task S8 admin wallet (2026-09-28): `lib/wallet.ts` (shared): `Adjustment` {userId, direction credit | debit, bucket wallet | gift, amountMinor, reason}, `checkAdjustment` (฿0.01–฿100,000, reason 1–200 chars, debit never below 0 for that bucket), `ADJUST_LIMIT` 30 / 10 min per admin, `toSatang`, `AdminWallet` (ledger rows + `by`). `wallet_ledger.created_by` (migration 0015, admin id audit). `lib/server/wallet.ts`: `adminWallet` (ledger + admin email), `adjustBalance` (transaction, customer user row `FOR UPDATE`, sum bucket, check, insert type `adjustment`, ref = reason), `totalOwed`. Route `/api/admin/balance` POST (admin only, `app_rate_limit` key `adjust:`). `lib/server/admin.ts`: users list `balanceMinor` subquery + sort `balance`, stats `owed`, user detail `wallet`. Demo store: same rules, ledger rows keep `byId` (stripped from the customer view). `typeLabel` adjustment = "Adjustment by CoreCart".
- UI: `/admin/user?id=` Balance panel (Wallet / Gift card balance / Total owed tiles, transactions table: date, type, reference, balance, amount ±, balance after, by), "Adjust balance" form (Credit / Debit radios, Balance select, Amount THB, Reason) → Review → amber confirm with the new balance → Confirm. Users list Balance column + "Balance (highest)" sort. Overview tile "Balance owed" (wallet + gift); overview tiles now 4 per row. CSS `.wal-*`. Tests `e2e/wallet.spec.ts` (desktop + mobile). Server smoke `node scripts/smoke-server.mjs wallet` (13 checks incl. parallel debits, restores the balance) — not run yet (needs the user to open the server).

- Handoff v15 task 4 / step 4b admin tickets (2026-09-28, from the stash draft, adapted to the task 3 fields): `/admin/tickets` (search #, customer, order number; Status + Subject filters; # · customer · subject · order number · status · last reply; open tickets bold) and `/admin/ticket?id=` (thread + reply; side panel: status select, customer, subject, order number + "Matches this customer's order" / "Not found in this customer's orders", key + revealed time, opened, last reply). `lib/server/tickets.ts` `listAllTickets`, `adminThread`, `adminReply` (answered + customer_unread + email), `adminSetStatus`. `/api/admin/tickets` GET / GET ?id= / PATCH {id, reply} | {id, status} (admin only, 120 writes/min per admin). `AdminApi.tickets/ticket/replyTicket/setTicketStatus` (server + demo). Admin nav "Tickets". CSS `.tk-admin`, `.tk-side`, `.tk-waiting` in `admin.css`.
- Known issue fixed: `lib/server/email.ts` `escapeHtml`; `actionEmail` escapes title, body (user name), label and link; ticket reply email escapes subject + body.
- Tests `e2e/tickets-admin.spec.ts` (2 × desktop + mobile: list, filters, search by order number, reply shown as text, Answered + unread badge (sidebar / "Tickets (1)" select), opening clears it, customer reply → Open, admin status → Closed). Server smoke tickets part +9 admin checks (not run yet: needs the server). The stash "4b admin tickets draft" is now merged into main; it stays in `git stash` until the user says to drop it.

- Future task S7 code part (2026-09-28): `lib/users.ts` (roles customer / seller / admin, `signupRole`, `checkNewUser`, `USER_ADMIN_LIMIT` 60 / 10 min per admin, `auditText`). Register page "Account type" Customer / Seller (sellers can only register + sign in). `auth.ts`: `role` input allowed on sign-up but the create hook keeps only customer | seller, the update hook refuses any role change (400); `sendResetPassword` uses "Your CoreCart account is ready / Set password" wording when the user has no login yet; `onPasswordReset` marks the email verified (the link proves it). Table `user_audit` (migration 0016). `lib/server/users.ts` `addUserByAdmin` (user row, not verified, no password → Better Auth reset email) and `setUserRole` (not yourself, never the last verified admin, row locked, audit row). Routes: `/api/admin/users` POST, `/api/admin/user` PATCH {id, role}. `AdminApi.addUser` / `setUserRole` (server + demo; demo shows the set-password link). UI: `/admin/users` "Add user" panel (Name, Email, Role; amber warning for Admin), `/admin/user` Role panel (select → Change role → amber confirm) + "Admin history". Tests `e2e/users.spec.ts` (2 × desktop + mobile). Server smoke `node scripts/smoke-server.mjs users` (13 checks; not run yet).
- Deploy prep: `scripts/migrate.mjs` (`npm run db:migrate`; Neon via DATABASE_URL, no-op without it) + `"vercel-build": "node scripts/migrate.mjs && npm run build"`; `lib/server/db/index.ts` skips runtime migrations on Vercel (fixes the "migrations may race on serverless" known issue). `scripts/pages-forward.mjs` + `deploy-pages.yml`: when the repository variable `REAL_SITE_URL` is set, GitHub Pages only forwards every path to the real site (https only); until then the demo builds and tests as before. `.env.example` notes the one shared Neon DATABASE_URL.

- Task 6 store links (2026-09-28): `lib/nav.ts` (`NAV_HREF` label → listing URL, `navHref`, `ON_SALE` = /search?sale=On+sale, drawer "Under ฿350" = `UNDER_THB_MINOR` converted to the visitor currency for label + ?max=). Header bar + drawer items without a sub-level are `Link`s now (drawer closes); hero action button → `Link.hero-action`; home quick categories, "Shop by category", promo banners, section links ("See all deals", "Shop components", "View all games" → /games, "Shop clearance"), feature row, brands (→ /search?q=brand), footer Shop + Returns (/account/orders) + Contact us (/account/tickets?new=1), currency menu "Help and support" (/account/tickets). No `href="#"` left in header, main or footer. CSS: `.hero-content .hero-action`, `.drawer li a` share the old button styles. Known issue fixed: drawer "Under $10" was not converted. Tests `e2e/nav.spec.ts` (2 × desktop + mobile; the desktop header-bar clicks are skipped inside the mobile run because that bar is hidden on phones — the drawer part runs on both).
