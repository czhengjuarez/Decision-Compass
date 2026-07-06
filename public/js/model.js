/*
 * Vroom normative decision model (2020 revision).
 * Decision tables transcribed 1:1 from Victor Vroom's matrices
 * (Time-Driven and Development-Driven), © Victor H. Vroom, 2020.
 *
 * A table is a nested tree keyed by factor id. Each node:
 *   { factor: 'sig', H: <node|string>, L: <node|string> }
 * A string leaf is a decision-style id. A node may use '*' meaning
 * "this branch resolves regardless of remaining factors".
 */

export const FACTORS = [
  {
    id: 'sig',
    name: 'Decision Significance',
    question: 'How significant is this decision to the success of your project or organization?',
    help: 'High: the decision is critical — a wrong call has serious, lasting consequences. Low: the stakes are modest and the outcome is easily corrected.',
    high: 'Highly significant — critical to success',
    low: 'Low significance — modest stakes',
  },
  {
    id: 'com',
    name: 'Importance of Commitment',
    question: 'How important is your team’s commitment to this decision?',
    help: 'High: implementation depends on people genuinely buying in. Low: the decision can be executed even if the team merely complies.',
    high: 'Essential — execution needs real buy-in',
    low: 'Not critical — compliance is enough',
  },
  {
    id: 'lex',
    name: 'Leader Expertise',
    question: 'How much knowledge or expertise do you personally have on this problem?',
    help: 'High: you have the information and experience to judge the options well on your own. Low: you are missing important knowledge others may have.',
    high: 'High — I know this problem well',
    low: 'Low — I’m missing important knowledge',
  },
  {
    id: 'lik',
    name: 'Likelihood of Commitment',
    question: 'If you made the decision by yourself, how likely is it that the team would commit to it anyway?',
    high: 'High — they would trust and support my call',
    low: 'Low — a unilateral call risks resistance',
    help: 'High: the team trusts you enough to get behind whatever you decide. Low: deciding alone would likely produce pushback or half-hearted execution.',
  },
  {
    id: 'gal',
    name: 'Goal Alignment',
    question: 'Does the team share the organizational goals at stake in this problem?',
    high: 'High — we’re after the same outcome',
    low: 'Low — individual agendas may diverge',
    help: 'High: team members want the same organizational outcome you do. Low: personal or departmental interests could pull the decision off course.',
  },
  {
    id: 'gex',
    name: 'Group Expertise',
    question: 'How much knowledge or expertise does the team have on this problem?',
    high: 'High — they know this domain well',
    low: 'Low — the team lacks relevant expertise',
    help: 'High: collectively, the team has the information and skill to evaluate the options. Low: the team would be guessing.',
  },
  {
    id: 'tco',
    name: 'Team Competence',
    question: 'How skilled and committed is the team at working together as a unit to solve problems?',
    high: 'High — an effective, cohesive problem-solving team',
    low: 'Low — collaboration is new or rocky',
    help: 'High: the group can run a productive problem-solving process together. Low: the group struggles to collaborate effectively.',
  },
];

export const FACTOR_BY_ID = Object.fromEntries(FACTORS.map((f) => [f.id, f]));

export const STYLES = {
  decide: {
    id: 'decide',
    name: 'Decide',
    badge: 'A',
    tone: 'blue',
    tagline: 'You make the decision alone and announce or sell it to the team.',
    detail:
      'Make the call yourself using the information you have or can gather. Then take responsibility for announcing it — or selling it — to the group. You may use others as information sources, but you don’t ask them to generate or evaluate solutions.',
    behaviors: [
      'Gather any facts you still need directly.',
      'Make the decision on your own timeline.',
      'Communicate it clearly, with the reasoning behind it.',
    ],
  },
  consult_ind: {
    id: 'consult_ind',
    name: 'Consult (Individually)',
    badge: 'CI',
    tone: 'purple',
    tagline: 'You present the problem to members one-on-one, then decide yourself.',
    detail:
      'Talk to team members individually, share the problem, and collect their suggestions — without bringing the group together. The final decision remains yours, and it may or may not reflect their input.',
    behaviors: [
      'Hold one-on-one conversations, not a group meeting.',
      'Present the problem, listen, and probe for suggestions.',
      'Decide yourself and close the loop with everyone.',
    ],
  },
  consult_grp: {
    id: 'consult_grp',
    name: 'Consult (Group)',
    badge: 'CG',
    tone: 'purple',
    tagline: 'You present the problem in a meeting, gather ideas, then decide yourself.',
    detail:
      'Bring the team together, present the problem, and collect everyone’s suggestions in open discussion. Then make the decision yourself, which may or may not reflect their input.',
    behaviors: [
      'Run a real discussion, not an announcement meeting.',
      'Make clear up front that you will make the final call.',
      'Explain afterwards how the input shaped the decision.',
    ],
  },
  facilitate: {
    id: 'facilitate',
    name: 'Facilitate',
    badge: 'F',
    tone: 'amber',
    tagline: 'You chair a group decision, defining constraints without pushing your own ideas.',
    detail:
      'Present the problem to the group in a meeting and act as facilitator: define the boundaries the decision must fit within, keep the discussion honest, and seek concurrence. Your ideas get no more weight than anyone else’s.',
    behaviors: [
      'State the constraints (budget, deadline, policy) up front.',
      'Facilitate — don’t advocate. Weigh your ideas equally with others’.',
      'Drive toward a decision the group genuinely agrees on.',
    ],
  },
  delegate: {
    id: 'delegate',
    name: 'Delegate',
    badge: 'D',
    tone: 'green',
    tagline: 'The group makes the decision within limits you set; you support from behind the scenes.',
    detail:
      'Hand the problem to the group. Let them diagnose it, generate alternatives, and decide within prescribed limits. Your role is behind the scenes: provide resources, encouragement, and the boundaries — not the answer.',
    behaviors: [
      'Define the limits, then step out of the room.',
      'Provide resources and remove obstacles when asked.',
      'Accept the group’s decision if it fits the limits.',
    ],
  },
};

/* Order in which factors are considered (the matrix funnel, left to right). */
export const FUNNEL_ORDER = ['sig', 'com', 'lex', 'lik', 'gal', 'gex', 'tco'];

/*
 * Time-Driven Model — value on time: pick the most autocratic process
 * that still protects decision quality and commitment.
 */
export const TIME_DRIVEN = {
  factor: 'sig',
  H: {
    factor: 'com',
    H: {
      factor: 'lex',
      H: {
        factor: 'lik',
        H: 'decide',
        L: {
          factor: 'gal',
          H: {
            factor: 'gex',
            H: { factor: 'tco', H: 'facilitate', L: 'consult_grp' },
            L: 'consult_grp',
          },
          L: 'consult_grp',
        },
      },
      L: {
        factor: 'lik',
        H: {
          factor: 'gal',
          H: {
            factor: 'gex',
            H: { factor: 'tco', H: 'facilitate', L: 'consult_ind' },
            L: 'consult_ind',
          },
          L: 'consult_ind',
        },
        L: {
          factor: 'gal',
          H: {
            factor: 'gex',
            H: { factor: 'tco', H: 'facilitate', L: 'consult_grp' },
            L: 'consult_grp',
          },
          L: 'consult_grp',
        },
      },
    },
    L: {
      factor: 'lex',
      H: 'decide',
      L: {
        factor: 'gal',
        H: {
          factor: 'gex',
          H: { factor: 'tco', H: 'facilitate', L: 'consult_ind' },
          L: 'consult_ind',
        },
        L: 'consult_ind',
      },
    },
  },
  L: {
    factor: 'com',
    H: {
      factor: 'lik',
      H: 'decide',
      L: { factor: 'tco', H: 'delegate', L: 'facilitate' },
    },
    L: 'decide',
  },
};

/*
 * Development-Driven Model — value on development: pick the most
 * participative process the situation can safely support.
 */
export const DEV_DRIVEN = {
  factor: 'sig',
  H: {
    factor: 'com',
    H: {
      factor: 'lik',
      H: {
        factor: 'gal',
        H: {
          factor: 'gex',
          H: { factor: 'tco', H: 'delegate', L: 'facilitate' },
          L: 'consult_grp',
        },
        L: 'consult_grp',
      },
      L: {
        factor: 'gal',
        H: {
          factor: 'gex',
          H: { factor: 'tco', H: 'delegate', L: 'facilitate' },
          L: 'facilitate',
        },
        L: 'consult_grp',
      },
    },
    L: {
      factor: 'gal',
      H: {
        factor: 'gex',
        H: { factor: 'tco', H: 'delegate', L: 'facilitate' },
        L: 'consult_grp',
      },
      L: 'consult_grp',
    },
  },
  L: {
    factor: 'com',
    H: { factor: 'lik', H: 'decide', L: 'delegate' },
    L: 'decide',
  },
};

export const MODELS = {
  time: {
    id: 'time',
    name: 'Time-Driven Model',
    short: 'Time-Driven',
    tree: TIME_DRIVEN,
    blurb:
      'Puts a premium on time and cost. Recommends the most autocratic process that still protects decision quality and team commitment — right for deadline pressure and one-off decisions.',
  },
  dev: {
    id: 'dev',
    name: 'Development-Driven Model',
    short: 'Development-Driven',
    tree: DEV_DRIVEN,
    blurb:
      'Puts a premium on growing your team. Recommends the most participative process the situation can safely support — right when building capability matters more than speed.',
  },
};

/*
 * Walk a model tree with the answers given so far.
 * answers: { factorId: 'H' | 'L' }
 * Returns { style, path } when resolved, or { need, path } when the
 * next factor on this branch is unanswered. path lists the factors
 * actually consulted, in order, with the judgment used.
 */
export function resolve(tree, answers) {
  const path = [];
  let node = tree;
  while (typeof node !== 'string') {
    const ans = answers[node.factor];
    if (ans !== 'H' && ans !== 'L') {
      return { need: node.factor, path };
    }
    path.push({ factor: node.factor, answer: ans });
    node = node[ans];
  }
  return { style: node, path };
}

/* All factors a model could ever ask, given current answers (for progress UI). */
export function nextQuestion(modelId, answers) {
  return resolve(MODELS[modelId].tree, answers);
}

/*
 * Classify every factor for the current partial answers:
 *   'used'     — consulted on the path as answered so far
 *   'next'     — the judgment the matrix needs right now
 *   'possible' — might still be consulted, depending on later answers
 *   'skipped'  — cannot be consulted on any completion of this path
 * Works by enumerating every completion of the unanswered factors
 * (at most 2^7 resolves — trivial) and unioning the consulted sets.
 */
export function factorRelevance(tree, answers) {
  const r = resolve(tree, answers);
  const usedNow = new Set(r.path.map((p) => p.factor));

  const open = FUNNEL_ORDER.filter((id) => answers[id] !== 'H' && answers[id] !== 'L');
  const everConsulted = new Set(usedNow);
  for (let m = 0; m < (1 << open.length); m++) {
    const full = { ...answers };
    open.forEach((id, i) => { full[id] = (m >> i) & 1 ? 'H' : 'L'; });
    for (const p of resolve(tree, full).path) everConsulted.add(p.factor);
  }

  const status = {};
  for (const id of FUNNEL_ORDER) {
    if (usedNow.has(id)) status[id] = 'used';
    else if (r.need === id) status[id] = 'next';
    else if (everConsulted.has(id)) status[id] = 'possible';
    else status[id] = 'skipped';
  }
  return { status, resolved: !!r.style };
}
