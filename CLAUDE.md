# CLAUDE.md — CoreCart (game key site)

Rules for every Claude session and task on this project. Read this file first, then `agents.md`, `design.md`, `code.md`, `weight.md`.

## Hard rules
- Never delete any file unless the user explicitly says so.
- Do not install anything into the project folder unless the user asks.
- No heavy dependencies. No localhost launch unless the user asks.
- Main folder `D:\mstar companies\Game keys and ecommerce pc site` and `live/` must stay identical at all times. Copy every changed file to both, verify byte match.
- Exception: test-only files stay out of `live/` (main folder + Git only): `e2e/`, `scripts/e2e.mjs`, `scripts/serve-out.mjs`, `scripts/smoke-server.mjs`, `playwright.config.ts`, `test-results/`, `playwright-report/`. `package.json` stays identical (it lists `@playwright/test` as a dev dependency, never shipped).
- After every task, small or big: update all four docs, sync `live/`, commit, push `main` (user runs git in normal PowerShell until Claude has git access).
- After every file change, show the real diff: `git -c color.ui=always --no-pager diff`. Additions green, deletions red. Never only summarize an edit.
- Tests on desktop AND mobile, always (user rule 2026-09-27). Every feature gets Playwright tests that run on both projects. Skip one device only when the test is truly minimal there (pure math with no screen, or UI that does not exist on that device AND a matching test covers the other device). Every skip needs a written reason in the test. Every test report to the user lists each skipped test by name with its reason, never just a count.
- Backend changes are tested on the real server too (localhost `npm run dev` + local PGlite, user allowed 2026-09-27): smoke-test every new or changed API and check the values really saved, not only the status code. Typecheck alone is not a test.
- Local test links, always (user rule 2026-09-27): at the start of every chat and after every task, make sure the local server is running (`npm run dev` / `start-backend.cmd` / preview "corecart-dev"; only one server) and give the user a table of localhost links for BOTH frontend and backend on the same server: store http://localhost:3000, product http://localhost:3000/product?id=key-elden-ring-steam, cart /cart, checkout /checkout, register /register, login /login, dashboard /account, balance /account/balance, admin /admin/login, plus the pages the task changed. Admin: admin@corecart.test (password set by the user). Still sync every change to live/ and Git (commit + push main) as always.
- Prompt suggestions off for all projects and tasks (`"promptSuggestionEnabled": false`). Do not offer suggested next prompts.
- D: drive only. C: has limited space. All project files, installs (`node_modules`), caches (npm cache `D:\dev\npm-cache`), databases (`.data/`), builds and tool data (Claude Code config `D:\dev\claude` via `CLAUDE_CONFIG_DIR`) go on D:. Never put installs, downloads or large files on C:.

## Context handoff
- Before the conversation context reaches 250k tokens, stop and write a handoff prompt for a new chat session.
- Handoff prompt includes: project path + GitHub repo, current phase and step, what was finished this session, files changed, what is pending (including unpushed commits), open decisions, and these rules.
- Save the handoff at the end of `agents.md` (both folders) so the next session can read it.

## Token saving (Caveman full mode)
Active until user says `stop caveman`, `normal mode`, or changes level.
- Terse. No filler, pleasantries, repeated summaries, decorative tables, emojis.
- No tool-call narration or progress preambles.
- Preserve technical meaning, commands, API names, numbers, exact errors.
- Never remove `no`, `not`, `never`, `only`, `except`. No invented abbreviations.
- Short sentences; clarity beats compression. Stay in user's language.
- Normal prose for security, irreversible actions, ambiguity. No duplicate explanation.

## Project
- GitHub: https://github.com/Cynicalfocus123/game-key-site- (`main`). Push to `main` deploys GitHub Pages demo.
- Stack: Next.js 15.5 App Router, React 19.1, TypeScript, plain CSS, Better Auth, Drizzle ORM, PostgreSQL (Neon) / PGlite locally.
- Two build modes: GitHub Pages = static demo (browser-only mock accounts). Server (`npm run dev`, later Vercel) = real auth + database.
