# Decision Compass

An interactive web app implementing **Victor Vroom's normative decision model** (2020 revision) — it helps a leader choose *how* to make a decision (from deciding alone to fully delegating), based on seven situational factors.

Live at **https://decision-compass.coscient.workers.dev**

## What it does

Two ways to get a recommendation:

- **Guided triage** — pick a model (Time-Driven or Development-Driven) and answer one factor question at a time (High/Low). The funnel skips any factor the matrix doesn't actually need for your path.
- **AI scenario analysis** — write a few sentences about your situation and Workers AI reads it, judges each of the seven factors with quoted evidence, and pre-fills the triage. If the API is unreachable, a client-side keyword analyzer takes over automatically so the flow still works offline.

Both paths land on a result screen showing the recommended process (Decide / Consult Individually / Consult Group / Facilitate / Delegate), the judgment trail, what the *other* model would have recommended, and a shareable link. Recent runs are saved to `localStorage` as a decision history.

## Tech stack

- No build step, no npm dependencies. Plain HTML/CSS/JS served as static assets.
- [Keel](https://github.com/) design system CSS is **copied**, not installed — see `public/css/keel-tokens.css` and `public/css/keel.css`.
- Backend is a single Cloudflare Worker (`src/worker.js`) that only handles `POST /api/analyze`, calling Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) with a structured JSON schema. Everything else is served by the Worker's static assets binding.

## Project structure

```
DecisionModel/
├── PLAN.md                     # design/spec notes, decision tables transcribed from source spreadsheet
├── AGENTS.md                   # instructions for AI coding agents working in this repo
├── wrangler.jsonc               # Cloudflare Worker config (static assets + AI binding)
├── src/
│   └── worker.js                # POST /api/analyze — Workers AI scenario analysis
└── public/
    ├── index.html                # single-page app shell
    ├── vroom_yetton_decision_model1b.jpg
    ├── css/
    │   ├── keel-tokens.css       # copied from Keel repo
    │   ├── keel.css              # copied from Keel repo
    │   └── app.css               # app layout on top of Keel tokens/components
    └── js/
        ├── model.js               # both decision tables + factor/style definitions (data only)
        ├── analyzer.js            # client-side scenario → factor inference heuristics (fallback)
        └── app.js                 # SPA state machine, routing, rendering, history/share
```

## Run locally

```
npx wrangler dev
```

Opens the app at `http://localhost:8787` with the real `AI` binding (Workers AI calls hit Cloudflare's remote inference, so they can incur usage even in local dev).

## Deploy

```
npx wrangler deploy
```

Deploys to `decision-compass.coscient.workers.dev` under the account configured in `wrangler.jsonc`.

## Source of truth for the model

The two decision tables (Time-Driven and Development-Driven) are transcribed 1:1 from Victor Vroom's matrices and encoded as nested trees in `public/js/model.js`. See `PLAN.md` for the full table transcription and the reasoning behind each UX decision.
