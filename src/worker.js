/*
 * Decision Compass Worker: serves static assets (handled by the assets
 * binding before this code runs) and exposes POST /api/analyze, which
 * reads a scenario with Workers AI and returns structured judgments on
 * Vroom's seven situational factors.
 */

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const FACTOR_DEFS = `
- sig (Decision Significance): High if the decision is critical to project/organization success with lasting consequences; Low if stakes are modest or easily corrected.
- com (Importance of Commitment): High if implementation depends on the team genuinely buying in; Low if compliance is enough to execute.
- lex (Leader Expertise): High if the LEADER personally has the knowledge/experience to judge the options well alone; Low if the leader is missing important knowledge.
- lik (Likelihood of Commitment): High if the team would commit to a decision the leader made alone (high trust); Low if a unilateral call risks resistance or half-hearted execution.
- gal (Goal Alignment): High if the team shares the organizational goals at stake; Low if individual or departmental agendas may diverge.
- gex (Group Expertise): High if the TEAM collectively has the knowledge/expertise on this problem; Low if the team would be guessing.
- tco (Team Competence): High if the group is skilled and committed at working together as a unit to solve problems; Low if collaboration is new or rocky.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    insight: {
      type: 'string',
      description: 'Two or three sentences reading the situation as a decision-process problem: what kind of decision this is, where the tension is, what to watch out for. Address the leader as "you". No style recommendation.',
    },
    factors: {
      type: 'object',
      properties: Object.fromEntries(
        ['sig', 'com', 'lex', 'lik', 'gal', 'gex', 'tco'].map((id) => [id, {
          type: 'object',
          properties: {
            answer: { type: 'string', enum: ['H', 'L', 'U'], description: 'H=High, L=Low, U=cannot tell from the scenario' },
            confidence: { type: 'integer', description: '1 weak, 2 moderate, 3 strong' },
            evidence: { type: 'string', description: 'Short phrase (under 12 words) quoted from the scenario supporting the judgment. Empty if answer is U.' },
            note: { type: 'string', description: 'One short sentence of reasoning. Empty if answer is U.' },
          },
          required: ['answer', 'confidence', 'evidence', 'note'],
        }])
      ),
      required: ['sig', 'com', 'lex', 'lik', 'gal', 'gex', 'tco'],
    },
    modelHint: {
      type: 'string',
      enum: ['time', 'dev', 'none'],
      description: 'time if the scenario signals urgency/deadline pressure; dev if it signals team growth matters more than speed; none if unclear.',
    },
    hintReason: { type: 'string', description: 'One short sentence for the model hint; empty if none.' },
  },
  required: ['insight', 'factors', 'modelHint', 'hintReason'],
};

const SYSTEM_PROMPT = `You analyze leadership decision scenarios using Victor Vroom's normative decision model. You never recommend a decision style yourself — you only judge the seven situational factors so a decision matrix can do that.

The factors (judge each strictly from what the scenario says or clearly implies — use U when the text genuinely does not say):
${FACTOR_DEFS}

Judge every factor the scenario speaks to, even indirectly — most scenarios reveal at least three factors. Reserve U for factors the text says nothing about; do not answer U for everything. An inference the scenario does not support is worse than a U, but a clearly supported judgment must not be dodged. Keep evidence phrases under 12 words and take them from the scenario text. Notes are one sentence, plain language.`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function runModel(env, scenario) {
  const result = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Scenario:\n"""\n${scenario}\n"""\n\nJudge the seven factors.` },
    ],
    response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
    temperature: 0.1,
    max_tokens: 2048,
  });
  return typeof result.response === 'string' ? JSON.parse(result.response) : result.response;
}

async function analyze(env, scenario) {
  // Constrained decoding occasionally fails (error 5024) or answers U
  // across the board; one retry recovers most of those cases.
  const readable = (o) => Object.values(o?.factors || {}).filter((v) => v?.answer === 'H' || v?.answer === 'L').length;
  let out;
  try {
    out = await runModel(env, scenario);
  } catch (err) {
    console.warn('first AI attempt failed, retrying:', err.message);
  }
  if (!out || readable(out) === 0) out = await runModel(env, scenario);

  // Normalize into the shape the frontend's local analyzer already uses.
  const factors = {};
  for (const [id, v] of Object.entries(out.factors || {})) {
    if (!v || v.answer !== 'H' && v.answer !== 'L') continue;
    factors[id] = {
      answer: v.answer,
      confidence: Math.min(3, Math.max(1, v.confidence | 0)),
      evidence: v.evidence ? [v.evidence] : [],
      note: v.note || '',
    };
  }
  return {
    source: 'ai',
    insight: out.insight || '',
    factors,
    modelHint: out.modelHint && out.modelHint !== 'none'
      ? { model: out.modelHint, reason: out.hintReason || '', evidence: [] }
      : null,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/analyze') {
      if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
      let scenario = '';
      try {
        ({ scenario = '' } = await request.json());
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }
      scenario = String(scenario).trim().slice(0, 4000);
      if (scenario.split(/\s+/).filter(Boolean).length < 8) {
        return json({ error: 'Scenario too short to analyze' }, 422);
      }
      try {
        return json(await analyze(env, scenario));
      } catch (err) {
        console.error('AI analyze failed:', err);
        return json({ error: 'AI analysis unavailable' }, 502);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};
