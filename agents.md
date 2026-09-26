# Agent workflow — Phase 1

Current task: homepage frontend only. Completed: visual system, responsive header/navigation, category drawer, promotional slider, mock homepage sections, footer, placeholder image system.

Hard limits: no listing, detail, checkout, accounts, seller, admin, backend, payment, or authentication work. Do not add heavy dependencies. Do not launch localhost unless user asks.

Placeholder images are approved for current Phase 1 prototype only. Replace local files in `public/images/placeholders/` when production assets arrive. Update `weight.md`, `design.md`, `agents.md`, and `code.md` on every task. Next approved phase requires homepage approval.

Accessibility review complete for Phase 1 drawer focus, Escape close, navigation controls, keyboard slider controls, reduced motion, image alt treatment, and visible focus.

GitHub Pages workflow deploys `main` for homepage review. Keep Phase 1 scope only.

Latest homepage review fix: slider navigation moved away from campaign CTA after mobile overlap report.

Latest homepage update: quick category strip and three promo banners added above Today's deals. Affected files: `app/storefront.tsx`, `app/globals.css`, `public/images/placeholders/categories/`, `public/images/placeholders/promos/`, and all four Markdown docs. Remaining approval item: review exact quick-link and promo visual direction before Phase 2.

Latest user correction: moved quick icon row above hardware categories, removed its heading labels, moved banners below hardware categories, and fixed hosted asset prefix.

Latest user asset update: replaced quick-category logos with supplied reference images. Assets remain in `public/images/placeholders/categories/` for later production replacement. Phase 1 remains open for visual approval only.

Latest folder update: moved live mirror from sibling `Game keys and ecommerce pc site-live` into `live/` under main Git folder. Old sibling path removed. Keep `live/` synchronized after each source change; keep it Git-ignored to prevent recursive project copies.

Tooling handoff (2026-09-25): project moved from Codex to Claude (Cowork). Claude audit only; no code, dependency, or asset changes. Hard rules from user: read all four Markdown docs before every task; update all four after every finished task, small or big; never delete any file unless user explicitly says so; do not install anything into project folder unless user asks. Local `main` and GitHub `origin/main` both at `dbc09ca`. Phase 1 still awaiting homepage visual approval before Phase 2.

Sync rule (user, 2026-09-25): main project folder and `live/` must be identical at all times. After every task, small or big: apply change in main folder, update all four Markdown docs, copy every changed file to `live/` and verify match, then git commit and push `main`. Pending: 2026-09-25 doc notes are not yet committed to Git; Claude cannot push until GitHub write access is set up or user pushes locally.

## Token saving rules (user, 2026-09-25)

Caveman full mode active until user says `stop caveman`, `normal mode`, or changes level.

- Keep responses terse.
- Remove filler, pleasantries, repeated summaries, decorative tables, emojis.
- No tool-call narration or progress preambles.
- Preserve technical meaning, commands, API names, numbers, and exact errors.
- Never remove `no`, `not`, `never`, `only`, or `except`.
- No invented abbreviations.
- Use short sentences; clarity beats compression.
- Stay in user's language.
- Switch to clearer normal prose for security, irreversible actions, or ambiguity.
- No duplicate explanation.

## Project workflow rules

- Read `weight.md`, `design.md`, `agents.md`, `code.md` before every task.
- Update all four after every completed project task.
- Keep Phase 1 homepage scope.
- No heavy dependencies or localhost unless requested.
- Main folder and `live/` must stay identical.
- Copy changed files, verify match, commit, push `main`.
- Never delete files unless explicitly requested.
- Do not install into project folder unless requested.

## Claude review (2026-09-25)

Finished steps (Git history): 1 homepage build `75f9b46`; 2 drawer accessibility + placeholder docs `caf1e19`; 3 GitHub Pages deploy `884171c`; 4 hero controls fix `7fd1329`; 5 quick categories + promo banners `639c4dc`; 6 reorder `52c0b8b`; 7 supplied logos `4955306`; 8 live mirror move `dbc09ca`; 9 Claude handoff + rules (docs only, not yet committed).

Current step: Phase 1 homepage visual approval by user.

Proposed roadmap (not approved): Phase 2 listing + product detail pages (mock data, frontend only). Phase 3 cart + checkout UI. Phase 4 backend: hosting with server, database, auth, payments, game key inventory + delivery, order tracking, admin. Phase 5 business/legal: authorized key suppliers, brand logo permission, PDPA privacy policy, terms, refunds, tax.

## Detailed next steps (proposed 2026-09-25, not approved)

0. Close Phase 1: fix 5 code issues in `code.md`, user approves homepage.
1. Hosting: leave GitHub Pages static export; deploy Next.js server build (Vercel suggested). Repo stays on GitHub.
2. Database: PostgreSQL (Neon or Supabase) + ORM (Drizzle or Prisma). Core tables: users, sessions, addresses, products, variants, game_keys (encrypted), carts, orders, order_items, payments.
3. Registration/login: Better Auth. Email + password, email verification, forgot password, optional Google login, rate limit, PDPA consent, account page. Email via Resend.
4. Catalog: listing + search + filters, product detail (hardware vs game key), data from database.
5. Cart + checkout: Stripe (card + PromptPay), webhook marks order paid.
6. Game key delivery: reserve key on order, reveal in account + email after payment, encrypted at rest, fraud limits.
7. Hardware orders: shipping address, fees, status, tracking.
8. Admin panel: products, stock, key CSV upload, orders, refunds, users.
9. Launch: legal pages, PDPA, security review, real images, domain, full test.
Open decisions: single store or multi-seller marketplace; hosting; database provider; login methods; payment provider.

## Phase 2 — accounts (started 2026-09-25, user request)

User approved start of registration/backend work. Marketplace model like Eneba, G2A, Kinguin, Green Man Gaming, Humble. Roles: customer (default), seller, admin; seller onboarding not built yet.

Built: register, login, Google login, email verification, forgot/reset password, account overview, order history, payment methods, settings, draft terms/privacy pages.

Two modes, one codebase:
- GitHub Pages (`main` push): demo mode. Browser-only mock accounts in localStorage. Shows full process: register → demo inbox → verify → dashboard → orders with demo keys → add test card → settings.
- Server mode (`npm run dev` in main folder or `live/`, later Vercel): real auth, database, API routes.

Not built yet: checkout, real key inventory/delivery, shipping, admin panel, seller portal, live Stripe/Resend/Google keys.

Extra rules (user, 2026-09-25):
- After every file change, show real git diff (`git -c color.ui=always --no-pager diff`), additions green, deletions red. Never summary only.
- Prompt suggestions off for all projects and tasks (`"promptSuggestionEnabled": false`). No suggested next prompts.
- Before context reaches 250k tokens, write a handoff prompt for a new chat session and save it in `agents.md`. Full rules in `CLAUDE.md`.
- D: drive only (C: low on space): installs, caches, databases, builds, tool data all on D:. npm cache `D:\dev\npm-cache`; Claude Code config `D:\dev\claude` (`CLAUDE_CONFIG_DIR`).

## Handoff (2026-09-25, Cowork → Claude Code)

Open Claude Code in `D:\mstar companies\Game keys and ecommerce pc site`. Read `CLAUDE.md`, then `agents.md`, `design.md`, `code.md`, `weight.md`. Follow every rule there.

State: Phase 2 accounts code is written in main folder and `live/` (identical, verified). Not yet committed. First actions:
1. `npm install` (new packages: better-auth, drizzle-orm, pg, pglite, drizzle-kit; Next 15.5.26, React 19.1.9).
2. `git status`, review diff, commit "feat: phase 2 accounts (register, login, Google, verify, reset, dashboard, orders, payment methods)", push `main`.
3. Check GitHub Actions Pages deploy passes; open demo `/register/` on Pages.
4. Local real mode: copy `.env.example` → `.env.local`, set `BETTER_AUTH_SECRET` (`npx @better-auth/cli secret`), `npm run dev`, register; verification link prints in terminal.

Next options (user decides): Neon DATABASE_URL + Vercel deploy; Google OAuth keys; Resend key; Stripe test key; then Step 4 catalog/listing + product pages, Step 5 cart/checkout, Step 6 key delivery, Step 7 shipping, Step 8 admin, seller portal.

## Handoff v2 (2026-09-25, Cowork → Claude Code) — use this one

Start Claude Code from `D:\mstar companies\Game keys and ecommerce pc site` (D: only; C: low on space).

Read first, in order, every session:
1. `CLAUDE.md` (all rules).
2. `agents.md`, `design.md`, `code.md`, `weight.md` (full files, including all older sections).
3. Past versions: `git log --oneline` and `git log -p -- CLAUDE.md agents.md design.md code.md weight.md` for history of decisions.
4. Confirm `live/` copies of the same files match main folder.

State: Phase 2 accounts code written in main + `live/`, verified identical. Not yet committed unless user already pushed; check `git status` and `git log origin/main -1`.
Pending: `npm install` (D: only, npm cache `D:\dev\npm-cache`), commit + push, check Pages deploy, local real test with `.env.local`.
Next step waits for user instruction.

## Handoff v3 (2026-09-25, Cowork → Claude Code) — latest, use this one

Goal of next session: read all docs + code, then agree with user on the next best step. No code changes before user agrees.
Full prompt text is in the Cowork chat and repeated here in short:
- Read `CLAUDE.md`, then `agents.md`, `design.md`, `code.md`, `weight.md` in full, then `git log -p` history of those files.
- Read the code: `next.config.ts`, `package.json`, `.github/workflows/deploy-pages.yml`, `app/` (storefront, components, auth + account pages), `lib/server/` (auth, db, email, stripe, session), `lib/client/` (api, demo-api, server-api, types), `app/api/**/route.api.ts`, `drizzle/`.
- Report: what works, gaps/bugs found, then 2–3 options for next step with effort and dependencies. Wait for user choice.
- Last pushed commit: `31820b0 feat: phase 2 accounts + rules`.

## Phase 3 step 1 — admin panel: users (2026-09-26, Claude Code)

User request: admin login + register, admin panel shows overall user registrations first. Next step after this: payments + orders per product.

Built: `/admin/login`, `/admin/register`, `/admin` (overview), `/admin/users` (table, search, filters, paging), `/admin/user?id=` (detail + sign-in history). Every sign-in now logged in new `login_event` table (method, IP, device, time).
Admin access rule: verified email AND (`role = admin` OR email in `ADMIN_EMAILS` env). Allowlisted emails get `role = admin` on sign-up and on next sign-in. Other emails registering on `/admin/register` become normal customers. Admin password minimum 12 characters (client check).
Demo (GitHub Pages): `/admin/register` makes a browser-only admin; panel shows this browser's demo users plus 36 generated sample users (`example.com`).
Checked: Better Auth 1.7.6 does not link Google to an unverified local account (`requireLocalEmailVerified` default true), so pre-registering an admin email cannot hijack it.
Tested: typecheck; server build; Pages build; 27-check server test (real Better Auth handler + admin routes on temp PGlite in `D:\dev\tmp`): sign-up, verify, 403 unverified, login events, 401/403/200 guards, stats, filters, search, paging, detail, no session tokens returned. Not tested: admin UI in a browser (no localhost per rule).
Open decisions: login history retention (suggest 90 days, PDPA); admin actions (ban, role change, force sign-out); record failed sign-ins.
Next step (user): Step 2 payments + orders per product (needs product catalog + checkout + Stripe/PromptPay).
Pending fixes from review (not done): escape `user.name` in email HTML (`lib/server/email.ts`); `/login` `next` accepts `/\evil.com`; Google sign-up sets `termsAcceptedAt` without consent; Stripe routes lack try/catch; runtime migrations race on serverless; wrong CPU/category images; USD vs THB.

## Tooling + decisions (2026-09-26)

Playwright added (user request): end-to-end tests run locally (`npm run test:e2e`, user approved a temporary 127.0.0.1 server for tests) and on GitHub Actions before every Pages deploy (failing test blocks deploy). Chromium only, browsers in `D:\dev\playwright`, temp in `D:\dev\tmp`. Firecrawl CLI + `firecrawl-lean` skill were installed then removed at user request; user PATH now includes `D:\codex system\npm-global` (user added).
Admin email given by user: stored only in local `.env.local` as `ADMIN_EMAILS` (never in public repo docs).
Agreed plan for Step 2 (not started, user said wait): catalog DB (products, currencies, regions, key inventory), admin products + currencies + regions, admin homepage sections, product page (Eneba-style layout, CoreCart look) + reviews + region check, cart (desktop/tablet top-right popup, mobile centered popup, mobile sticky Add to cart + Buy now, cart page with coupon, summary, payment logos, trust block), then checkout/payments (Step 3).
Currency: 53-currency list from user (Codex research): AED ARS AUD AZN BDT BGN BHD BRL CAD CHF CLP CNY COP CRC CZK DKK DZD EUR GBP HKD HUF IDR ILS INR ISK JOD JPY KRW KWD KZT MAD MXN MYR NOK NZD PEN PHP PKR PLN QAR RON RUB SAR SEK SGD THB TND TRY UAH USD UYU UZS ZAR. Admin enables/disables each and marks chargeable; default USD; auto-pick by visitor country; base price THB; language English only for now. Header settings dropdown (Currency ›, Language, Help) with 3-column flag grid; mobile drawer with 2-column list. Flags as small SVG files.
Open decisions (asked, unanswered): BGN (Bulgaria on euro since 2026-01-01) and RUB (sanctions) handling; single seller vs marketplace; image storage; description editor; review rules; homepage section list; payment provider (Stripe/Omise/2C2P); coupon rules; login history retention.

Live mirror rule (2026-09-26, user): Playwright/test files stay out of `live/`; main folder + Git only. Removed `live/e2e`, `live/scripts`, `live/playwright.config.ts`. Rule added to `CLAUDE.md`.

## Handoff v4 (2026-09-26, Claude Code → new Claude Code session) — latest, use this one

Context note: previous session passed 250k tokens without a handoff (rule missed). Next session: estimate context at each major step and hand off before 250k.

PROJECT
- Folder (D: only): `D:\mstar companies\Game keys and ecommerce pc site`. Mirror `live/` inside it (Git-ignored); identical to main folder except test-only files (`e2e/`, `scripts/e2e.mjs`, `scripts/serve-out.mjs`, `playwright.config.ts`, `test-results/`, `playwright-report/`) and generated folders. Deploys come from GitHub, not from `live/`.
- GitHub: https://github.com/Cynicalfocus123/game-key-site- (`main`). Push to `main` → Actions builds static demo, runs Playwright, deploys Pages at `/game-key-site-/`. Claude can commit + push from this PC (git author still `Codex`). `gh` not installed (cannot read CI results).
- Business: game key + gift card + PC hardware marketplace (Eneba/G2A/Kinguin style), Bangkok. Roles: customer, seller (later), admin.

READ FIRST: `CLAUDE.md` (project rules), user rules `D:\dev\claude\CLAUDE.md` (all projects: no prompt suggestions, no question-card pop-ups, ask decisions in plain text, D: only), then `agents.md`, `design.md`, `code.md`, `weight.md` in full.

DONE THIS SESSION (all pushed, tree clean, last commit `cc0b9ed`)
- `72aeb86` docs handoff v3.
- `8685524` admin panel step 1: `/admin/login`, `/admin/register`, `/admin` overview (stats, 30-day sign-up chart, method breakdown, newest users), `/admin/users` (search/filter/sort/paging), `/admin/user?id=` (sessions + sign-in history). New `login_event` table + migration `drizzle/0001_admin_login_events.sql`. Admin = verified email AND (role admin OR in `ADMIN_EMAILS`). Demo mode has browser-only admin + 36 sample users. 27-check server test passed (esbuild bundle + temp PGlite in `D:\dev\tmp\corecart-admin-test`).
- `9ace902` Playwright: `@playwright/test` 1.63.0, Chromium in `D:\dev\playwright`, `npm run test:e2e` (builds demo, serves `out/` on 127.0.0.1:4173, user approved local runs), 18 tests (desktop + mobile) pass, 90/90 on repeat. CI runs tests before Pages deploy.
- `cc0b9ed` test files kept out of `live/`; rule in `CLAUDE.md`.
- Local only (Git-ignored): `.env.local` with `ADMIN_EMAILS=<owner email, see local file>` and random `BETTER_AUTH_SECRET` (copied to `live/`).
- Firecrawl installed then fully removed at user request. User PATH includes `D:\codex system\npm-global` (npm global prefix). App setting "Prompt suggestions" turned Off.
- Wireframes agreed (shown in chat, not saved): product detail page (Eneba layout, CoreCart look), admin products/editor/homepage sections, cart flow (desktop top-right popup, mobile centered popup, mobile sticky Add to cart + Buy now, cart page with coupon, summary, payment logos, trust block), currency selector (header settings dropdown → 3-column flag grid; mobile drawer → 2-column list), admin currencies table.

NEXT TASK (user wants this next, not started): exchange rates + currency selector across the whole site. Full prompt was given to user; summary:
- Seed 53 currencies (list in "Tooling + decisions" above). Decimals: 0 for JPY KRW CLP ISK; 3 for BHD JOD KWD TND; else 2. Default USD, base price THB, language English only.
- Rates: recommended ExchangeRate-API open endpoint `https://open.er-api.com/v6/latest/USD` (free, no key, daily, needs credit link), refresh ≤ daily in server mode, admin manual override, build-time JSON + committed fallback for Pages demo. Money in integer minor units.
- Auto-pick currency by country (`x-vercel-ip-country`; demo: browser language/timezone), fallback USD, choice saved in localStorage / account.
- One shared price formatter used everywhere. Non-chargeable currency → show exact charged amount in chargeable currency. Orders store currency, amount, rate.
- Playwright tests for switching currency (desktop + mobile, survives reload).

OPEN DECISIONS (ask in plain text, no pop-ups)
1. Rate source: auto daily (recommended) or manual.
2. Flags: OK to add 53 flag SVGs from MIT flag-icons via jsDelivr (~60 KB) into `public/images/flags/`.
3. Enabled at launch: all except BGN + RUB (recommended; Bulgaria uses euro since 2026-01-01, RUB sanctions) / all 53 / only AED USD THB.
4. Chargeable for now: USD THB AED (recommended) / all enabled.
5. Later steps: seller model, image storage, description editor, reviews rule, homepage section list, payment provider (Stripe/Omise/2C2P), coupon rules, login-history retention.

BUILD ORDER AFTER CURRENCY: catalog DB + admin products + key inventory → admin homepage sections → product page + reviews + region check → cart + coupons → checkout + payments + orders.

KNOWN ISSUES (not fixed): unescaped `user.name` in email HTML (`lib/server/email.ts`); `/login` `next` accepts `/\evil.com`; Google sign-up sets `termsAcceptedAt` without consent; Stripe routes lack try/catch; runtime migrations may race on serverless; wrong CPU/category placeholder images; homepage links `#`, cart count fixed; Geist via CSS `@import`; no Neon/Vercel/Resend/Google/Stripe keys yet.

TOOLING NOTES: npm is `npm.cmd` in PowerShell; npm cache `D:\dev\npm-cache`; builds need `NEXT_TELEMETRY_DISABLED=1` (telemetry write on C: fails EXDEV); temp work in `D:\dev\tmp`; use forward slashes for Windows paths in Node spawn env.

RULES: never delete files unless user says so; no installs unless asked; no heavy deps; no localhost unless asked (Playwright local runs approved); after every file change show `git -c color.ui=always --no-pager diff`; after every task update 4 docs, sync `live/`, commit, push `main`; caveman terse mode; no prompt suggestions or question cards; handoff before 250k tokens saved at end of `agents.md` (both folders).

## Phase 3 step 2 — exchange rates + currency selector (2026-09-26, Claude Code)

Decisions (user approved layout + motion; defaults applied, all admin-changeable): auto daily rates from ExchangeRate-API open endpoint + manual override; 53 flag SVGs (MIT flag-icons 7.5.0); enabled = all except BGN + RUB; chargeable = USD THB AED; default USD; base THB.
Built: 53 currencies (DB seeded on first use), server rate refresh (at most every 12 h, 1 h retry after failure, last good rates kept, runs after the response), admin `/admin/currencies`, header settings dropdown + currency panel (desktop/tablet), mobile drawer row + full-screen list, auto-pick by country, choice saved in localStorage + account, one shared formatter, THB-based homepage prices, orders store charged currency/amount/rate, footer credit "Rates by Exchange Rate API", build-time `public/rates.json` for Pages with committed fallback.
Not possible yet: cart/checkout do not exist. `ChargeNotice` ("You will be charged $X USD") is built for them; the currency panel already says when the chosen currency is not chargeable.
Tested: typecheck; server build; Pages build; server rates service on temp PGlite (seed, refresh, not-due skip, forced refresh, USD lock, override, validation, JP/DE suggestion); Playwright 27 passed (conversion + rounding unit checks THB→USD/JPY/KWD, desktop switch + reload, mobile switch + reload, auto-pick Bangkok, orders reference, admin disable JPY). Not tested: server-mode UI in a browser.

## Handoff v5 (2026-09-26, Claude Code → new session) — superseded by v6

PROJECT: `D:\mstar companies\Game keys and ecommerce pc site` (D: only), mirror `live/` (identical except test-only files). GitHub https://github.com/Cynicalfocus123/game-key-site- (`main`; push deploys Pages after Playwright).
READ FIRST: `CLAUDE.md`, `D:\dev\claude\CLAUDE.md`, then `agents.md`, `design.md`, `code.md`, `weight.md`.
DONE THIS SESSION: currency system (section above). Pushed: `39a21d8 feat: exchange rates + currency selector`, then docs commit "docs: handoff v5 status". Tree clean, `live/` verified identical (test files excluded). Pages deploy runs Playwright in CI; `gh` not installed, so check the Actions tab for the result.
OPEN DECISIONS (ask in plain text): create owner admin with `npm run admin:create` (user types password); seller model, image storage, description editor, review rules, homepage section list, payment provider (Stripe/Omise/2C2P), coupon rules, login-history retention; whether demo sample orders should charge the chosen chargeable currency (now always USD).
KNOWN ISSUES: drawer label "Under $10" not converted (category name); admin user detail sums order totals across currencies; `mxn.svg` flag is 85 KB; plus Handoff v4 list (email HTML escaping, `/login` next check, Google consent, Stripe try/catch, migration race, placeholder images, `#` links, fixed cart count, Geist `@import`, no Neon/Vercel/Resend/Google/Stripe keys).
NEXT (user order): catalog DB + admin products + key inventory → admin homepage sections → product page + reviews + region check → cart + coupons (use `Price`, `ChargeNotice`, `useCurrency().charge`) → checkout + payments + orders (store `currency`, `totalCents`, `baseTotalMinor`, `fxRate`, `ratesAt` server-side from `publicCurrencies()`).
ADMIN: no web sign-up for admins; server command `npm run admin:create`; demo admin `admin@corecart.demo` / `CoreCartDemoAdmin2026` (Pages only).
RULES: same as Handoff v4 RULES. Estimate context at each major step; hand off before 250k.

## Admin access lockdown (2026-09-26, user request)

User rules: no Google sign-in for admin; admin accounts are never created from the website; only admins can enter the admin panel; user must be able to enter the demo admin to test the dashboard.
Built: Google button removed from `/admin/login`; "Create admin account" link removed; `/admin/register` only forwards to `/admin/login` (file kept, no form). Server: admin = `role = admin` + verified email only; `ADMIN_EMAILS` allowlist removed (no auto-promotion on sign-up or sign-in; `.env.local` value is now unused); every sign-up is a customer; Better Auth hook blocks linking Google (or any non-password login) to an admin account. Admins are created on the server only: `npm run admin:create -- --email you@example.com --name "Your Name"` (hidden password prompt or `ADMIN_PASSWORD`, min 12; `--demote`; `--unlink-other-logins`; uses DATABASE_URL or local PGlite; stop `npm run dev` first for PGlite). Demo (GitHub Pages): built-in demo admin `admin@corecart.demo` / `CoreCartDemoAdmin2026`, shown with a "Fill demo admin" button on the demo sign-in page only (browser-only fake data).
Tested: typecheck; server build; Pages build; create-admin on temp PGlite (short password rejected, create, update + new password, demote + sessions cleared, missing account error, stored hash verifies with Better Auth `verifyPassword`); Playwright 31 passed (register address forwards, no Google/no create link, customer refused on admin sign-in, demo admin dashboard, currencies admin).
Open decision: should the local owner admin be created now with `npm run admin:create` (needs owner email + password typed by user)?

## Handoff v6 (2026-09-26, Claude Code → new session) — superseded by v7 (details still valid)

GOAL OF NEXT SESSION: review and agree the next task (Step 3: catalog database + admin products + key inventory) with the user before any code. Show a wireframe first (user asks for wireframes before building). Ask open decisions in plain text, no question cards.

PROJECT: `D:\mstar companies\Game keys and ecommerce pc site` (D: only). Mirror `live/` identical except test-only files (`e2e/`, `scripts/e2e.mjs`, `scripts/serve-out.mjs`, `playwright.config.ts`, `test-results/`, `playwright-report/`). GitHub https://github.com/Cynicalfocus123/game-key-site- (`main`); push → Actions builds demo, runs Playwright, deploys https://cynicalfocus123.github.io/game-key-site-/ . Deploy status readable without `gh`: `curl https://api.github.com/repos/Cynicalfocus123/game-key-site-/actions/runs?per_page=1`.
READ FIRST: `CLAUDE.md`, `D:\dev\claude\CLAUDE.md`, then `agents.md`, `design.md`, `code.md`, `weight.md` in full. Confirm git clean at the commit after `cecbbbe` ("docs: handoff v6") and `live/` byte match.

STATE (all pushed): Phase 1 homepage; Phase 2 accounts (Better Auth, demo + server modes); Phase 3 step 1 admin (overview, users, user detail, login history); currency system (53 currencies, THB base, USD default, ExchangeRate-API, `/admin/currencies`, header dropdown + mobile sheet, `Price`/`useCurrency`/`ChargeNotice`, orders store charged currency/amount/rate); admin lockdown (no admin sign-up or Google; `npm run admin:create`; demo admin `admin@corecart.demo` / `CoreCartDemoAdmin2026` on Pages only). Playwright: 31 passed.

HOW THE USER TESTS ADMIN
- Demo: https://cynicalfocus123.github.io/game-key-site-/admin/login/ → "Fill demo admin" → Sign in.
- Real server (local): `npm run admin:create -- --email <owner> --name "<name>"` (user types password), then `npm run dev`, open http://localhost:3000/admin/login . Local DB = PGlite `.data/pglite` (stop dev server before running admin:create). Customer verification links print in the dev terminal (no RESEND_API_KEY).

NEXT TASK TO REVIEW (Step 3, not started): catalog DB + admin products + key inventory.
Proposed scope for discussion: tables `product` (type game_key | gift_card | hardware, slug, title, description, platform, region, publisher, images, status draft/published), `product_variant` or edition (price THB satang, old price, stock mode), `game_key` inventory (encrypted key text, status available/reserved/sold, batch, cost, added_by), `category`, `region` (+ region lock rules); admin pages Products list (search, filters, status), Product editor (details, images, price THB with live currency preview, SEO), Key inventory (CSV upload, counts, reveal audit log), Categories/Regions; storefront homepage cards read from DB (server) / seed JSON (demo).
Decisions to ask: single store vs marketplace sellers now; image storage (Vercel Blob / Cloudflare R2 / Supabase Storage / local for now); description editor (plain text, Markdown, rich text); key encryption key location (env `KEY_ENCRYPTION_SECRET`); key CSV format; stock rules for hardware; which product fields are required; demo mode behaviour (seed catalog in JSON).
Later order: admin homepage sections → product page + reviews + region check → cart + coupons (use `Price`, `ChargeNotice`, `useCurrency().charge`) → checkout + payments (Stripe/Omise/2C2P decision) → key delivery → shipping.

OTHER OPEN DECISIONS: seller model; payment provider; coupon rules; review rules; login-history retention; demo sample orders charge currency (now USD); delete `app/admin/register/page.tsx` (now redirect only; needs explicit user OK).
KNOWN ISSUES (not fixed): drawer label "Under $10"; admin user detail sums totals across currencies; `mxn.svg` 85 KB; unescaped `user.name` in email HTML; `/login` `next` accepts `/\evil.com`; Google sign-up sets `termsAcceptedAt` without consent; Stripe routes lack try/catch; runtime migrations may race on serverless; wrong placeholder images; `#` links; fixed cart count; Geist via CSS `@import`; `.env.local` `ADMIN_EMAILS` unused; no Neon/Vercel/Resend/Google/Stripe keys.
TOOLING: npm is `npm.cmd` in PowerShell; npm cache `D:\dev\npm-cache`; builds need `NEXT_TELEMETRY_DISABLED=1`; temp in `D:\dev\tmp`; Playwright browsers `D:\dev\playwright`; this PC is in Bangkok time zone (tests that expect USD pin `America/New_York`); `tsc`/`next build` also type-check `live/`, so sync `live/` before building.
RULES: never delete files unless user says so; no installs unless asked; no heavy deps; no localhost unless asked (Playwright runs approved); show `git -c color.ui=always --no-pager diff` after file changes; after every task update 4 docs, sync `live/`, commit, push `main`; caveman terse; no prompt suggestions or question cards; wireframe first for UI work; estimate context at each major step, hand off before 250k (save at end of `agents.md`, both folders).

## Handoff v7 (2026-09-26, Claude Code → new session) — latest, use this one (replaces v6 goal)

GOAL OF NEXT SESSION: wireframes first, no code until the user approves them. Two areas, both requested by the user:
A) Cart (user says it was asked before and is still missing): Add to cart does nothing, header cart button shows nothing, cart page missing.
B) Customer dashboard redesign: sidebar with Balance, Orders, Keys library, Tickets; key detail page opened from every "View keys".
After wireframe approval: build A then B (or the order the user picks), with tests, docs, `live/` sync, commit, push.

REFERENCE SCREENSHOTS (user supplied, Eneba; copy the structure, keep CoreCart look: white, `#2563EB` blue, square corners, Geist, thin dividers — not Eneba purple). Saved Git-ignored, main folder only: `Claude outputs/references/`
- `ref-dashboard-overview.png`: left sidebar — My account (Overview, Login history), Balance (expand), Orders, Keys library, Tickets, Settings (expand). Overview page: breadcrumb "My account · Overview"; Profile card (avatar, name, email, edit pencil, "Complete your profile (33%)" bar, "2 of 6 tasks completed" ›); Total balance card ("$0.00", note "estimated based on the most recent conversion rate", Wallet overview button); Gift card balance row ("$0.00", + button, "Available to spend on CoreCart only"); Latest purchases (3 cover images, "View keys library" button).
- `ref-keys-library.png`: "My library": search "Search by product name / order id"; table: cover thumb, Date, Order ID, Product name, Seller, Price, "View keys" link per row.
- `ref-view-key-detail.png`: "Get your product" page: cover + title; facts row: Region (GLOBAL, "Check region restrictions"), Platform (STEAM, "Activation guide"), Product type (DIGITAL KEY, ? tooltip), Works on (Windows); "Digital product key" box: key text + copy button, "Activate on Steam" (yellow in ref; use CoreCart primary), "Print as a gift"; line "Don't want to use it now? You can always find the code in your Library" + My library button; refund note "Since it's a digital product and the key was displayed, you are not eligible for a refund unless the key is invalid or faulty."; seller block (name, rating %, "You rated as …"); "Report a problem" button (→ ticket).
- `ref-product-card-add-to-cart.png`: current homepage cards (THB prices, "Add to cart" button) — button has no handler yet.
- `ref-cart-wireframe.png`: cart wireframe agreed in an earlier chat: desktop/tablet top-right "Added to cart" popup under the cart icon (item rows with cover, title, "Steam · Global", × remove; Subtotal (N items); View cart + Checkout buttons; closes on ×, outside click, Esc, or after 6 s idle; hover/click cart icon reopens). Mobile: centered popup over dimmed page ("Added to cart", "You have 2 items in your cart", Continue shopping, View cart; tap outside closes). Mobile cart page, sections stacked: "Your cart (2)", item rows (title, price, "Steam · Windows", qty − 1 +, wishlist ♡, remove ×).
Earlier agreed cart plan (Handoff v4 / "Tooling + decisions"): cart page with coupon field, order summary, payment logos, trust block; mobile sticky Add to cart + Buy now on product pages.

CART WIREFRAME MUST COVER: header cart icon with live count; desktop popup; mobile popup; cart page desktop (items list left, summary right: subtotal, coupon, total in chosen currency, `ChargeNotice` "You will be charged $X USD" when currency not chargeable, Checkout button, payment logos, trust block) and mobile (stacked, sticky checkout bar); empty cart state; qty rules (game keys qty limit, stock); cart storage (guest: localStorage; signed in: account/server cart, merge on sign-in); demo vs server behaviour. Checkout itself is a later step (show button → "checkout coming next" or wireframe only).
DASHBOARD WIREFRAME MUST COVER: new sidebar (Overview, Login history, Balance, Orders, Keys library, Tickets, Payment methods, Settings); Overview cards; Balance page (wallet + gift card balance, history table, redeem gift card code); Keys library table + search; Key detail page (above, reveal marks key as viewed = no refund text honest); Tickets (list, new ticket form with order/key picker, ticket thread with replies, status open/answered/closed) + admin side Tickets list/reply; mobile layouts for all.

DECISIONS TO ASK (plain text, no question cards):
Cart: guest cart allowed? max qty per game key; coupon rules now or later; server cart table now or localStorage only until checkout.
Balance: real wallet (top-up, refunds as store credit) or display only for now; gift card codes (who issues, format, expiry); currency of balance (THB base shown converted).
Keys: key reveal = counts as "viewed" for refund rule? "Print as a gift" (printable page) now or later; activation guides per platform (static pages?).
Tickets: categories (order problem, key invalid, payment, account, other); attachments now or later (needs image storage); email notification on reply (needs Resend); admin reply UI in same step?
Seller column/rating: single store now → show "CoreCart" or hide Seller column until marketplace.
Profile completion %: which 6 tasks (name, verified email, avatar, country, currency, 2FA?).

CURRENT CODE FACTS (for planning): header cart button in `app/components/site-header.tsx` has fixed count `2`, no handler. Storefront cards in `app/storefront.tsx` (mock data, THB satang, `<Price>`), "Add to cart" button no handler. Account pages: `app/account/` (overview, orders, payment-methods, settings) with `AccountShell` sidebar in `app/components/account-shell.tsx`; orders have `demoKey` + `KeyReveal`. Money helpers: `useCurrency()` (`price`, `charge`, `format`), `ChargeNotice`, `formatMoney`, `convertMinor` (integer minor units). Demo API pattern: `lib/client/demo-api.ts` (localStorage) + `server-api.ts` + `types.ts` interfaces. No product catalog DB yet (Step 3 catalog was the previous plan; cart can start with mock products and switch to the catalog later — confirm with user).

STATE: all pushed; git clean after "docs: handoff v7"; `live/` identical (test files excluded). Tests 31 passed. Demo admin `admin@corecart.demo` / `CoreCartDemoAdmin2026` (Pages only); real admins `npm run admin:create`.
READ FIRST: `CLAUDE.md`, `D:\dev\claude\CLAUDE.md`, `agents.md` (Handoff v6 details still valid: tooling, known issues, rules), `design.md`, `code.md`, `weight.md`, then the 5 reference images.
RULES: wireframe first (inline visual), no code before approval; never delete files unless told; no installs unless asked; no heavy deps; no localhost unless asked (Playwright approved); show real git diff after changes; after every task update 4 docs, sync `live/`, commit, push `main`; caveman terse; no prompt suggestions or question cards; estimate context each major step, hand off before 250k.

## Handoff v8 (2026-09-26) — latest, use this one. Cart + checkout gate + customer dashboard: wireframes APPROVED, split into 2 parts

User approved all wireframes (A cart, B checkout gate, C dashboard). Build in 2 parts (see PARTS), one chat session each, in order. Each part: build, Playwright tests (desktop + mobile), update 4 docs, sync `live/`, show `git -c color.ui=always --no-pager diff`, commit, push `main`, then add a line under "PROGRESS" below ("Part N done: commit …, notes"). Wireframes were shown in chat only; this section is the spec. Reference images in `Claude outputs/references/` (Git-ignored): `ref-dashboard-overview`, `ref-keys-library`, `ref-view-key-detail`, `ref-product-card-add-to-cart`, `ref-cart-wireframe`, `ref-checkout-gate-desktop/mobile`, `ref-gate-register-desktop/mobile`, `ref-gate-signin-mobile`, `ref-gate-signin-desktop-split`, `ref-overview-purchases-old` (old Eneba-like card, replaced). Look = CoreCart (white, `#2563EB`, square corners, Geist, thin dividers), never Eneba purple or Fanatical orange.

DEFAULTS APPROVED: no guest checkout (account required to pay); guests can add to cart; guest cart = localStorage, exact items (product id, title, platform, region, qty, THB price) survive reload + browser restart; on register/sign-in merges into account cart (server table; same item → higher qty, capped; no duplicates); max 5 per game key per order, hardware ≤ stock; demo coupon `WELCOME10` = 10 % (real coupon admin later); cart uses current homepage mock products until catalog DB exists (stable product ids); `/checkout` = review page only ("Payment is coming in the next step"); wallet display only; gift card codes admin-issued `XXXX-XXXX-XXXX-XXXX`, optional expiry, stored THB, shown converted, redeem works; key hidden until "Reveal key", reveal time stored, refund note applies after; Print as a gift + static activation guides now; Seller column hidden, "Sold by CoreCart"; ticket categories Order problem / Key invalid or used / Payment / Account / Other; no attachments yet; reply email prints to terminal until Resend; admin tickets in same part as customer tickets; profile completion 6 = verified email, name, avatar, country, currency, deals choice; login history 90 days.
OPEN (ask at start of Part 1): user message cut off at "showing the exact item and…" — ask for the rest; header "Sign in" link opens the popup (suggest desktop popup, mobile `/login` page) or stays a page.

SPEC A — CART
A1 header cart icon live count (all tabs, `storage` event). A2 desktop/tablet popup under cart icon: "Added to cart" ✓, last 3 rows (cover, title, "Steam · Global · ×1", price, × remove), "and N more", Subtotal (N items), View cart + Checkout; closes on ×, outside click, Esc, 6 s idle; hover/click cart icon reopens. A3 mobile (<768) centered popup over dimmed page: icon, "Added to cart", "You have N items in your cart", Continue shopping (primary), View cart; tap outside closes. A4 Add to cart on every card (games too); button shows "Added ✓" 1.5 s; at limit "Limit reached". A5 `/cart` desktop: breadcrumb, "Your cart (N)", rows (cover, title, platform · OS · Instant key, region line "Global — works in Thailand", qty − n +, price, ♡ save, × remove, limit note), Continue shopping / Remove all; right summary: Subtotal, Shipping Free, coupon line with remove, coupon field + Apply, Total in chosen currency, `ChargeNotice` "You will be charged $X USD", Checkout, payment logos (VISA, Mastercard, AMEX, PromptPay as text badges), trust (Secure payment, Instant key delivery, Support tickets 24/7). A6 mobile: stacked, coupon collapsible, sticky bottom bar (Total + Checkout). A7 empty: icon, "Your cart is empty", Browse today's deals; signed out adds "Have an account? Sign in to see your saved cart". A8 `/checkout`: order review + info note + Back to cart; signed out or unverified → gate.

SPEC B — CHECKOUT GATE (one modal, views switch in place, focus trap, Esc/outside/× close)
B1 choice (every Checkout click while signed out: popup, cart page, sticky bar, `/checkout`): "Almost there", "Your keys are saved to your account, so we need to know who you are."; two columns: NEW TO CORECART / Create an account / Continue (primary) | RETURNING CUSTOMER / I already have an account / Sign in (outline); footer "N items · $X stay in your cart" + "Secure checkout". Signed in → straight to `/checkout`. Mobile stacks with "or".
B2/B3 register view: Back, lock "Create your account to check out", grey benefits strip (Keys safe in your library / Every order in one place / Support tickets), Email, Password (8+, eye toggle), Keep me signed in (checked), Email me CoreCart deals (optional, unchecked — PDPA), Create account, "or", Continue with Google, "By creating an account you agree to our Terms and Privacy policy.", footer bar "Already have an account?" + Sign in. No name/confirm field (name from email local part, editable later).
B4 sign-in view: Email, Password (eye), Keep me signed in + Forgot password?, Sign in, or, Google, inline error "Wrong email or password.", footer "New to CoreCart?" + Create account.
B5 check email: mail icon, "Check your email", "We sent a link to {email}. Open it in this browser to go straight to checkout with your cart.", "I've verified — sign in", Resend email; demo shows demo inbox link; unverified sign-in lands here.
B6 desktop/tablet (≥768) sign-in + register use split layout: form left, blue `#2563EB` panel right with promo artwork slot + "New to CoreCart?" / Create account (register view: "Already have an account?" / Sign in); × top-right. Mobile keeps single column (B3/B4). No Facebook, Fandom or magic link.

SPEC C — CUSTOMER DASHBOARD
C1 sidebar: My account (Overview, Login history), Balance, Orders, Keys library, Tickets (unread badge), Payment methods, Settings, Sign out; blue active bar. Overview: breadcrumb; Profile card (initials avatar, name, email, edit pencil, "Complete your profile (N%)" bar, "X of 6 tasks completed" ›); Total balance card (green amount, "Estimated from the most recent conversion rate.", Wallet overview) + Gift card balance row (+ → redeem); RECENT PURCHASES card (own design): header + "All orders ›", stats strip Keys owned | Not revealed (blue) ["On the way" added later with shipping], 3 rows (cover, title, "Steam · Global · 2 days ago", chip New key blue / Revealed grey, Reveal › / View ›), grey footer "N keys waiting" + Open keys library (primary); empty: box icon, "No purchases yet", Browse today's deals.
C2 Login history table (date, method, device, masked IP), 90 days, "Not you? Change password". C3 Balance: Wallet + Gift card tiles, redeem field, transactions table (Date, Type, Ref, Amount, Balance) with empty row. C4 Orders: restyled table (Date, Order ID, Items, Total, Status chip, Details ›), key items link to C6. C5 Keys library `/account/keys`: search "Search by product name / order ID", filter All · Not revealed · Revealed, table (cover, Date, Order ID, Product name + New chip, Price, View key / Reveal key), 20 per page, no Seller column. C6 key detail `/account/keys/view?id=`: breadcrumb, cover + title, facts Region (Check region restrictions) / Platform (Activation guide) / Product type (? tooltip) / Works on; masked key + Reveal key + "Revealing the key ends the refund window."; after reveal: key + copy (Copied ✓), Activate on {platform} (primary), Print as a gift, "Don't want to use it now? You can always find the code in your library." + My library; refund note; "Sold by CoreCart", revealed time, order id; Report a problem → new ticket prefilled. C7 print page (logo, "A gift for you", optional To/From/message, cover, title, key in dashed box, activation steps, black-and-white friendly, `window.print`). C8 `/help/activate/{steam,xbox,playstation,nintendo,ea,ubisoft}` static steps. C9 Tickets list (#, Subject, Status chip Open amber / Answered green / Closed grey) + New ticket form (Category, Order/key picker, Subject, Message, Send). C10 thread (messages; support messages with blue left bar; reply box; Close ticket; Reply). C11 admin `/admin/tickets` (search, status, category; #, customer, subject, order, status, last reply) + `/admin/ticket?id=` (thread + side panel customer/order/key revealed time + status select). Admin reply → Answered; customer reply → Open. C12 mobile: section dropdown replaces sidebar; tables become cards; key facts 2×2; full-width buttons.

PARTS — user decision 2026-09-26: build in TWO parts only (one chat each; hand off mid-part if context nears 250k):
- PART 1 = Cart + checkout gate (spec A + B; old steps 1–2). LARGE.
- PART 2 = Customer dashboard + admin tickets + gift cards + polish (spec C; old steps 3–7). VERY LARGE; expect a handoff mid-way, continue in a new chat from PROGRESS. Build order inside: shell/overview/login history/orders → keys library/key detail/print/guides → balance/gift cards → tickets customer + admin → polish + `/code-review`.
Old step detail (still valid as checklist):
1. Cart core — MEDIUM. Cart model + storage (guest localStorage; server `cart_item` table + API; demo localStorage), merge on sign-in, header count, Add to cart on cards, A2/A3 popups, A5–A7 cart page, WELCOME10, limits, A8 `/checkout` placeholder. Tests: add, count, popups, qty/limit, remove, coupon, reload keeps exact items, empty state, currency switch.
2. Checkout gate — MEDIUM. B1–B6 modal, short register (email + password), rememberMe, Google, B5 verify flow (demo inbox), return to `/checkout`, cart merge after register/sign-in. Tests: gate every time signed out, skipped signed in, register → verify → checkout with same items, sign in → merged items, errors, mobile layout.
3. Dashboard shell + Overview + Login history + Orders restyle — MEDIUM. C1 sidebar + C12 mobile menu, profile fields (avatar, country) migration, profile completion, Recent purchases card, C2, C4.
4. Keys library + key detail — MEDIUM-LARGE. Per-key records (order item keys, `revealed_at`, reveal audit), APIs, C5, C6 reveal/copy, C7 print, C8 guides; Report a problem links to Tickets placeholder until Part 6.
5. Balance + gift cards — MEDIUM. `wallet_ledger`, `gift_card` tables, redeem API (rate limited), C3, overview balance numbers, small admin `/admin/gift-cards` (create, list, disable).
6. Tickets customer + admin — LARGE (may need 2 sessions: 6a customer, 6b admin). `ticket`, `ticket_message` tables, APIs, C9–C11, unread badge, Report a problem prefill, terminal email on reply, demo mode.
7. Polish + review — SMALL. Check every screen vs spec at 390/768/1280, accessibility, `/code-review`, known issues, final handoff.

PROGRESS
- (none yet)
