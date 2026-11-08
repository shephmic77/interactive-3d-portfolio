import { projects, projectDetails, type Chart, type Project } from './project-content';
import { projectBriefs } from './project-briefs';

export { projects };

const dialog = document.querySelector<HTMLDialogElement>('#project-dive')!;
const navigation = document.querySelector<HTMLElement>('#dive-nav')!;
const content = document.querySelector<HTMLElement>('#dive-content')!;
const repository = document.querySelector<HTMLAnchorElement>('#dive-repo')!;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

function section(title: string, entries: string[]) {
  const group = element('section');
  if (!entries.length) return group;
  const list = element('ul');
  for (const entry of entries) list.append(element('li', entry));
  group.append(element('h3', title), list);
  return group;
}

function pairs(title: string, entries: { label: string; value: string }[], className = '') {
  const group = element('section');
  if (!entries.length) return group;
  const list = element('dl');
  list.className = className;
  for (const { label, value } of entries) {
    const pair = element('div');
    pair.append(element('dt', label), element('dd', value));
    list.append(pair);
  }
  group.append(element('h3', title), list);
  return group;
}

function bars(items: { label: string; value: number; text: string }[], max: number) {
  const group = element('div');
  group.className = 'dive-bars';
  for (const item of items) {
    const row = element('div');
    const fill = element('span');
    fill.style.width = `${Math.max(0, Math.min(1, item.value / max)) * 100}%`;
    const track = element('div');
    track.className = 'dive-track';
    track.setAttribute('aria-hidden', 'true');
    track.append(fill);
    row.append(element('span', item.label), element('strong', item.text), track);
    group.append(row);
  }
  return group;
}

function workflow(steps: string[]) {
  const list = element('ol');
  list.className = 'dive-workflow';
  for (const [index, step] of steps.entries()) {
    const item = element('li');
    const number = element('span', String(index + 1).padStart(2, '0'));
    number.setAttribute('aria-hidden', 'true');
    item.append(number, element('strong', step));
    list.append(item);
  }
  return list;
}

function chartView(chart: Chart) {
  const figure = element('figure');
  figure.className = 'dive-chart';
  figure.append(element('figcaption', chart.title));
  switch (chart.kind) {
    case 'bars':
      figure.append(bars(chart.items, chart.max));
      break;
    case 'prob':
      for (const group of chart.groups) {
        const max = group.items.some(item => item.value > 1) ? 100 : 1;
        figure.append(element('h4', group.heading), bars(group.items.map(item => ({
          ...item, text: `${+(item.value / max * 100).toFixed(1)}%`,
        })), max));
      }
      break;
    case 'gauge':
      figure.append(bars([{ label: chart.label, text: chart.text, value: chart.value }], chart.max),
        element('p', chart.sub));
      break;
    case 'stack': {
      const total = chart.segments.reduce((sum, segment) => sum + segment.value, 0);
      figure.append(bars(chart.segments.map(segment => ({ ...segment, text: String(segment.value) })), total),
        pairs('Breakdown', chart.chips, 'dive-stats'));
      break;
    }
    case 'steps':
      figure.append(workflow(chart.steps));
      break;
    case 'matrix': {
      const table = element('table');
      const caption = element('caption', 'Each marked cell is a comparison in the project.');
      const header = table.createTHead().insertRow();
      header.append(element('th', 'Baseline'));
      for (const col of chart.cols) header.append(element('th', col));
      const body = table.createTBody();
      for (const row of chart.rows) {
        const tr = body.insertRow();
        const label = element('th', row);
        label.scope = 'row';
        tr.append(label);
        for (const _ of chart.cols) tr.append(element('td', 'Included'));
      }
      table.prepend(caption);
      figure.append(table);
      break;
    }
    case 'keys':
      figure.append(section(chart.knob, chart.keys));
      break;
    case 'contrast': {
      const compare = element('div');
      compare.className = 'dive-compare';
      compare.append(section(chart.from.heading, chart.from.items), section(chart.to.heading, chart.to.items));
      figure.append(compare);
      break;
    }
    case 'cards':
      figure.append(pairs('Details', chart.items.map(item => ({ label: item.title, value: item.text }))));
      break;
    case 'shelf':
    case 'chat':
      figure.append(section(chart.kind === 'shelf' ? 'Collection' : 'Examples', chart.items));
      break;
  }
  if ('note' in chart && chart.note) figure.append(element('p', chart.note));
  return figure;
}

export function openProject(project: Project) {
  const details = projectDetails[project.id];
  const brief = projectBriefs[project.id];
  dialog.style.setProperty('--dive-accent', project.color);
  dialog.querySelector('#dive-index')!.textContent =
    `Dive log ${String(projects.indexOf(project) + 1).padStart(2, '0')} · ${project.category}`;
  dialog.querySelector('#dive-title')!.textContent = project.name;
  dialog.querySelector('#dive-tagline')!.textContent = details.tagline;
  dialog.querySelector('#dive-status')!.textContent = project.status || details.kicker || '';
  dialog.querySelector('#dive-credit')!.textContent = details.credit || details.repoNote || '';
  repository.hidden = !project.link;
  if (project.link) repository.href = project.link;
  else repository.removeAttribute('href');

  const labels = details.labels;
  const quickRead = element('section');
  quickRead.className = 'dive-brief';
  quickRead.append(element('h3', 'Project summary'), element('p', brief.summary));
  const panels = [
    { title: 'Overview', available: true, render: () => [
      quickRead,
      pairs('At a glance', details.stats ?? [], 'dive-stats'),
      element('h3', 'How it works'),
      workflow(brief.flow),
      element('h3', 'Project background'),
      ...details.overview.map(text => element('p', text)),
      section(labels?.question || 'Research question', details.question ? [details.question] : []),
      section(labels?.data || 'Data and scope', details.data),
      section('Tools', details.tools ?? project.tools),
    ] },
    { title: 'Method', available: !!(details.method?.length || details.details?.length), render: () => [
      pairs(labels?.method || 'Approach', (details.method ?? []).map(step => ({ label: step.title, value: step.text }))),
      pairs(labels?.details || 'Design choices', (details.details ?? []).map(item => ({ label: item.term, value: item.text }))),
    ] },
    { title: 'Results', available: true, render: () => [
      section(labels?.findings || details.titles?.results || 'Findings', details.findings),
      chartView(details.chart),
      ...(details.extra ? [chartView(details.extra)] : []),
    ] },
    { title: 'Limits & files', available: !!(details.limits?.length || details.learned?.length || details.next?.length || details.files?.length),
      render: () => [
        section(labels?.limits || 'Limitations', details.limits ?? []),
        section(labels?.learned || 'Lessons', details.learned ?? []),
        section(labels?.next || 'Next steps', details.next ?? []),
        pairs(labels?.files || 'Files to explore', (details.files ?? []).map(file => ({ label: file.path, value: file.text }))),
      ] },
  ];
  navigation.replaceChildren();
  for (const panel of panels.filter(item => item.available)) {
    const button = element('button', panel.title);
    button.type = 'button';
    button.setAttribute('aria-controls', 'dive-content');
    button.addEventListener('click', () => {
      for (const sibling of navigation.children) sibling.setAttribute('aria-pressed', String(sibling === button));
      content.setAttribute('aria-label', panel.title);
      content.replaceChildren(...panel.render());
      content.scrollTop = 0;
    });
    navigation.append(button);
  }
  navigation.querySelector('button')!.click();
  dialog.showModal();
}
