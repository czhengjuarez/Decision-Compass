import { FACTORS, FACTOR_BY_ID, STYLES, MODELS, resolve, factorRelevance } from './model.js';
import { analyzeScenario, CONFIDENCE_LABEL } from './analyzer.js';

/* ------------------------------------------------------------------ */
/* state                                                               */
/* ------------------------------------------------------------------ */

const state = {
  scenario: '',
  model: 'time', // 'time' | 'dev'
  mode: 'guided', // 'guided' | 'machine'
  answers: {}, // factorId -> 'H' | 'L'
  inferred: null, // analyzer output for machine mode
  saved: false, // current run already written to history
};

const HISTORY_KEY = 'dc.history.v1';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveToHistory(entry) {
  const items = loadHistory();
  const key = JSON.stringify([entry.model, entry.answers]);
  if (items[0] && JSON.stringify([items[0].model, items[0].answers]) === key) return;
  items.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 12)));
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const app = document.getElementById('app');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function go(route) { location.hash = route; }

function encodeShare() {
  const a = Object.entries(state.answers).map(([k, v]) => k + v).join('.');
  const p = new URLSearchParams({ m: state.model, a });
  if (state.scenario) p.set('s', state.scenario.slice(0, 600));
  return `${location.origin}${location.pathname}#/result?${p.toString()}`;
}

function decodeShare(qs) {
  const p = new URLSearchParams(qs);
  const m = p.get('m');
  if (!MODELS[m]) return false;
  const answers = {};
  for (const part of (p.get('a') || '').split('.')) {
    const mm = part.match(/^([a-z]{3})(H|L)$/);
    if (mm && FACTOR_BY_ID[mm[1]]) answers[mm[1]] = mm[2];
  }
  state.model = m;
  state.answers = answers;
  state.scenario = p.get('s') || '';
  state.saved = false;
  return true;
}

const ICON_COMPASS = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;

/*
 * Ask the Worker's AI endpoint to read the scenario; fall back to the
 * local keyword analyzer if the call fails so the flow always works.
 */
async function analyzeWithAI(scenario) {
  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const out = await res.json();
    if (!out.factors) throw new Error('bad payload');
    if (!Object.keys(out.factors).length) {
      // AI read nothing usable — let the keyword analyzer try, but keep
      // any insight the AI produced.
      const local = analyzeScenario(scenario);
      return { ...out, factors: local.factors, modelHint: out.modelHint || local.modelHint };
    }
    return out; // { source:'ai', insight, factors, modelHint }
  } catch (err) {
    console.warn('AI analysis unavailable, using local analyzer:', err);
    return { source: 'local', insight: '', ...analyzeScenario(scenario) };
  }
}

function toneBadge(style) {
  const s = STYLES[style];
  return `<span class="of-badge of-badge--${s.tone}">${esc(s.name)}</span>`;
}

/* ------------------------------------------------------------------ */
/* layout                                                              */
/* ------------------------------------------------------------------ */

function shell(active, inner) {
  return `
  <header class="topbar">
    <a class="brand" href="#/">
      <span class="brand__mark">${ICON_COMPASS}</span>
      <span>
        <span class="brand__name">Decision Compass</span><br/>
        <span class="brand__sub">Vroom decision model</span>
      </span>
    </a>
    <nav class="topbar__nav">
      <a href="#/" class="${active === 'home' ? 'active' : ''}">New decision</a>
      <a href="#/styles" class="${active === 'styles' ? 'active' : ''}">The five styles</a>
      <a href="#/about" class="${active === 'about' ? 'active' : ''}">About the model</a>
    </nav>
  </header>
  ${inner}
  <footer class="foot">
    <span>Decision matrices © Victor H. Vroom, 2020 · Built with the Keel design system</span>
    <span>Not advice — a structured way to think.</span>
  </footer>`;
}

/* ------------------------------------------------------------------ */
/* home                                                                */
/* ------------------------------------------------------------------ */

function renderHome() {
  const history = loadHistory();
  app.innerHTML = shell('home', `
  <section class="hero">
    <p class="kicker">How should this decision be made?</p>
    <h1>Pick the right level of team involvement, before you pick the answer.</h1>
    <p>Victor Vroom's research shows the best decision <em>process</em> — from deciding alone to fully delegating — depends on the situation. Describe yours, answer a short triage, and get a recommended process.</p>
  </section>

  <div class="stack">
    <div class="of-field">
      <label class="of-label" for="scenario">Your scenario <span class="muted">(optional for the guided path, needed for analysis)</span></label>
      <textarea id="scenario" class="of-textarea" rows="5"
        placeholder="e.g. We need to pick a new on-call rotation. The team is senior and works well together, but people have strong opinions and will resist anything imposed on them. No hard deadline...">${esc(state.scenario)}</textarea>
      <span class="of-field__hint">Mention stakes, deadline, how much you and the team each know, trust, and how well the team works together — the more signals, the better the analysis.</span>
    </div>

    <div>
      <p class="of-label" style="margin-bottom: var(--of-space-2)">What matters more right now?</p>
      <div class="grid-2" id="model-pick">
        ${Object.values(MODELS).map((m) => `
          <button class="model-pick" data-model="${m.id}" aria-pressed="${state.model === m.id}">
            <h3>${esc(m.name)}</h3>
            <p>${esc(m.blurb)}</p>
          </button>`).join('')}
      </div>
    </div>

    <div class="row no-print">
      <button id="btn-guided" class="of-btn of-btn--primary of-btn--lg">Guide me step by step</button>
      <button id="btn-machine" class="of-btn of-btn--secondary of-btn--lg">Analyze my scenario for me</button>
    </div>

    ${history.length ? `
    <div class="stack--tight stack" id="history-list" style="margin-top: var(--of-space-6)">
      <div class="spread">
        <p class="of-label">Recent decisions</p>
        <button id="btn-clear-history" class="of-btn of-btn--ghost of-btn--sm">Clear</button>
      </div>
      ${history.map((h, i) => `
        <button class="history-item" data-hist="${i}">
          <span class="history-item__scenario">${esc(h.scenario || '(no scenario text)')}</span>
          <span class="row" style="gap:8px; flex-wrap: nowrap;">
            <span class="subtle">${esc(MODELS[h.model].short)}</span>
            ${toneBadge(h.style)}
          </span>
        </button>`).join('')}
    </div>` : ''}
  </div>`);

  const ta = document.getElementById('scenario');
  ta.addEventListener('input', () => { state.scenario = ta.value; });

  document.getElementById('model-pick').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-model]');
    if (!btn) return;
    state.model = btn.dataset.model;
    for (const b of document.querySelectorAll('[data-model]')) {
      b.setAttribute('aria-pressed', String(b === btn));
    }
  });

  document.getElementById('btn-guided').addEventListener('click', () => {
    state.mode = 'guided';
    state.answers = {};
    state.inferred = null;
    state.saved = false;
    go('#/triage');
  });

  document.getElementById('btn-machine').addEventListener('click', async (e) => {
    if (state.scenario.trim().split(/\s+/).filter(Boolean).length < 8) {
      alert('Write a few sentences about your situation first — the analyzer needs something to read.');
      ta.focus();
      return;
    }
    const btn = e.currentTarget;
    btn.disabled = true;
    const phrases = ['Reading your scenario…', 'Weighing stakes and expertise…', 'Checking team dynamics…', 'Almost there…'];
    let phraseIndex = 0;
    const spinnerLabel = document.createElement('span');
    btn.textContent = '';
    btn.insertAdjacentHTML('afterbegin', '<span class="of-spinner" aria-hidden="true"></span>');
    btn.appendChild(spinnerLabel);
    spinnerLabel.textContent = phrases[0];
    const cycle = setInterval(() => {
      phraseIndex = (phraseIndex + 1) % phrases.length;
      spinnerLabel.textContent = phrases[phraseIndex];
    }, 1400);
    state.mode = 'machine';
    state.answers = {};
    state.saved = false;
    state.inferred = await analyzeWithAI(state.scenario);
    clearInterval(cycle);
    if (state.inferred.modelHint) state.model = state.inferred.modelHint.model;
    for (const [id, v] of Object.entries(state.inferred.factors)) state.answers[id] = v.answer;
    go('#/review');
  });

  const clear = document.getElementById('btn-clear-history');
  if (clear) clear.addEventListener('click', () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHome();
  });

  const list = document.getElementById('history-list');
  if (list) list.addEventListener('click', (e) => {
    const item = e.target.closest('[data-hist]');
    if (!item) return;
    const h = loadHistory()[Number(item.dataset.hist)];
    if (!h) return;
    Object.assign(state, {
      scenario: h.scenario, model: h.model, answers: { ...h.answers },
      mode: 'guided', inferred: null, saved: true,
    });
    go('#/result');
  });
}

/* ------------------------------------------------------------------ */
/* guided triage                                                       */
/* ------------------------------------------------------------------ */

function trailHTML(path, current) {
  const chips = path.map(({ factor, answer }) => `
    <button class="trail__chip" data-revisit="${factor}" title="Change this judgment">
      ${esc(FACTOR_BY_ID[factor].name)} <span class="hl">${answer === 'H' ? 'High' : 'Low'}</span>
    </button>`);
  if (current) {
    chips.push(`<span class="trail__chip trail__chip--now">${esc(FACTOR_BY_ID[current].name)}</span>`);
  }
  return `<div class="trail">${chips.join('')}</div>`;
}

function renderTriage() {
  const r = resolve(MODELS[state.model].tree, state.answers);
  if (r.style) { go('#/result'); return; }

  const f = FACTOR_BY_ID[r.need];
  const inferredHere = state.inferred?.factors?.[f.id] || null;

  app.innerHTML = shell('home', `
  <div class="stack">
    <div class="spread">
      <div>
        <p class="kicker">${esc(MODELS[state.model].name)} · question ${r.path.length + 1}</p>
      </div>
      <button id="btn-restart" class="of-btn of-btn--ghost of-btn--sm">Start over</button>
    </div>

    ${trailHTML(r.path, f.id)}

    ${state.scenario ? `<div class="scenario-peek">${esc(state.scenario.slice(0, 400))}${state.scenario.length > 400 ? '…' : ''}</div>` : ''}

    <div class="of-card q-card">
      <p class="kicker q-card__factor">${esc(f.name)}</p>
      <h2>${esc(f.question)}</h2>
      <p class="q-card__help">${esc(f.help)}</p>
      <div class="hl-buttons">
        <button class="hl-btn ${inferredHere?.answer === 'H' ? 'hl-btn--suggested' : ''}" data-answer="H">
          <span class="hl-btn__tag">HIGH${inferredHere?.answer === 'H' ? ' · suggested from your scenario' : ''}</span>
          <span class="hl-btn__label">${esc(f.high)}</span>
        </button>
        <button class="hl-btn ${inferredHere?.answer === 'L' ? 'hl-btn--suggested' : ''}" data-answer="L">
          <span class="hl-btn__tag">LOW${inferredHere?.answer === 'L' ? ' · suggested from your scenario' : ''}</span>
          <span class="hl-btn__label">${esc(f.low)}</span>
        </button>
      </div>
    </div>

    <p class="subtle">The triage follows Vroom's matrix like a funnel — it only asks the factors that matter on your current path, so the number of questions varies (2–7).</p>
  </div>`);

  for (const btn of document.querySelectorAll('[data-answer]')) {
    btn.addEventListener('click', () => {
      state.answers[f.id] = btn.dataset.answer;
      renderTriage();
    });
  }
  bindTrailAndRestart(renderTriage);
}

function bindTrailAndRestart(rerender) {
  for (const chip of document.querySelectorAll('[data-revisit]')) {
    chip.addEventListener('click', () => {
      delete state.answers[chip.dataset.revisit];
      state.saved = false;
      if (rerender === renderTriage) renderTriage(); else go('#/triage');
    });
  }
  const restart = document.getElementById('btn-restart');
  if (restart) restart.addEventListener('click', () => {
    state.answers = {};
    state.saved = false;
    go('#/');
  });
}

/* ------------------------------------------------------------------ */
/* machine review                                                      */
/* ------------------------------------------------------------------ */

function renderReview() {
  if (!state.inferred) { go('#/'); return; }
  const inf = state.inferred.factors;
  const found = Object.keys(inf).length;
  const r = resolve(MODELS[state.model].tree, state.answers);
  const rel = factorRelevance(MODELS[state.model].tree, state.answers);
  const hint = state.inferred.modelHint;
  const isAI = state.inferred.source === 'ai';

  app.innerHTML = shell('home', `
  <div class="stack">
    <div>
      <p class="kicker">${isAI ? 'AI scenario analysis' : 'Scenario analysis (offline mode)'}</p>
      <h1 class="page-title">${found ? `I could read ${found} of 7 factors from your scenario` : 'Your scenario didn’t give me enough signals'}</h1>
      ${!isAI ? `<p class="subtle" style="margin-top: var(--of-space-2)">The AI analyzer wasn’t reachable, so this used simple keyword matching — judgments may be rougher than usual.</p>` : ''}
    </div>

    <div class="scenario-peek">${esc(state.scenario.slice(0, 500))}${state.scenario.length > 500 ? '…' : ''}</div>

    ${state.inferred.insight ? `
    <div class="of-card insight">
      <p class="of-card__kicker kicker" style="margin-bottom: var(--of-space-2)">Reading of your situation</p>
      <p class="muted" style="font-size: var(--of-text-sm)">${esc(state.inferred.insight)}</p>
    </div>` : ''}

    ${hint ? `<p class="subtle">Model: <strong>${esc(MODELS[hint.model].name)}</strong> looks right — ${hint.reason
      ? esc(hint.reason)
      : `your scenario mentions ${(hint.evidence || []).map((e) => `<em>“${esc(e)}”</em>`).join(', ')}`}. Change it below if that’s wrong.</p>` : ''}

    <div class="grid-2" id="model-pick">
      ${Object.values(MODELS).map((m) => `
        <button class="model-pick" data-model="${m.id}" aria-pressed="${state.model === m.id}">
          <h3>${esc(m.name)}</h3>
          <p>${esc(m.blurb)}</p>
        </button>`).join('')}
    </div>

    <div class="of-card">
      ${FACTORS.map((f) => {
        const v = inf[f.id];
        const current = state.answers[f.id];
        const skipped = rel.status[f.id] === 'skipped';
        const detail = v
          ? `${esc(CONFIDENCE_LABEL[v.confidence])}${v.evidence.length ? `: ${v.evidence.map((e) => `<em>“${esc(e)}”</em>`).join(' · ')}` : ''}${v.note ? ` — ${esc(v.note)}` : ''}`
          : 'no signal in the scenario — I’ll ask if the matrix needs it';
        return `
        <div class="infer ${skipped ? 'infer--skipped' : ''}">
          <div>
            <div class="infer__name">${esc(f.name)}
              ${skipped ? '<span class="of-badge of-badge--default infer__skip-badge">skipped by the matrix</span>' : ''}
            </div>
            <div class="infer__evidence">${skipped
              ? 'given your other judgments, the matrix never consults this factor on this path'
              : detail}</div>
          </div>
          <span class="seg ${skipped ? 'seg--disabled' : ''}" data-factor="${f.id}">
            <button data-v="H" aria-pressed="${current === 'H'}" ${skipped ? 'disabled' : ''}>High</button>
            <button data-v="" aria-pressed="${current == null}" ${skipped ? 'disabled' : ''}>?</button>
            <button data-v="L" aria-pressed="${current === 'L'}" ${skipped ? 'disabled' : ''}>Low</button>
          </span>
        </div>`;
      }).join('')}
    </div>

    <div class="row no-print">
      <button id="btn-continue" class="of-btn of-btn--primary of-btn--lg">
        ${r.style ? 'See the recommendation' : `Continue — answer what’s missing`}
      </button>
      <button id="btn-restart" class="of-btn of-btn--ghost">Start over</button>
    </div>
    <p class="subtle">${r.style
      ? 'Your scenario covered everything the matrix needs on this path.'
      : 'The matrix still needs at least one judgment your scenario didn’t reveal — I’ll only ask what’s required.'}</p>
  </div>`);

  document.getElementById('model-pick').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-model]');
    if (!btn) return;
    state.model = btn.dataset.model;
    renderReview();
  });

  for (const seg of document.querySelectorAll('.seg[data-factor]')) {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const id = seg.dataset.factor;
      if (b.dataset.v) state.answers[id] = b.dataset.v; else delete state.answers[id];
      state.saved = false;
      renderReview();
    });
  }

  document.getElementById('btn-continue').addEventListener('click', () => {
    const rr = resolve(MODELS[state.model].tree, state.answers);
    go(rr.style ? '#/result' : '#/triage');
  });
  bindTrailAndRestart(null);
}

/* ------------------------------------------------------------------ */
/* result                                                              */
/* ------------------------------------------------------------------ */

function renderResult() {
  const r = resolve(MODELS[state.model].tree, state.answers);
  if (!r.style) { go('#/triage'); return; }

  const s = STYLES[r.style];
  const other = MODELS[state.model === 'time' ? 'dev' : 'time'];
  const or = resolve(other.tree, state.answers);

  if (!state.saved) {
    saveToHistory({
      ts: Date.now(),
      scenario: state.scenario,
      model: state.model,
      answers: { ...state.answers },
      style: r.style,
    });
    state.saved = true;
  }

  const styleOrder = ['decide', 'consult_ind', 'consult_grp', 'facilitate', 'delegate'];

  app.innerHTML = shell('home', `
  <div class="stack">
    <div class="spread no-print">
      <p class="kicker">${esc(MODELS[state.model].name)} · recommendation</p>
      <span class="row">
        <button id="btn-share" class="of-btn of-btn--secondary of-btn--sm">Copy share link</button>
        <button id="btn-print" class="of-btn of-btn--secondary of-btn--sm">Print / PDF</button>
        <button id="btn-restart" class="of-btn of-btn--ghost of-btn--sm">New decision</button>
      </span>
    </div>

    <article class="of-card of-card--brand-elevated result-hero">
      <p class="of-card__kicker">Recommended process</p>
      <h2>${esc(s.name)}</h2>
      <div class="of-card__rule"></div>
      <p>${esc(s.tagline)}</p>
    </article>

    <div class="spectrum" title="Where this sits on the involvement spectrum">
      ${styleOrder.map((id) => `<span class="${id === s.id ? 'on' : ''}">${esc(STYLES[id].name)}</span>`).join('')}
    </div>

    ${state.scenario ? `<div class="scenario-peek">${esc(state.scenario.slice(0, 400))}${state.scenario.length > 400 ? '…' : ''}</div>` : ''}

    ${state.inferred?.insight ? `
    <div class="of-card insight">
      <p class="of-card__kicker kicker" style="margin-bottom: var(--of-space-2)">AI reading of your situation</p>
      <p class="muted" style="font-size: var(--of-text-sm)">${esc(state.inferred.insight)}</p>
    </div>` : ''}

    <div class="grid-2">
      <div class="of-card style-card">
        <h3>What this looks like</h3>
        <p class="muted" style="margin: var(--of-space-2) 0 var(--of-space-3); font-size: var(--of-text-sm);">${esc(s.detail)}</p>
        <ul class="behaviors">${s.behaviors.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      </div>

      <div class="of-card style-card">
        <h3>Your judgment trail</h3>
        <p class="subtle" style="margin: var(--of-space-2) 0 var(--of-space-1);">Flip any judgment to see how the recommendation changes.</p>
        <div class="trail-review">
          ${r.path.map(({ factor, answer }) => `
          <div class="infer">
            <div class="infer__name">${esc(FACTOR_BY_ID[factor].name)}</div>
            <span class="seg" data-flip="${factor}">
              <button data-v="H" aria-pressed="${answer === 'H'}">High</button>
              <button data-v="L" aria-pressed="${answer === 'L'}">Low</button>
            </span>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="compare">
      <p class="of-label" style="margin-bottom: var(--of-space-2)">What would the ${esc(other.name)} say?</p>
      ${or.style
        ? (or.style === r.style
          ? `<p class="muted">Same answer: ${toneBadge(or.style)} — both models agree here, so the trade-off between speed and team development doesn’t change the process.</p>`
          : `<p class="muted">Different answer: ${toneBadge(or.style)}. ${state.model === 'time'
              ? 'If you can afford the time, the more participative process would also grow your team.'
              : 'If you’re short on time, the faster process still protects quality and commitment.'}
             <button id="btn-swap" class="of-btn of-btn--tint of-btn--sm" style="margin-left:8px">View that path</button></p>`)
        : `<p class="muted">It would need ${or.path.length ? 'a few more judgments' : 'more judgments'} — <button id="btn-swap" class="of-btn of-btn--tint of-btn--sm">answer them</button> to compare.</p>`}
    </div>
  </div>`);

  document.getElementById('btn-share').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(encodeShare());
      e.target.textContent = 'Copied!';
      setTimeout(() => { e.target.textContent = 'Copy share link'; }, 1600);
    } catch {
      prompt('Copy this link:', encodeShare());
    }
  });
  document.getElementById('btn-print').addEventListener('click', () => window.print());
  document.getElementById('btn-restart').addEventListener('click', () => {
    state.answers = {};
    state.saved = false;
    go('#/');
  });

  for (const seg of document.querySelectorAll('.seg[data-flip]')) {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      state.answers[seg.dataset.flip] = b.dataset.v;
      state.saved = false;
      renderResult();
    });
  }

  const swap = document.getElementById('btn-swap');
  if (swap) swap.addEventListener('click', () => {
    state.model = other.id;
    state.saved = false;
    const rr = resolve(other.tree, state.answers);
    go(rr.style ? '#/result' : '#/triage');
    if (rr.style) renderResult();
  });
}

/* ------------------------------------------------------------------ */
/* five styles cheat sheet                                             */
/* ------------------------------------------------------------------ */

function renderStyles() {
  const order = ['decide', 'consult_ind', 'consult_grp', 'facilitate', 'delegate'];
  app.innerHTML = shell('styles', `
  <div class="stack">
    <div>
      <p class="kicker">Reference</p>
      <h1 class="page-title">The five decision styles</h1>
      <p class="muted" style="margin-top: var(--of-space-2); max-width: 62ch;">A spectrum of team involvement — from you deciding alone to the team deciding for itself. None is “best”: each fits different situations, which is exactly what the triage works out.</p>
    </div>
    <div class="spectrum">
      <span>Leader decides</span><span></span><span>Shared</span><span></span><span>Team decides</span>
    </div>
    <div class="stack stack--tight">
      ${order.map((id) => {
        const s = STYLES[id];
        return `
        <div class="of-card style-card">
          <div class="spread">
            <h3>${esc(s.name)}</h3>
            ${toneBadge(id)}
          </div>
          <p class="muted" style="margin: var(--of-space-2) 0 var(--of-space-3); font-size: var(--of-text-sm);">${esc(s.detail)}</p>
          <ul class="behaviors">${s.behaviors.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
        </div>`;
      }).join('')}
    </div>
  </div>`);
}

/* ------------------------------------------------------------------ */
/* about                                                               */
/* ------------------------------------------------------------------ */

function renderAbout() {
  app.innerHTML = shell('about', `
  <div class="stack about">
    <div>
      <p class="kicker">Background</p>
      <h1 class="page-title">About the Vroom decision model</h1>
    </div>
    <p>Victor Vroom (Yale School of Management), first with Philip Yetton (1973) and later Arthur Jago, spent decades studying a deceptively simple question: <strong>how much should a leader involve the team in a decision?</strong> Their answer: it depends on the situation — and the situational factors can be pinned down precisely enough to put in a matrix.</p>
    <p>This app implements the two matrices from Vroom's revised (2020) model:</p>
    <div class="grid-2">
      ${Object.values(MODELS).map((m) => `
      <div class="of-card style-card">
        <h3>${esc(m.name)}</h3>
        <p class="muted" style="margin-top: var(--of-space-2); font-size: var(--of-text-sm);">${esc(m.blurb)}</p>
      </div>`).join('')}
    </div>
    <p>Both matrices read the same seven situational factors — decision significance, importance of commitment, leader expertise, likelihood of commitment, goal alignment, group expertise, and team competence — but weigh them differently. The Time-Driven model treats meetings as a cost; the Development-Driven model treats them as an investment.</p>
    <div class="of-card style-card">
      <h3>The original 1973 decision tree</h3>
      <p class="muted" style="margin: var(--of-space-2) 0 var(--of-space-4); font-size: var(--of-text-sm);">The earlier Vroom–Yetton model asked seven yes/no questions and mapped to styles labeled AI, AII, CI, CII, and GII — the ancestors of today's Decide, Consult, Facilitate, and Delegate.</p>
      <img src="/vroom_yetton_decision_model1b.jpg" alt="Vroom-Yetton 1973 decision tree: questions Q1–Q7 branching to decision styles AI, AII, CI, CII, GII" loading="lazy" />
    </div>
    <p class="subtle">Decision matrices © Victor H. Vroom, 2020. This tool is an educational aid, not a substitute for judgment.</p>
  </div>`);
}

/* ------------------------------------------------------------------ */
/* router                                                              */
/* ------------------------------------------------------------------ */

function route() {
  const hash = location.hash || '#/';
  const [path, qs] = hash.slice(1).split('?');
  window.scrollTo(0, 0);
  switch (path) {
    case '/triage': return renderTriage();
    case '/review': return renderReview();
    case '/result':
      if (qs && !Object.keys(state.answers).length) decodeShare(qs);
      return renderResult();
    case '/styles': return renderStyles();
    case '/about': return renderAbout();
    default: return renderHome();
  }
}

window.addEventListener('hashchange', route);
route();
