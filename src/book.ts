import { books, projects, type Chart, type Project, type ProjectBook } from './content';

/**
 * The Projects section: a bookshelf in the middle of the page. Pick a spine and that one book is pulled out, shown as a closed
 * cover, and opens. Every project is its own small volume (up to four spreads: Overview, Method, Results, Limits), and the
 * page turns stay inside that book. "Shelf" puts it back.
 *
 * Wide screens show two pages and turn a real leaf (Web Animations API on a CSS 3D leaf). Narrow screens and reduced motion
 * get a single scrolling column and a short fade instead; the cover step is skipped there.
 */
const esc = (v: string) => v.replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]!));
const pad = (n: number) => String(n).padStart(2, '0');
const mq = (q: string) => typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
const narrow = () => mq('(max-width: 750px)');
const reduced = () => mq('(prefers-reduced-motion: reduce)');
const sleep = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));
const EASE_TURN = 'cubic-bezier(.52,.02,.24,1)';
const EASE_OUT = 'cubic-bezier(.18,.82,.24,1)';
const TURN_MS = 950;

// ---------- charts ----------
function chartHtml(c: Chart): string {
  switch (c.kind) {
    case 'bars':
      return `<ul class="ch-bars">${c.items.map(i => `<li><span class="ch-l">${esc(i.label)}</span><span class="ch-track" aria-hidden="true"><i style="width:${Math.max(2, Math.min(100, i.value / c.max * 100)).toFixed(1)}%"></i></span><span class="ch-v">${esc(i.text)}</span></li>`).join('')}</ul>`;
    case 'prob':
      return c.groups.map((g, gi) => `<div class="ch-group ${gi ? 'alt' : ''}"><div class="ch-sub">${esc(g.heading)}</div><ul class="ch-bars">${g.items.map(i => `<li><span class="ch-l">${esc(i.label)}</span><span class="ch-track" aria-hidden="true"><i style="width:${Math.max(2, i.value).toFixed(1)}%"></i></span><span class="ch-v">${i.value.toFixed(1)}%</span></li>`).join('')}</ul></div>`).join('');
    case 'gauge': {
      const r = 52, circ = 2 * Math.PI * r, f = Math.min(1, c.value / c.max) * circ;
      return `<div class="ch-gauge"><svg viewBox="0 0 140 140" aria-hidden="true"><circle class="g-back" cx="70" cy="70" r="${r}"/><circle class="g-fill" cx="70" cy="70" r="${r}" stroke-dasharray="${f.toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 70 70)"/></svg><div class="g-text"><strong>${esc(c.text)}</strong><span>${esc(c.label)}</span></div></div><p class="ch-sub centered">${esc(c.sub)}</p>`;
    }
    case 'stack': {
      const sum = c.segments.reduce((a, s) => a + s.value, 0) || 1;
      return `<div class="ch-stack" aria-hidden="true">${c.segments.filter(s => s.value > 0).map(s => `<span class="seg s${c.segments.indexOf(s)}" style="flex:${s.value / sum}"><b>${s.value}</b></span>`).join('')}</div>
        <ul class="ch-legend">${c.segments.map((s, i) => `<li><i class="sw s${i}" aria-hidden="true"></i>${esc(s.label)} <strong>${s.value}</strong></li>`).join('')}</ul>
        <ul class="ch-chips">${c.chips.map(x => `<li><small>${esc(x.label)}</small><strong>${esc(x.value)}</strong></li>`).join('')}</ul>`;
    }
    case 'steps':
      return `<ol class="ch-steps">${c.steps.map((s, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span><span>${esc(s)}</span></li>`).join('')}</ol>`;
    case 'matrix':
      return `<table class="ch-matrix"><thead><tr><th scope="col"><span class="sr">Replacement baseline</span></th>${c.cols.map(x => `<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${c.rows.map((r, ri) => `<tr><th scope="row">${esc(r)}</th>${c.cols.map((_, ci) => `<td><span class="dotn">${ri * c.cols.length + ci + 1}</span><span class="sr">View ${ri * c.cols.length + ci + 1}</span></td>`).join('')}</tr>`).join('')}</tbody></table>`;
    case 'keys':
      return `<ol class="ch-keys"><li class="knob"><span class="kn" aria-hidden="true"></span><span class="kl">${esc(c.knob)}<small>knob</small></span></li>${c.keys.map((k, i) => `<li><span class="kn2" aria-hidden="true">${i + 1}</span><span class="kl">${esc(k)}</span></li>`).join('')}</ol>`;
    case 'shelf':
      return `<div class="ch-shelf" aria-hidden="true">${c.items.map((_, i) => `<span style="height:${62 + (i * 37) % 30}%"><b>${pad(i + 1)}</b></span>`).join('')}</div>`;
    case 'contrast':
      return `<div class="ch-contrast"><div class="cc-col"><div class="ch-sub">${esc(c.from.heading)}</div><ul class="cc-chips">${c.from.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div><span class="cc-arrow" aria-hidden="true">→</span><div class="cc-col to"><div class="ch-sub">${esc(c.to.heading)}</div><ul class="cc-chips">${c.to.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div></div>`;
    case 'cards':
      return `<ul class="ch-cards">${c.items.map(i => `<li><strong>${esc(i.title)}</strong><span>${esc(i.text)}</span></li>`).join('')}</ul>`;
    case 'chat':
      return `<ul class="ch-chat">${c.items.map(q => `<li><span class="bub">${esc(q)}</span></li>`).join('')}</ul>`;
  }
}
function plate(c: Chart): string {
  const note = 'note' in c && c.note ? `<p class="plate-note">${esc(c.note)}</p>` : '';
  return `<figure class="plate"><figcaption>${esc(c.title)}</figcaption>${chartHtml(c)}${note}</figure>`;
}

// ---------- pages ----------
type Spread = { name: string; left: string; right: string; fs?: number };
const ornament = `<svg class="orn" viewBox="0 0 120 24" aria-hidden="true"><path d="M2 12h44M74 12h44" /><path d="M60 3l7 9-7 9-7-9z"/><circle cx="50" cy="12" r="2"/><circle cx="70" cy="12" r="2"/></svg>`;
const sec = (title: string, inner: string, cls = '') => `<section class="pg-sec ${cls}"><h4>${esc(title)}</h4>${inner}</section>`;
const list = (items: string[]) => `<ul class="pg-list">${items.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`;

function linkBlock(p: Project, b: ProjectBook): string {
  return p.link
    ? `<a class="pg-link" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer"><span>View ${esc(p.name)} on GitHub</span><span aria-hidden="true">↗</span><small>${esc(p.link.replace('https://', ''))}</small></a>`
    : `<p class="pg-note">${esc(b.repoNote || 'No public repository is linked for this volume.')}</p>`;
}

/** Builds the spreads for one book. Spreads with nothing to say are left out. */
function buildSpreads(index: number): Spread[] {
  const p = projects[index];
  const b = books[p.id];
  const out: Spread[] = [];
  if (!b) {
    out.push({ name: 'Overview', left: `<header class="pg-head"><div class="pg-kicker">VOL. ${pad(index + 1)}</div><h3 class="pg-title" tabindex="-1">${esc(p.name)}</h3></header>`, right: `<section class="pg-sec"><p>${esc(p.description)}</p></section>${p.link ? linkBlock(p, { tagline: '', overview: [], data: [], chart: { kind: 'steps', title: '', steps: [] }, findings: [] }) : ''}` });
    return out;
  }
  const lab = { question: 'The question', data: 'The data', method: 'How it works', details: 'Good to know', findings: 'What came out', limits: 'Limits', learned: 'What it taught', next: 'What next', files: 'In the repository', ...(b.labels || {}) };
  const names = { overview: 'Overview', method: 'Method', results: 'Results', limits: 'Limits', ...(b.titles || {}) };
  const status = [pad(index + 1) + ' / ' + pad(projects.length), p.category.toUpperCase(), b.kicker?.toUpperCase()].filter(Boolean).join(' · ');
  const tools = b.tools || p.tools;

  // 1 · overview
  out.push({
    name: names.overview,
    left: `<header class="pg-head"><div class="pg-kicker">VOL. ${esc(status)}</div><h3 class="pg-title" tabindex="-1">${esc(p.name)}</h3><p class="pg-tagline">${esc(b.tagline)}</p></header>
      ${b.stats?.length ? `<dl class="pg-stats">${b.stats.map(s => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl>` : ''}
      <ul class="pg-tools" aria-label="Tools used">${tools.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      ${b.question ? `<section class="pg-sec ask"><h4>${esc(lab.question)}</h4><p>${esc(b.question)}</p></section>` : ''}`,
    right: `<span class="ribbon" aria-hidden="true"></span>
      <section class="pg-sec lead"><h4 class="sr">About</h4>${b.overview.map(t => `<p>${esc(t)}</p>`).join('')}</section>
      ${b.data.length ? sec(lab.data, list(b.data)) : ''}`,
  });

  // 2 · method
  if (b.method?.length) {
    out.push({
      name: names.method,
      left: `<header class="pg-head slim"><div class="pg-kicker">${esc(p.name.toUpperCase())} · ${esc(names.method.toUpperCase())}</div><h3 class="pg-h2" tabindex="-1">${esc(lab.method)}</h3></header>
        <ol class="flow">${b.method.map((s, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span><div><strong>${esc(s.title)}</strong><span>${esc(s.text)}</span></div></li>`).join('')}</ol>`,
      right: b.details?.length
        ? `${sec(lab.details, `<dl class="terms">${b.details.map(t => `<div><dt>${esc(t.term)}</dt><dd>${esc(t.text)}</dd></div>`).join('')}</dl>`)}`
        : '',
    });
  }

  // 3 · results
  const worksList = b.chart.kind === 'shelf' ? sec('Works in this volume', `<ol class="ch-works">${b.chart.items.map((w, i) => `<li><span>${pad(i + 1)}</span>${esc(w)}</li>`).join('')}</ol>`) : '';
  out.push({
    name: names.results,
    left: `<header class="pg-head slim"><div class="pg-kicker">${esc(p.name.toUpperCase())} · ${esc(names.results.toUpperCase())}</div><h3 class="pg-h2" tabindex="-1">${esc(names.results)}</h3></header>${plate(b.chart)}${b.extra ? plate(b.extra) : ''}`,
    right: `${b.findings.length ? sec(lab.findings, list(b.findings)) : ''}${worksList}`,
  });

  // 4 · limits, next, files
  const hasLimits = !!(b.limits?.length || b.learned?.length);
  const tail = `${b.next?.length ? sec(lab.next, list(b.next)) : ''}${b.files?.length ? sec(lab.files, `<ul class="files">${b.files.map(f => `<li><code>${esc(f.path)}</code><span>${esc(f.text)}</span></li>`).join('')}</ul>`) : ''}${b.credit ? `<p class="pg-credit">${esc(b.credit)}</p>` : ''}${linkBlock(p, b)}`;
  if (hasLimits || b.next?.length || b.files?.length) {
    out.push({
      name: names.limits,
      left: hasLimits
        ? `<header class="pg-head slim"><div class="pg-kicker">${esc(p.name.toUpperCase())} · ${esc(names.limits.toUpperCase())}</div><h3 class="pg-h2" tabindex="-1">${esc(lab.limits)}</h3></header>${b.limits?.length ? `<section class="pg-sec caveat">${list(b.limits)}</section>` : ''}${b.learned?.length ? sec(lab.learned, list(b.learned)) : ''}`
        : `<header class="pg-head slim"><div class="pg-kicker">${esc(p.name.toUpperCase())} · ${esc(names.limits.toUpperCase())}</div><h3 class="pg-h2" tabindex="-1">Next</h3></header>${b.next?.length ? sec(lab.next, list(b.next)) : ''}`,
      right: hasLimits ? tail : `${b.files?.length ? sec(lab.files, `<ul class="files">${b.files.map(f => `<li><code>${esc(f.path)}</code><span>${esc(f.text)}</span></li>`).join('')}</ul>`) : ''}${linkBlock(p, b)}`,
    });
  } else {
    // nothing else to say: the link or repository note closes the Results spread
    out[out.length - 1].right += linkBlock(p, b);
  }
  return out;
}

function coverFace(i: number): string {
  const p = projects[i];
  const b = books[p.id];
  return `<span class="ca-hinge" aria-hidden="true"></span><span class="ca-inner">
      <span class="ca-top">VOL. ${pad(i + 1)} / ${pad(projects.length)}</span>${ornament}
      <span class="ca-title">${esc(p.name)}</span>
      <span class="ca-tag">${esc(b?.tagline || p.description)}</span>
      <span class="ca-cat">${esc(p.category.toUpperCase())}${b?.kicker ? ` · ${esc(b.kicker.toUpperCase())}` : ''}</span>
      <span class="ca-open" aria-hidden="true">OPEN <span>→</span></span></span>`;
}

// ---------- DOM and state ----------
let stage: HTMLElement | null = null;
let shelfView: HTMLElement;
let bookView: HTMLElement;
let body: HTMLElement;
let frame: HTMLElement;
let pages: HTMLElement;
let leftEl: HTMLElement;
let rightEl: HTMLElement;
let castL: HTMLElement;
let castR: HTMLElement;
let coverBtn: HTMLButtonElement;
let tabsEl: HTMLElement;
let shelfBtn: HTMLButtonElement;
let prevBtn: HTMLButtonElement;
let nextBtn: HTMLButtonElement;
let hideBtns: HTMLButtonElement[] = [];
let pill: HTMLButtonElement;
let live: HTMLElement;
let countEl: HTMLElement;
let ghLink: HTMLAnchorElement;
let pnL: HTMLElement;
let pnR: HTMLElement;

let visible = false;
let minimized = false;
let mode: 'shelf' | 'book' = 'shelf';
let bookIdx = -1;
let spreadIdx = -1; // -1 = closed cover
let spreads: Spread[] = [];
let busy = false;
let queued: number | null = null;
let epoch = 0;
let hideTimer = 0;
let lastSpine: HTMLElement | null = null;

const announce = (t: string) => { if (live) live.textContent = t; };
const tooLate = (e: number) => e !== epoch;

function shelfHtml(): string {
  // Two shelves: the data-science volumes on top; software, hardware and engineering below, with a gap between groups.
  const rows: string[][] = [['Data Science & ML'], ['Software & AI', 'Hardware', 'Engineering']];
  const tall = [1, .93, .86, .97, .9, .83, .95, .88, 1, .92, .85];
  const spine = (p: Project, i: number) => `<li><button type="button" class="spine" data-pick="${i}" style="--c:${esc(p.color)};--t:${tall[i % tall.length]};--wv:${62 + (i * 13) % 19}px" aria-label="${esc(p.name)}, volume ${i + 1} of ${projects.length}, ${esc(p.category)}${p.status ? `, ${esc(p.status)}` : ''}. Open this book."><span class="sp-band" aria-hidden="true"></span><span class="sp-n" aria-hidden="true">${pad(i + 1)}</span><span class="sp-t" aria-hidden="true">${esc(p.name)}</span><span class="sp-cat" aria-hidden="true">${esc(p.category)}</span><span class="sp-band" aria-hidden="true"></span></button></li>`;
  return `<header class="shelf-head"><div class="shelf-eyebrow">THE COLLECTION</div><h3 class="shelf-title" id="shelf-title" tabindex="-1">Pick a book</h3><p class="shelf-sub">${projects.length} volumes of data science, sports analytics, AI, hardware and engineering. Each one opens into its own short book.</p></header>
    <div class="shelf-case">${rows.map(cats => `<section class="shelf-row" aria-label="${esc(cats.join(', '))}"><h4 class="shelf-label">${esc(cats.join('  ·  '))}</h4><ul class="shelf-books">${cats.map((cat, ci) => projects.map((p, i) => ({ p, i })).filter(x => x.p.category === cat).map(({ p, i }, k) => (ci > 0 && k === 0 ? `<li class="sp-gap" aria-hidden="true"></li>` : '') + spine(p, i)).join('')).join('')}</ul><div class="plank" aria-hidden="true"></div></section>`).join('')}</div>
    <div class="shelf-foot"><button type="button" class="bk-btn bk-hide" data-hide><span class="wide">HIDE SHELF</span><span class="slim">SHOW LIST</span></button></div>`;
}

function ensure() {
  if (stage) return;
  stage = document.createElement('div');
  stage.id = 'book-stage';
  stage.className = 'book-stage';
  stage.hidden = true;
  stage.innerHTML = `<div class="shelf-view" id="bk-shelf" role="region" aria-label="Project shelf">${shelfHtml()}</div>
    <div class="book-view closed away" id="bk-book" role="region" aria-label="Project book" inert aria-hidden="true">
      <div class="book">
        <div class="book-body" id="bk-body">
          <div class="book-cover" id="bk-frame"><div class="book-pages" id="bk-pages"><section class="page page-left" id="bk-left"></section><section class="page page-right" id="bk-right"></section><div class="cast cast-l" id="bk-castl" aria-hidden="true"></div><div class="cast cast-r" id="bk-castr" aria-hidden="true"></div><div class="gutter" aria-hidden="true"></div><span class="pn pn-l" id="bk-pnl" aria-hidden="true"></span><span class="pn pn-r" id="bk-pnr" aria-hidden="true"></span></div></div>
          <button type="button" class="cover-static" id="bk-cover"></button>
        </div>
        <div class="book-bar">
          <button type="button" class="bk-btn" id="bk-shelfbtn" aria-label="Back to the shelf"><span aria-hidden="true">←</span> SHELF</button>
          <button type="button" class="bk-btn" id="bk-prev" aria-label="Previous page"><span aria-hidden="true">‹</span> PREV</button>
          <div class="bk-tabs" id="bk-tabs" role="group" aria-label="Chapters of this book"></div>
          <span class="bk-count" id="bk-count" aria-hidden="true"></span>
          <button type="button" class="bk-btn" id="bk-next" aria-label="Next page">NEXT <span aria-hidden="true">›</span></button>
          <a class="bk-btn bk-gh" id="bk-gh" href="#" target="_blank" rel="noopener noreferrer" hidden>GITHUB <span aria-hidden="true">↗</span></a>
          <button type="button" class="bk-btn bk-hide" data-hide><span class="wide">HIDE BOOK</span><span class="slim">SHOW LIST</span></button>
        </div>
      </div>
    </div>
    <div class="sr" id="bk-live" role="status" aria-live="polite"></div>`;
  const panel = document.querySelector('#content-panel');
  (panel?.parentElement || document.body).insertBefore(stage, panel || null);
  const q = <T extends HTMLElement>(s: string) => stage!.querySelector<T>(s)!;
  shelfView = q('#bk-shelf'); bookView = q('#bk-book'); body = q('#bk-body'); frame = q('#bk-frame'); pages = q('#bk-pages');
  leftEl = q('#bk-left'); rightEl = q('#bk-right'); castL = q('#bk-castl'); castR = q('#bk-castr'); coverBtn = q('#bk-cover');
  tabsEl = q('#bk-tabs'); shelfBtn = q('#bk-shelfbtn'); prevBtn = q('#bk-prev'); nextBtn = q('#bk-next');
  hideBtns = [...stage.querySelectorAll<HTMLButtonElement>('[data-hide]')];
  live = q('#bk-live'); countEl = q('#bk-count'); ghLink = q('#bk-gh'); pnL = q('#bk-pnl'); pnR = q('#bk-pnr');

  pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'book-pill';
  pill.hidden = true;
  stage.parentElement!.insertBefore(pill, stage);

  prevBtn.addEventListener('click', () => void flip(spreadIdx - 1));
  nextBtn.addEventListener('click', () => void flip(spreadIdx + 1));
  shelfBtn.addEventListener('click', () => void toShelf());
  coverBtn.addEventListener('click', () => { if (spreadIdx < 0) void flip(0); });
  hideBtns.forEach(b => b.addEventListener('click', () => setMinimized(true)));
  pill.addEventListener('click', () => setMinimized(false));
  stage.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const spine = t.closest<HTMLElement>('[data-pick]');
    if (spine) { void pick(Number(spine.dataset.pick), spine); return; }
    const tab = t.closest<HTMLElement>('[data-spread]');
    if (tab) void flip(Number(tab.dataset.spread));
  });
  document.addEventListener('keydown', onKey);
  let rz = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(rz);
    rz = window.setTimeout(() => { if (!visible || mode !== 'book' || busy) return; spreads.forEach(x => { delete x.fs; }); paint(); }, 120);
  });
  if (typeof window.matchMedia === 'function') {
    window.matchMedia('(max-width: 750px)').addEventListener?.('change', onResizeMode);
    window.matchMedia('(max-width: 1100px)').addEventListener?.('change', syncPanelInert);
  }
}

function onKey(e: KeyboardEvent) {
  if (!visible || minimized || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  if (mode === 'book') {
    if (e.key === 'ArrowRight') { e.preventDefault(); void flip(spreadIdx + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); void flip(spreadIdx - 1); }
    else if (e.key === 'Home') { e.preventDefault(); void flip(narrow() ? 0 : -1); }
    else if (e.key === 'End') { e.preventDefault(); void flip(spreads.length - 1); }
  } else if (t?.classList.contains('spine')) {
    const all = [...shelfView.querySelectorAll<HTMLElement>('.spine')];
    const at = all.indexOf(t);
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : -1;
    if (to >= 0 && to < all.length) { e.preventDefault(); all[to].focus(); }
  }
}

// ---------- fitting ----------
/**
 * Type is sized to the page. Each spread is tried at up to 1.3x the base size and shrunk until neither page scrolls (never below
 * about 72% of the base). A book then uses one size across its spreads, allowing sparse spreads to be at most 15% larger than
 * the densest, so turning pages never jumps in size.
 */
function measure(sp: Spread): number {
  const w = pages.clientWidth, h = pages.clientHeight;
  if (narrow() || !w || !h) return 0;
  const m = document.createElement('div');
  m.setAttribute('aria-hidden', 'true');
  m.setAttribute('inert', '');
  m.style.cssText = `position:absolute;left:-99999px;top:0;width:${w}px;height:${h}px;display:grid;grid-template-columns:1fr 1fr;visibility:hidden;pointer-events:none`;
  m.innerHTML = `<section class="page page-left">${sp.left}</section><section class="page page-right">${sp.right}</section>`;
  bookView.querySelector('.book')!.appendChild(m);
  const L = m.children[0] as HTMLElement, R = m.children[1] as HTMLElement;
  const base = parseFloat(getComputedStyle(L).fontSize) || 14;
  const min = Math.max(10, base * .72);
  const over = () => Math.max(L.scrollHeight / (L.clientHeight || 1), R.scrollHeight / (R.clientHeight || 1));
  let fs = Math.min(base * 1.3, 21);
  m.style.setProperty('--fs', fs + 'px');
  for (let k = 0; k < 9; k++) {
    const o = over();
    if (o <= 1.003 || fs <= min + .01) break;
    fs = Math.max(min, fs * Math.pow(1 / o, .85));
    m.style.setProperty('--fs', fs + 'px');
  }
  m.remove();
  return fs;
}
function fitBook() {
  const raw = spreads.map(measure);
  const lo = Math.min(...raw.filter(x => x > 0));
  spreads.forEach((sp, i) => { sp.fs = raw[i] > 0 && isFinite(lo) ? Math.min(raw[i], lo * 1.15) : 0; });
}
function fsOf(sp: Spread): number { if (sp.fs === undefined) fitBook(); return sp.fs ?? 0; }
function applyFs(el: Element | null | undefined, fs: number) {
  if (!el) return;
  if (fs > 0) (el as HTMLElement).style.setProperty('--fs', fs + 'px'); else (el as HTMLElement).style.removeProperty('--fs');
}

// ---------- painting ----------
function setAccent(i: number) { stage!.style.setProperty('--book-accent', i >= 0 ? projects[i].color : '#c9b389'); }

function paint() {
  const proj = bookIdx >= 0 ? projects[bookIdx] : null;
  const cur = spreads[Math.max(0, spreadIdx)];
  if (proj && cur) {
    leftEl.innerHTML = cur.left;
    rightEl.innerHTML = cur.right;
    const fs = fsOf(cur);
    applyFs(leftEl, fs); applyFs(rightEl, fs);
    leftEl.scrollTop = 0; rightEl.scrollTop = 0; pages.scrollTop = 0;
  }
  const closed = spreadIdx < 0;
  const last = spreads.length - 1;
  pages.inert = closed && !narrow();
  prevBtn.disabled = narrow() ? spreadIdx <= 0 : closed;
  prevBtn.setAttribute('aria-label', !narrow() && spreadIdx === 0 ? 'Close the book' : 'Previous page');
  nextBtn.disabled = spreadIdx >= last;
  nextBtn.firstChild!.textContent = closed ? 'OPEN ' : 'NEXT ';
  nextBtn.setAttribute('aria-label', closed ? 'Open the book' : 'Next page');
  tabsEl.querySelectorAll<HTMLElement>('.bk-tab').forEach((t, i) => { if (i === spreadIdx) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); });
  pnL.textContent = closed ? '' : String(2 * spreadIdx + 1);
  pnR.textContent = closed ? '' : String(2 * spreadIdx + 2);
  ghLink.hidden = !proj?.link;
  if (proj?.link) { ghLink.href = proj.link; ghLink.setAttribute('aria-label', `Open ${proj.name} on GitHub (opens in a new tab)`); }
  countEl.textContent = `${pad(Math.max(0, spreadIdx) + 1)} / ${pad(spreads.length || 1)}`;
  window.requestAnimationFrame(() => [leftEl, rightEl].forEach((el, i) => {
    const scrolls = el.scrollHeight > el.clientHeight + 2 && !narrow();
    el.tabIndex = scrolls ? 0 : -1;
    el.classList.toggle('scrolls', scrolls);
    if (scrolls) { el.setAttribute('role', 'region'); el.setAttribute('aria-label', i ? 'Right page, scrolls' : 'Left page, scrolls'); } else { el.removeAttribute('role'); el.removeAttribute('aria-label'); }
  }));
}

function loadBook(i: number) {
  bookIdx = i;
  spreads = buildSpreads(i);
  tabsEl.innerHTML = spreads.map((s, k) => `<button type="button" class="bk-tab" data-spread="${k}"><span aria-hidden="true">${pad(k + 1)}</span> ${esc(s.name)}</button>`).join('');
  coverBtn.innerHTML = `<span class="cover-face">${coverFace(i)}</span>`;
  coverBtn.setAttribute('aria-label', `${projects[i].name}, closed. Open the book.`);
  setAccent(i);
}

// ---------- animation helpers ----------
const wait = async (a: Animation | undefined) => { try { await a?.finished; } catch { /* cancelled */ } };

function makeLeaf(cls: string, front: string, back: string, frontCls: string, backCls: string): HTMLElement {
  const leaf = document.createElement('div');
  leaf.className = `leaf ${cls}`;
  leaf.setAttribute('aria-hidden', 'true');
  leaf.setAttribute('inert', '');
  leaf.innerHTML = `<div class="leaf-face front ${frontCls}">${front}<i class="shade"></i></div><div class="leaf-face back ${backCls}">${back}<i class="shade"></i></div>`;
  return leaf;
}

/** Turn one leaf inside the pages: next lifts the right page over the spine, previous lifts the left page. */
async function turnLeaf(from: Spread, to: Spread, dir: 1 | -1, e: number) {
  const next = dir > 0;
  const leaf = makeLeaf(next ? 'leaf-next' : 'leaf-prev',
    next ? from.right : from.left, next ? to.left : to.right,
    next ? 'page page-right' : 'page page-left', next ? 'page page-left' : 'page page-right');
  const under = next ? rightEl : leftEl;
  const scrolled = under.scrollTop;
  const fsFrom = fsOf(from), fsTo = fsOf(to);
  under.innerHTML = next ? to.right : to.left;
  under.scrollTop = 0;
  applyFs(under, fsTo);
  applyFs(leaf.querySelector('.front'), fsFrom);
  applyFs(leaf.querySelector('.back'), fsTo);
  pages.appendChild(leaf);
  leaf.querySelector<HTMLElement>('.front')!.scrollTop = scrolled;
  const sign = next ? -1 : 1;
  const D = TURN_MS;
  const frontShade = leaf.querySelector('.front .shade') as HTMLElement;
  const backShade = leaf.querySelector('.back .shade') as HTMLElement;
  const anims = [
    leaf.animate([
      { transform: 'rotateY(0deg) translateZ(0)' },
      { transform: `rotateY(${sign * 90}deg) translateZ(34px)`, offset: .5 },
      { transform: `rotateY(${sign * 180}deg) translateZ(0)` },
    ], { duration: D, easing: EASE_TURN, fill: 'forwards' }),
    frontShade.animate([{ opacity: 0 }, { opacity: .55, offset: .5 }, { opacity: .55 }], { duration: D, easing: 'linear', fill: 'forwards' }),
    backShade.animate([{ opacity: .6 }, { opacity: .6, offset: .5 }, { opacity: 0 }], { duration: D, easing: 'linear', fill: 'forwards' }),
    // the page under the lifting leaf darkens a little, then the page it lands on
    (next ? castR : castL).animate([{ opacity: 0 }, { opacity: .34, offset: .32 }, { opacity: 0 }], { duration: D * .62, easing: 'ease-out', fill: 'forwards' }),
    (next ? castL : castR).animate([{ opacity: 0 }, { opacity: 0, offset: .45 }, { opacity: .3, offset: .85 }, { opacity: 0 }], { duration: D, easing: 'ease-in-out', fill: 'forwards' }),
  ];
  await Promise.race([Promise.all(anims.map(wait)), sleep(D + 1500)]);
  if (tooLate(e)) return;
  const other = next ? leftEl : rightEl;
  other.innerHTML = next ? to.left : to.right;
  applyFs(other, fsTo);
  leaf.remove();
  anims.forEach(a => a.cancel());
}

/** Cover leaf: the whole right half of the book body (leather margin included) swings over the spine. */
function coverLeaf(spread: Spread): HTMLElement {
  const leaf = makeLeaf('cover-leaf', `<span class="cover-face">${coverFace(bookIdx)}</span>`,
    `<div class="cover-back"><section class="page page-left">${spread.left}</section></div>`, 'cover-front', '');
  applyFs(leaf.querySelector('.cover-back .page'), fsOf(spread));
  return leaf;
}

async function openCover(to: Spread, e: number) {
  rightEl.innerHTML = to.right; leftEl.innerHTML = to.left;
  applyFs(rightEl, fsOf(to)); applyFs(leftEl, fsOf(to));
  const leaf = coverLeaf(to);
  bookView.classList.add('opening');
  body.appendChild(leaf);
  const D = TURN_MS + 150;
  const fs = leaf.querySelector('.front .shade') as HTMLElement;
  const bs = leaf.querySelector('.back .shade') as HTMLElement;
  const anims = [
    body.animate([{ transform: 'translateX(-25%)' }, { transform: 'translateX(0)' }], { duration: D, easing: EASE_TURN, fill: 'both' }),
    leaf.animate([
      { transform: 'rotateY(0deg) translateZ(0)' },
      { transform: 'rotateY(-90deg) translateZ(40px)', offset: .5 },
      { transform: 'rotateY(-180deg) translateZ(0)' },
    ], { duration: D, easing: EASE_TURN, fill: 'forwards' }),
    fs.animate([{ opacity: 0 }, { opacity: .5, offset: .5 }, { opacity: .5 }], { duration: D, easing: 'linear', fill: 'forwards' }),
    bs.animate([{ opacity: .6 }, { opacity: .6, offset: .5 }, { opacity: 0 }], { duration: D, easing: 'linear', fill: 'forwards' }),
  ];
  await Promise.race([Promise.all(anims.map(wait)), sleep(D + 1500)]);
  if (tooLate(e)) return;
  bookView.classList.remove('closed', 'opening');
  leaf.remove();
  anims.forEach(a => a.cancel());
}

async function closeCover(from: Spread, e: number) {
  const leaf = coverLeaf(from);
  bookView.classList.add('opening');
  body.appendChild(leaf);
  const D = TURN_MS + 150;
  const fs = leaf.querySelector('.front .shade') as HTMLElement;
  const bs = leaf.querySelector('.back .shade') as HTMLElement;
  const anims = [
    body.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-25%)' }], { duration: D, easing: EASE_TURN, fill: 'both' }),
    leaf.animate([
      { transform: 'rotateY(-180deg) translateZ(0)' },
      { transform: 'rotateY(-90deg) translateZ(40px)', offset: .5 },
      { transform: 'rotateY(0deg) translateZ(0)' },
    ], { duration: D, easing: EASE_TURN, fill: 'forwards' }),
    fs.animate([{ opacity: .5 }, { opacity: .5, offset: .5 }, { opacity: 0 }], { duration: D, easing: 'linear', fill: 'forwards' }),
    bs.animate([{ opacity: 0 }, { opacity: .6, offset: .5 }, { opacity: .6 }], { duration: D, easing: 'linear', fill: 'forwards' }),
  ];
  await Promise.race([Promise.all(anims.map(wait)), sleep(D + 1500)]);
  if (tooLate(e)) return;
  bookView.classList.add('closed');
  bookView.classList.remove('opening');
  leaf.remove();
  anims.forEach(a => a.cancel());
}

/** Narrow screens and reduced motion: no leaf, a short fade between pages. */
async function fadeSwap(change: () => void, e: number) {
  if (reduced()) { change(); return; }
  const out = pages.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 130, easing: 'ease-in', fill: 'forwards' });
  await wait(out);
  if (tooLate(e)) return;
  change();
  const back = pages.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 190, easing: 'ease-out', fill: 'forwards' });
  await wait(back);
  out.cancel(); back.cancel();
}

// ---------- navigation ----------
/** When the element that had focus has just been replaced or hidden, focus lands on the new left page's title. */
function refocusTitle() { leftEl.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true }); }
let refocus = false;

async function flip(target: number) {
  if (!stage || mode !== 'book') return;
  const lowest = narrow() ? 0 : -1;
  target = Math.max(lowest, Math.min(spreads.length - 1, target));
  if (busy) { queued = target; return; }
  if (target === spreadIdx) return;
  const e = epoch;
  busy = true;
  const active = document.activeElement;
  const mustFocus = refocus || coverBtn === active || pages.contains(active);
  refocus = false;
  const from = spreadIdx;
  if (narrow() || reduced()) {
    await fadeSwap(() => { spreadIdx = target; if (target >= 0) bookView.classList.remove('closed'); else bookView.classList.add('closed'); paint(); }, e);
  } else if (from < 0) {
    await openCover(spreads[target], e);
    if (tooLate(e)) return;
    spreadIdx = target; paint();
  } else if (target < 0) {
    await closeCover(spreads[from], e);
    if (tooLate(e)) return;
    spreadIdx = target; paint();
  } else {
    await turnLeaf(spreads[from], spreads[target], target > from ? 1 : -1, e);
    if (tooLate(e)) return;
    spreadIdx = target; paint();
  }
  if (tooLate(e)) return;
  busy = false;
  if (mustFocus && spreadIdx >= 0) refocusTitle();
  announce(spreadIdx < 0 ? `${projects[bookIdx].name}, closed.` : `${projects[bookIdx].name}. ${spreads[spreadIdx].name}, page ${2 * spreadIdx + 1} and ${2 * spreadIdx + 2} of ${spreads.length * 2}.`);
  if (queued !== null) { const q = queued; queued = null; void flip(q); }
}

function show(view: 'shelf' | 'book') {
  mode = view;
  const isBook = view === 'book';
  shelfView.classList.toggle('away', isBook);
  bookView.classList.toggle('away', !isBook);
  if (isBook) { shelfView.setAttribute('inert', ''); shelfView.setAttribute('aria-hidden', 'true'); bookView.removeAttribute('inert'); bookView.removeAttribute('aria-hidden'); }
  else { bookView.setAttribute('inert', ''); bookView.setAttribute('aria-hidden', 'true'); shelfView.removeAttribute('inert'); shelfView.removeAttribute('aria-hidden'); }
  pill.innerHTML = `${isBook ? 'OPEN THE BOOK' : 'OPEN THE SHELF'} <span aria-hidden="true">↗</span>`;
}

function rectOf(el: Element) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }

/** Fly the closed cover between a spine on the shelf and the middle of the page (FLIP). */
async function fly(spine: HTMLElement | null, toSpine: boolean, e: number) {
  if (!spine || reduced() || narrow()) return;
  const a = rectOf(spine), b = rectOf(coverBtn);
  const dx = a.x - b.x, dy = a.y - b.y, sx = a.w / b.w, sy = a.h / b.h;
  const small = `translate(${dx}px,${dy}px) scale(${sx},${sy})`;
  const inner = coverBtn.querySelector<HTMLElement>('.ca-inner');
  const D = 720;
  const anims = [
    coverBtn.animate(toSpine ? [{ transform: 'none', opacity: 1 }, { transform: small, opacity: 1 }] : [{ transform: small, opacity: .9 }, { transform: 'none', opacity: 1 }], { duration: D, easing: EASE_OUT, fill: 'both' }),
    ...(inner ? [inner.animate(toSpine ? [{ opacity: 1 }, { opacity: 0, offset: .45 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0, offset: .5 }, { opacity: 1 }], { duration: D, easing: 'linear', fill: 'both' })] : []),
  ];
  await Promise.race([Promise.all(anims.map(wait)), sleep(D + 1200)]);
  if (tooLate(e)) return;
  anims.forEach(x => x.cancel());
}

async function pick(i: number, spine: HTMLElement | null) {
  if (!stage || busy) return;
  const e = epoch;
  busy = true;
  lastSpine = spine;
  const wasFocus = !!spine && stage.contains(document.activeElement);
  refocus = wasFocus || mq('(max-width: 1100px)');
  loadBook(i);
  spreadIdx = narrow() ? 0 : -1;
  bookView.classList.toggle('closed', spreadIdx < 0);
  bookView.classList.remove('opening');
  paint();
  announce(`${projects[i].name}. ${narrow() ? 'Opened.' : 'Book picked from the shelf.'}`);
  if (spine) spine.style.visibility = 'hidden';
  show('book');
  if (spine && !narrow() && !reduced()) { bookView.classList.add('flying'); await fly(spine, false, e); if (tooLate(e)) return; bookView.classList.remove('flying'); }
  if (tooLate(e)) return;
  busy = false;
  if (spreadIdx < 0) {
    await sleep(reduced() ? 0 : 260);
    if (tooLate(e)) return;
    await flip(0);
  } else if (refocus) { refocus = false; refocusTitle(); }
}

async function toShelf() {
  if (!stage || mode !== 'book') return;
  if (busy) { queued = null; return; }
  const e = epoch;
  busy = true;
  const spine = lastSpine && shelfView.contains(lastSpine) ? lastSpine : shelfView.querySelector<HTMLElement>(`[data-pick="${bookIdx}"]`);
  const idx = bookIdx;
  if (!narrow() && !reduced()) {
    if (spreadIdx > 0) { await fadeSwap(() => { spreadIdx = 0; paint(); }, e); if (tooLate(e)) return; }
    if (spreadIdx === 0) { await closeCover(spreads[0], e); if (tooLate(e)) return; spreadIdx = -1; paint(); }
    bookView.classList.add('flying');
    await fly(spine, true, e);
    if (tooLate(e)) return;
    bookView.classList.remove('flying');
  }
  if (spine) spine.style.visibility = '';
  show('shelf');
  bookIdx = -1; spreadIdx = -1; spreads = []; queued = null;
  busy = false;
  announce('Back at the shelf.');
  const back = shelfView.querySelector<HTMLElement>(`[data-pick="${idx}"]`);
  back?.focus({ preventScroll: true });
}

function resetToShelf() {
  epoch++;
  stage?.getAnimations?.({ subtree: true }).forEach(a => a.cancel());
  stage?.querySelectorAll('.leaf').forEach(l => l.remove());
  shelfView?.querySelectorAll<HTMLElement>('.spine').forEach(s => { s.style.visibility = ''; });
  busy = false; queued = null; bookIdx = -1; spreadIdx = -1; spreads = [];
  bookView?.classList.remove('opening', 'flying');
  bookView?.classList.add('closed');
  if (shelfView) show('shelf');
}

function onResizeMode() {
  if (!visible || mode !== 'book' || busy) return;
  if (narrow() && spreadIdx < 0) spreadIdx = 0;
  bookView.classList.toggle('closed', spreadIdx < 0);
  paint();
}

function setMinimized(min: boolean) {
  minimized = min;
  if (!stage) return;
  stage.classList.toggle('min', min);
  pill.hidden = !min || !visible;
  document.body.classList.toggle('book-min', min);
  syncPanelInert();
  if (min) pill.focus({ preventScroll: true });
  else (mode === 'book' ? hideBtns[1] : hideBtns[0])?.focus({ preventScroll: true });
}

/** On narrow screens the book covers the side panel, so the panel must not be reachable by keyboard or screen reader while it is hidden behind. */
function syncPanelInert() {
  const panel = document.querySelector('#content-panel');
  if (!panel) return;
  const covered = visible && !minimized && mq('(max-width: 1100px)');
  if (covered) panel.setAttribute('inert', ''); else panel.removeAttribute('inert');
}

// ---------- public API ----------
/** Shows the shelf, or, with a project id, picks that book off the shelf and opens it. */
export function openBook(projectId?: string) {
  ensure();
  window.clearTimeout(hideTimer);
  const idx = projectId ? projects.findIndex(p => p.id === projectId) : -1;
  const wasVisible = visible;
  visible = true;
  stage!.hidden = false;
  document.body.classList.add('book-open');
  if (minimized && (projectId || !wasVisible)) { minimized = false; stage!.classList.remove('min'); document.body.classList.remove('book-min'); }
  pill.hidden = !minimized;
  syncPanelInert();
  if (!wasVisible) {
    resetToShelf();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      stage!.classList.add('shown');
      if (idx >= 0) void pick(idx, shelfView.querySelector<HTMLElement>(`[data-pick="${idx}"]`));
      else if (mq('(max-width: 1100px)')) window.setTimeout(() => { if (visible && !minimized) shelfView.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true }); }, 80);
    }));
  } else if (idx >= 0 && !(mode === 'book' && bookIdx === idx)) {
    // jumping to another book (from the side list): put the current one away without ceremony, then pick the new one
    const spine = shelfView.querySelector<HTMLElement>(`[data-pick="${idx}"]`);
    if (mode === 'book') {
      epoch++;
      stage!.getAnimations?.({ subtree: true }).forEach(a => a.cancel());
      stage!.querySelectorAll('.leaf').forEach(l => l.remove());
      shelfView.querySelectorAll<HTMLElement>('.spine').forEach(s => { s.style.visibility = ''; });
      busy = false; queued = null;
      show('shelf');
    }
    void pick(idx, spine);
  }
}

export function closeBook() {
  if (!stage || !visible) return;
  visible = false;
  stage.classList.remove('shown');
  pill.hidden = true;
  document.body.classList.remove('book-open', 'book-min');
  minimized = false;
  stage.classList.remove('min');
  syncPanelInert();
  hideTimer = window.setTimeout(() => { if (!visible && stage) { stage.hidden = true; resetToShelf(); } }, 380);
}

/** Focusable elements inside the book, for the panel's Tab trap. Empty while the book is hidden or tucked away. */
export function bookTabbables(): HTMLElement[] {
  const shown = !!stage && visible && !minimized;
  const list = shown ? [...stage!.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')].filter(el => !el.closest('[inert]') && !el.hidden) : [];
  if (pill && !pill.hidden) list.push(pill);
  return list;
}
export function isBookOpen() { return visible; }
