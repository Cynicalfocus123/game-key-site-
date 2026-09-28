# CoreCart codebase guide (for code review)

A map of the whole frontend and backend for reviewers, people or AI. The running change log is `code.md`, the look is in `design.md`, dependency weight is in `weight.md`, and plans and handoffs are in `agents.md`.
Snapshot: 2026-09-27, commit `e0f781a` (step 3b). Repo: https://github.com/Cynicalfocus123/game-key-site- (`main`).

## 1. What it is

CoreCart is a store for game keys (Steam, Xbox, PlayStation, Nintendo, EA, Ubisoft) and PC hardware. Thai base currency (THB) with 53 display currencies, customer accounts, a customer dashboard and an admin panel.

**Stack:** Next.js 15.5 App Router, React 19.1, TypeScript 5.9, plain CSS (no UI kit), Better Auth 1.7 (email + password, optional Google), Drizzle ORM 0.45, PostgreSQL (Neon) in production or PGlite (embedded Postgres file DB in `.data/pglite`) locally. Tests use Playwright 1.63. There are no other runtime dependencies.

**Not built yet:** real payments and real orders (no payment provider chosen), catalog database (products are a mock list in `lib/catalog.ts`), shipping, real emails (Resend is wired but has no key, so emails print to the terminal), admin tickets (customer tickets exist), wallet top-up. Returns exist, but a refund is a manual admin note until payments.

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
  cart/, checkout/, checkout/payment/   Cart, review, payment UI (Pay disabled: no provider)
  login/, register/, forgot-password/, reset-password/, verify-email/   Auth pages
  account/                Customer dashboard (AccountShell): overview, login-history, balance, orders (Returns & Orders tabs),
                          keys (+ view, print), favorites, tickets (?new=1, ?id=), payment-methods, settings
  admin/                  Admin panel (AdminShell): overview, users, user?id=, currencies, gift-cards,
                          promo-codes (+ edit), returns, login, register (redirects to login)
  help/                   Activation guides (/help/activate/[platform], static), gift card fraud page
  api/**/route.api.ts     Server API routes (see section 5)
  components/             Shared client components (section 4)
  *.css                   globals.css (tokens + storefront), account.css, cart.css, admin.css
lib/
  catalog.ts              Mock products (id, price in THB satang, kind, category, platform, region rules), cart rules
  promo.ts                Promo code rules, discount maths, validation, summary text
  tickets.ts              Ticket subjects (4), order number clean/check, statuses, limits, form checks, types
  returns.ts              Return rules: reasons per item kind, eligibility (keys only unrevealed), status moves, form checks
  gift-cards.ts           Gift card code format, hashing, statuses, ledger balances
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
                          rates.ts (exchange rates), email.ts (Resend or terminal), stripe.ts (unused yet)
drizzle/                  SQL migrations 0000–0011 + meta snapshots (generated by drizzle-kit)
scripts/                  fetch-rates.mjs (build), create-admin.mjs (only way to make an admin),
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
  - `currency-menu.tsx`, `icons.tsx`, `auth-ui.tsx` (forms, `Notice`, `safeNext`, `DemoBanner`).
- **Money:** always integer minor units. Catalog prices are THB satang, and conversion uses BigInt-scaled rates (`lib/currency/money.ts`). Orders store the charged currency, amount and rate.
- **Styling:** plain CSS with tokens on `:root` in `globals.css`. Square corners, `#2563EB` primary. Mobile breakpoints are mostly 767px and 640px.

## 5. Backend: API routes (server mode only)

Auth guard helpers are in `lib/server/session.ts`: `requireUser` (verified session → user row) and `requireAdmin` (401 when signed out, 403 when not an admin). Admin means `role === "admin"` and a verified email, and only `scripts/create-admin.mjs` can make one.

| Route | Methods | Guard | What |
|---|---|---|---|
| `/api/auth/[...all]` | all | – | Better Auth (sign-up/in/out, verify email, reset password, update-user, Google) |
| `/api/config` | GET | – | Which features are configured (google, stripe, email, sample orders) |
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
| `/api/promo/validate` | POST {code, items?} | – (public) | Promo rules + server discount; 10 unknown codes / min per IP → 429 |
| `/api/admin/me` | GET | user | `{ admin }` |
| `/api/admin/stats`, `/users`, `/user` | GET | admin | Dashboard numbers, user list, user detail |
| `/api/admin/currencies` (+ `/refresh`) | GET PATCH POST | admin | Enable / chargeable / override / rounding; refresh rates |
| `/api/admin/gift-cards` | GET POST PATCH | admin | List (last 4 only), create (full codes returned once), disable / enable |
| `/api/admin/promo-codes` | GET POST PATCH DELETE | admin | List / get, create, edit or enable, delete (hard while unused, soft after) |
| `/api/admin/returns` | GET PATCH | admin | All returns with customer email; status change {id, status, note} (reject needs a note) |

## 6. Database (`lib/server/db/schema.ts`, migrations in `drizzle/`)

Migrations run automatically on the first request (`dbReady()`).

| Table | Purpose |
|---|---|
| `user`, `session`, `account`, `verification` | Better Auth core, plus user fields: role, termsAcceptedAt, marketingOptIn, currency, avatar, country, marketingChoiceAt, stripeCustomerId |
| `rate_limit` | Better Auth rate limits; also used by `lib/server/rate-limit.ts` with `giftcard:` / `promo:` key prefixes |
| `login_event` | One row per sign-in (method, IP, UA) |
| `orders`, `order_items` | Orders (only dev sample orders today); charged currency + THB total + rate |
| `order_key`, `key_reveal` | One key per unit; reveal audit |
| `cart_item`, `favorite` | Signed-in cart and favorites |
| `currency`, `rate_status` | Currency settings and exchange-rate fetch status |
| `gift_card` | SHA-256 code hash + last 4 (never the full code), amount (THB satang), expiry, disabled, redeemer |
| `wallet_ledger` | Signed money movements per user and bucket (wallet / gift); balance = sum |
| `promo_code` | Promo rules; `uses` stays 0 until real checkout |
| `ticket`, `ticket_message` | Support tickets (#1001 identity number, category = Subject id, order_ref = typed order number, status open / answered / closed, customer_unread) and their messages (from_support) |
| `return_request` | One order line + quantity, reason, message, status requested / approved / rejected / refunded, admin note |

## 7. Security model (please check)

- **Sessions:** Better Auth cookie sessions. Email must be verified before sign-in. Sign-in and sign-up are rate limited (5/min in the DB).
- **Admin access:** never granted from the web. Sign-up always creates a customer, and admin accounts cannot link Google (see the `databaseHooks` in `auth.ts`).
- **Prices are never trusted from the client:** the cart API reads prices from the catalog, and the promo validate endpoint recalculates the discount on the server. Checkout (not built) must call `promoDiscount` on the server again.
- **Secret codes:**
  - Gift card codes are hashed; a redeem claims the card atomically (`UPDATE … WHERE redeemed_at IS NULL … RETURNING` inside a transaction).
  - Key codes are sent only after reveal.
- **Rate limits:** gift card redeem (per user + per IP) and promo validate (unknown codes per IP) use the `rate_limit` table. The IP comes from `x-forwarded-for`, which is spoofable unless the host overwrites it (Vercel does).
- **Redirects:** `safeNext` in `auth-ui.tsx` accepts same-site paths only.
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

- The runtime migration on the first request may race on serverless (several cold starts at once).
- **Stripe:** Stripe routes lack try/catch, and `lib/server/stripe.ts` is unused until a provider is chosen.
- **Email and consent:** `user.name` is not escaped in email HTML. Google sign-up sets `termsAcceptedAt` without asking.
- **Money display:** the admin user detail sums order totals across currencies, and the drawer's "Under $10" is not converted.
- **Promo limits:** once-per-customer and max-uses are stored and shown but not enforced (needs real orders / `promo_redemption`).
- **Order items:** they have no product id, so covers and links are matched by name (`coverFor`).
- **Returns:** refunds are manual (admin writes a note); a key return blocks reveal of that unit, but refunding does not disable the key at a supplier yet.
- **Data retention:** the `key_reveal` table has no retention policy.
- **Placeholders:** product copy, images and system requirements are placeholders, and some `#` links remain.
- **Assets and CSS:** `mxn.svg` is 85 KB. (Geist is self-hosted through `next/font` since 2026-09-27.)
- **Small UI bugs:**
  - The header ♡ asks guests to sign in.
  - Hardware pages say "Instant key delivery".
  - "Keep me signed in" on register has no effect until the first sign-in.
- **Fixed on 2026-09-27:** server-mode profile saves never saved. The update hook rejected unsent (`undefined`) fields and Better Auth still answered 200. Settings saves made in server mode before this date were lost.
