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
