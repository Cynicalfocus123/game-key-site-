# CoreCart codebase guide (for code review)

A map of the whole frontend and backend for reviewers, people or AI. The running change log is `code.md`, the look is in `design.md`, dependency weight is in `weight.md`, and plans and handoffs are in `agents.md`.
Snapshot: 2026-09-29 (Handoff v18: T1 wallet top-up, real-server smoke, screenshot pass). Repo: https://github.com/Cynicalfocus123/game-key-site- (`main`).

## 1. What it is

CoreCart is a store for game keys (Steam, Xbox, PlayStation, Nintendo, EA, Ubisoft) and PC hardware. Thai base currency (THB) with 53 display currencies, customer accounts, a customer dashboard and an admin panel.

**Stack:** Next.js 15.5 App Router, React 19.1, TypeScript 5.9, plain CSS (no UI kit), Better Auth 1.7 (email + password, optional Google), Drizzle ORM 0.45, PostgreSQL (Neon) in production or PGlite (embedded Postgres file DB in `.data/pglite`) locally. Tests use Playwright 1.63. There are no other runtime dependencies.

**Not built yet:** real card payments with a live provider (the top-up flow is built and waits for one: section 11) and real orders / paying for orders, catalog database (products are a mock list in `lib/catalog.ts`), shipping, real emails (Resend is wired but has no key, so emails print to the terminal). Returns exist, but a refund is a manual admin note until payments.

## 2. Two build modes (important for review)

| Mode | How | Data | API layer |
|---|---|---|---|
| **Static demo** (GitHub Pages) | `GITHUB_ACTIONS=true` or `STATIC_DEMO=1` → `output: "export"`, `NEXT_PUBLIC_DEMO_MODE=true`; `route.api.ts` files are not built | Browser `localStorage` only (`corecart-demo-v1`) | `lib/client/demo-api.ts` |
| **Server** (`npm run dev`, later Vercel) | Normal Next server, `pageExtensions` includes `api.ts` | PostgreSQL / PGlite | `app/api/**/route.api.ts` + `lib/server/*`, client `lib/client/server-api.ts` |

- `lib/client/api.ts` picks `demoApi` or `serverApi` (and `demoAdminApi` or `serverAdminApi`) at build time. Both implement the same interfaces, `AccountApi` and `AdminApi`, in `lib/client/types.ts`. **Every feature has two implementations, and they must behave the same.**
- The static export cannot pre-render per-record pages, so dynamic pages use query strings: `/product?id=`, `/account/keys/view?id=`, `/admin/user?id=`, `/admin/promo-codes/edit?id=`.
- Shared business rules live in `lib/*.ts` (no server imports) and are used by the demo, the server and the UI alike, e.g. `lib/promo.ts`, `lib/gift-cards.ts`, `lib/catalog.ts`, `lib/currency/*`.

## 3. Folder map

```
app/                      Next App Router
  layout.tsx              Providers: Auth → Currency → Cart → Favorites; CheckoutGate; imports all CSS
  page.tsx, storefront.tsx  Homepage (hero, categories, product sections, drawer)
  product/                Product detail (?id=)
  search/, games/, hardware/   Listing pages (one component: search text + filters in the URL, left sidebar / mobile sheet)
  cart/, checkout/, checkout/payment/   Cart, review, payment UI (Pay disabled: no provider)
  login/, register/, forgot-password/, reset-password/, verify-email/   Auth pages
  favorites/              Guest favorites (this browser); signed-in users go to /account/favorites
  account/                Customer dashboard (AccountShell): overview, login-history, balance (+ balance/top-up, T1), orders (Returns & Orders tabs),
                          keys (+ view, print), favorites, tickets (?new=1, ?id=), payment-methods, settings
  admin/                  Admin panel (AdminShell): overview, users, user?id=, currencies, gift-cards,
                          promo-codes (+ edit), returns, tickets, ticket?id=, topups, topup?id= (T1), filters, login, register (redirects to login)
  help/                   Activation guides (/help/activate/[platform], static), gift card fraud page
  api/**/route.api.ts     Server API routes (see section 5)
  components/             Shared client components (section 4)
  *.css                   globals.css (tokens + storefront), account.css, cart.css, admin.css
lib/
  catalog.ts              Mock products (id, price in THB satang, kind, category, platform, region rules, type, genres, sold out), cart rules
  search.ts               Search matcher (Roman numerals, joined words, initials, 1 typo) used by the header + listing
  listing.ts              Listing filters: groups, URL state, facet counts, sort, titles
  filters.ts              Admin filter config (S4): groups, catalog merge, edits, storefront view (labels, hidden, order)
  promo.ts                Promo code rules, discount maths, validation, summary text
  tickets.ts              Ticket subjects (4), order number clean/check, statuses, limits, form checks, types
  returns.ts              Return rules: reasons per item kind, eligibility (keys only unrevealed), status moves, form checks
  gift-cards.ts           Gift card code format, hashing, statuses, ledger balances
  wallet.ts               Admin balance adjustments (S8): checks, limits, THB input
  topup.ts                Wallet top-up rules (T1): presets, limits in USD → paying currency, daily cap, statuses, 30-min expiry, types
  keys.ts                 GameKey type, masking, activation guides, library filter
  profile.ts              Avatars, countries, profile completion tasks, IP masking
  product-info.ts         Placeholder product copy
  currency/               currencies.ts (53 currencies, country map), money.ts (BigInt rates, convertMinor,
                          formatMoney), rules.ts (admin patch rules), fallback-rates.json
  client/                 types.ts (interfaces), api.ts (mode switch, money/date helpers),
                          server-api.ts (fetch), demo-api.ts (localStorage), demo-currency.ts
  server/                 auth.ts (Better Auth config + hooks), session.ts (requireUser/requireAdmin/json),
                          db/index.ts (pg or PGlite + auto migrations), db/schema.ts (all tables),
                          admin.ts, cart.ts, favorites.ts, keys.ts, gift-cards.ts, promo.ts, rate-limit.ts,
                          rates.ts (exchange rates), email.ts (Resend or terminal), stripe.ts (unused yet),
                          topups.ts (T1 create / webhook crediting / admin), payments/ (provider adapters: none, dev, stubs)
drizzle/                  SQL migrations 0000–0017 + meta snapshots (generated by drizzle-kit)
scripts/                  fetch-rates.mjs (build), create-admin.mjs (first admin), migrate.mjs (Neon migrations, vercel-build), pages-forward.mjs (github.io → real site),
                          e2e.mjs + serve-out.mjs (tests), smoke-server.mjs (server API smoke test)
e2e/                      Playwright specs (desktop + mobile projects), helpers.ts
live/                     Byte-identical mirror of the repo minus test-only files (project rule; Git-ignored)
```

## 4. Frontend architecture

- **Providers** (`app/layout.tsx`):
  - `AuthProvider` (`auth-provider.tsx`): session user, `refresh`.
  - `CurrencyProvider` (`currency-provider.tsx`): picks the display currency (account → browser → country → USD). Gives `price(thbMinor)`, `format`, `convert`, `charge` and the `<Price>` and `<ChargeNotice>` components.
  - `CartProvider` (`cart-provider.tsx`):
    - Guest cart lives in localStorage; a signed-in cart comes from the account API, and the guest cart merges into it on sign-in.
    - Live updates across tabs through `storage` events.
    - Owns the applied promo code: re-checks it on load, focus, other-tab changes, cart changes and at expiry, and exposes `totals` (discount on eligible lines only), `couponNote` and the checkout gate state.
  - `FavoritesProvider` (`favorites-provider.tsx`): works the same way as the cart.
- **Shells:**
  - `AccountShell` (`account-shell.tsx`): sign-in guard, sidebar on desktop, "Account section" select on mobile, breadcrumb.
  - `AdminShell` (`admin-shell.tsx`): guard through `/api/admin/me`; the admin nav is defined here.
- **Other components:**
  - `site-header.tsx`: header, drawer with a focus trap, currency menu.
  - `checkout-gate.tsx`: sign-in / register popup before checkout.
  - `cart-ui.tsx`: Add to cart, header cart popup or mobile sheet, `RegionLine`, `CouponLine`, `CouponNotes`.
  - `payment-logos.tsx`: payment logo tiles (cart / checkout / payment summary, strip above the footer).
  - `filter-config.tsx`: storefront hook for the admin filter config (labels, hidden values, order).
  - `currency-menu.tsx`, `icons.tsx`, `auth-ui.tsx` (forms, `Notice`, `safeNext`, `DemoBanner`).
- **Money:** always integer minor units. Catalog prices are THB satang, and conversion uses BigInt-scaled rates (`lib/currency/money.ts`). Orders store the charged currency, amount and rate.
- **Styling:** plain CSS with tokens on `:root` in `globals.css`. Square corners, `#2563EB` primary. Mobile breakpoints are mostly 767px and 640px.
- **Product images (Eneba sizes, 2026-09-29):** one 4:5 image per product (all types; admin upload later = 800×1000). Listing cards (`.product-image`, `.fav-cover`) show it 5:7 with `object-fit: cover` centered; the product page (`.pdp-media`) shows the full 4:5 (max 420 / 320 / 240 px wide); small covers (cart, popup, checkout, payment, search, orders/keys) are 4:5. Test `e2e/image-sizes.spec.ts` checks 11 widths (phones 360–430, tablets 768–1180, desktop 1280–1920).

## 5. Backend: API routes (server mode only)

Auth guard helpers are in `lib/server/session.ts`: `requireUser` (verified session → user row) and `requireAdmin` (401 when signed out, 403 when not an admin). Admin means `role === "admin"` and a verified email, and only `scripts/create-admin.mjs` can make one.

| Route | Methods | Guard | What |
|---|---|---|---|
| `/api/auth/[...all]` | all | – | Better Auth (sign-up/in/out, verify email, reset password, update-user, Google) |
| `/api/config` | GET | – | Which features are configured (google, stripe, email, sample orders, payments {provider, available, simulate}) |
| `/api/currencies` | GET | – | Public currency list + rates; schedules a rate refresh |
| `/api/cart` | GET PUT POST DELETE | user | Account cart (caps: 5 per key, hardware ≤ stock) |
| `/api/favorites` | GET PUT POST DELETE | user | Favorites (max 200) |
| `/api/account/orders` | GET POST | user | Orders; POST = dev-only sample order |
| `/api/account/tickets` | GET, GET ?id=, GET ?unread=1, POST, PATCH | user | Own tickets; thread (marks support replies read); new ticket {category, orderRef, message, keyId?} (5 / hour, form errors do not count); PATCH {id, reply} or {id, close} |
| `/api/account/returns` | GET POST | user | Own returns; request a return {orderItemId, quantity, reason, message} (line locked FOR UPDATE; 409 when not eligible) |
| `/api/account/keys` | GET, GET ?id=, POST {id} | user | Keys (code hidden until reveal); reveal stamps once and logs every reveal (IP, UA) |
| `/api/account/logins` | GET | user | Own sign-ins, 90 days, masked IP |
| `/api/account/balance` | GET, POST {code} | user | Wallet + gift balance + ledger; redeem gift card (5 / 10 min per user, 20 per IP) |
| `/api/account/payment-methods` | GET POST DELETE | user | Stripe saved cards (not configured: no key) |
| `/api/account/topups` | GET, GET ?id=, POST | user | Own top-ups + daily cap left; create {amountMinor, currency, idempotencyKey} → pending + payment start (10 / 10 min per user, 30 per IP; verified email; 503 while provider none). Never credits |
| `/api/account/topups/simulate` | POST {id, outcome} | user | Dev adapter only: signed fake provider event through the webhook handler (paid / failed / resend) |
| `/api/payments/webhook` | POST | provider signature | The only place money is credited: verify (adapter) → event id once → lock top-up → one ledger row. 300 / min per IP, 64 KB |
| `/api/promo/validate` | POST {code, items?} | – (public) | Promo rules + server discount; 10 unknown codes / min per IP → 429 |
| `/api/admin/me` | GET | user | `{ admin }` |
| `/api/admin/stats`, `/users`, `/user` | GET | admin | Dashboard numbers (+ balance owed), user list (+ balance), user detail (+ wallet, audit) |
| `/api/admin/users` | POST | admin | Add user {name, email, role} → set-password email (60 user writes / 10 min per admin) |
| `/api/admin/user` | PATCH | admin | Role change {id, role} + audit row |
| `/api/admin/currencies` (+ `/refresh`) | GET PATCH POST | admin | Enable / chargeable / override / rounding; refresh rates |
| `/api/admin/gift-cards` | GET POST PATCH | admin | List (last 4 only), create (full codes returned once), disable / enable |
| `/api/admin/promo-codes` | GET POST PATCH DELETE | admin | List / get, create, edit or enable, delete (hard while unused, soft after) |
| `/api/filters` | GET | – (public) | Filter config for the storefront (hidden / deleted flagged) |
| `/api/admin/filters` | GET POST PATCH DELETE | admin | Filter manager: add value, rename / hide / move, group show / starts open, soft delete; writes 120/min per admin |
| `/api/admin/balance` | POST | admin | Wallet adjustment {userId, direction, bucket, amountMinor, reason} → new ledger row with admin id (30 / 10 min per admin); debit never below 0 |
| `/api/admin/tickets` | GET, GET ?id=, PATCH | admin | All tickets / one thread; PATCH {id, reply} (answered + unread + email) or {id, status}; 120 writes/min per admin |
| `/api/admin/topups` | GET, GET ?id=, PATCH | admin | Top-ups list (search, status, provider, dates, 50 / page) / detail with event log; PATCH {id, action fail / cancel, reason} pending only, audited. No manual credit |
| `/api/admin/returns` | GET PATCH | admin | All returns with customer email; status change {id, status, note} (reject needs a note) |

## 6. Database (`lib/server/db/schema.ts`, migrations in `drizzle/`)

Migrations run automatically on the first request (`dbReady()`).

| Table | Purpose |
|---|---|
| `user`, `session`, `account`, `verification` | Better Auth core, plus user fields: role, termsAcceptedAt, marketingOptIn, currency, avatar, country, marketingChoiceAt, stripeCustomerId |
| `rate_limit` | Better Auth rate limits only (Better Auth prunes rows older than ~60 s) |
| `app_rate_limit` | Our fixed-window limits (`lib/server/rate-limit.ts`, keys `giftcard:` / `promo:` / `ticket:`), migration 0013 |
| `login_event` | One row per sign-in (method, IP, UA) |
| `orders`, `order_items` | Orders (only dev sample orders today); charged currency + THB total + rate |
| `order_key`, `key_reveal` | One key per unit; reveal audit |
| `cart_item`, `favorite` | Signed-in cart and favorites |
| `currency`, `rate_status` | Currency settings and exchange-rate fetch status |
| `gift_card` | SHA-256 code hash + last 4 (never the full code), amount (THB satang), expiry, disabled, redeemer |
| `wallet_ledger` | Signed money movements per user and bucket (wallet / gift); balance = sum; `created_by` = admin for adjustments; `top_up_id` unique (one credit per top-up) |
| `top_up` | Wallet top-ups (T1): TU- number, charged amount + currency, THB credit + rate, status, provider + ref, idempotency key (unique per user), deadline, paid / credited / closed times, closed_by admin |
| `payment_event` | Raw provider webhook log: unique (provider, event_id), payload, result (credited / failed / ignored / error) |
| `promo_code` | Promo rules; `uses` stays 0 until real checkout |
| `ticket`, `ticket_message` | Support tickets (#1001 identity number, category = Subject id, order_ref = typed order number, status open / answered / closed, customer_unread) and their messages (from_support) |
| `user_audit` | Admin actions on a user (created by admin, role changes) with the admin id |
| `filter_group`, `filter_option` | Admin filter config (S4): group shown / starts open; values (catalog value + admin label, hidden, position, soft delete) |
| `return_request` | One order line + quantity, reason, message, status requested / approved / rejected / refunded, admin note |

## 7. Security model (please check)

- **Sessions:** Better Auth cookie sessions. Email must be verified before sign-in. Sign-in and sign-up are rate limited (5/min in the DB).
- **Admin access:** sign-up creates a customer or a seller only (the create hook drops anything else; update-user cannot change `role`). Admins come from `scripts/create-admin.mjs` or from another admin (`/admin/users` Add user or role change: audited in `user_audit`, not on yourself, never the last admin). Admin accounts cannot link Google (see the `databaseHooks` in `auth.ts`).
- **Prices are never trusted from the client:** the cart API reads prices from the catalog, and the promo validate endpoint recalculates the discount on the server. Checkout (not built) must call `promoDiscount` on the server again.
- **Secret codes:**
  - Gift card codes are hashed; a redeem claims the card atomically (`UPDATE … WHERE redeemed_at IS NULL … RETURNING` inside a transaction).
  - Key codes are sent only after reveal.
- **Rate limits:** gift card redeem (per user + per IP) and promo validate (unknown codes per IP) and new tickets (5/hour per user) use the `app_rate_limit` table (never `rate_limit`: Better Auth deletes its old rows, which reset our counters until 2026-09-28). The IP comes from `x-forwarded-for`, which is spoofable unless the host overwrites it (Vercel does).
- **Redirects:** `safeNext` in `auth-ui.tsx` accepts same-site paths only.
- **Top-up money:** only a verified webhook credits (never the browser return page). Three guards against double credit: unique event id, `FOR UPDATE` lock + status check, unique `wallet_ledger.top_up_id`. The charged amount + currency in the event must match the top-up. `PAYMENT_PROVIDER=dev` is refused in production.
- **Card data:** CoreCart never takes card numbers. The payment page fields are disabled placeholders; real payments will use the provider's hosted fields.

## 8. How to run and test

```
npm install                      # node_modules on D:, npm cache D:\dev\npm-cache
npm run dev                      # server mode, http://localhost:3000, PGlite in .data/pglite
npm run admin:create -- --email you@example.com   # stop dev first (PGlite = one process)
node scripts/smoke-server.mjs    # server API smoke test (dev server running; see header of the file)
npm run test:e2e                 # static build + Playwright desktop + mobile (add --no-build to reuse out/)
```

Env keys are listed in `.env.example`.

## 9. Test coverage

- **Playwright** (`e2e/`, demo mode, desktop + mobile, about 118 tests): home, auth, admin, cart + gate, currency, dashboard, header fixes, keys, product + favorites, payment page, balance + gift cards, promo codes, returns, tickets.
- **Server mode:**
  - `scripts/smoke-server.mjs`: about 80 API checks covering promo, gift cards, balance, cart, favorites, keys, logins, profile and returns, with saved values checked. `node scripts/smoke-server.mjs returns` runs only the returns part (34 checks).
  - A customer flow run: sign-up → verify link → redeem → limits → 403 on admin APIs → parallel double redeem.
  - A Playwright UI run against `npm run dev` (promo + gift card).
  - The server-mode runs are not in CI yet.
- **Last full e2e run** (2026-09-27): 105 passed, 0 failed, 7 skipped by design (each skip carries a reason in the spec). Local runs use 2 workers and a 60 s timeout (`playwright.config.ts`): more parallel browsers ran out of RAM on the dev PC.

## 10. Known issues and review hot spots

- Migrations: on Vercel they run once in `vercel-build` (`scripts/migrate.mjs`); runtime migration only runs locally / without VERCEL.
- **Stripe:** `lib/server/stripe.ts` is used only for saved cards (no key set); provider errors return 502.
- **Email and consent:** Google sign-up records `termsAcceptedAt`; the Google button shows the consent line. Email HTML is escaped.
- **Money display:** fixed 2026-09-28 (admin order totals per currency, drawer price converted).
- **Promo limits:** once-per-customer and max-uses are stored and shown but not enforced (needs real orders / `promo_redemption`).
- **Order items:** they have no product id, so covers and links are matched by name (`coverFor`).
- **Returns:** refunds are manual (admin writes a note); a key return blocks reveal of that unit, but refunding does not disable the key at a supplier yet.
- **Data retention:** the `key_reveal` table has no retention policy.
- **Placeholders:** product copy, images and system requirements are placeholders. Store links go to listing pages (`lib/nav.ts`); items without products yet land on the closest listing.
- **Assets and CSS:** `mxn.svg` is 85 KB. (Geist is self-hosted through `next/font` since 2026-09-27.)
- **Small UI bugs:**
  - "Keep me signed in" on register has no effect until the first sign-in.
- **Fixed on 2026-09-27:** server-mode profile saves never saved. The update hook rejected unsent (`undefined`) fields and Better Auth still answered 200. Settings saves made in server mode before this date were lost.

## 11. Wallet top-up flow and payment provider plug-in (T1, 2026-09-29)

**Flow.**
1. /account/balance/top-up: the customer picks a preset or a custom amount. The paying currency is the visitor currency when it is chargeable (Admin → Currencies), else USD. Limits come from `lib/topup.ts` (USD cents converted to the paying currency).
2. Pay → `POST /api/account/topups` → `lib/server/topups.ts createTopUp`: user row lock, idempotency key replay, daily cap (paid + credited in 24 h), older pending → cancelled, insert `top_up` (pending, credit_minor in THB at today's rate, deadline +30 min), then `provider.createPayment` → redirect URL (hosted page) / client data / simulate.
3. The provider charges the card and calls `POST /api/payments/webhook`. `handleWebhook`: adapter `verifyWebhook` (signature over the raw body) → insert `payment_event` (a repeated event id → 200 "duplicate") → transaction: lock the top-up → `payment.succeeded` = status credited + one `wallet_ledger` row (type top_up, ref TU-…); `payment.failed` = failed + reason. Errors → 500 and the event row keeps "error: …" so the provider's retry is processed.
4. The result page (?id=) polls `GET /api/account/topups?id=` every 3 s and shows pending / credited / failed / expired / cancelled. Pending rows expire lazily on every read.
5. Admin: /admin/topups (list + filters), /admin/topup?id= (event log, Mark failed / Cancel pending with a reason → `user_audit`). Corrections to money = Adjust balance (S8), never on the top-up.

**Adapters (`lib/server/payments/`, env `PAYMENT_PROVIDER`).** `none` (default): Pay disabled "Card payments coming soon", no rows, webhooks 400. `dev` (never production): signed simulated events (header `x-dev-signature` = HMAC-SHA256 of the raw body with `PAYMENT_DEV_SECRET`, default "corecart-dev-webhook-secret"); the result page shows Simulate paid / failed / send again. `stripe` / `omise` / `2c2p`: stubs (Pay stays disabled).

**Plug in a real provider (no redesign):** fill its adapter in `stub.ts` (or its own file) — keys in env; `createPayment` creates the provider payment with metadata {topUpId, number} and returns `{ kind: "redirect", url }` or `{ kind: "client", data }` + providerRef; `verifyWebhook` checks the provider signature and maps its event to `PaymentEvent` (event id, topUpId or providerRef, amount + currency, type); `supports(currency)`; `available: true`. Register `{site}/api/payments/webhook` at the provider, set `PAYMENT_PROVIDER`, restart. Later `refund()` + a "refund.succeeded" event writes a `top_up_refund` debit (only unspent money can go back to a card). Paying orders with the wallet later = a `purchase` ledger line (debit) at checkout.

**Tests.** `e2e/topup.spec.ts` (demo, desktop + mobile), `node scripts/smoke-server.mjs topups` (localhost; full checks with PAYMENT_PROVIDER=dev).


## 12. Product catalog, admin products and key inventory (task B, 2026-09-29)

**Data.** `lib/catalog.ts` keeps the seed products (31) and a live list (published only) set by `setCatalog()`; every lookup (`productById`, `allProducts()`, `cleanCart`, promo eligibility, filters) reads the live list. Server: `lib/server/catalog.ts` copies the seed into table `product` once (only when empty), keeps the published list in memory (reload every 30 s and right after an admin write), `ensureCatalog()` runs before cart / favorites / promo validate / filters. Browser: `lib/client/catalog.ts` (`catalogReady()`: demo = localStorage key `corecart-demo-catalog-v1`, server = `/api/catalog`), React hook `useCatalog()` (`app/components/catalog.tsx`, seed on the hydration render then live). Cart and favorites providers wait for `catalogReady()` before cleaning the guest lists and re-clean when the catalog changes.
**Tables (migration 0018).** `product` (id, name, kind, status published | draft | deleted, price, `data` jsonb = the full Product, updated_by); delete = status "deleted" (id stays reserved). `product_image` (cropped 800×1000 WebP/JPEG as base64, served by `/api/images/{id}`, cached 1 year). `product_key` (code AES-256-GCM with env `KEY_ENCRYPTION_KEY`, HMAC hash unique per product, last4, status available | reserved | sold, batch).
**Rules.** `lib/products.ts` `parseProduct` (same check in the editor, demo and API), `imageSize` / `imageOk` (reads WebP / JPEG headers; exact 800×1000, ≤ 1.5 MB), picker helpers `familyOf` / `pickSibling`. `lib/key-inventory.ts` (`parseKeyText`: one per line or CSV first column, 1000 per upload).
**API.** Public: GET `/api/catalog`, GET `/api/images/{id}`. Admin (120 writes / min, images 30 / 10 min, keys 30 uploads / 10 min): `/api/admin/products` (GET list or ?id=, POST create, PATCH update, DELETE ?id=), POST `/api/admin/products/image` { dataUrl }, `/api/admin/products/keys` (GET counts or ?productId=, POST { productId, text, batch }, DELETE ?productId=&keyId=; codes never leave the server).
**UI.** /admin/products (search, kind, status, Keys column), /admin/products/edit (?id=) with `ImageCropper` (`app/components/image-cropper.tsx`: 4:5 frame, drag / arrow keys / zoom, dashed 5:7 listing area, canvas → 800×1000 WebP, JPEG fallback), /admin/products/keys?id=. Product page: Platform / Edition / Region picker for products with the same "Game group" (`family`).
**Tests.** `e2e/products.spec.ts` (4 × desktop + mobile), smoke part `products` (real server, not run yet).

**Genres (task C, 2026-09-29).** `GENRES` in `lib/catalog.ts` = one flat list of 25 in the user's order ("Open world" back after Adventure, 2026-09-29) (Platformer = game genre; "Platforms" = Steam / Xbox …). `GENRE_RENAMES` maps old names (Single player, First person, Third person, Co-op, FPS → FPS/TPS); `upgradeProduct` / `upgradeGenres` apply it to stored products, old links (`?genre=FPS`) and, once, to saved filter settings (`mergeCatalog`: old options soft-deleted, genres re-ordered). Filter manager always lists all 25 (0-product ones too). Drawer: Digital Games → Genres submenu (admin order, labels, hidden left out) → `/games?genre=`. Test `e2e/genres.spec.ts`.
