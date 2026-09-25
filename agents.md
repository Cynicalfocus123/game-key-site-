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
