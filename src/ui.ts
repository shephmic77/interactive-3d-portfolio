import { categories, engineeringWorks, profile, projects, resume as cv, type Category, type Project } from './content';
import { bookTabbables, closeBook, openBook } from './book';
export type Section = 'projects' | 'about' | 'contact' | 'resume' | 'credits';
type NavHandler = (section:Section | 'home', projectId?:string) => void;

const panel = document.querySelector<HTMLElement>('#content-panel')!;
const body = document.querySelector<HTMLElement>('#panel-body')!;
const tag = document.querySelector<HTMLElement>('#panel-tag')!;
const scrim = document.querySelector<HTMLElement>('#panel-scrim')!;
let activeSection: Section | null = null;
let currentCategory: 'All' | Category = 'All';
let searchQuery='';
let navigate: NavHandler = () => undefined;
let lastFocus: HTMLElement | null = null;
const html = (v:string) => v.replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]!));

const sectionInfo: Record<Section, [string,string,string]> = {
  projects:['01','THE BOOK CART','A COLLECTION OF THINGS I HAVE BUILT'],
  about:['02','THE CORKBOARD','A LITTLE BIT ABOUT ME'],
  contact:['03','THE VENDING MACHINE','WAYS TO SAY HELLO'],
  resume:['04','THE RESUME STAND','EXPERIENCE & SKILLS'],
  credits:['05','THE ARCADE','BEHIND THE SCENES']
};

function heading(section:Section, eyebrow?:string){
  const [num,title,subtitle]=sectionInfo[section];
  tag.textContent=`PORTFOLIO / ${num}`;
  return `<div class="section-top"><div class="section-eyebrow">${eyebrow||subtitle}</div><h2>${title}<span class="period">.</span></h2></div>`;
}
function projectCard(p:Project){
  return `<button type="button" class="project-card" data-project="${html(p.id)}" style="--book-accent:${p.color}">
    <span class="book-spine" aria-hidden="true"><span></span></span>
    <span class="project-card-main"><span class="project-name">${html(p.name)}</span><span class="project-category">${html(p.category)}${p.status?' · '+html(p.status):''}</span></span><span class="project-arrow">↗</span>
  </button>`;
}
function projectList(){
  return heading('projects')+`<p class="panel-copy">Every book on the cart represents a project. The engineering volume collects several earlier mechanical design projects.</p>
    <label class="project-search-label" for="project-search">FIND A PROJECT</label>
    <div class="project-search-wrap"><span aria-hidden="true">⌕</span><input id="project-search" class="project-search" type="search" autocomplete="off" placeholder="Search books, tools, topics…" value="${html(searchQuery)}" /></div>
    <div class="category-list" role="group" aria-label="Filter project categories">${categories.map(c=>`<button type="button" class="category-btn ${c===currentCategory?'selected':''}" data-category="${html(c)}">${html(c)}</button>`).join('')}</div>
    <div class="projects-count" id="projects-count"></div><div class="projects-list" id="projects-list"></div>`;
}
function applyFilter(){
  const q=searchQuery.trim().toLowerCase();
  const found=projects.filter(p=>(currentCategory==='All'||p.category===currentCategory)&&(!q||[p.name,p.category,p.description,...p.tools].join(' ').toLowerCase().includes(q)));
  document.querySelector<HTMLElement>('#projects-list')!.innerHTML=found.length?found.map(projectCard).join(''):'<div class="projects-empty">No books match those filters. Try another search or category.</div>';
  document.querySelector<HTMLElement>('#projects-count')!.textContent=`${String(found.length).padStart(2,'0')} VOLUMES`;
  document.querySelectorAll<HTMLButtonElement>('.category-btn').forEach(btn=>{
    const selected=btn.dataset.category===currentCategory;btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(selected));
  });
}
function detail(project:Project){
  tag.textContent=`PROJECT / ${project.id.toUpperCase()}`;
  body.innerHTML=`<button type="button" class="back-link" id="back-to-books">← BACK TO BOOK CART</button>
    <div class="project-detail-cover" style="--book-accent:${project.color}"><span class="cover-kicker">THE MICHAEL SHEPHERD COLLECTION</span><span class="cover-ornament">✳</span><span class="cover-title">${html(project.name)}</span><span class="cover-edition">${html(project.category)}</span></div>
    <div class="section-eyebrow">PROJECT NOTES ${project.status?' / '+html(project.status.toUpperCase()):''}</div><h2 class="detail-title">${html(project.name)}<span class="period">.</span></h2>
    <p class="panel-copy">${html(project.description)}</p>${project.id==='engineering'?`<div class="section-rule">WORKS IN THIS VOLUME</div><div class="engineering-list">${engineeringWorks.map((w,i)=>`<div><span>${String(i+1).padStart(2,'0')}</span><strong>${html(w)}</strong></div>`).join('')}</div>`:''}<div class="skill-list">${project.tools.map(t=>`<span>${html(t)}</span>`).join('')}</div>
    ${project.link?`<a class="primary-action" href="${html(project.link)}" target="_blank" rel="noopener noreferrer">VIEW GITHUB REPOSITORY <span>↗</span></a>`:`<div class="note">This engineering book groups earlier CAD and fabrication work. There is no single verified public repository linked here.</div>`}`;
  document.querySelector<HTMLButtonElement>('#back-to-books')!.addEventListener('click',()=>renderSection('projects'));
  body.scrollTop=0;
}
function about(){
  return heading('about')+`<p class="lede">Hi, I'm Michael.</p>
  <p class="panel-copy">I'm studying Data Science at Penn State, and I enjoy turning subjects I care about into things I can build, analyze, and explore.</p>
  <div class="info-grid"><div class="info-card"><span>EDUCATION</span><strong>${html(profile.school)}</strong><small>${html(profile.degree)}<br>${html(profile.graduation)}</small></div>
  <div class="info-card"><span>INTERESTS</span><strong>Sports, film & data</strong><small>Basketball, soccer, geography, movies and creative projects</small></div></div>
  <div class="section-rule">WHAT I WORK ON</div><p class="panel-copy">Sports analytics, machine learning, AI applications, visualization, and smaller experiments that make learning fun. My earlier work also includes mechanical engineering and CAD.</p>
  <div class="section-rule">EXPERIENCE</div><p class="panel-copy">Worked on geospatial AI agents including flood alert and travel hazard assessment workflows, alongside independent data science projects.</p>
  <button class="inline-link" type="button" data-jump="contact">WANT TO GET IN TOUCH? <span>↗</span></button>`;
}
function contact(){
  return heading('contact')+`<p class="panel-copy">Choose a channel from the vending machine. Every link below works and opens the appropriate destination.</p>
    <div class="contact-list"><a class="contact-card" href="mailto:${html(profile.email)}"><span class="contact-icon">@</span><span><small>EMAIL</small><strong>${html(profile.email)}</strong></span><span class="contact-arrow">↗</span></a>
    <a class="contact-card" href="${html(profile.linkedin)}" target="_blank" rel="noopener noreferrer"><span class="contact-icon">in</span><span><small>CONNECT</small><strong>LinkedIn</strong></span><span class="contact-arrow">↗</span></a>
    <a class="contact-card" href="${html(profile.github)}" target="_blank" rel="noopener noreferrer"><span class="contact-icon">&lt;/&gt;</span><span><small>VIEW CODE</small><strong>GitHub</strong></span><span class="contact-arrow">↗</span></a></div>
    <div class="note">The vending machine is on the back of the building, beside the credits arcade cabinet. Rotate the scene to find both.</div>`;
}
function resume(){
  const li=(t:string[])=>`<ul role="list">${t.map(x=>`<li>${html(x)}</li>`).join('')}</ul>`;
  const jobs=cv.experience.map(j=>`<div class="rs-row"><strong>${html(j.org)}</strong><span>${html(j.place)}</span></div><div class="rs-row rs-it"><em>${html(j.role)}</em><em>${html(j.dates)}</em></div>${li(j.bullets)}`).join('');
  const works=cv.projects.map(p=>`<p class="rs-proj"><strong>${html(p.name)} | ${html(p.tools)}</strong></p>${li(p.bullets)}`).join('');
  const skills=cv.skills.map(k=>`<p><strong>${html(k.label)}:</strong> ${html(k.items)}</p>`).join('');
  return heading('resume')+`<p class="panel-copy">My resume, laid out as the one-page PDF. Open the PDF for the original file.</p>
  <a class="primary-action" href="${html(cv.pdf)}" target="_blank" rel="noopener noreferrer" aria-label="Open the resume as a PDF in a new tab"><span class="pa-text">OPEN THE PDF</span> <span aria-hidden="true">↗</span></a>
  <div class="resume-paper" id="resume-paper" role="region" aria-label="Resume, one page"><div class="rs-wrap"><article class="sheet">
    <h3 class="rs-name">${html(profile.name)}</h3>
    <p class="rs-contact"><strong>${html(profile.email)} | ${html(cv.phone)}</strong> | ${html(cv.linkedin)} | ${html(cv.site)} | ${html(profile.github.replace('https://',''))}</p>
    <section><h4 class="rs-h">EDUCATION</h4><div class="rs-row"><span class="rs-l"><strong>${html(cv.school.name)}</strong> | ${html(cv.school.place)}</span><span>Anticipated Graduation: <strong><em>${html(cv.school.grad)}</em></strong></span></div><p><em>${html(cv.school.degree)}</em></p></section>
    <section><h4 class="rs-h">TECHNICAL SKILLS</h4>${skills}</section>
    <section><h4 class="rs-h">EXPERIENCE</h4>${jobs}</section>
    <section><h4 class="rs-h">PROJECTS</h4>${works}</section>
    <section><h4 class="rs-h">CERTIFICATES</h4><p>${cv.certificates.map(html).join(' | ')}</p></section>
  </article></div></div>
  <button type="button" id="print-resume" class="ghost-action">PRINT THIS PAGE</button>`;
}
function markResumeScroller(){
  const r=document.querySelector<HTMLElement>('#resume-paper');if(!r)return;
  if(r.scrollWidth>r.clientWidth+1)r.setAttribute('tabindex','0');else r.removeAttribute('tabindex');
}
function credits(){
 return heading('credits')+`<div class="arcade-banner"><span class="pixel-stars">✦  ✷  ✦</span><strong>THANKS FOR PLAYING</strong><span>INSERT CURIOSITY TO CONTINUE</span></div>
  <p class="panel-copy">A small arcade hidden behind the building, reserved for the credits and a look at how this little world was built.</p>
  <div class="section-rule">INSPIRATION</div><div class="credit-row"><strong>Jesse Zhou</strong><span>Inspiration for this project</span></div>
  <div class="section-rule">BUILT WITH</div><div class="credit-row"><strong>Three.js</strong><span>3D scene, camera and object interactions</span></div><div class="credit-row"><strong>TypeScript</strong><span>Application logic</span></div><div class="credit-row"><strong>Vite</strong><span>Development and production build</span></div><div class="credit-row"><strong>CSS + Canvas</strong><span>Interface and procedural graphic textures</span></div>
  <div class="section-rule">A NOTE ABOUT THE ART</div><p class="panel-copy">The 3D building in this starter is made from original procedural geometry, not a purchased scene or a hidden background image. The models, positions and interactions are editable in the source.</p>
  <div class="note">This credits panel covers the supplied prototype. Add required asset and music attributions here if you incorporate third-party files in the future.</div>`;
}
const layouts:Record<Section,()=>string>={projects:projectList,about,contact,resume,credits};

function renderSection(section:Section){
  activeSection=section;
  body.innerHTML=layouts[section]();
  body.scrollTop=0;
  if(section==='projects') {
    applyFilter();
    document.querySelector<HTMLInputElement>('#project-search')?.addEventListener('input',e=>{
      searchQuery=(e.target as HTMLInputElement).value;applyFilter();
    });
  }
  if(section==='resume'){document.querySelector('#print-resume')?.addEventListener('click',()=>window.print());markResumeScroller();}
  body.querySelectorAll<HTMLButtonElement>('[data-jump]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.jump as Section)));
}
export function showPanel(section:Section, projectId?:string){
  if(!panel.classList.contains('open'))lastFocus=(document.activeElement as HTMLElement)||null;
  renderSection(section);
  if(section==='projects' && projectId){const p=projects.find(p=>p.id===projectId);if(p) detail(p);}
  if(section==='projects')openBook(projectId);else closeBook();
  panel.classList.toggle('wide',section==='resume');
  panel.classList.add('open');panel.setAttribute('aria-hidden','false');
  scrim.hidden=false;requestAnimationFrame(()=>scrim.classList.add('visible'));
  document.body.classList.add('panel-open');
  document.querySelector('#intro')?.classList.add('subdued');
  document.querySelectorAll<HTMLButtonElement>('[data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
  panel.focus();
}
export function closePanel(){
  closeBook();activeSection=null;panel.classList.remove('open');panel.setAttribute('aria-hidden','true');
  scrim.classList.remove('visible');window.setTimeout(()=>{if(!scrim.classList.contains('visible'))scrim.hidden=true;},280);
  document.body.classList.remove('panel-open');document.querySelector('#intro')?.classList.remove('subdued');
  document.querySelectorAll<HTMLButtonElement>('[data-section]').forEach(b=>b.classList.remove('active'));
  lastFocus?.focus({preventScroll:true});lastFocus=null;
}
export function initUI(nav:NavHandler){
  navigate=nav;
  window.addEventListener('resize',()=>{if(activeSection==='resume')markResumeScroller();});
  document.querySelector<HTMLButtonElement>('#panel-close')!.addEventListener('click',()=>navigate('home'));
  scrim.addEventListener('click',()=>navigate('home'));
  body.addEventListener('click',(event)=>{
    const t=event.target as HTMLElement;
    const filter=t.closest<HTMLButtonElement>('[data-category]');
    if(filter&&activeSection==='projects'){currentCategory=filter.dataset.category as typeof currentCategory;applyFilter();return;}
    const book=t.closest<HTMLButtonElement>('[data-project]');
    if(book&&activeSection==='projects'){const p=projects.find(p=>p.id===book.dataset.project);if(p){detail(p);openBook(p.id);}}
  });
  document.addEventListener('keydown',(event)=>{
    if(event.key==='Escape' && activeSection){event.preventDefault();navigate('home');}
    if(event.key==='Tab'&&activeSection){
      const tabbable=[...bookTabbables(),...panel.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input')];
      if(!tabbable.length)return;
      if(event.shiftKey&&document.activeElement===tabbable[0]){event.preventDefault();tabbable[tabbable.length-1].focus();}
      else if(!event.shiftKey&&document.activeElement===tabbable[tabbable.length-1]){event.preventDefault();tabbable[0].focus();}
    }
  });
}
