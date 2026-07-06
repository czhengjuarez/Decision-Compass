# AGENTS.md

Instructions for AI coding agents working in this repo. See `README.md` for the human-facing overview and `PLAN.md` for the full design spec and decision-table transcription.

## Project shape

- **No build step, no npm dependencies.** Plain HTML/CSS/JS served as static assets by a Cloudflare Worker. Do not add a bundler, package.json dependencies, or a framework — this is a deliberate constraint, not an oversight.
- Keel design system CSS (`public/css/keel-tokens.css`, `public/css/keel.css`) is **copied** from the Keel repo, not installed as a package. Only edit `public/css/app.css` for app-specific styling; treat the other two as vendored files and only refresh them by re-copying from source, not hand-editing.
- The single backend route is `POST /api/analyze` in `src/worker.js`. Everything else is served by the Worker's `assets` binding straight from `public/`.

## Commands

- Local dev: `npx wrangler dev` (real `AI` binding — Workers AI calls hit remote inference and can incur usage even locally).
- Deploy: `npx wrangler deploy` → `decision-compass.coscient.workers.dev`.
- No test suite or linter is configured. Verify changes by running the app in a browser (`npx wrangler dev`) and exercising both the guided triage and the AI scenario analysis flows.

## Decision engine (`public/js/model.js`)

- `TIME_DRIVEN` and `DEV_DRIVEN` are nested decision trees transcribed **1:1** from Victor Vroom's source spreadsheet (see `PLAN.md` §4 for the full table). Do not "simplify" or restructure these trees — if a table looks wrong, check it against the transcription in `PLAN.md` before changing it.
- `resolve()` walks a tree with the answers collected so far; `factorRelevance()` figures out which of the seven factors are used/next/possible/skipped on the current path so the UI can gray out irrelevant questions. Both are pure functions — keep them that way.
- The seven factor ids are fixed: `sig, com, lex, lik, gal, gex, tco` (`FUNNEL_ORDER`). The five decision styles are fixed: `decide, consult_ind, consult_grp, facilitate, delegate`. These ids are load-bearing across `model.js`, `analyzer.js`, `app.js`, and `worker.js` — renaming one means updating all four.

## Workers AI integration (`src/worker.js`)

- Uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast` with `response_format: json_schema` and `temperature: 0.1`.
- **`max_tokens` must stay at 2048 or higher.** Lower budgets cause the model to fail constrained decoding with `AiError 5024 ("JSON Model couldn't be met")`. This was found the hard way — don't lower it to save cost.
- The worker retries once if the first call throws or returns all-`U` (unknown) answers — this recovers most transient failures. Keep this retry; don't remove it as "dead code."
- The frontend (`analyzeWithAI` in `public/js/app.js`) always has a fallback: if `/api/analyze` fails or returns nothing usable, it falls back to the local keyword analyzer (`public/js/analyzer.js`) so the flow never hard-blocks the user. Preserve this fallback path in any change to the AI flow.

## Frontend conventions (`public/js/app.js`)

- Single-file SPA: hash-based routing, one `state` object, template-literal rendering into `#app`. No virtual DOM, no component framework — keep new UI in this style rather than introducing one.
- Styling uses Keel's `--of-*` design tokens and `of-*` utility classes (buttons, cards, badges, fields) defined in `keel-tokens.css`/`keel.css`. Reach for those before writing new raw CSS in `app.css`.
- The brand mark is an inline SVG compass icon (`ICON_COMPASS` in `app.js`, reused as the page favicon in `index.html`) — if you touch the brand mark, keep both in sync.
- Theme (Light/Dark/System) is `data-mode` on `<html>` + `localStorage['theme']`, applied in `applyTheme()`. Because every Keel token already uses `light-dark(...)`, the toggle only needs to flip the computed `color-scheme` (see `:root[data-mode='light'|'dark']` in `app.css`) — never duplicate hex values per mode.

## Interactive decision trees (`treeViz.js`, `tree1973.js`, `tree2020.js`)

- `treeViz.js` is a generic engine: give it a `{q, no, yes}`/`{leaf}` tree plus `questions`/`styles`/`edgeLabels`/`legend`, and it lays out (position derived from tree shape, not hand-placed), renders an SVG, and wires up hover/focus/click-to-pin-a-path interactivity. `tree1973.js` and `tree2020.js` are thin data modules on top of it — put new trees there, not new copies of the engine.
- `tree2020.js`'s trees are **generated from `model.js`'s `TIME_DRIVEN`/`DEV_DRIVEN`** via a small converter, not hand-transcribed — this guarantees the About-page diagrams can never drift from the actual decision logic. If `model.js`'s trees change, these update automatically.
- `tree1973.js`'s tree **was** hand-transcribed (from a historical chart, no source data file existed) and cross-checked to produce exactly 14 terminal outcomes matching the classic Vroom-Yetton group-problem tree. Don't "clean up" its branch order — the `first: 'yes'` overrides on some nodes intentionally reproduce the original chart's visual order, not an arbitrary choice.
- **The `<svg>` must have explicit `width`/`height` attributes matching the `viewBox`**, not just `viewBox` alone. Relying on CSS `width:100%; height:auto` with no intrinsic size attributes causes the browser to recompute the aspect ratio unstably during reflow — this shipped once and looked like the diagram "shrinking or jumping" on hover. Verified fixed with a scripted Playwright hover/click sweep (0px delta across every node/leaf); if you touch sizing here again, re-verify the same way rather than eyeballing it.
- The diagram intentionally lives inside `.app`'s normal 880px column (no full-bleed breakout) so it left-aligns with the surrounding copy — it's fully fluid (scales via `viewBox`, no min-width) so it doesn't need extra width.

## Code style

- No comments except where they explain a non-obvious constraint (e.g. the `max_tokens` note above). Don't add docstrings or restate what the code already says.
- Match existing formatting (no semicolon-free style, template literals for HTML, `const`/arrow functions).
