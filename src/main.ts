import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildAquarium } from './aquarium';
import { openProject, projects } from './project-dive';
import resumeUrl from '../output/pdf/Michael_Shepherd_Resume.pdf?inline';
import './style.css';

const host = document.querySelector<HTMLElement>('#aquarium')!;
const status = document.querySelector<HTMLElement>('#status')!;
const label = document.querySelector<HTMLOutputElement>('#label')!;
const projectList = document.querySelector<HTMLUListElement>('#project-list')!;
const reset = document.querySelector<HTMLButtonElement>('#reset')!;
const picker = document.querySelector<HTMLDialogElement>('#project-picker')!;
const pickerButton = document.querySelector<HTMLButtonElement>('#projects')!;

const bio = document.querySelector<HTMLDialogElement>('#bio')!;
document.querySelector<HTMLAnchorElement>('#resume-download')!.href = resumeUrl;
document.querySelector('#about')?.addEventListener('click', () => bio.showModal());

const catalog = new Map(projects.map(project => [project.id, project]));
const hitProject = (key: string) => key.startsWith('engineering-') ? 'engineering' : key;
let highlightProject = (_id: string) => {};
document.querySelector('#project-count')!.textContent = String(projects.length);
pickerButton.addEventListener('click', () => picker.showModal());
picker.addEventListener('click', event => {
  if (event.target !== picker) return;
  const { left, right, top, bottom } = picker.getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) picker.close();
});
for (const project of projects) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  const marker = document.createElement('span');
  marker.className = 'project-marker';
  marker.style.setProperty('--project-color', project.color);
  marker.setAttribute('aria-hidden', 'true');
  const title = document.createElement('strong');
  title.textContent = project.name;
  const category = document.createElement('small');
  category.textContent = project.category;
  const arrow = document.createElement('span');
  arrow.className = 'project-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '›';
  button.append(marker, title, category, arrow);
  button.setAttribute('aria-haspopup', 'dialog');
  button.addEventListener('click', () => {
    picker.close();
    highlightProject(project.id);
    openProject(project);
  });
  item.append(button);
  projectList.append(item);
}
if (matchMedia('(pointer: coarse)').matches) status.textContent = 'Drag to orbit · Pinch to zoom · Tap a fish';

function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.20;
  host.append(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(43, 1, .15, 220);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 16;
  controls.zoomToCursor = true;
  controls.maxDistance = 155;
  controls.minPolarAngle = .38;
  controls.maxPolarAngle = Math.PI * .485;
  function home() {
    camera.position.set(76, 60, 49).lerp(new THREE.Vector3(0, 15, 0), camera.aspect < .85 ? -.23 : .21);
    controls.target.set(0, 15, 0);
    controls.update();
  }
  function resize() {
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.fov = camera.aspect < .85 ? 54 : 43;
    // Leave room for the title on wide screens while keeping the reef centered on narrow screens.
    const wideFraming = THREE.MathUtils.smoothstep(camera.aspect, 1.2, 2.03);
    camera.filmOffset = -0.25 * camera.aspect * camera.getFilmWidth()
      * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * wideFraming;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
  }
  resize();
  home();
  reset.addEventListener('click', home);
  window.addEventListener('resize', resize);

  const world = buildAquarium();
  let selected: (typeof world.hits)[number] | null = null;
  highlightProject = id => {
    selected = world.hits.find(hit => hitProject(hit.object.userData.key) === id) ?? null;
    hideLabel();
  };
  const hitObjects = world.hits.map(hit => hit.object);
  const hitByObject = new Map(world.hits.map(hit => [hit.object, hit]));
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function hideLabel() {
    label.hidden = true;
    world.setHovered(selected);
  }
  renderer.domElement.addEventListener('pointerleave', hideLabel);
  const canvas = renderer.domElement;
  let press: { x: number; y: number; id: number; slop: number } | null = null;
  const activePointers = new Set<number>();
  function pick(event: PointerEvent, select = false) {
    const bounds = renderer.domElement.getBoundingClientRect();
    const offsets = select && event.pointerType === 'touch'
      ? [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]]
      : [[0, 0]];
    let hit: (typeof world.hits)[number] | undefined;
    for (const [dx, dy] of offsets) {
      pointer.set((event.clientX + dx - bounds.left) / bounds.width * 2 - 1,
        1 - (event.clientY + dy - bounds.top) / bounds.height * 2);
      ray.setFromCamera(pointer, camera);
      const candidate = ray.intersectObjects(hitObjects)[0];
      if (!candidate) continue;
      ray.far = candidate.distance;
      const blocked = ray.intersectObjects(world.occluders).length > 0;
      ray.far = Infinity;
      if (blocked) continue;
      hit = hitByObject.get(candidate.object);
      break;
    }
    if (!hit) {
      hideLabel();
      return;
    }
    if (select) {
      if (hit.object.userData.key === 'submarine') {
        hideLabel();
        bio.showModal();
        return;
      }
      const project = catalog.get(hitProject(hit.object.userData.key));
      if (project) {
        selected = hit;
        hideLabel();
        openProject(project);
        return;
      }
    }
    world.setHovered(hit);
    label.textContent = hit.label;
    label.hidden = false;
    label.style.left = `${Math.min(event.clientX + 14, window.innerWidth - label.offsetWidth - 10)}px`;
    label.style.top = `${Math.max(10, event.clientY - 38)}px`;
  }
  canvas.addEventListener('pointerdown', event => {
    hideLabel();
    activePointers.add(event.pointerId);
    press = event.isPrimary && event.button === 0 && activePointers.size === 1
      ? { x: event.clientX, y: event.clientY, id: event.pointerId, slop: event.pointerType === 'touch' ? 11 : 7 }
      : null;
  });
  canvas.addEventListener('pointermove', event => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > press.slop) press = null;
    if (!event.buttons && event.pointerType !== 'touch') pick(event);
  });
  canvas.addEventListener('pointerup', event => {
    activePointers.delete(event.pointerId);
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= press.slop) pick(event, true);
    press = null;
  });
  function cancelPress(event: PointerEvent) {
    activePointers.delete(event.pointerId);
    if (press?.id === event.pointerId) press = null;
    hideLabel();
  }
  canvas.addEventListener('pointercancel', cancelPress);
  canvas.addEventListener('lostpointercapture', cancelPress);

  const paused = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let swimTime = 0;
  let previous = performance.now();
  renderer.setAnimationLoop(now => {
    if (!paused) swimTime += Math.max(0, Math.min((now - previous) / 1000, .05));
    previous = now;
    controls.update();
    world.animate(swimTime);
    renderer.render(world.scene, camera);
  });
}

try {
  start();
} catch (error) {
  console.error(error);
  status.textContent = 'This browser could not start the 3D preview.';
  reset.disabled = true;
}
