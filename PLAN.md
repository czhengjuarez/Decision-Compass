# Decision Model App — Plan

> **Status: shipped** — live at https://decision-compass.coscient.workers.dev
> Deploy with `npx wrangler deploy`; local dev with `npx wrangler dev`.
>
> **Update (Jul 2026): Workers AI integration.** "Analyze my scenario" now calls
> `POST /api/analyze` (`src/worker.js`), which runs `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
> with a structured JSON schema (temperature 0.1, max_tokens 2048 — lower budgets cause
> AiError 5024 "JSON Model couldn't be met"; one retry on failure/all-unknown). Returns
> per-factor H/L/U with confidence, quoted evidence, one-line reasoning, a model hint, and
> an overall insight paragraph. The keyword analyzer (`analyzer.js`) remains as automatic
> fallback when the API is unreachable or reads nothing. The review screen grays out
> factors the matrix can never consult on the current path (`factorRelevance` in model.js).

An interactive web app implementing **Victor Vroom's normative decision model** (2020 revision), helping leaders choose *how* to make a decision — from deciding alone to delegating — based on seven situational factors.

## 1. Source of truth

- **Spreadsheet** (`vroom.xlsx`, from the shared Google Sheet) — two tabs, decoded into exact decision tables:
  - **Time-Driven Model** — minimizes time/cost; value on the clock.
  - **Development-Driven Model** — maximizes team growth; value on development.
- Both matrices funnel through 7 situational factors (each judged **High** or **Low**, some skipped depending on path):
  1. Decision Significance
  2. Importance of Commitment
  3. Leader Expertise
  4. Likelihood of Commitment
  5. Goal Alignment
  6. Group Expertise
  7. Team Competence
- Five possible recommendations: **Decide · Consult (Individually) · Consult (Group) · Facilitate · Delegate**
- The classic 1973 Vroom-Yetton tree is rebuilt as data + an interactive SVG (`public/js/tree1973.js`) in the "About the model" section — hover/tap a question or outcome for an explanation, click an outcome to trace its path.

## 2. User flows

### Flow A — Guided triage (user decides step by step)
1. User optionally writes their scenario (kept visible as context).
2. Picks a model (Time-Driven vs Development-Driven) with a plain-language explainer of when each applies — or "not sure" defaults to showing both at the end.
3. Answers one factor question at a time (High / Low), with plain-language help text per factor. The funnel **skips factors the matrix doesn't need** on the current path, exactly like the spreadsheet.
4. Gets a final recommendation card with: the process, what it means concretely, the judgment trail, and what the *other* model would have said.

### Flow B — Machine suggestion (scenario analysis)
1. User writes their scenario in free text.
2. A client-side analyzer scans it for signals on each of the 7 factors (keyword/phrase heuristics, e.g. "deadline/urgent" → time pressure; "they know more than me" → leader expertise Low; "new team/don't trust each other" → team competence Low).
3. Factors it can infer are pre-filled with a confidence note and shown for review (user can flip any of them); factors it cannot infer are asked as short questions — only the ones the matrix actually needs.
4. If the scenario gives enough info, the user can jump straight to the suggestion; otherwise the app says exactly what's missing.

## 3. Architecture

Keep it dependency-free — no build step, no npm packages (Keel is consumed by copying its CSS, not installed):

```
DecisionModel/
├── PLAN.md
├── wrangler.jsonc              # Cloudflare Worker config (static assets)
└── public/
    ├── index.html              # single-page app shell
    ├── css/
    │   ├── keel-tokens.css     # copied from Keel repo tokens/tokens.css
    │   ├── keel.css            # copied from Keel packages/keel/src/styles.css
    │   └── app.css             # app layout, using only --of-* tokens / of-* classes
    └── js/
        ├── model.js            # both decision tables + factor/style definitions (data only)
        ├── analyzer.js         # scenario → factor inference heuristics
        ├── tree1973.js          # 1973 Vroom-Yetton tree data + interactive SVG renderer
        └── app.js              # SPA state machine, routing, rendering, history/share
```

- **Decision engine**: each model is a nested decision table transcribed 1:1 from the spreadsheet tabs; a resolver walks it with the current answers and reports either a recommendation or the next factor needed.
- **Look & feel**: Keel design system (Ops Forward) — magenta brand, `light-dark()` auto dark mode, Space Grotesk display font, `of-card`/`of-btn`/`of-badge`/`of-field` components; overall page structure referencing lbd.
- **Deploy**: Cloudflare Worker with static assets binding (`npx wrangler deploy`), same account as lbd.

## 4. Decision tables (transcribed from spreadsheet)

Legend: H/L = user judgment, `–` = skipped, → = recommendation.

**Time-Driven** (Sig, Commit-Importance, Leader-Exp, Commit-Likelihood, Goal-Align, Group-Exp, Team-Comp):
- H H H H – – – → Decide
- H H H L H H H → Facilitate; …H H L → Consult (Group); …H L – → Consult (Group); …L – – → Consult (Group)
- H H L H H H H → Facilitate; …H H L → Consult (Individually); …H L – → Consult (Individually); …L – – → Consult (Individually)
- H H L L H H H → Facilitate; …H H L → Consult (Group); …H L – → Consult (Group); …L – – → Consult (Group)
- H L H – – – – → Decide
- H L L – H H H → Facilitate; …H H L → Consult (Individually); …H L – → Consult (Individually); …L – – → Consult (Individually)
- L H – H – – – → Decide
- L H – L – – H → Delegate; …L → Facilitate
- L L – – – – – → Decide

**Development-Driven**:
- H H – H H H H → Delegate; …H H L → Facilitate; …H L – → Consult (Group); …L – – → Consult (Group)
- H H – L H H H → Delegate; …H H L → Facilitate; …H L – → Facilitate; …L – – → Consult (Group)
- H L – – H H H → Delegate; …H H L → Facilitate; …H L – → Consult (Group); …L – – → Consult (Group)
- L H – H – – – → Decide
- L H – L – – – → Delegate
- L L – – – – – → Decide

## 5. Extra features (beyond the core ask)

- **Both-models comparison** on the result screen — when the two models disagree, that's the interesting insight (time cost vs. development payoff).
- **Shareable link** — answers encoded in the URL hash so a recommendation can be sent to a colleague.
- **Decision history** — recent triages saved to localStorage with scenario snippet, model, and outcome; revisit/re-run any of them.
- **Judgment trail** — the result shows every H/L call made, each one clickable to jump back and flip it ("what if commitment weren't an issue?").
- **Style cheat-sheet page** — the five processes explained with concrete meeting-level behaviors.
- **Print/export** — a clean print stylesheet so a result page can be saved as PDF for a decision log.
- **Auto dark mode** — free via Keel's `light-dark()` tokens.

## 6. Execution order

1. Write this plan (done).
2. Scaffold `public/`, copy Keel CSS, build app shell.
3. Encode both decision tables + factor/style content in `model.js`; verify resolver against every spreadsheet row.
4. Build guided triage flow, then scenario analyzer flow.
5. Result screen with comparison, trail, share, history.
6. Local check with `npx wrangler dev`, then deploy with `npx wrangler deploy`.
