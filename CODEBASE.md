# CoreCart codebase guide (for code review)

A map of the whole frontend and backend for reviewers, people or AI. The running change log is `code.md`, the look is in `design.md`, dependency weight is in `weight.md`, and plans and handoffs are in `agents.md`.
Snapshot: 2026-09-29 (Handoff v21: T2 master admin permissions, T3 seller application + close account, email task: emails + order pages). Repo: https://github.com/Cynicalfocus123/game-key-site- (`main`).

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
  purchase-popup.ts       Purchase popup rules: feed row type, settings parse, audit text, 24 h / buyer-only pick, pages without the popup, time text
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
drizzle/                  SQL migrations 0000–0025 + meta snapshots (generated by drizzle-kit)
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

Auth guard helpers are in `lib/server/session.ts`: `requireUser` (verified session → user row) and `requireAdmin(req, section | "master")` (401 when signed out, 403 when not an admin or without that section, T2). Admin means role `admin` or `master_admin` and a verified email; the first one comes from `scripts/create-admin.mjs`, later ones only from a master admin (section 14).

| Route | Methods | Guard | What |
|---|---|---|---|
| `/api/auth/[...all]` | all | – | Better Auth (sign-up/in/out, verify email, reset password, update-user, Google) |
| `/api/config` | GET | – | Which features are configured (google, stripe, email, sample orders, payments {provider, available, simulate}) |
| `/api/currencies` | GET | – | Public currency list + rates; schedules a rate refresh |
| `/api/cart` | GET PUT POST DELETE | user | Account cart (caps: 5 per key, hardware ≤ stock) |
| `/api/favorites` | GET PUT POST DELETE | user | Favorites (max 200) |
| `/api/account/orders` | GET, GET ?id=, PATCH, POST | user | Orders; ?id= (id or CC- number) = one order + own seller ratings; PATCH {id, taxInfo \| null} optional tax details; POST = dev-only sample order (+ "Order confirmed" email) |
| `/api/account/ratings` | POST | user | Rate the seller {orderId, seller, stars 1–5, comment ≤ 500}; one per order + seller, again = edit (30 / 10 min) |
| `/api/verify-code` | POST | – (public) | {email, code}: 6-digit email code → Better Auth verify + session cookie (5 wrong = dead code; 20 / 10 min per IP, 10 per email) |
| `/api/admin/emails` | GET POST | admin (any) | GET dev outbox (last 30 emails, only without RESEND_API_KEY, never production); POST {id} sample email to the signed-in admin (10 / 10 min) |
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
| `/api/admin/me` | GET | user | `{ admin, master, perms }` (T2) |
| `/api/sell` | GET POST | user (verified) | T3 my latest seller application; submit all 4 steps (one pending / approved at a time, merchant name free, own unused files) |
| `/api/sell/files` | POST multipart | user (verified) | T3 one file {kind, file}: type from content, 5 MB, 40 / 10 min; stored encrypted |
| `/api/account/close` | POST | user | T3 close own account {word: CLOSE, password, reason?} (data kept, sessions ended) |
| `/api/admin/sellers` | GET PATCH | sellers | T3 list per tab (?tab, ?q) / detail ?id (everything incl. ID number, matches, history); PATCH {id, action approve / reject / blacklist / unblacklist, reason} |
| `/api/admin/seller-files` | GET | sellers | T3 one file (?id, &download=1), decrypted, no-store + nosniff; every call = one history row |
| `/api/admin/admins` | GET PATCH | master | Admins + sections + latest 50 admin changes; PATCH {id, perms} (audited before → after) |
| `/api/admin/stats`, `/users`, `/user` | GET | admin | Dashboard numbers (+ balance owed), user list (+ balance), user detail (+ wallet, audit) |
| `/api/admin/users` | POST | admin | Add user {name, email, role} → set-password email (60 user writes / 10 min per admin) |
| `/api/admin/user` | PATCH | users | Role change {id, role} + audit row; T3 {id, close: reason} / {id, reopen: note} |
| `/api/admin/currencies` (+ `/refresh`) | GET PATCH POST | admin | Enable / chargeable / override / rounding; refresh rates |
| `/api/admin/gift-cards` | GET POST PATCH | admin | List (last 4 only), create (full codes returned once), disable / enable |
| `/api/admin/promo-codes` | GET POST PATCH DELETE | admin | List / get, create, edit or enable, delete (hard while unused, soft after) |
| `/api/filters` | GET | – (public) | Filter config for the storefront (hidden / deleted flagged) |
| `/api/recent-purchases` | GET | – (public) | Purchase popup feed { enabled, purchases: [{ id (order line), productId, at, country }] }; paid / completed orders of active customer / seller accounts, last 24 h, published + not hidden products, newest 10; cached 10 s; dev sample orders only where sample orders are allowed |
| `/api/admin/purchase-popup` | GET PUT | products | { settings: { enabled, hidden[] }, history (last 20) }; PUT saves + one `site_setting_event` row per real change (30 / min per admin) |
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
| `user_audit` | Admin actions on a user (created by admin, role changes, section changes "perms" before → after, top-up closes) with the admin id (null = `npm run admin:create`) |
| `filter_group`, `filter_option` | Admin filter config (S4): group shown / starts open; values (catalog value + admin label, hidden, position, soft delete) |
| `seller_application`, `seller_file`, `seller_event` | T3 seller applications (answers jsonb, ID number AES-GCM + HMAC hash, merchant key, status, decision, blacklist), uploaded files (encrypted on disk, row = kind / type / size / sha256 / random stored name), history (submitted, views, downloads, decisions) |
| `return_request` | One order line + quantity, reason, message, status requested / approved / rejected / refunded, admin note |
| `seller_rating` | Email task: stars 1–5 + comment per customer, order and seller (unique; edit = upsert) |
| `email_code` | Email task: 6-digit verify code (HMAC hash, 10 min, attempts) → the Better Auth verification token it stands for |
| `site_setting`, `site_setting_event` | Purchase popup (migration 0025): one JSON row per setting key (`purchase_popup` = { enabled, hidden }) + admin audit (who, when, what). Also index `orders_paid_idx` for the feed |
| `known_device` | Email task: SHA-256 of the `cc_device` cookie per user (+ label, IP, location, first / last seen); unknown device → "New sign-in" email |

## 7. Security model (please check)

- **Sessions:** Better Auth cookie sessions. Email must be verified before sign-in. Sign-in and sign-up are rate limited (5/min in the DB).
- **Admin access:** sign-up creates a customer or a seller only (the create hook drops anything else; update-user cannot change `role`). Admins come from `scripts/create-admin.mjs` or from a master admin (T2: `/admin/users` Add user, role change, `/admin/admins`; audited in `user_audit`, not on yourself, never the last admin / last master). Every admin API call checks the admin's section on the server (section 14). Admin accounts cannot link Google (see the `databaseHooks` in `auth.ts`).
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

## 13. Store menu & categories (task D, 2026-09-29)

**Rules.** `lib/menu.ts`: `MenuItem` (id, parent, label, href, kind link | genres | under, position, hidden, isNew, inBar, inFooter, deleted), `DEFAULT_MENU` (stable ids `m-…`: Shop All, All offers, On sale, Random Steam Keys, Trending now NEW, Platforms › Steam / Xbox / PlayStation / Nintendo / PC, Genres (automatic), Digital Games › …, PC Parts › …, hardware items, Deals, Clearance), `MENU_TARGETS` (admin link presets), `menuTree`, `parseMenuInput` / `parseMenuPatch` (links must be store paths "/…", no "//", no outside URLs), `addMenuItem` / `updateMenuItem` (move ±1, change level) / `deleteMenuItem` (soft, sub-items too). One level of sub-items; an item with sub-items stays top level; Genres (automatic) only top level. Sub-items never sit in the bar / footer.
**Storage.** Table `menu_item` (migration 0019); `lib/server/menu.ts` copies DEFAULT_MENU in while the table is empty, edits in a transaction with an advisory lock, writes changed rows only. Demo: `corecart-demo-v1`.menu (missing = DEFAULT_MENU).
**API.** Public GET `/api/menu` → { items }. Admin `/api/admin/menu` GET / POST / PATCH { id, …, move?, hidden? } / DELETE ?id= (120 writes / min / admin, key `menu:{id}`), every write returns the whole menu.
**UI.** `app/components/menu-config.tsx` (`useMenu`, `reloadMenu`), header bar (`site-header.tsx`: inBar items, CSS dropdown on hover / focus for sub-items, Genres = 3-column list; tablet shows the first 5), drawer (top level → one submenu, "← label" back), footer "Shop" column (`footer-shop.tsx`, inFooter items). Admin `/admin/categories` ("Menu & categories"). `lib/nav.ts` stays for the home page tiles only.
**Listing + products.** `?trending=1` / `?new=1` (`ListState.trending / isNew`, chips "Trending now" / "New", titles "Trending now" / "New games"); type "Random key" + platform = title "Random Steam keys". Product type "Random key" (normal product, 4 seed items `randomKeys`; `SEED_ADDED` v2 adds them to an existing server catalog by id / demo catalog once via `seedV`). NEW badge (`.badge-new`) on cards + product page for products flagged New.
**Tests.** `e2e/categories.spec.ts` (4 × desktop + mobile); nav / genres specs follow the new drawer. Smoke part `menu` (real server, not run yet).

## 14. Master admin + per-admin permissions (T2, 2026-09-29)

**Roles.** `master_admin` = every section always, and the only role that can add, promote, demote or remove admins (incl. other masters) and set sections. `admin` = only the sections in `user.admin_perms` (jsonb list; null = all, only for old demo data). Rules in `lib/admin-perms.ts` (shared by server, demo and UI).
**Sections (11).** users (Users + user detail), wallet (Adjust balance; Overview "Balance owed"), topups, products (products, image upload, key inventory), menu, filters, currencies, giftcards, promo, returns, tickets. Overview is open to every admin (newest users only with users). T3 will add "sellers".
**Server.** `requireAdmin(req, perm)` on every `/api/admin/*` route reads role + sections from the user row on each call (a change works at once). Master-only: `/api/admin/admins`, admin roles in POST `/api/admin/users` and PATCH `/api/admin/user` (`roleChangeError`). `lib/server/users.ts`: `addUserByAdmin(actor, …perms)`, `setUserRole(actor, …)` (last master / last admin guard, new admin = no sections, leaving admin clears them), `setAdminPerms` (not yourself, not a master, only role admin; audit "perms" row only when something changed), `adminList`.
**Migration 0020.** Adds `admin_perms`; admins that exist then get all 11 sections (user default: keep everything until the master changes it). First master: `npm run admin:create -- --email you@… --master` (server stopped); rerunning without --master keeps a master a master; `--demote` → customer.
**Audit.** `user_audit`: created, role ("admin → customer"), perms ("Promo codes, Tickets → Users, Tickets"), who (admin id; null = server command), when. Shown on the user page ("Admin history") and on /admin/admins ("Recent admin changes", latest 50).
**UI.** AdminShell asks `/api/admin/me`, hides sections (sidebar + phone select), shows "No access" for a page without its section (`pagePerm`), and gives pages `useAdminMe()`. /admin/admins (master): one card per admin with `PermChecks` (checkbox per section, Select all / Clear all), Save sections, Remove admin (confirm), Add admin (`AddUser adminOnly`).
**Demo.** Built-in demo admin = master_admin (older browsers upgraded once). `adminStore(perm)` gives the same 403 messages as the server.
**Tests.** `e2e/admin-perms.spec.ts` (3 × desktop + mobile). Smoke part `admins` (real server; the smoke admin must be master; the plain-admin 403 checks need an optional helper login, listed as SKIP without it).

## 15. Seller application (KYC redesign 2026-10-01) + close account (T3)

**Flow.** Everyone signs up as a customer (register has no account type). "Sell on CoreCart" (footer, account menu) → /sell (intro, draft card or status card) → /sell/apply (signed in + verified): choose **Individual** (Basic details · Proofs · Product description) or **Business** (Basic details · Documentation · Representative · Trade references · Offer details) → Final step → Approving. Left progress list (phone: bar on top + "All steps"). Each Continue saves the step to a **server draft** (`PUT /api/sell {input, step}`; resume on any device); Continue stays grey until the step passes `checkSeller(input, step)` (pressing it shows the errors); Business has Save for later (`step` null). Send request needs the confirm + terms ticks → SA-number + email (business: also to the representative). /sell/details = read-only copy (answers, file names, last 4 of the document number). Rejected → "Apply again" (`?again=1`) = new draft from the old answers (`reapplyInput`: no files, no document number). Wireframe screens 1–12: `Claude outputs/wireframes/kyc-redesign-wireframe.png`.
**Draft card (screen 12).** Account overview + /sell: "In progress (N%)", bar, "N out of N steps completed · next: …", Complete application, Delete → confirm (Delete application / Keep it). Delete (`DELETE /api/sell`) clears the answers and hides the draft; uploaded files stay (KYC).
**Rules (`lib/sellers.ts`).** One pending or approved application per person. Merchant name unique among pending / approved (key = lower-case letters + digits). Files: JPEG / PNG / GIF / PDF, 10 MB, type from magic bytes; selfie JPEG / PNG / PDF (no GIF), required. File kinds: id_front / id_back / selfie / invoice (individual), certificate + doc_gov_id, doc_registration, doc_address, doc_tax (optional), doc_supply, doc_ubo, doc_articles + supplier_proof (business; supplier file ids live on each supplier); "key" = older form only. Business representative + CEO 18+, phone = country + 4–14 digits (`lib/dial-codes.ts`), UBOs 1–10, suppliers 1–5 (proof type contract / confirmation / invoice, 1–5 files), products 1–10, links 0–10 https. **Freeze**: every supplier proof = B2B invoice → `freezeDays` 10 (derived from the answers; admin chip, starts at approval). Answers stored as `StoredAnswers` v2; older 4-step applications keep `LegacyAnswers` and still open.
**Storage (`lib/server/sellers.ts`).** `seller_application` (seller_type, answers jsonb, ID number AES-256-GCM + HMAC hash, merchant key, terms_version + terms_accepted_at), `seller_draft` (one per user: data, id_number_enc, completed steps, submitted_application_id, discarded_at), `seller_file` (encrypted in `UPLOAD_DIR` or .data/uploads/seller, random names), `seller_event`. Migrations 0028 (seller_type + seller_draft) and 0029 (terms + discarded_at). Nothing is deleted, ever.
**Admin (section "sellers").** /admin/sellers = list table (tabs Pending · Approved · Rejected · Blacklisted · Closed, search incl. company, columns type / merchant / applicant or company / country / files / submitted / status / Open; ⚠ returning person; freeze). Click a row → **one detail page per seller** (/admin/seller?id=, screen 11): header chips + Decision, every answer in labeled cards (`app/components/seller-answers.tsx`: Application incl. terms + freeze, Company, Representative + ID number, CEO, UBOs table, each trade reference, Offer details), returning-person box, **Files table grouped by step** (`fileGroups`; missing optional docs "Not sent (optional)") with View / Download and a full-screen viewer (Previous / Next / ← →, Esc) — every open = history row — then History.
**Rejected (screen 13, user 2026-10-01).** A rejected seller sees a Difmark-style red banner (`SellerRejectedBanner`: "Your … Verification was rejected … CONTACT OUR SUPPORT ›") on My account, /sell and /sell/apply; /sell/apply shows step 7 Approving in red + the reason + Go to details / Contact support / Apply again (new draft with the old answers). Contact support = `/account/tickets?new=1&subject=account_verification` (new ticket subject "Account verification", `lib/tickets.ts`); the rejection email links there too.
**Sales freeze timer (screen 14, user 2026-10-01).** Approve of an invoice-only business sets `seller_application.freeze_until` = now + 10 days (history "Sales freeze started"; approved email says "on hold until …"). `releaseDueFreezes()` (`lib/server/sellers.ts`) claims due rows with one UPDATE … RETURNING (each released once), writes a "System" history row, emails the seller (`sellerSalesOpen`) and every admin with Seller applications (`adminFreezeEnded`); it runs every 5 minutes (`instrumentation.api.ts` → `startFreezeTimer` when the server starts; the first read starts it too) and on reads (max every 30 s). Admin: header chip "⏱ Freeze · N d left", Application row with date + bar + **Release now…** (reason, action `release`, seller gets the early "sales open" email), list chip + **On hold** tab, Overview notice (`GET /api/admin/sellers?notices=1`, Dismiss = `PATCH {id, dismissNotice}`, for all admins). Seller card: "Sales are on hold until …" → "Sales are open.". Migration 0030. `SELLER_FREEZE_SECONDS` shortens the hold for local tests (ignored in production). Demo store: same, checked on every read.
**Returning person / close account / demo.** Unchanged from T3 (see git history): same email / KYC number hash / merchant name as rejected / blacklisted / closed records → flagged; close account keeps data, blocks sign-in. Demo store (`demo-api.ts`) has the same rules incl. drafts (`sellerDrafts` in localStorage).
**Tests.** `e2e/sellers.spec.ts` (6 × desktop + mobile, no skips). Smoke part `sellers` (real server, needs the user to open it): upload type / size rules, draft step order + Delete, submit with terms, own details, admin answers + files + audit, encrypted on disk, business with freeze + rep email, returning person, R3 race, close account. Real server 2026-10-01 (dev server restarted with `SELLER_FREEZE_SECONDS=20`, smoke with `SMOKE_FREEZE_SECONDS=20`): 144 passed, 0 failed, 0 skipped incl. automatic release (System history, Overview notice, admin + seller emails, once). Browser check desktop 1280 + mobile 390 (admin account as applicant): /admin/sellers, /admin/seller (answers, Files table, viewer Previous / Next, PNG decrypted), /account rejected banner + draft card + Delete confirm, /sell/apply Business (old answers filled in) + Individual, /sell/details (ID number •••• last 4), no sideways scroll. On hold tab / Release now / Overview notice not seen in the browser (the smoke ends every record Rejected; test hold 20 s); smoke API checks + demo e2e cover them. Bugs found + fixed: (1) `instrumentation.api.ts` imported `lib/server/sellers` after an early return, so dev webpack also bundled it for edge ("Can't resolve 'fs'" from pg) and every page answered 500; the import now sits inside `if (NEXT_RUNTIME === "nodejs")`. (2) /admin/sellers opened as `?tab=…` first asked for "pending" and that later answer replaced the list (empty); the load effect now ignores answers of an older tab / search (same fix as billing / fees 2026-09-30). Smoke check "draft: GET returns it" now accepts the Rejected application an earlier run left.
## 16. Emails, order page, receipt, seller rating (email task, 2026-09-29)

**One layout.** `lib/emails.ts` (shared: server, demo, admin preview) = every email: `renderEmail(id, data, site)` → { subject, html, text }. Layout: blue → purple header (#2563EB → #4F46E5 → #7C3AED, solid blue fallback), white card, grey footer ("create a ticket" link, copyright, company address from `COMPANY` in `lib/orders.ts` = placeholders until the user sends them). Inline styles + tables (email apps drop `<style>`); every value escaped. 19 templates (`EMAIL_LIST`): verify (code + link), welcome, reset, passwordChanged, newSignIn, emailChanged (template only: email change is not built), adminCreated, orderConfirmed, paymentFailed, refund, returnUpdate (received / approved / rejected), topUp, giftCard, balanceAdjusted, ticketCreated, ticketReply, sellerReceived, sellerApproved, sellerRejected. `sampleEmail(id)` = preview data. **Rejection email (2026-09-29, user, Difmark style):** `sellerRejected` has `business` (= application `isCompany`) → "Personal / Business verification rejected"; optional `hero` in the layout = centred PNG `public/email/verification-rejected.png` (480×320 shown 240×160, own art, made by `Claude outputs/tools/email-art.mjs`; email apps drop SVG) + 26 px bold UPPERCASE centred title; reason in a grey box with a red left edge; support email `COMPANY.supportEmail` (placeholder support@corecart.example) + "create a ticket" link + full-width CONTACT SUPPORT TEAM button → /account/tickets?new=1. Callers: `lib/server/sellers.ts` decide + demo-api. Keys are never written in an email: Get key opens the signed-in order page.
**Sending.** `lib/server/email.ts` `sendTemplate(to, id, data)` (never throws) → Resend when RESEND_API_KEY is set, else terminal + dev outbox (last 30, memory, never production). Hooks: auth.ts (verify code + link, welcome = `afterEmailVerification`, reset / admin-created, password changed = `onPasswordReset` for verified accounts + after hook on /change-password, device check after every sign-in), tickets.ts (created, reply), returns.ts (received / approved / rejected / refunded), wallet-mail.ts (top-up credited from the webhook, gift card redeem route, admin adjustment route), sellers.ts (received, approved, rejected), orders.ts `mailOrder` (sample orders today; real checkout calls it after the payment webhook).
**Verify code.** `sendVerificationEmail` gets Better Auth's token; `lib/server/account-mail.ts issueVerifyCode` stores HMAC(code) + token in `email_code` (one per user, 10 min). `/api/verify-code` checks it (5 wrong = dead) and calls `auth.api.verifyEmail({ token })` (same as the link: verified + welcome + session cookie forwarded). UI `VerifyCodeForm` (auth-ui.tsx) on /register, /login (unverified), checkout gate.
**New device.** Cookie `cc_device` (random 32 bytes, httpOnly, 400 days); `known_device` keeps its SHA-256. `noteDevice` runs in the auth after hook on every new session; an unknown device on an account that already has one → "New sign-in" email (device name `lib/device.ts`, masked IP, location, Bangkok time). `lib/server/geo.ts` GEO_PROVIDER: sample (default outside production: "Bangkok, Thailand (sample location)"), cloudflare (CF-IPCountry header), none (production default). Real lookup waits for the real server (user). `login_event.location` shown on Login history.
**Orders.** /account/orders = Eneba table: Date · Status (Order fulfilled green / Processing amber / Payment incomplete, Cancelled, Refunded red — `ORDER_STATUS`) · Order title (+N more items) · Order ID · Payment method · Total · Details; search by order ID (`matchesOrder`, ignores case, spaces, dashes); whole row opens the order page. ≥1200 full table, 1024–1199 no Payment method column, < 1024 one card per order (table in an `.ord-wrap` scroll box, never page overflow). /account/orders/view?id= = receipt detail: Ordered products (cover, price, seller, status, Rate the seller, Reveal / View key, Request return → back to the Returns tab with the confirmation), Payment details, Order summary, Receipts and invoices. /account/orders/receipt?id= (&doc=invoice opens the tax form): printable document (print CSS shows only `.receipt-doc`), optional tax details saved on the order (`parseTaxInfo`) → title "Tax invoice / Receipt", else "Receipt". Migration 0022: orders payment_method / payment_last4 / paid_at / subtotal_minor / discount_minor / promo_code / wallet_minor / tax_info; order_items product_id / seller; old orders backfilled as card •••• 4242.
**Rating.** `RatingDialog` (orders-ui.tsx): 1–5 star radios + comment, Esc / outside closes, phones = bottom sheet. Email "Rate the seller" = order page `&rate=1`. Admin view of ratings = later (seller profiles, T3 tools).
**Admin.** /admin/emails (every admin): template list (select under 1024 px), iframe preview at 600 / 375 px (sandboxed), plain-text view, Send test to me, outbox (demo: this browser; server: dev outbox).
**Demo.** demo-api.ts keeps the same emails in `corecart-demo-v1`.outbox (last 50), codes on tokens, devices (`corecart-demo-device` key), ratings, tax details. The check-email screens show "Code: 123456" in the demo inbox.
**Tests.** `e2e/emails.spec.ts` (7 × desktop + mobile; 1 desktop-only pure template check), dashboard / returns specs follow the order page. Smoke part `emails` (real server, dev outbox).

## 17. Code review fixes R1–R8, N1, N2, N4 (2026-09-30)

Source: Codex + peer reviews 1–3 of `b0e22bf` / `54e534c` (list + reasoning: agents.md "CODE REVIEW FIXES R1–R8"). Migrations 0023 (`claim_email`, `terms_version`, `top_up.review_note`, R3 unique index) and 0024 (`email_failure`).

**R1 closed-account email reuse.** A sign-up with the email of a closed account never touches the closed row. The auth before hook (`lib/server/auth.ts`) rewrites the body: email → `claim+<uuid>@claim.invalid`, `claimEmail` = the real address (Better Auth merges hook bodies with defu, so a client `claimEmail` is always overwritten with ""). The create hook keeps `claim_email` only for that placeholder. The verification email + 6-digit code go to `claim_email`. `beforeEmailVerification` refuses when the closed row no longer holds the address; `afterEmailVerification` → `finishEmailClaim` (`lib/server/account-close.ts`): one transaction locks the closed row + the claimant, moves the closed row to `closed+<id>@closed.invalid`, gives the address to the claimant, audit `email_claimed`; on failure the claimant goes back to unverified. Resend verification for such an address goes to the newest pending claim. Failed / unverified sign-ups change nothing, so admin reopen still works. `.invalid` addresses never get mail (`sendTemplate`). Demo: same in demo-api.ts.
**R2 return vs reveal.** `revealKey` (`lib/server/keys.ts`) = one transaction: lock the order line (`lockLine`, the same row lock `createReturn` takes) → lock the key → `revealHeld` → stamp `revealed_at` → log. Route answers 409 `RETURN_HOLD` when held.
**R3 merchant name.** Partial unique index `seller_app_merchant_open_idx` (merchant_key where status in pending / approved). The migration creates it only when no duplicates exist (else RAISE WARNING, rows kept, app check still refuses new ones). 23505 → 409 `merchantTaken` (submit) / `merchantOpen` (unblacklist back to Pending).
**R4 cart saves.** `cart-provider.tsx`: signed-in saves run one at a time per product; clicks meanwhile only change `want`, the loop sends the newest value; server replies are applied only when no save is waiting. A failed or thrown save reloads the server cart and shows `saveNote` (amber, in `CouponNotes`).
**R5 catalog.** `lib/client/catalog.ts`: null or error = failure → retry 1 s, 2 s, 4 s … 30 s, and on `online` / `focus`. `catalogReady()` resolves only with the real catalog; `catalogStatus()` + `CatalogNotice` ("Live prices could not be loaded yet…") on cart, checkout, product.
**R6 seller upload.** `app/api/sell/files/route.api.ts`: sign-in → rate limit → Content-Length check → `readCapped` (stops at 5 MB + 64 KB) → multipart parse. VPS proxy should also cap bodies.
**R7 Terms.** `lib/terms.ts` `TERMS_VERSION`. Email sign-up must send `termsVersion` (register checkbox; checkout gate button under the notice) → saved `terms_version` + `terms_accepted_at`. Google: `POST /api/terms/accept` (signed httpOnly `cc_terms`, 10 min, `lib/server/terms.ts`) right before the redirect; a new Google account is refused without it. Other creation paths record no terms. Old rows: `terms_version` null = no server proof.
**R8 payment events.** Contract + checks in `lib/server/payments/event.ts` (pure): `normalizeEvent` (success needs amount = positive safe integer, currency 3 letters upper-cased, payment reference; never filled from our row) and `matchEvent` (provider, top-up id vs reference, reference, currency, amount; permanent vs transient). `handleWebhook`: 200 credited / failed / duplicate / ignored / "rejected: …" (permanent; admin `review_note` on the top-up, event never re-processed), 400 bad signature, 503 "deferred: …" (reference not known yet; retried), 500 our error. Credit = saved `creditMinor`; late payments keep the old policy under the same checks. Dev adapter passes raw values through; Simulate sends complete events with the saved `providerRef` (now `dev_<topUpId>`). Admin top-up page shows "Needs review".
**N1 verify code.** `checkVerifyCode`: `attempts = attempts + 1 where attempts < 5 returning` before comparing; the right code is used once (`delete … returning`).
**N2 dev outbox.** GET `/api/admin/emails`: outbox + failures only for the master admin (others get null + a notice). Kept copies of verify / reset / admin-created emails hide the 6-digit code and links unless `DEV_OUTBOX_SECRETS=1` (private machine only; the smoke script needs it for code steps).
**N4 email failures.** `sendEmail` returns ok / error; network, 429 and 5xx are tried 3 times. `sendTemplate` saves failures in `email_failure`; master admin sees "Failed sends" on /admin/emails; admin test email answers 502 when not sent. Screens stay generic; the resend buttons are the retry path.
**N3 receipt title (user 2026-09-30).** A receipt = the order details, so the title is always "Receipt" (`documentTitle()` in lib/orders.ts), with or without a tax ID. The optional tax details stay: saved on the order and shown on the same receipt ("Shown on this receipt: name · Tax ID"). Order page: section "Receipt", columns Receipt (Download) + Tax ID (Add / Edit tax ID); no "tax invoice" wording anywhere. `?doc=invoice` still opens the tax form (old links).
**Still ahead.** Real provider work (merchant account, test / live keys, provider-specific completed-payment checks) is still ahead: R8 does not make payments production-ready.
**Tests.** `e2e/review-fixes.spec.ts` (demo, desktop + mobile; R8 pure checks desktop only; R5 needs E2E_SERVER_URL). Smoke: R1/R7 in users + sellers + emails parts, R2 in returns, R3 + R6 in sellers, R8 in topups, N1/N2/N4 in emails + admins.
**Real-server test (2026-09-30, npm run dev + local PGlite, PAYMENT_PROVIDER=dev, DEV_OUTBOX_SECRETS=1).** Found + fixed 3 bugs the demo build could not show: (1) R1 placeholder check was a broken regex (`/^claim+[w-]+@claim.invalid$/`, never matched a real `claim+<uuid>` address), so the claim was dropped and no code reached the real address. Now one helper `isClaimPlaceholder` in `lib/account-close.ts`, used twice in `lib/server/auth.ts`. (2) Dev outbox: each dev route bundle had its own `outbox` array, so /admin/emails missed most emails; the list now lives on `globalThis.__corecartOutbox` (`lib/server/email.ts`). (3) Server catalog (`lib/server/catalog.ts`, older bug): the reload time was shared on globalThis but the product list is per module copy, so after an admin save other routes (favorites) kept the old list up to 30 s. Now an admin write bumps a shared version; each copy keeps its own loaded time + version and reloads when the version changed (a load that started before the write is awaited, then checked again). Demo: `save()` in demo-api.ts returns false when storage throws; demo `setCartItem` then answers a failed save (R4 note testable). Smoke script: waits out the top-up limit (10 / 10 min, first 429 checked), section count read from lib/admin-perms.ts (12), R8 refusals check "not credited" (creating another top-up cancels the older pending one), prints the checks made so far when it stops early.

## 18. Purchase popup ("Someone just purchased", 2026-09-30)

**Spec.** Wireframe approved 2026-09-30 (`Claude outputs/wireframes/purchase-popup-wireframe.png`). Defaults used (user said continue without changing them): admin access = the existing "Products + key inventory" section (no new section); only orders from the last 24 h; wallet top-ups never shown (they are not orders).
**Rules.** `lib/purchase-popup.ts`: `pickRecent` (enabled, not hidden, product live, last 24 h, newest 10, one row per order line), `isBuyerRole` (customer / seller), `POPUP_ORDER_STATUSES` (paid, completed), `parsePopupSettings`, `popupChange` (audit text, null = no change), `popupAllowedOn` (no popup on /cart, /checkout*, /account*, /admin*, /login, /register, /forgot-password, /reset-password, /verify-email, /sell/apply), `timeAgo`, `POPUP_TIMING` (3 s first, 6 s show, 8 s gap, 30 s poll).
**Server.** `lib/server/purchase-popup.ts`: settings in `site_setting` (key purchase_popup), save = advisory lock + upsert + `site_setting_event` row in one transaction; feed query joins order_items → orders → user → product (published), active buyer accounts only, sample orders only when `sampleOrdersAllowed()`; 10 s cache on globalThis (an admin save clears it). Privacy: only order-line id, product id, time and the account country leave the server.
**Demo.** `demo-api.ts` `recentPurchases` reads every buyer's paid orders in this browser (sample orders count here); `purchasePopup` / `savePurchasePopup` keep settings + audit in the demo store.
**UI.** `app/components/purchase-popup.tsx` (mounted in `app/layout.tsx`): polls while the tab is visible, product image / name / link from the live catalog, hover / focus pauses, × = sessionStorage `corecart-popup-closed`, seen ids in localStorage `corecart-popup-seen` (last 200). Phones: one-line bar, 12 px above `.pdp-sticky` / `.cart-sticky` when shown; sets `--cc-popup-top` + `html[data-cc-popup]` so the favorites toast sits above it. CSS `.pp-*` in cart.css (z-index 55: under sheets and dialogs). Admin page `/admin/purchase-popup` (switch, search + Hide, hidden table with Show again, Discard / Save, History).
**Tests.** `e2e/purchase-popup.spec.ts` 8 tests × desktop + mobile (fake clock), no skips. Smoke part `popup` (58 checks: settings saved + audited, bad input, 401 / 403, buyer country, admin orders left out, lines without a product left out, hidden, off, closed buyer, privacy, restore). Seller part now also checks a closed account cannot sign in (85 checks).
**Real-server browser check (2026-09-30).** Headless Playwright against `npm run dev`, desktop 1280 + mobile 390: 55 passed (placement, text with country, link, ×, pages without the popup incl. signed-in /account + /admin, admin Off / Hide / reload / History / restore, saved values read back with GET /api/admin/purchase-popup). The Browser pane is not usable for this while hidden (the popup only polls in a visible tab).

## 19. Checkout tasks: billing address, processing screen, Get your product, service fee + sales tax (2026-09-30)

**Spec.** Task list rows 5–8; wireframes approved 2026-09-30 (`Claude outputs/wireframes/billing-address-wireframe.png`, `processing-wireframe.png`, `get-product-wireframe.png`, `order-summary-wireframe.png`). User answers 2026-09-30: a new billing address is always saved (no tick box); Thai labels English + Thai; hidden keys open Get your product, shown keys never do; one admin-set service fee for all products; tax added on top, rate set by the admin; fee + tax start off.
**Billing address (task 5).** `lib/address-formats.ts`: one layout per country in `COUNTRY_CODES` (special layouts TH, UA, US, PR, GB, JP, CA, AU, HK, AE, QA, BR, MX, IN, CN, KR, IT, ES + street / house-number layout for DE, AT, CH, LI, NL, BE, DK, NO, SE, FI, PL, CZ, SK, HU, SI, HR, LU; others DEFAULT), region lists (TH 77 provinces with Thai names, US 50 + DC, UA, JP 47, CA, AU, HK), postcode rules (none for AE, QA, HK; optional IE, BH, PA, SV, JO), `checkAddress` (only that country's keys, tidy, upper-case postcode, per-field errors), `billingShort`. Stored on `user.billing_address` (jsonb, migration 0026). API `GET / PUT /api/account/billing-address` (user, 30 writes / 10 min, 4 KB body, same checks; unchanged = no write). UI `app/components/billing-address.tsx`: country first (saved address, else account country, else TH), fields in a 6-column grid (phones 2), error after leaving a field, auto-save 1.2 s after the form is complete and different ("✓ Saved to your account"). Used on checkout Payment (card method, under "Your payment is secure"; summary "Billing details Bangkok 10110") and Account → Payment methods. Card data never touches CoreCart (the card fields stay the provider's; with hosted fields the section will wait for their "not empty" event).
**Processing screen (task 6).** `/checkout/processing?order=` or `?topup=`: checkout header (logo + steps, phones show the current label only), CSS ring (blue → purple, 1 s; reduced motion 3 s), polls every 3 s: order paid / completed → order page, cancelled / refunded → "Your payment was not completed" (Try again + My orders); top-up credited → top-up result, failed / expired / cancelled → not completed. After 2 min "Still working — we will email you". Unknown id → "We could not find this payment". Top-up provider return URL now points here (`lib/server/topups.ts`, cancel URL unchanged). Order checkout will use it once real checkout exists (Pay still off).
**Get your product (task 8).** `/account/keys/get?id=<key>` or `?item=<order line>` (email; first hidden key of the line). Revealed key → redirect to `/account/keys/view`; the key page now shows revealed keys only and sends hidden ones here (one place to reveal). Shared `app/components/key-facts.tsx` (`KeyFacts` row, `keyInfo`, `keyHref`). Manual activation card: warning, "{PLATFORM} is the correct platform" + "{REGION} is the correct region" (both required), Display the key (= `revealKey`, same server rules, then key page), Request refund (existing `ReturnForm`, only while eligible; open return → note). Links: order page `KeyLinks`, keys library, overview say "Get key"; order email "Get key" per key line → `/account/keys/get?item=` (`EmailItem.keyUrl`).
**Service fee + sales tax (task 7).** `lib/fees.ts`: `FeeSettings` (fee on/off, percent bp ≤ 20 %, fixed ≤ ฿1,000, minimum; tax on/off, default rate, rate per country ≤ 30 %), `parseFeeSettings`, `charges(settings, base, country)` (fee = % + fixed, at least min, on sub-total − discount; tax on base + fee; country unknown → tax null = "Calculated at payment"), `feeChange` (audit text). Server `lib/server/fees.ts` (site_setting key `fees_tax`, advisory lock + audit row), `GET /api/fees` (public), `GET / PUT /api/admin/fees` (new admin section `fees`, 30 writes / min). Orders: `service_fee_minor`, `tax_minor`, `tax_rate_bp`, `billing` (migration 0026); the dev sample order computes them on the server (THB → charged currency, exact) with the tax country = billing address, else account country, else TH. `chargeRows` (lib/orders.ts) = order page, receipt, order email lines (zero lines left out). UI: `app/components/fees.tsx` (`useFees` once per page view, `useCharges`, `FeeTaxLines`): cart + checkout review (fee line when on, tax "Calculated at payment", "Estimated total"), payment page (fee line always, "Sales tax X%" by billing / account country, total + charge notice use it). Admin `/admin/fees`: switches, inputs, country rate table, live ฿1,000 example, Save / Discard, History. Demo store mirrors everything (`s.fees`, `s.feeEvents`, `billingAddress` on the demo user).
**Tests.** e2e: `billing-address.spec.ts` (3), `processing.spec.ts` (4), `get-product.spec.ts` (3), `fees.spec.ts` (4), all desktop + mobile, no skips; reveal steps in keys / returns / tickets / dashboard specs now go through Get your product (`displayKey` helper); emails + admin-perms updated. Smoke part `checkout` (billing checks + saved values, fees validation / audit / public GET / 401, sample order fee + tax + billing + total, order email lines, settings restored). Real server 2026-09-30 (dev server restarted, migration 0026 applied): smoke `checkout` 58 passed, 0 failed; `admins` 53/0 (13 sections incl. fees); `topups` 90/0, 1 skip (30-minute expiry: too slow for a smoke run, covered by the e2e clock test). Browser check (headless Playwright scratch script, desktop 1280×800 + mobile 390×844, admin account as customer): 94 passed, 0 failed, 0 skipped — billing TH / US / HK on /checkout/payment saved (GET API) + kept after reload, /admin/fees switch on → saved + history + public GET, cart fee line + estimated total, payment 7% TH tax + total, GB → 0%, Get your product ticks → Display the key → key page (revealedAt + code via GET API), /checkout/processing?topup= → Simulate paid → top-up result (credited); fees, billing and cart restored afterwards. Bugs found + fixed: `billing-address.tsx` and `/admin/fees` loaded their data in an effect without a cancel flag, so a late second answer (React dev runs effects twice) overwrote what the user had already chosen (country back to TH, fee switch back off). Both now apply only the latest load; the fees page edits use a functional state update.

## 20. Wallet top-up redesign + bank transfer (2026-10-01, wireframe `Claude outputs/wireframes/topup-wireframe.png`, approved)

**Rules (`lib/topup.ts`).** Presets $10 / $15 / $25 / $50 / $100, min $1 / max $100 per top-up (card and bank), daily cap unchanged ($2,000 paid + credited per 24 h). `TopUp.method` = `card` (provider webhook credits) | `bank` (admin confirms). `statusLabel(t)` = "Waiting for transfer" for a pending bank top-up. Numbers: TU-######## (card), BT-######## (bank). `transferRef()` = personal reference CC-XXXXXX (no 0/O/1/I). Bank details: `BankSettings` {bankName, accountName, accountNumber, swift}, `parseBankSettings` (all three main fields or none; SWIFT 8/11; account number 4–40). Bank currencies = every currency enabled in Admin → Currencies (user 2026-10-01), no separate list, `bankReady`, `bankChange` (audit text). `BANK_PENDING_MS` 7 days, `BANK_OPEN_MAX` 3 waiting per customer. `receivedMismatch` text.

**Server (`lib/server/topups.ts`).** `bankSettings` / `bankHistory` / `saveBankSettings` (site_setting key `bank_transfer` + site_setting_event audit, advisory lock, unchanged = no row). `bankInfo(userId)` (null = Coming soon; makes `user.topup_ref` once, unique, retries on clash). `createTopUp` with `method: "bank"` → `createBankTopUp` (any enabled currency, limits, daily cap, max 3 waiting, idempotency key, provider "bank", 7-day deadline, no payment start). A new card top-up cancels only older pending CARD rows. `expireStale` reason by method. `simulateTopUp` refuses bank rows; the provider webhook never matches them (provider "bank"). `adminConfirmBank(adminId, id, receivedMinor, bankRef)`: bank only, pending or expired, amount must equal the top-up, one transaction (row lock → credited + `confirmed_by` + bank ref in provider_ref + one `wallet_ledger` top_up row, unique per top-up) + `user_audit` "topup_confirmed" + `mailTopUp`. Admin list search also matches the CC- reference; `AdminTopUp.customerRef`, `confirmedBy`.

**DB.** Migration `0027_topup_bank.sql`: `top_up.method` (default card), `top_up.confirmed_by`, `user.topup_ref` (unique).

**API.** `GET /api/account/topups` → + `bank` (BankInfo | null). `POST /api/account/topups` accepts `method: "bank"`. `PATCH /api/admin/topups` `{ id, action: "confirm", receivedMinor, bankRef? }`. New `GET/PUT /api/admin/bank-transfer` (section topups, 30 writes / 10 min per admin).

**UI.** `/account/balance` = Wallet (menu label "Wallet", URL kept): balance card (flag, total, currency name, wallet / gift split, "Top up history" anchor), Add funds (5 cards, one-click TOP UP → card top-up → result page), "Top up a custom amount" = tabs (role tablist; option cards right on desktop, tabs on top under 900 px): Payment methods (logos, currency picker + amount, limits + daily left, You pay / Added / New balance, green TOP UP BALANCE), Bank transfer (Coming soon or our details + reference with Copy + "I have sent the transfer"), Gift card (redeem form; `#redeem` opens it); Top up history (last 5, See all); Transactions. `/account/balance/top-up` = result page only (no ?id= → Wallet); bank rows show reference + "Waits until", no polling, no simulate. Admin `/admin/topups`: "Bank transfer details" panel (form, history; currencies follow Admin → Currencies) + Method column; `/admin/topup`: "Confirm received…" for bank rows (amount + optional bank ref), customer reference tile. `PaymentTiles` exported from payment-logos. CSS `.wal-*` in account.css (old picker `.tu-grid/.tu-chip/.tu-pay…`, `.bal-total/.bal-tile/.bal-h` removed), `.tu-bank*` in admin.css.

**Tests.** `e2e/topup.spec.ts` rewritten (9 tests × desktop + mobile, no skips; layout checks branch on isMobile); `processing.spec.ts` + `balance.spec.ts` + `dashboard.spec.ts` follow the Wallet. Smoke `topups`: new limits + bank part (runs before the card part; restores wallet + bank settings). Real server 2026-10-02: 131 passed, 0 failed, 2 skipped (7-day bank expiry, 30-min card expiry: too slow for a smoke run, covered by the e2e clock test). Three smoke-script fixes on the way (app code unchanged): the non-card-currency bank check now asks ~$20 in that currency (AR$10 was under the $1 minimum); waiting transfers left by a stopped run are cancelled first (kept, never deleted); bank requests wait out the shared 10 / 10 min limit like card ones. A full run takes ~35–45 min (several 10-minute windows), longer than Claude's 30-min background limit: start it as a separate process with a log file. A stopped run can leave the "Smoke Bank" test details saved: clear them afterwards (done 2026-10-02; bank transfer shows Coming soon again).
