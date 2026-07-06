/*
 * Generic renderer for a binary decision tree: {q, no, yes} for a
 * question node, {leaf} for an outcome. Shared by the 1973 tree
 * (tree1973.js) and the 2020 Time-/Development-Driven trees
 * (tree2020.js) on the About page — this file only knows about
 * layout, drawing, and hover/click/pin interactivity; each caller
 * supplies its own questions, styles, edge labels, and legend.
 *
 * Node/leaf y-positions are derived, not hand-placed: each leaf takes
 * the next row in tree order, each internal node sits at the vertical
 * midpoint of its two children. This guarantees the layout always
 * matches whatever tree data is passed in.
 */

const COL_W = 148;
const ROW_H = 40;
const PAD_LEFT = 30;
const PAD_TOP = 40;

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* IDs for a node and its two outgoing edges are reserved before
 * recursing so children can record them as ancestors (for path
 * highlighting), then filled in once both children are placed. */
function layoutTree(tree, colOf) {
  const nodes = [];
  const leaves = [];
  const edges = [];

  function visitChild(n, parentX, ancestorNodes, ancestorEdges) {
    if (n.leaf) {
      const y = PAD_TOP + leaves.length * ROW_H + ROW_H / 2;
      const x = parentX + COL_W;
      const id = leaves.length;
      leaves.push({ id, x, y, style: n.leaf, pathNodes: ancestorNodes, pathEdges: ancestorEdges });
      return { x, y };
    }
    return visitNode(n, ancestorNodes, ancestorEdges);
  }

  function visitNode(n, ancestorNodes, ancestorEdges) {
    const x = PAD_LEFT + colOf(n.q) * COL_W;
    const myId = nodes.length;
    nodes.push(null);
    const childNodes = [...ancestorNodes, myId];

    const branches = n.first === 'yes' ? ['yes', 'no'] : ['no', 'yes'];
    const pts = {};
    for (const key of branches) {
      const edgeId = edges.length;
      edges.push(null);
      pts[key] = { edgeId, ...visitChild(n[key], x, childNodes, [...ancestorEdges, edgeId]) };
    }

    const y = (pts.no.y + pts.yes.y) / 2;
    nodes[myId] = { id: myId, x, y, q: n.q, pathNodes: ancestorNodes, pathEdges: ancestorEdges };
    edges[pts.no.edgeId] = { id: pts.no.edgeId, x1: x, y1: y, x2: pts.no.x, y2: pts.no.y, key: 'no' };
    edges[pts.yes.edgeId] = { id: pts.yes.edgeId, x1: x, y1: y, x2: pts.yes.x, y2: pts.yes.y, key: 'yes' };
    return { x, y };
  }

  visitNode(tree, [], []);
  const width = PAD_LEFT + 8 * COL_W;
  const height = PAD_TOP + leaves.length * ROW_H + 20;
  return { nodes, leaves, edges, width, height };
}

function buildSvg(layout, { colOrder, questions, styles, edgeLabels }) {
  const { nodes, leaves, edges, width, height } = layout;

  const headerMarkup = colOrder.map((id, i) =>
    `<text class="vy-col-label" x="${PAD_LEFT + i * COL_W}" y="20" text-anchor="middle">${esc(questions[id].label)}</text>`
  ).join('');

  const edgeMarkup = edges.map((e) => {
    const label = edgeLabels[e.key];
    const mx = (e.x1 + e.x2) / 2;
    const my = (e.y1 + e.y2) / 2;
    const dy = e.y2 === e.y1 ? (e.key === 'yes' ? -8 : 8) : (e.y2 < e.y1 ? -6 : 6);
    return `<g class="vy-edge-g" data-edge="${e.id}">
      <line class="vy-edge" x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" />
      <text class="vy-edge-label" x="${mx}" y="${my + dy}" text-anchor="middle">${esc(label)}</text>
    </g>`;
  }).join('');

  const nodeMarkup = nodes.map((n) => {
    const q = questions[n.q];
    return `<g class="vy-node" data-node="${n.id}" tabindex="0" role="button" aria-label="${esc(q.label)} — ${esc(q.text)}">
      <circle class="vy-node__hit" cx="${n.x}" cy="${n.y}" r="14" />
      <circle class="vy-node__dot" cx="${n.x}" cy="${n.y}" r="6" />
      <text class="vy-node__label" x="${n.x}" y="${n.y - 12}" text-anchor="middle">${esc(q.label)}</text>
    </g>`;
  }).join('');

  const leafMarkup = leaves.map((l) => {
    const s = styles[l.style];
    const w = 52, h = 26;
    return `<g class="vy-leaf vy-leaf--${s.tone}" data-leaf="${l.id}" tabindex="0" role="button" aria-label="${esc(s.name)}: ${esc(s.desc)}">
      <rect class="vy-leaf__box" x="${l.x - w / 2}" y="${l.y - h / 2}" width="${w}" height="${h}" rx="6" />
      <text class="vy-leaf__label" x="${l.x}" y="${l.y + 4}" text-anchor="middle">${esc(s.badge)}</text>
    </g>`;
  }).join('');

  return `<svg class="vy-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Interactive decision tree — hover or tap to explore">
    ${headerMarkup}
    <g class="vy-edges">${edgeMarkup}</g>
    <g class="vy-nodes">${nodeMarkup}</g>
    <g class="vy-leaves">${leafMarkup}</g>
  </svg>`;
}

function defaultPanelHTML(legend) {
  return `<p class="kicker">Explore the tree</p>
    <p class="muted" style="font-size: var(--of-text-sm)">Hover or focus a question mark to read it, or an outcome box to see what it means. Click an outcome to trace the path that leads there.</p>
    <div class="vy-legend">
      ${legend.map((item) => `<span class="vy-legend__item"><span class="vy-legend__swatch vy-legend__swatch--${item.tone}"></span>${esc(item.text)}</span>`).join('')}
    </div>`;
}

/* Renders `tree` into `container` and wires up hover/focus/click
 * interactivity: hovering a node shows its question, hovering an
 * outcome shows what it means, clicking an outcome pins the path from
 * root to that outcome so it stays highlighted while you read it. */
export function mountInteractiveTree(container, tree, { colOrder, questions, styles, edgeLabels, legend }) {
  const colOf = (id) => colOrder.indexOf(id);
  const layout = layoutTree(tree, colOf);
  const { nodes, leaves } = layout;

  container.innerHTML = `
    <div class="vy-tree__scroll">${buildSvg(layout, { colOrder, questions, styles, edgeLabels })}</div>
    <div class="of-card vy-panel" id="vy-panel" aria-live="polite">${defaultPanelHTML(legend)}</div>
  `;

  const svgEl = container.querySelector('.vy-svg');
  const panel = container.querySelector('#vy-panel');
  let pinned = null;

  function clearHighlight() {
    svgEl.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
  }

  function highlightPath(pathNodes, pathEdges, selfEl) {
    clearHighlight();
    pathEdges.forEach((i) => svgEl.querySelector(`[data-edge="${i}"]`)?.classList.add('is-active'));
    pathNodes.forEach((i) => svgEl.querySelector(`[data-node="${i}"]`)?.classList.add('is-active'));
    selfEl?.classList.add('is-active');
  }

  function showNode(n, el) {
    const q = questions[n.q];
    panel.innerHTML = `<p class="kicker">${esc(q.label)}</p><p>${esc(q.text)}</p>`;
    highlightPath(n.pathNodes, n.pathEdges, el);
  }

  function showLeaf(l, el) {
    const s = styles[l.style];
    panel.innerHTML = `<p class="kicker">Outcome</p><p><strong>${esc(s.name)}</strong></p><p class="muted" style="margin-top: var(--of-space-2); font-size: var(--of-text-sm)">${esc(s.desc)}</p>`;
    if (pinned === l.id) panel.insertAdjacentHTML('beforeend', `<button class="of-btn of-btn--ghost of-btn--sm vy-panel__clear" type="button" style="margin-top: var(--of-space-3)">Clear selection</button>`);
    highlightPath(l.pathNodes, l.pathEdges, el);
  }

  function resetPanel() {
    panel.innerHTML = defaultPanelHTML(legend);
    clearHighlight();
  }

  function restore() {
    if (pinned != null) showLeaf(leaves[pinned], svgEl.querySelector(`[data-leaf="${pinned}"]`));
    else resetPanel();
  }

  container.addEventListener('mouseover', (e) => {
    const nodeEl = e.target.closest('.vy-node');
    const leafEl = e.target.closest('.vy-leaf');
    if (nodeEl) showNode(nodes[+nodeEl.dataset.node], nodeEl);
    else if (leafEl) showLeaf(leaves[+leafEl.dataset.leaf], leafEl);
  });
  container.addEventListener('mouseleave', restore);

  container.addEventListener('focusin', (e) => {
    const nodeEl = e.target.closest('.vy-node');
    const leafEl = e.target.closest('.vy-leaf');
    if (nodeEl) showNode(nodes[+nodeEl.dataset.node], nodeEl);
    else if (leafEl) showLeaf(leaves[+leafEl.dataset.leaf], leafEl);
  });
  container.addEventListener('focusout', (e) => {
    if (!container.contains(e.relatedTarget)) restore();
  });

  container.addEventListener('click', (e) => {
    if (e.target.closest('.vy-panel__clear')) { pinned = null; resetPanel(); return; }
    const leafEl = e.target.closest('.vy-leaf');
    if (!leafEl) return;
    const id = +leafEl.dataset.leaf;
    pinned = pinned === id ? null : id;
    restore();
  });
  container.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.vy-leaf, .vy-panel__clear')) {
      e.preventDefault();
      e.target.click();
    }
  });
}
