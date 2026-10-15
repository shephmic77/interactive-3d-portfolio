import { books, projects, type Chart, type Project } from './content';

/**
 * The open book for the Projects section.
 * Spread 0 is the title page and contents; spreads 1..n are one project each (left: plate and numbers, right: the write-up).
 * Wide screens show two pages and turn a leaf; narrow screens stack the two pages in one scrolling column.
 */
const esc = (v: string) => v.replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]!));
const pad = (n: number) => String(n).padStart(2, '0');
const total = () => projects.length + 1;
const mq = (q: string) => typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
const narrow = () => mq('(max-width: 750px)');
const reduced = () => mq('(prefers-reduced-motion: reduce)');

let stage: HTMLElement | null = null;
let pages: HTMLElement;
let leftEl: HTMLElement;
let rightEl: HTMLElement;
let dots: HTMLElement;
let prevBtn: HTMLButtonElement;
let nextBtn: HTMLButtonElement;
let hideBtn: HTMLButtonElement;
let pill: HTMLButtonElement;
let live: HTMLElement;
let countEl: HTMLElement;
let ghLink: HTMLAnchorElement;
let pnL: HTMLElement;
let pnR: HTMLElement;
let current = 0;
let animating = false;
let visible = false;
let minimized = false;
let hideTimer = 0;

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
      return `<div class="ch-stack" aria-hidden="true">${c.segments.filter(s => s.value > 0).map((s, i) => `<span class="seg s${c.segments.indexOf(s)}" style="flex:${s.value / sum}"><b>${s.value}</b></span>`).join('')}</div>
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
  }
}
function plate(c: Chart): string {
  const note = 'note' in c && c.note ? `<p class="plate-note">${esc(c.note)}</p>` : '';
  return `<figure class="plate"><figcaption>${esc(c.title)}</figcaption>${chartHtml(c)}${note}</figure>`;
}

// ---------- pages ----------
type Spread = { left: string; right: string; accent: string; name: string };
const ornament = `<svg class="orn" viewBox="0 0 120 24" aria-hidden="true"><path d="M2 12h44M74 12h44" /><path d="M60 3l7 9-7 9-7-9z"/><circle cx="50" cy="12" r="2"/><circle cx="70" cy="12" r="2"/></svg>`;

function frontSpread(): Spread {
  const cats = [...new Set(projects.map(p => p.category))];
  const left = `<div class="plate-ex"><div class="ex-libris">EX LIBRIS</div>${ornament}<h3 class="ex-title" tabindex="-1">The Michael Shepherd Collection</h3>
    <p class="ex-sub">${projects.length} volumes of data science, sports analytics, AI, hardware and engineering.</p>
    <ul class="ex-key">${cats.map(cat => { const p = projects.find(x => x.category === cat)!; return `<li><i style="background:${esc(p.color)}" aria-hidden="true"></i>${esc(cat)} <strong>${projects.filter(x => x.category === cat).length}</strong></li>`; }).join('')}</ul>
    <p class="ex-hint">Pick a volume from the contents, or turn the page. <span aria-hidden="true">→</span></p></div>`;
  const right = `<h3 class="toc-h" tabindex="-1">Contents</h3><ol class="toc">${projects.map((p, i) => `<li><button type="button" class="toc-row" data-spread="${i + 1}" style="--c:${esc(p.color)}"><span class="toc-n">${pad(i + 1)}</span><span class="toc-name">${esc(p.name)}<small>${esc(p.category)}</small></span><span class="toc-dots" aria-hidden="true"></span><span class="toc-p">${2 * (i + 1)}</span></button></li>`).join('')}</ol>
`;
  return { left, right, accent: '#c9b389', name: 'Contents' };
}

function projectSpread(index: number): Spread {
  const p: Project = projects[index - 1];
  const b = books[p.id];
  const lab = { question: 'The question', data: 'The data', approach: 'How it works', findings: 'What came out', caveat: 'Worth knowing', ...(b?.labels || {}) };
  const status = [pad(index) + ' / ' + pad(projects.length), p.category.toUpperCase(), b?.kicker?.toUpperCase()].filter(Boolean).join(' · ');
  const left = `<header class="pg-head"><div class="pg-kicker">VOL. ${esc(status)}</div><h3 class="pg-title" tabindex="-1">${esc(p.name)}</h3><p class="pg-tagline">${esc(b?.tagline || p.description)}</p></header>
    ${b ? plate(b.chart) : ''}
    ${b?.stats?.length ? `<dl class="pg-stats">${b.stats.map(s => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl>` : ''}
    <ul class="pg-tools" aria-label="Tools used">${p.tools.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
`;
  const sec = (title: string, inner: string) => `<section class="pg-sec"><h4>${esc(title)}</h4>${inner}</section>`;
  const right = `<span class="ribbon" aria-hidden="true"></span>
    ${b?.question ? sec(lab.question, `<p>${esc(b.question)}</p>`) : `<section class="pg-sec"><p>${esc(p.description)}</p></section>`}
    ${b?.data ? sec(lab.data, `<p>${esc(b.data)}</p>`) : ''}
    ${b?.chart.kind === 'shelf' ? sec('Works in this volume', `<ol class="ch-works">${b.chart.items.map((w, i) => `<li><span>${pad(i + 1)}</span>${esc(w)}</li>`).join('')}</ol>`) : ''}
    ${b?.approach?.length ? sec(lab.approach, `<ul class="pg-list">${b.approach.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`) : ''}
    ${b?.findings?.length ? sec(lab.findings, `<ul class="pg-list">${b.findings.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`) : ''}
    ${b?.caveat ? `<section class="pg-sec caveat"><h4>${esc(lab.caveat)}</h4><p>${esc(b.caveat)}</p></section>` : ''}
    ${p.link ? `<a class="pg-link" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer"><span>View ${esc(p.name)} on GitHub</span><span aria-hidden="true">↗</span><small>${esc(p.link.replace('https://', ''))}</small></a>` : `<p class="pg-note">${esc(b?.repoNote || 'No public repository is linked for this volume.')}</p>`}`;
  return { left, right, accent: p.color, name: p.name };
}
const spread = (i: number): Spread => (i === 0 ? frontSpread() : projectSpread(i));

// ---------- DOM ----------
function ensure() {
  if (stage) return;
  stage = document.createElement('div');
  stage.id = 'book-stage';
  stage.className = 'book-stage';
  stage.hidden = true;
  stage.innerHTML = `<div class="book" role="region" aria-label="Project book">
      <div class="book-cover"><div class="book-pages" id="book-pages"><section class="page page-left" id="bk-left"></section><section class="page page-right" id="bk-right"></section><div class="gutter" aria-hidden="true"></div><span class="pn pn-l" id="bk-pnl" aria-hidden="true"></span><span class="pn pn-r" id="bk-pnr" aria-hidden="true"></span></div></div>
      <div class="book-bar">
        <button type="button" class="bk-btn" id="bk-prev" aria-label="Previous page"><span aria-hidden="true">←</span> PREV</button>
        <div class="bk-dots" id="bk-dots" role="group" aria-label="Jump to a volume"></div>
        <span class="bk-count" id="bk-count" aria-hidden="true"></span>
        <button type="button" class="bk-btn" id="bk-next" aria-label="Next page">NEXT <span aria-hidden="true">→</span></button>
        <a class="bk-btn bk-gh" id="bk-gh" href="#" target="_blank" rel="noopener noreferrer" hidden>GITHUB <span aria-hidden="true">↗</span></a>
        <button type="button" class="bk-btn bk-hide" id="bk-hide"><span class="wide">HIDE BOOK</span><span class="slim">SHOW LIST</span></button>
      </div>
      <div class="sr" id="bk-live" role="status" aria-live="polite"></div>
    </div>`;
  const panel = document.querySelector('#content-panel');
  (panel?.parentElement || document.body).insertBefore(stage, panel || null);
  pages = stage.querySelector('#book-pages')!;
  leftEl = stage.querySelector('#bk-left')!;
  rightEl = stage.querySelector('#bk-right')!;
  dots = stage.querySelector('#bk-dots')!;
  prevBtn = stage.querySelector('#bk-prev')!;
  nextBtn = stage.querySelector('#bk-next')!;
  hideBtn = stage.querySelector('#bk-hide')!;
  live = stage.querySelector('#bk-live')!;
  countEl = stage.querySelector('#bk-count')!;
  ghLink = stage.querySelector('#bk-gh')!;
  pnL = stage.querySelector('#bk-pnl')!;
  pnR = stage.querySelector('#bk-pnr')!;
  dots.innerHTML = Array.from({ length: total() }, (_, i) => `<button type="button" class="bk-dot" data-spread="${i}" aria-label="${i === 0 ? 'Contents' : `Volume ${i}: ${esc(projects[i - 1].name)}`}"></button>`).join('');

  pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'book-pill';
  pill.hidden = true;
  pill.innerHTML = 'OPEN THE BOOK <span aria-hidden="true">↗</span>';
  stage.parentElement!.insertBefore(pill, stage);

  prevBtn.addEventListener('click', () => go(current - 1));
  nextBtn.addEventListener('click', () => go(current + 1));
  hideBtn.addEventListener('click', () => setMinimized(true));
  pill.addEventListener('click', () => setMinimized(false));
  stage.addEventListener('click', e => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-spread]');
    if (t) { go(Number(t.dataset.spread)); }
  });
  document.addEventListener('keydown', onKey);
  const rerender = () => { if (visible && !animating) paint(); };
  if (typeof window.matchMedia === 'function') {
    window.matchMedia('(max-width: 750px)').addEventListener?.('change', rerender);
    window.matchMedia('(max-width: 1100px)').addEventListener?.('change', syncPanelInert);
  }
}

function onKey(e: KeyboardEvent) {
  if (!visible || minimized || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
  else if (e.key === 'Home') { e.preventDefault(); go(0); }
  else if (e.key === 'End') { e.preventDefault(); go(total() - 1); }
}

function paint() {
  const s = spread(current);
  stage!.style.setProperty('--book-accent', s.accent);
  leftEl.innerHTML = s.left;
  rightEl.innerHTML = s.right;
  leftEl.scrollTop = 0; rightEl.scrollTop = 0; pages.scrollTop = 0;
  prevBtn.disabled = current === 0;
  nextBtn.disabled = current === total() - 1;
  dots.querySelectorAll<HTMLButtonElement>('.bk-dot').forEach((d, i) => {
    if (i === current) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
  });
  pnL.textContent = current === 0 ? '' : String(2 * current);
  pnR.textContent = current === 0 ? 'i' : String(2 * current + 1);
  const proj = current > 0 ? projects[current - 1] : null;
  ghLink.hidden = !proj?.link;
  if (proj?.link) { ghLink.href = proj.link; ghLink.setAttribute('aria-label', `Open ${proj.name} on GitHub (opens in a new tab)`); }
  countEl.textContent = `${pad(current + 1)} / ${pad(total())}`;
  window.requestAnimationFrame(() => [leftEl, rightEl].forEach((el, i) => {
    const scrolls = el.scrollHeight > el.clientHeight + 2 && !narrow();
    el.tabIndex = scrolls ? 0 : -1;
    if (scrolls) { el.setAttribute('role', 'region'); el.setAttribute('aria-label', i ? 'Right page' : 'Left page'); } else { el.removeAttribute('role'); el.removeAttribute('aria-label'); }
  }));
  live.textContent = current === 0 ? 'Contents' : `Volume ${current} of ${projects.length}: ${s.name}`;
}

function go(target: number) {
  target = Math.max(0, Math.min(total() - 1, target));
  if (target === current || animating || !stage) return;
  const hadFocusInPages = pages.contains(document.activeElement);
  const finish = () => {
    current = target; paint(); animating = false;
    if (hadFocusInPages && !pages.contains(document.activeElement)) leftEl.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
  };
  if (narrow() || reduced()) {
    animating = true;
    if (!reduced()) { pages.classList.add('swap'); window.setTimeout(() => { finish(); pages.classList.remove('swap'); }, 160); }
    else finish();
    return;
  }
  const dir = target > current ? 1 : -1;
  const from = spread(current), to = spread(target);
  animating = true;
  const leaf = document.createElement('div');
  leaf.className = `leaf ${dir > 0 ? 'leaf-next' : 'leaf-prev'}`;
  leaf.setAttribute('aria-hidden', 'true');
  leaf.setAttribute('inert', '');
  leaf.innerHTML = dir > 0
    ? `<div class="leaf-face front page page-right">${from.right}</div><div class="leaf-face back page page-left">${to.left}</div>`
    : `<div class="leaf-face front page page-left">${from.left}</div><div class="leaf-face back page page-right">${to.right}</div>`;
  if (dir > 0) rightEl.innerHTML = to.right; else leftEl.innerHTML = to.left;
  stage.style.setProperty('--book-accent', to.accent);
  pages.appendChild(leaf);
  void leaf.offsetWidth;
  leaf.classList.add('turning');
  let done = false;
  const end = () => { if (done) return; done = true; leaf.remove(); finish(); };
  leaf.addEventListener('transitionend', end);
  window.setTimeout(end, 1000);
}

function setMinimized(min: boolean) {
  minimized = min;
  if (!stage) return;
  stage.classList.toggle('min', min);
  pill.hidden = !min || !visible;
  document.body.classList.toggle('book-min', min);
  syncPanelInert();
  if (min) pill.focus({ preventScroll: true }); else hideBtn.focus({ preventScroll: true });
}

/** On narrow screens the book covers the side panel, so the panel must not be reachable by keyboard or screen reader while it is hidden behind. */
function syncPanelInert() {
  const panel = document.querySelector('#content-panel');
  if (!panel) return;
  const covered = visible && !minimized && mq('(max-width: 1100px)');
  if (covered) panel.setAttribute('inert', ''); else panel.removeAttribute('inert');
}

// ---------- public API ----------
export function openBook(projectId?: string) {
  ensure();
  window.clearTimeout(hideTimer);
  const idx = projectId ? projects.findIndex(p => p.id === projectId) + 1 : -1;
  const wasVisible = visible;
  visible = true;
  stage!.hidden = false;
  document.body.classList.add('book-open');
  if (minimized && projectId) { minimized = false; stage!.classList.remove('min'); document.body.classList.remove('book-min'); }
  pill.hidden = !minimized;
  syncPanelInert();
  if (!wasVisible) {
    current = idx > 0 ? idx : 0;
    paint();
    requestAnimationFrame(() => requestAnimationFrame(() => stage!.classList.add('shown')));
    if (mq('(max-width: 1100px)')) window.setTimeout(() => { if (visible && !minimized) leftEl.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true }); }, 80);
  } else if (idx > 0) {
    go(idx);
  }
}

export function closeBook() {
  if (!stage || !visible) return;
  visible = false;
  stage.classList.remove('shown');
  pill.hidden = true;
  document.body.classList.remove('book-open', 'book-min');
  syncPanelInert();
  hideTimer = window.setTimeout(() => { if (!visible && stage) stage.hidden = true; }, 350);
}

/** Focusable elements inside the book, for the panel's Tab trap. Empty while the book is hidden or tucked away. */
export function bookTabbables(): HTMLElement[] {
  const shown = !!stage && visible && !minimized;
  const list = shown ? [...stage!.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')] : [];
  if (pill && !pill.hidden) list.push(pill);
  return list;
}
export function isBookOpen() { return visible; }
