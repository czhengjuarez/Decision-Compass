/*
 * The original Vroom-Yetton (1973) decision tree for group problems —
 * seven yes/no questions funneling to one of five decision styles
 * (AI, AII, CI, CII, GII). Data only; public/js/treeViz.js does the
 * layout + SVG rendering + interactivity, shared with the 2020 trees.
 */

import { mountInteractiveTree } from './treeViz.js';

export const QUESTIONS_1973 = {
  q1: { label: 'Q1', text: 'Is there a quality requirement? Is the nature of the solution critical? Are there technical or rational grounds for selecting among possible solutions?' },
  q2: { label: 'Q2', text: 'Do I have sufficient information to make a high-quality decision?' },
  q3: { label: 'Q3', text: 'Is the problem structured? Are the alternative courses of action and methods for their evaluation known?' },
  q4: { label: 'Q4', text: 'Is acceptance of the decision by subordinates critical to its implementation?' },
  q5: { label: 'Q5', text: 'If I were to make the decision by myself, is it reasonably certain that it would be accepted by my subordinates?' },
  q6: { label: 'Q6', text: 'Do subordinates share the organizational goals to be obtained in solving this problem?' },
  q7: { label: 'Q7', text: 'Is conflict among subordinates likely in obtaining the preferred solution?' },
};

export const STYLES_1973 = {
  AI: { name: 'AI — Autocratic I', tone: 'blue', badge: 'AI', desc: 'You solve the problem or make the decision yourself, using the information you already have.' },
  AII: { name: 'AII — Autocratic II', tone: 'blue', badge: 'AII', desc: 'You get any facts you need from subordinates, then decide alone — you may or may not tell them what the questions are for.' },
  CI: { name: 'CI — Consultative I', tone: 'amber', badge: 'CI', desc: 'You share the problem with subordinates individually, get their ideas without bringing them together, then decide yourself.' },
  CII: { name: 'CII — Consultative II', tone: 'amber', badge: 'CII', desc: 'You share the problem with subordinates as a group, get their collective input, then decide yourself.' },
  GII: { name: 'GII — Group II', tone: 'green', badge: 'GII', desc: 'You share the problem with the group and decide together, trying to reach consensus — your idea carries no more weight than anyone else’s.' },
};

const COL_ORDER_1973 = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'];

const LEGEND_1973 = [
  { tone: 'blue', text: 'AI / AII — you decide alone' },
  { tone: 'amber', text: 'CI / CII — you consult, then decide' },
  { tone: 'green', text: 'GII — the group decides together' },
];

/* Nested tree: {q, no, yes} for a question node, {leaf} for an outcome.
 * Transcribed from Vroom & Yetton's 1973 group-problem tree (14 terminal
 * problem types); order/skips verified against the classic chart.
 *
 * `first` picks which branch is laid out above the other, matching the
 * original chart's visual order (most-autocratic outcomes at the top) —
 * it is NOT always "no": Q3/Q5/Q6/Q7 nodes draw "yes" first. */
const TREE_1973 = {
  q: 'q1',
  no: {
    q: 'q4',
    no: { leaf: 'AI' },
    yes: { q: 'q5', first: 'yes', yes: { leaf: 'AI' }, no: { leaf: 'GII' } },
  },
  yes: {
    q: 'q2',
    no: {
      q: 'q4',
      no: { leaf: 'AI' },
      yes: {
        q: 'q5',
        first: 'yes',
        yes: { leaf: 'AI' },
        no: {
          q: 'q6',
          first: 'yes',
          yes: { leaf: 'GII' },
          no: { q: 'q7', first: 'yes', yes: { leaf: 'CII' }, no: { leaf: 'CI' } },
        },
      },
    },
    yes: {
      q: 'q3',
      first: 'yes',
      yes: {
        q: 'q4',
        no: { leaf: 'AII' },
        yes: {
          q: 'q5',
          first: 'yes',
          yes: { leaf: 'AII' },
          no: {
            q: 'q6',
            first: 'yes',
            yes: { leaf: 'GII' },
            no: { q: 'q7', first: 'yes', yes: { leaf: 'CII' }, no: { leaf: 'CI' } },
          },
        },
      },
      no: { leaf: 'CII' },
    },
  },
};

export function mountTree1973(container) {
  mountInteractiveTree(container, TREE_1973, {
    colOrder: COL_ORDER_1973,
    questions: QUESTIONS_1973,
    styles: STYLES_1973,
    edgeLabels: { no: 'NO', yes: 'YES' },
    legend: LEGEND_1973,
  });
}
