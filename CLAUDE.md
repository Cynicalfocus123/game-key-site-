# CLAUDE.md — CoreCart (game key site)

Rules for every Claude session and task on this project. Read this file first, then `agents.md`, `design.md`, `code.md`, `weight.md`.

## Hard rules
- Never delete any file unless the user explicitly says so.
- Do not install anything into the project folder unless the user asks.
- No heavy dependencies. No localhost launch unless the user asks.
- Main folder `D:\mstar companies\Game keys and ecommerce pc site` and `live/` must stay identical at all times. Copy every changed file to both, verify byte match.
- After every task, small or big: update all four docs, sync `live/`, commit, push `main` (user runs git in normal PowerShell until Claude has git access).
- After every file change, show the real diff: `git -c color.ui=always --no-pager diff`. Additions green, deletions red. Never only summarize an edit.
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
