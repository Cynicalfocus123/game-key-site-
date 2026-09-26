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
