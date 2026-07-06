/*
 * The 2020 Time-Driven and Development-Driven trees, reusing the same
 * interactive SVG engine (treeViz.js) as the 1973 tree, so the About
 * page can flip between all three and see exactly what changed.
 *
 * Converts model.js's {factor, H, L}/string-leaf trees into treeViz's
 * {q, no, yes}/{leaf} shape — generated from the app's own verified
 * decision tables, not re-transcribed by hand.
 */

import { FACTORS, FUNNEL_ORDER, STYLES, MODELS } from './model.js';
import { mountInteractiveTree } from './treeViz.js';

function convert(node) {
  if (typeof node === 'string') return { leaf: node };
  return { q: node.factor, no: convert(node.L), yes: convert(node.H) };
}

const QUESTIONS_2020 = Object.fromEntries(
  FACTORS.map((f) => [f.id, { label: f.id.toUpperCase(), text: f.question }])
);

const STYLES_2020 = Object.fromEntries(
  Object.values(STYLES).map((s) => [s.id, { name: `${s.badge} — ${s.name}`, tone: s.tone, badge: s.badge, desc: s.tagline }])
);

const LEGEND_2020 = Object.values(STYLES).map((s) => ({ tone: s.tone, text: `${s.badge} — ${s.name}` }));

export function mountTree2020(container, modelId) {
  const tree = convert(MODELS[modelId].tree);
  mountInteractiveTree(container, tree, {
    colOrder: FUNNEL_ORDER,
    questions: QUESTIONS_2020,
    styles: STYLES_2020,
    edgeLabels: { no: 'LOW', yes: 'HIGH' },
    legend: LEGEND_2020,
  });
}
