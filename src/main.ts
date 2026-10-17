import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildWorld, type HitTarget } from './world';
import { closePanel, initUI, showPanel, type Section } from './ui';
import { projects } from './content';
import './style.css';

const element=document.querySelector<HTMLElement>('#scene')!;
const tooltip=document.querySelector<HTMLElement>('#tooltip')!;
const intro=document.querySelector<HTMLElement>('#intro')!;
const quickNav=document.querySelector<HTMLElement>('#quick-nav')!;
const menuToggle=document.querySelector<HTMLButtonElement>('#mobile-explore')!;
let activeSection:Section|'home'='home';
let renderer:THREE.WebGLRenderer|null=null;
let controls:OrbitControls|null=null;
let camera:THREE.PerspectiveCamera|null=null;
let raycaster:THREE.Raycaster|null=null;
let world:ReturnType<typeof buildWorld>|null=null;
let cameraTween:{startPos:THREE.Vector3;startTarget:THREE.Vector3;endPos:THREE.Vector3;endTarget:THREE.Vector3;startTime:number;duration:number}|null=null;
const mouse=new THREE.Vector2();
let pointerDown:{x:number;y:number}|null=null;
let wasDragging=false;
let hovered:HitTarget|null=null;
const mobile=()=>typeof window.matchMedia==='function' ? window.matchMedia('(max-width: 750px)').matches : window.innerWidth<=750;

// Default (title) view. V9 shrank the building and tightened the plaza, so the whole composition (cart, building,
// sign post) now fits in a closer view. Desktop is checked by numeric projection (fov 39, 1920x945): the cluster
// spans roughly x 590-1390 px, clear of the intro text on the left and the quick-nav on the right.
const HOME_DIRECTION=new THREE.Vector3(18.8,8.9,20.9).normalize();
const HOME_DISTANCE=21.5;
const HOME_TARGET=new THREE.Vector3(-.1,4.6,.3);
const MOBILE_HOME_POSITION=new THREE.Vector3(18.8,14.6,20.9).multiplyScalar(1.28);
const MOBILE_HOME_TARGET=new THREE.Vector3(0,4.6,0);
function homeView():{pos:THREE.Vector3;target:THREE.Vector3}{
 if(mobile())return {pos:MOBILE_HOME_POSITION.clone(),target:MOBILE_HOME_TARGET.clone()};
 return {pos:HOME_TARGET.clone().addScaledVector(HOME_DIRECTION,HOME_DISTANCE),target:HOME_TARGET.clone()};
}

const views:Record<Section,{pos:THREE.Vector3;target:THREE.Vector3}>={
  projects:{pos:new THREE.Vector3(-5.85,4.5,10.5),target:new THREE.Vector3(-4.09,1.55,3.02)},
  about:{pos:new THREE.Vector3(9.4,4.0,-.4),target:new THREE.Vector3(2.84,2.05,.28)},
  contact:{pos:new THREE.Vector3(5.3,3.5,-8.8),target:new THREE.Vector3(1.1,1.2,-2.82)},
  resume:{pos:new THREE.Vector3(8.1,3.6,8.5),target:new THREE.Vector3(2.74,1.15,3.27)},
  credits:{pos:new THREE.Vector3(-2.8,3.7,-9.0),target:new THREE.Vector3(-.14,1.2,-2.82)}
};

function tweenTo(pos:THREE.Vector3,target:THREE.Vector3,duration=1050){
 if(!camera||!controls)return;
 cameraTween={startPos:camera.position.clone(),startTarget:controls.target.clone(),endPos:pos.clone(),endTarget:target.clone(),startTime:performance.now(),duration:(typeof window.matchMedia==='function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)?1:duration};
 controls.enabled=false;
}
function hideMobileMenu(){quickNav.classList.remove('mobile-open');menuToggle.setAttribute('aria-expanded','false');menuToggle.innerHTML='EXPLORE <span>↑</span>';}
function navigateTo(section:Section|'home',projectId?:string,updateHash=true){
 hideMobileMenu();
 world?.setHovered(null);hovered=null;tooltip.classList.remove('shown');
 activeSection=section;
 if(section==='home'){
  closePanel();intro.classList.remove('subdued');
  const home=homeView();tweenTo(home.pos,home.target,1080);
 }else{
  showPanel(section,projectId);
  const view=views[section];tweenTo(view.pos,view.target,950);
 }
 if(updateHash){const hash=section==='home'?'#home':`#${section}`;if(location.hash!==hash)history.pushState(null,'',hash);}
}
function readHash(){const h=location.hash.replace('#','');const section:Section|'home'=['projects','about','contact','resume','credits'].includes(h)?h as Section:'home';navigateTo(section,undefined,false);}

initUI(navigateTo);
document.querySelectorAll<HTMLButtonElement>('[data-section]').forEach(button=>button.addEventListener('click',()=>navigateTo(button.dataset.section as Section)));
document.querySelector<HTMLButtonElement>('#reset-view')!.addEventListener('click',()=>navigateTo('home'));
document.querySelector<HTMLAnchorElement>('#logo-home')!.addEventListener('click',(event)=>{event.preventDefault();navigateTo('home')});
menuToggle.addEventListener('click',()=>{const on=quickNav.classList.toggle('mobile-open');menuToggle.setAttribute('aria-expanded',String(on));menuToggle.innerHTML=on?'CLOSE <span>×</span>':'EXPLORE <span>↑</span>';});
window.addEventListener('popstate',readHash);

try{
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setSize(element.clientWidth,element.clientHeight);
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.52;
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=mobile()?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;   // the cheaper filter on phones
 // Nothing that casts a shadow moves except the hover-scaled targets, so the shadow map is drawn once and redrawn only when one of them moves.
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 element.appendChild(renderer.domElement);
 camera=new THREE.PerspectiveCamera(40,element.clientWidth/element.clientHeight,.09,150);
 const home=homeView();
 camera.position.copy(home.pos);camera.lookAt(home.target);
 controls=new OrbitControls(camera,renderer.domElement);
 controls.target.copy(home.target);
 controls.enableDamping=true;
 controls.dampingFactor=.065;
 controls.minDistance=7.5;
 controls.maxDistance=40;
 controls.maxPolarAngle=Math.PI*.49;
 controls.minPolarAngle=.36;
 controls.enablePan=false;
 controls.rotateSpeed=.65;
 controls.zoomSpeed=.72;
 controls.update();
 raycaster=new THREE.Raycaster();
 world=buildWorld();
 const clock=new THREE.Clock();
 const render=()=>{
  requestAnimationFrame(render);
  if(!renderer||!camera||!controls||!world)return;
  if(cameraTween){
   const raw=Math.min(1,(performance.now()-cameraTween.startTime)/cameraTween.duration);
   const k=raw<.5?4*raw*raw*raw:1-Math.pow(-2*raw+2,3)/2;
   camera.position.lerpVectors(cameraTween.startPos,cameraTween.endPos,k);
   controls.target.lerpVectors(cameraTween.startTarget,cameraTween.endTarget,k);
   if(raw>=1){cameraTween=null;controls.enabled=true;}
  }
  controls.update();if(world.animate(clock.getElapsedTime()))renderer.shadowMap.needsUpdate=true;renderer.render(world.scene,camera);
 };
 render();
 const isInside=(o:THREE.Object3D,ancestor?:THREE.Object3D)=>{for(let p:THREE.Object3D|null=o;p;p=p.parent)if(p===ancestor)return true;return false;};
 /** Nearest interactive object under the pointer that is actually visible: a second ray, stopped just short of the
  *  hit, must not strike any solid mesh (wall, roof, furniture) that is not part of the target itself. This stops the
  *  vending machine and arcade behind the building from reacting when the pointer is over the front of the building. */
 const pickVisibleHit=():HitTarget|null=>{
  if(!raycaster||!world)return null;
  const candidates=raycaster.intersectObjects(world.hits.map(h=>h.object),false);
  for(const candidate of candidates){
   const target=world.hits.find(h=>h.object===candidate.object);
   if(!target)continue;
   raycaster.far=Math.max(0,candidate.distance-.03);
   const blockers=raycaster.intersectObjects(world.occluders,false).filter((b:THREE.Intersection)=>!isInside(b.object,target.visual)&&!isInside(b.object,target.object));
   raycaster.far=Infinity;
   if(!blockers.length)return target;
  }
  return null;
 };
 const hoverPick=(e:PointerEvent)=>{
  if(!camera||!renderer||!raycaster||!world||wasDragging)return;
  const rect=renderer.domElement.getBoundingClientRect();
  mouse.x=(e.clientX-rect.left)/rect.width*2-1;mouse.y=-(e.clientY-rect.top)/rect.height*2+1;
  raycaster.setFromCamera(mouse,camera);
  hovered=pickVisibleHit();
  world.setHovered(hovered);
  renderer.domElement.style.cursor=hovered?'pointer':'grab';
  if(hovered&&!mobile()){tooltip.textContent=hovered.label;tooltip.style.left=`${Math.min(window.innerWidth-210,e.clientX)}px`;tooltip.style.top=`${Math.max(36,e.clientY)}px`;tooltip.classList.add('shown');}
  else tooltip.classList.remove('shown');
 };
 renderer.domElement.addEventListener('pointerdown',(e:PointerEvent)=>{pointerDown={x:e.clientX,y:e.clientY};wasDragging=false;tooltip.classList.remove('shown');});
 renderer.domElement.addEventListener('pointermove',(e:PointerEvent)=>{
  if(pointerDown&&Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>6){wasDragging=true;world?.setHovered(null);tooltip.classList.remove('shown');}
  else if(!pointerDown)hoverPick(e);
 });
 renderer.domElement.addEventListener('pointerup',(e:PointerEvent)=>{
  const shouldClick=!!pointerDown&&!wasDragging;pointerDown=null;wasDragging=false;
  if(shouldClick){hoverPick(e);if(hovered){const hit=hovered;navigateTo(hit.section,hit.projectId);}}
 });
 renderer.domElement.addEventListener('pointerleave',()=>{hovered=null;world?.setHovered(null);pointerDown=null;tooltip.classList.remove('shown');renderer!.domElement.style.cursor='grab';});
 function resize(){if(!camera||!renderer||!controls)return;const w=element.clientWidth,h=element.clientHeight;camera.aspect=w/h;camera.fov=mobile()?46:39;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(window.devicePixelRatio,mobile()?1.25:1.5));renderer.setSize(w,h,false);}
 window.addEventListener('resize',resize);resize();
}catch(error){
 console.error('Unable to start WebGL scene:',error);
 element.innerHTML=`<div style="display:grid;place-items:center;height:100%;padding:20px;color:#bcd0e0;background:#091327;text-align:center;font-family:system-ui">The interactive 3D scene is unavailable in this browser. You can still use the menu to explore the portfolio.</div>`;
}

if(location.hash&&location.hash!=='#home')readHash();
// Project counts are kept in content.ts. No external data loading or API keys required.
console.info(`Portfolio ready: ${projects.length} project volumes.`);
