import * as THREE from 'three';
import { projects, type Project } from './content';
import type { Section } from './ui';

export type HitTarget={ object:THREE.Object3D; section:Section; label:string; projectId?:string; visual?:THREE.Object3D };
export type World={scene:THREE.Object3D; hits:HitTarget[]; /** Solid meshes that can hide an interactive object from the pointer (used to reject hovers through walls). */ occluders:THREE.Object3D[]; setHovered:(hit:HitTarget|null)=>void; animate:(elapsed:number)=>void};
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
const materialCache=new Map<string,THREE.MeshStandardMaterial>();
const color=(hex:string,metalness=0,roughness=.79,emissive?:string,emissiveIntensity=0)=>{
 const key=[hex,metalness,roughness,emissive??'',emissiveIntensity].join(':');
 let mat=materialCache.get(key);
 if(!mat){mat=new THREE.MeshStandardMaterial({color:hex,metalness,roughness,emissive:emissive||'#000000',emissiveIntensity});materialCache.set(key,mat);}
 return mat;
};
const dark=color('#18233a'), wood=color('#68534d'), brass=color('#dfad78',.53,.37), stone=color('#716f86'), trim=color('#2e5964',.2), moss=color('#35544b'), leaf=color('#3a8765'), leaf2=color('#5f9a68'), glass=color('#e0b679',0,.16,'#ffb25d',.55), bright=color('#ffd39c',0,.42,'#ffb566',1.05);
const cyan='#6befff', magenta='#ff66ce', amber='#ffc078', violet='#b499ff';
const neon=(c:string,brightness=2.2)=>color(c,.12,.32,c,brightness);
let seed=45178;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
// Textures use their own generator so the number of windows never changes the scatter of plants or paving.
let texSeed=90211;const texRandom=()=>{texSeed=(texSeed*16807)%2147483647;return(texSeed-1)/2147483646;};
const cubeGeometry=new THREE.BoxGeometry(1,1,1);
const planeGeometry=new THREE.PlaneGeometry(1,1);
function box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,rot=0){
 const mesh=new THREE.Mesh(cubeGeometry,mat);
 mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.y=rot;
 mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cyl(parent:THREE.Object3D,x:number,y:number,z:number,r1:number,r2:number,h:number,mat:THREE.Material,segments=10){let m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
function sphere(parent:THREE.Object3D,x:number,y:number,z:number,r:number,mat:THREE.Material,segments=9){let m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,segments<=1?0:1),mat);m.position.set(x,y,z);if(mat===leaf||mat===leaf2)m.userData.foliage=true;parent.add(m);return m;}
function plank(parent:THREE.Object3D,x:number,y:number,z:number,w:number,d:number,mat:THREE.Material){return box(parent,x,y,z,w,.11,d,mat);}
function line(parent:THREE.Object3D,pts:THREE.Vector3[],radius:number,mat:THREE.Material){const curve=new THREE.CatmullRomCurve3(pts);const m=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(7,pts.length*6),radius,5,false),mat);parent.add(m);return m;}

function texture(draw:(ctx:CanvasRenderingContext2D,w:number,h:number)=>void,w=512,h=256){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d')!;draw(ctx,w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}

// ---------------------------------------------------------------------------------------------
// LIGHTING BUDGET
// A real PointLight is evaluated for every lit pixel of every lit material, so the scene keeps a
// small set of real "key" lights (all created in buildWorld, plus the two rear machines and the
// alley lamp) and fakes every other lamp with an emissive mesh, an additive halo and additive
// light-pool decals. Decals cost no per-pixel lighting, so lamps can still visibly light their
// surroundings. Do not add new PointLights to individual fixtures; use halo()/glowPatch() instead.
// ---------------------------------------------------------------------------------------------
export const POINT_LIGHT_BUDGET=16;
/** The building (walls, terraces, furnishings, back-wall machines) is built at its original size and then shrunk by this factor. */
export const BUILDING_SCALE=.78;
/** Live tuning without editing code: open the site with e.g. `?glow=1.3&keys=0.9&room=1.4` to scale the fake-light
 *  halos/pools (glow), the real key lights (keys) and the warm light inside the rooms (room). 1 = as authored; clamped to 0..4. */
const tuning=(()=>{
 const q=typeof location!=='undefined'?new URLSearchParams(location.search):null;
 const read=(name:string)=>{const v=Number(q?.get(name));return Number.isFinite(v)&&v>0?Math.min(v,4):1;};
 return {glow:read('glow'),keys:read('keys'),room:read('room')};
})();
type KeyLight={light:THREE.PointLight;base:number;amp:number;speed:number;phase:number};
const keyLights:KeyLight[]=[];
/** Creates a real PointLight and registers it for animation. `intensity` is captured as the light's
 *  base level, so animation always breathes around the configured value, never a stale constant. */
function keyLight(parent:THREE.Object3D,hex:string,intensity:number,distance:number,x:number,y:number,z:number,amp=0,speed=.7,phase=0){
 const light=new THREE.PointLight(hex,intensity*tuning.keys,distance,2);light.position.set(x,y,z);parent.add(light);
 keyLights.push({light,base:light.intensity,amp,speed,phase});return light;
}
let glowMap:THREE.Texture|null=null;
function glowTexture(){return glowMap??(glowMap=texture((c,W,H)=>{
 const g=c.createRadialGradient(W/2,H/2,0,W/2,H/2,W/2);
 g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.16,'rgba(255,255,255,.62)');g.addColorStop(.42,'rgba(255,255,255,.2)');g.addColorStop(.72,'rgba(255,255,255,.045)');g.addColorStop(1,'rgba(255,255,255,0)');
 c.clearRect(0,0,W,H);c.fillStyle=g;c.fillRect(0,0,W,H);
},128,128));}
const glowMaterials=new Map<string,THREE.Material>();
function haloMaterial(hex:string,opacity:number){
 const key=`s:${hex}:${opacity}`;let m=glowMaterials.get(key) as THREE.SpriteMaterial|undefined;
 if(!m){m=new THREE.SpriteMaterial({map:glowTexture(),color:hex,opacity:Math.min(1,opacity*tuning.glow),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});glowMaterials.set(key,m);}
 return m;
}
function patchMaterial(hex:string,opacity:number){
 const key=`p:${hex}:${opacity}`;let m=glowMaterials.get(key) as THREE.MeshBasicMaterial|undefined;
 if(!m){m=new THREE.MeshBasicMaterial({map:glowTexture(),color:hex,opacity:Math.min(1,opacity*tuning.glow),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});glowMaterials.set(key,m);}
 return m;
}
/** Soft camera-facing bloom around a bulb or neon tube. */
function halo(parent:THREE.Object3D,x:number,y:number,z:number,size:number,hex:string,opacity=.6){
 const s=new THREE.Sprite(haloMaterial(hex,opacity));s.position.set(x,y,z);s.scale.setScalar(size);parent.add(s);return s;
}
/** Additive light-pool decal. `flat` lays it on a floor (normal up); otherwise it faces local +Z
 *  (use it on walls, in the local space of the fixture). `rotY` turns it in its own plane. */
function glowPatch(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,hex:string,opacity:number,rotY=0,flat=false){
 const m=new THREE.Mesh(planeGeometry,patchMaterial(hex,opacity));m.position.set(x,y,z);m.scale.set(w,h,1);
 if(flat){m.rotation.x=-Math.PI/2;m.rotation.z=rotY;}else m.rotation.y=rotY;
 parent.add(m);return m;
}
/** Height of the walkable surface below a given world height: pavement, terrace or roof terrace. */
const surfaceBelow=(y:number)=>y<4.2?.045:y<7.6?4.455:7.945;

function labelTexture(words:string,fg='#ecfaff',bg='#122c42',border='#78efff',w=768,h=192,vertical=false){
  return texture((c,W,H)=>{c.fillStyle=bg;c.fillRect(0,0,W,H);c.lineWidth=10;c.strokeStyle=border;c.shadowBlur=18;c.shadowColor=border;c.strokeRect(14,14,W-28,H-28);c.shadowBlur=0;c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';const fontSize=vertical?62:Math.min(77,Math.floor(W/(words.length*.68+1)),Math.floor(H*.52));c.font=`bold ${fontSize}px system-ui, Arial`;c.fillText(words,W/2,H/2,W-60);},w,h);
}
/** All cover art is generated from project metadata; no external image assets are needed. */
function bookCoverTexture(project:Project){
 return texture((ctx,w,h)=>{
  ctx.fillStyle=project.color;ctx.fillRect(0,0,w,h);
  const grad=ctx.createLinearGradient(0,0,w,h);
  grad.addColorStop(0,'#ffffff58');grad.addColorStop(.4,'#ffffff0c');grad.addColorStop(1,'#08182b7a');
  ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#132038a6';ctx.lineWidth=13;ctx.strokeRect(23,22,w-46,h-44);
  ctx.strokeStyle='#f7ffec';ctx.lineWidth=4;ctx.strokeRect(35,35,w-70,h-70);
  ctx.fillStyle='#203049';ctx.font='bold 27px Arial';ctx.textAlign='center';
  ctx.fillText('MICHAEL SHEPHERD',w/2,90,w-80);
  ctx.font='bold 21px Arial';ctx.fillText(project.category.toUpperCase(),w/2,132,w-65);
  ctx.save();ctx.translate(w/2,h*.41);ctx.strokeStyle='#10253eaa';ctx.lineWidth=18;
  ctx.beginPath();ctx.arc(0,0,w*.20,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<5;i++){const theta=i*Math.PI*2/5;ctx.fillStyle=i%2?'#faf2e8cc':'#16213fb3';ctx.fillRect(Math.cos(theta)*w*.18-22,Math.sin(theta)*w*.18-22,44,44);}
  ctx.restore();
  const words=project.name.split(' ');const lines:string[]=[];let current='';
  for(const word of words){if((current+' '+word).trim().length>17&&current){lines.push(current);current=word;}else current=(current+' '+word).trim();}
  if(current)lines.push(current);
  ctx.fillStyle='#0e1c31';ctx.textAlign='center';ctx.font='bold 49px Arial';
  lines.slice(0,4).forEach((line,i)=>ctx.fillText(line,w/2,h*.69+i*59,w-70));
  ctx.fillStyle='#0e1c31';ctx.font='bold 21px Arial';ctx.fillText(project.status==='In progress'?'WORK IN PROGRESS':'PORTFOLIO VOLUME',w/2,h-64,w-70);
 },512,768);
}
function plane(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,tex:THREE.Texture,rot=0,emissive=0){const mat=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,transparent:true});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);mesh.position.set(x,y,z);mesh.rotation.y=rot;parent.add(mesh);return mesh;}
type WindowStyle='warm'|'dark'|'blinds'|'planter';
const glareMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false});
// ---------------------------------------------------------------------------------------------
// HOLLOW BUILDING
// Both floors are real rooms: walls are slabs with genuine openings (no textured "picture" windows), a floor
// and ceiling, and a few simple furnishings (see interiors()). Every window/door registers its opening here
// first, then hollowWall() cuts each wall around the openings that belong to it.
// ---------------------------------------------------------------------------------------------
type Opening={x:number;y:number;z:number;w:number;h:number;rot:number};
const openings:Opening[]=[];
const WALL_T=.24, WALL_IN=.05;   // wall thickness, and the inner plaster layer within it
/** Warm interior surfaces. They glow gently (emissive) so rooms read as lit from inside; `?room=` scales this. */
const plasterMat=()=>color('#cdb08c',0,.92,'#ff9a52',.30*tuning.room);
const ceilingMat=()=>color('#a98f78',0,.95,'#ff9a52',.22*tuning.room);
const floorMat=()=>color('#8a6a4c',0,.85,'#ff8a40',.16*tuning.room);
/** True when something small at (x,y,z) would sit across a registered opening (keeps brick joints out of windows). */
function overlapsOpening(x:number,y:number,z:number,reach:number){
 for(const o of openings){
  const dx=x-o.x,dz=z-o.z;
  const lx=dx*Math.cos(o.rot)-dz*Math.sin(o.rot),ln=dx*Math.sin(o.rot)+dz*Math.cos(o.rot);
  if(Math.abs(ln)<.6&&Math.abs(lx)<o.w/2+reach+.12&&Math.abs(y-o.y)<o.h/2+.2)return true;
 }
 return false;
}
/** A wall slab with holes. (x,y,z) is the centre of the OUTER face at the wall's base; `rot` turns local +Z (outward)
 *  to the world. Openings whose registered position lies on this wall are cut out; the wall is an outer brick layer
 *  plus a thin inner plaster layer. */
function hollowWall(parent:THREE.Object3D,x:number,y:number,z:number,rot:number,width:number,height:number,outer:THREE.Material,inner:THREE.Material){
 const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);
 const sin=Math.sin(rot),cos=Math.cos(rot);
 const cuts=openings.flatMap(o=>{
  if(Math.abs(Math.sin((o.rot-rot)/2))>1e-3)return [];
  const dx=o.x-x,dz=o.z-z;
  const ln=dx*sin+dz*cos,lx=dx*cos-dz*sin;
  if(Math.abs(ln)>.4||Math.abs(lx)+o.w/2>width/2+1e-3)return [];
  // An opening on another storey that merely lines up with this wall must not be cut into it.
  if(o.y+o.h/2<=y+.01||o.y-o.h/2>=y+height-.01)return [];
  return [{l:lx-o.w/2,r:lx+o.w/2,b:THREE.MathUtils.clamp(o.y-o.h/2-y,0,height),t:THREE.MathUtils.clamp(o.y+o.h/2-y,0,height)}];
 }).sort((a,b)=>a.l-b.l);
 const piece=(x0:number,x1:number,y0:number,y1:number)=>{
  if(x1-x0<.002||y1-y0<.002)return;
  const w=x1-x0,h=y1-y0,cx=(x0+x1)/2,cy=(y0+y1)/2,t=WALL_T-WALL_IN;
  box(g,cx,cy,-t/2,w,h,t,outer).userData.wall=true;
  // The inner plaster is glowing (emissive), so it stops short of the wall's outer ends: otherwise its end face shows
  // as a thin bright line down every building corner.
  const i0=x0<=-width/2+1e-3?x0+.07:x0,i1=x1>=width/2-1e-3?x1-.07:x1;
  box(g,(i0+i1)/2,cy,-t-WALL_IN/2,i1-i0,h,WALL_IN,inner).userData.wall=true;
 };
 let cursor=-width/2;
 for(const c of cuts){piece(cursor,c.l,0,height);piece(c.l,c.r,0,c.b);piece(c.l,c.r,c.t,height);cursor=c.r;}
 piece(cursor,width/2,0,height);
 return g;
}
/** Wall-thickness lining of an opening, so you see a proper reveal rather than a paper-thin hole. */
function reveal(node:THREE.Object3D,w:number,h:number,bottom=true){
 const mat=color('#8a7a6c',0,.9,'#ff9a52',.12*tuning.room),face=-.108,d=WALL_T,z=face-d/2;
 box(node,-w/2+.02,0,z,.04,h,d,mat);box(node,w/2-.02,0,z,.04,h,d,mat);box(node,0,h/2-.02,z,w,.04,d,mat);
 if(bottom)box(node,0,-h/2+.02,z,w,.04,d,mat);
}
/** `groundSpill` lets a lit window throw a pool of light onto the surface in front of it; turn it off
 *  where nothing walkable lies below (so a light patch never hovers in mid-air). */
function facadeWindow(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,rot=0,style:WindowStyle='warm',groundSpill=true,lintel=true){
  openings.push({x,y,z,w,h,rot});
  const node=new THREE.Group();node.position.set(x,y,z);node.rotation.y=rot;parent.add(node);
  // Casing around the hole (four bars, not a solid backing), then the thin sash inside the hole.
  box(node,0,h/2+.06,0,w+.24,.12,.20,dark);box(node,0,-h/2-.06,0,w+.24,.12,.20,dark);
  box(node,-w/2-.06,0,0,.12,h,.20,dark);box(node,w/2+.06,0,0,.12,h,.20,dark);
  reveal(node,w,h);
  box(node,-w/2+.045,0,0,.09,h,.10,trim);box(node,w/2-.045,0,0,.09,h,.10,trim);
  box(node,0,h/2-.045,0,w,.09,.10,trim);box(node,0,-h/2+.045,0,w,.09,.10,trim);
  box(node,0,0,0,.06,h,.08,dark);box(node,0,.12,0,w,.06,.08,dark);
  if(style==='dark'){
    // A quiet room with a lamp on behind curtains: dim warm glass, two curtain panels, a soft glow (vtest8).
    box(node,0,0,-.19,w,h,.03,color('#4a3430',.1,.3,'#ff9f55',.3));
    for(const sx of [-1,1])box(node,sx*(w/2-.16),.02,-.12,.30,h-.12,.04,color('#c9a98d',0,.9,'#8a6a50',.18));
    halo(node,-w*.14,-h*.10,-.08,Math.max(w,h)*.8,'#ffb36a',.4);
    glowPatch(node,0,-h*.04,-.04,w+1.5,h+1.3,'#ffbd6e',.07);
    for(const xx of [-w*.28,w*.30])pot(node,xx,-h*.5-.07,.2,.2);   // two little pots on the sill
  }
  if(style==='blinds'){
    // A half-drawn blind creates a silhouette distinctly different from the lit shops.
    box(node,0,h*.30,-.02,w-.14,h*.30,.03,color('#879088'));
    for(let i=0;i<4;i++)box(node,0,h*.43-i*.12,.02,w-.16,.025,.04,trim);
  }
  if(style==='planter'){
    box(node,0,-h*.52,.27,w*.84,.17,.27,color('#80675b'));
    for(const xx of [-.30,0,.29])pot(node,xx,-h*.52+.08,.30,.22);   // pots stand on the planter box top
  }
  box(node,0,-h*.50-.12,.19,w+.28,.10,.30,stone);
  if(lintel)box(node,0,h*.50+.12,.12,w+.25,.085,.22,stone);   // omitted under the shop awning, which would swallow it
  // Warm window light spilling onto the surrounding masonry/trim and the surface in front.
  if(style==='warm'||style==='planter'||style==='blinds'){
    glowPatch(node,0,-h*.04,-.04,w+1.9,h+1.7,'#ffbd6e',style==='blinds'?.09:.12);
    if(groundSpill){
      const sideways=Math.abs(Math.sin(rot))>.5;
      glowPatch(parent,x+Math.sin(rot)*1.35,surfaceBelow(y-h/2),z+Math.cos(rot)*1.35,w+1.4,2.8,'#ffbd6e',.11,sideways?Math.PI/2:0,true);
    }
  }
  const glare=new THREE.Mesh(planeGeometry,glareMaterial);glare.scale.set(w*.22,h*.93,1);glare.position.set(-w*.20,0,.06);glare.rotation.z=.12;node.add(glare);
  return node;
}
/** A real doorway: opening, reveal, casing and a glazed door leaf (solid kick panel, open glass above). */
function doorway(parent:THREE.Object3D,x:number,cy:number,z:number,w:number,h:number,rot:number){
 openings.push({x,y:cy,z,w,h,rot});
 const node=new THREE.Group();node.position.set(x,cy,z);node.rotation.y=rot;parent.add(node);
 const frame=color('#245b61',.2,.49);
 box(node,-w/2-.07,0,0,.14,h+.14,.20,dark);box(node,w/2+.07,0,0,.14,h+.14,.20,dark);box(node,0,h/2+.07,0,w+.28,.14,.20,dark);
 reveal(node,w,h,false);
 box(node,-w/2+.06,0,-.02,.12,h,.08,frame);box(node,w/2-.06,0,-.02,.12,h,.08,frame);
 box(node,0,h/2-.06,-.02,w,.12,.08,frame);
 box(node,0,-h/2+.40,-.02,w-.1,.80,.08,frame);          // solid kick panel
 box(node,0,-h/2+.86,-.02,w-.1,.09,.09,frame);          // mid rail under the glass
  box(node,w/2-.06,-h*.06,.045,.04,.5,.05,brass);          // pull handle, screwed to the lock stile
 const glare=new THREE.Mesh(planeGeometry,glareMaterial);glare.scale.set(w*.22,h*.6,1);glare.position.set(-w*.2,h*.1,.05);glare.rotation.z=.12;node.add(glare);
 return node;
}
/** `cordTop` is the absolute height of whatever the lamp hangs from (an awning underside, a bracket arm); the cord
 *  ends exactly there, so it never pokes through the support. */
function hangingLamp(parent:THREE.Object3D,x:number,y:number,z:number,intensity=1.0,cordTop=y+.35){
  if(cordTop>y+.16)line(parent,[V(x,cordTop,z),V(x,y+.14,z)],.025,dark);cyl(parent,x,y+.05,z,.19,.29,.22,brass);
  sphere(parent,x,y-.08,z,.16,bright);
  // Bloom around the bulb and a pool where its light lands (no real light per lamp, see LIGHTING BUDGET).
  halo(parent,x,y-.06,z,.9+.45*intensity,'#ffc78f',.65);
  glowPatch(parent,x,surfaceBelow(y),z,2.0+.7*intensity,1.8+.6*intensity,'#ffc27a',.09*Math.min(1.4,intensity),0,true);
}
/** Clean low-poly houseplant: a clay pot with a soil disc and a bush made of a few flat-shaded leaf blobs. Every blob
 *  overlaps its neighbours and the pot rim, so nothing floats or pokes out as a stray shard. `trail` makes a fuller bush
 *  that spills a little over the rim. `floorY` is kept for call-site compatibility (the old trailing vines are gone). */
function pot(parent:THREE.Object3D,x:number,y:number,z:number,s=.4,trail=false,_floorY?:number){
  const clay=color('#996553'),soil=color('#3b2c2a');
  cyl(parent,x,y+s*.24,z,s*.25,s*.20,s*.48,clay,8);                 // pot body, y .. y+.48s
  cyl(parent,x,y+s*.49,z,s*.27,s*.27,s*.05,clay,8);                 // rim lip
  cyl(parent,x,y+s*.505,z,s*.215,s*.215,s*.02,soil,8);              // soil
  const tall=random()<.4,lean=random()*6.28;
  const blob=(dx:number,dy:number,dz:number,r:number,i:number)=>{const m=sphere(parent,x+dx,y+dy,z+dz,r,i%2?leaf:leaf2,1);m.rotation.set(i*.7,i*1.3,0);return m;};
  if(tall){
    cyl(parent,x,y+s*.78,z,s*.025,s*.035,s*.58,color('#5c4538'),5);   // slim stem rising from the soil
    blob(0,s*1.16,0,s*.30,0);
    for(let i=0;i<3;i++){const a=lean+i*2.09;blob(Math.cos(a)*s*.20,s*.96,Math.sin(a)*s*.20,s*.19,i+1);}
  }else{
    blob(0,s*.80,0,s*.27,0);
    for(let i=0;i<4;i++){const a=lean+i*1.57+random()*.3;blob(Math.cos(a)*s*.21,s*.66,Math.sin(a)*s*.21,s*.17,i+1);}
    blob(Math.cos(lean)*s*.06,s*1.02,Math.sin(lean)*s*.06,s*.17,5);
  }
  if(trail){for(let i=0;i<3;i++){const a=lean+.8+i*2.09;blob(Math.cos(a)*s*.30,s*.53,Math.sin(a)*s*.30,s*.12,i);}}
}
/** Ivy clinging to a wall: three slim stems hung from a ledge, each with pairs of pointed leaves lying flat on the face.
 *  `wall` says which face: 'z' = a wall facing +Z at z=`face`, 'x' = a wall facing +X at x=`face`. `at` is the position
 *  along the wall, `top` the height the ivy hangs from (a ledge, awning or cornice). */
function addVines(parent:THREE.Object3D,wall:'x'|'z',face:number,at:number,top:number,height:number){
 const g=new THREE.Group();
 if(wall==='z')g.position.set(at,0,face);else{g.position.set(face,0,at);g.rotation.y=Math.PI/2;}   // local +Z is always out of the wall
 parent.add(g);
 for(let i=0;i<3;i++){
  const dx=(i-1)*.17,len=height*(.72+.14*((i*2)%3)/2);
  line(g,[V(dx,top,.02),V(dx+.025,top-len*.5,.024),V(dx-.01,top-len,.02)],.013,moss);
  const m=Math.max(4,Math.round(len/.2));
  for(let j=0;j<m;j++){
   const y=top-.06-(len-.1)*j/(m-1),side=j%2?1:-1;
   for(const k of [0,1]){
    const lf=new THREE.Mesh(new THREE.OctahedronGeometry(.07,0),(j+k)%2?leaf2:leaf);
    const sx=(k?1:-1)*.055;
    lf.position.set(dx+sx+side*.01,y-k*.045,.04);lf.scale.set(.85,1.55,.3);lf.rotation.z=(k?-1:1)*(.6+.25*((j*7+i*3+k)%3)/2);
    lf.userData.foliage=true;g.add(lf);
   }
  }
 }
}
/** Height of the awning's underside above a given z (the awning tilts down away from the wall at .20 rad). */
const awningUnder=(y:number,z0:number,depth:number,z:number)=>y-.19-.2*(z-(z0+depth*.45))-.03;
function awning(parent:THREE.Object3D,x:number,y:number,z:number,w:number,depth:number){for(let i=0;i<10;i++){const width=w/10,m=i%2?trim:color('#ded1bb');const seg=box(parent,x-w/2+width*(i+.5),y-.19,z+depth*.45,width+.01,.07,depth,m);seg.rotation.x=.20;}
  box(parent,x,y+.06,z+.03,w,.17,.17,dark);box(parent,x,y-.44,z+depth-.09,w,.26,.13,trim);   // rear beam rests against the wall; front valance
}
// V4: all details below are functional architecture or ordinary exterior furnishings.
// None of the personal-interest memorabilia from ENDGAME_ONLY is used here.
const iron=color('#243545',.46,.46);
const zinc=color('#8b9397',.43,.61);
const slate=color('#424e5b',.28,.73);
const darkGlass=color('#203541',.13,.25);
const pale=color('#b6a79b');

/** Yaw that turns an object's local +Z toward the world point (tx,tz) from (x,z). Seats face +Z, so this makes them face it. */
const faceTo=(x:number,z:number,tx:number,tz:number)=>Math.atan2(tx-x,tz-z);
/** A chair standing at (x,z) that faces the point (tx,tz), normally the middle of its table. */
function patioChair(parent:THREE.Object3D,x:number,y:number,z:number,tx:number,tz:number){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=faceTo(x,z,tx,tz);parent.add(g);
  // Outdoor seating is placed only on the usable terrace surfaces.
  box(g,0,.49,0,.62,.08,.51,wood);
  box(g,0,.78,-.23,.65,.57,.08,wood);
  for(const xx of [-.23,.23])for(const zz of [-.16,.16]){
    box(g,xx,.22,zz,.062,.45,.064,iron);
  }
  box(g,0,.53,0,.48,.045,.41,color('#7f8172'));
  return g;
}
/** A slatted bench seating `len` people wide, facing (tx,tz). `y` is the surface it stands on. */
function bench(parent:THREE.Object3D,x:number,y:number,z:number,tx:number,tz:number,len=1.1){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=faceTo(x,z,tx,tz);parent.add(g);
  box(g,0,.44,0,len,.09,.44,wood);                                  // seat
  box(g,0,.72,-.20,len,.40,.06,wood);                               // backrest, behind the seat
  for(const sx of [-1,1]){
    box(g,sx*(len/2-.07),.21,.12,.06,.44,.06,iron);                 // front legs
    box(g,sx*(len/2-.07),.37,-.20,.06,.74,.06,iron);                // rear legs run up to carry the backrest
    box(g,sx*(len/2-.07),.40,-.04,.05,.05,.38,iron);                // side rails tie front and rear legs
  }
}
function patioTable(parent:THREE.Object3D,x:number,y:number,z:number,r=.46){
  cyl(parent,x,y+.72,z,r,r,.09,wood,12);
  cyl(parent,x,y+.38,z,.07,.08,.68,iron,9);
  cyl(parent,x,y+.055,z,.29,.29,.07,iron,10);
}
/** Window-box planter resting on the top rail of a railing (rail top bar centre is base+.81, .065 thick).
 *  `along` is the direction the rail runs; the box's long side follows it. */
function railingPlanter(parent:THREE.Object3D,x:number,z:number,along:'x'|'z',base:number){
  const rail=base+.81,y=rail+.0325+.095;           // box bottom touches the rail top
  const rot=along==='x'?0:Math.PI/2;
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);
  box(g,0,0,0,.55,.19,.23,color('#775b53'));
  for(const bx of [-.20,.20])box(g,bx,-.095-.0325,0,.035,.15,.12,iron);   // saddle brackets straddling the rail
  for(let i=0;i<3;i++){
    const xx=(i-1)*.17;
    const b=sphere(g,xx,.17+(i===1?.03:0),0,i===1?.15:.125,i===1?leaf2:leaf,1);b.rotation.y=i*1.1;
  }
}
/** `floorY`: undefined = pool on the surface below the lamp, null = no floor pool (nothing below it). */
function wallLight(parent:THREE.Object3D,x:number,y:number,z:number,rot=0,strength=1,floorY?:number|null){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);
  box(g,0,0,0,.13,.33,.11,iron);
  box(g,0,-.04,.23,.30,.06,.36,brass);
  box(g,0,-.16,.27,.21,.22,.20,bright);
  const hood=new THREE.Mesh(new THREE.ConeGeometry(.24,.16,4),slate);
  hood.position.set(0,.015,.27);hood.rotation.y=Math.PI*.25;g.add(hood);
  // The lamp's light is faked: bulb bloom, a wash on the wall below it, and a pool where the beam lands.
  const s=Math.min(1.35,strength);
  halo(g,0,-.18,.32,.85+.3*s,'#ffb866',.6);
  glowPatch(g,0,-.55,.03,2.0+.55*s,2.5+.6*s,'#ffae60',.12*s);
  const fy=floorY===undefined?surfaceBelow(y):floorY;
  if(fy!==null){
    const reach=THREE.MathUtils.clamp((y-fy)*.5,1.2,2.4);
    glowPatch(parent,x+Math.sin(rot)*reach*.6,fy,z+Math.cos(rot)*reach*.6,reach*2.2,reach*1.8,'#ffb064',.12*s,Math.abs(Math.sin(rot))>.5?Math.PI/2:0,true);
  }
}
function exhaustVent(parent:THREE.Object3D,x:number,y:number,z:number,rot=0,w=.56){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);
  box(g,0,0,0,w+.12,.56,.15,iron);
  box(g,0,0,.09,w,.43,.035,zinc);
  for(let i=0;i<5;i++)box(g,0,-.17+i*.085,.115,w-.08,.025,.035,dark);
  for(const dx of [-w/2,w/2])sphere(g,dx,0,.12,.035,brass,1);
}
function hvacUnit(parent:THREE.Object3D,x:number,y:number,z:number,rot=0,scale=1){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;g.scale.setScalar(scale);parent.add(g);
  // Wall brackets support the condenser's weight and point back to the wall.
  for(const xx of [-.48,.48]){
    box(g,xx,-.46,-.14,.13,.11,.58,iron);      // arm from the wall to the front of the body
    box(g,xx,-.22,-.37,.11,.51,.12,iron);
  }
  box(g,0,0,0,1.26,.78,.43,zinc);
  box(g,0,0,.23,1.15,.68,.038,color('#46505e',.45,.43));
  // Low-poly fan grille and a readable central fan instead of a plain square.
  const fanRing=new THREE.Mesh(new THREE.TorusGeometry(.235,.027,5,16),iron);fanRing.position.set(-.19,0,.257);g.add(fanRing);
  cyl(g,-.19,0,.265,.065,.065,.055,slate,9).rotation.x=Math.PI/2;
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3;
    const spoke=box(g,-.19+Math.cos(a)*.12,Math.sin(a)*.12,.270,.22,.035,.028,slate);
    spoke.rotation.z=a;
  }
  for(let i=0;i<5;i++)box(g,.32,-.23+i*.112,.256,.34,.025,.033,dark);
  box(g,0,.44,0,1.29,.065,.49,slate);
  return g;
}
function electricBox(parent:THREE.Object3D,x:number,y:number,z:number,rot=0){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);
  box(g,0,0,0,.52,.74,.23,zinc);
  box(g,0,0,.14,.45,.65,.04,slate);
  box(g,.11,-.10,.175,.035,.11,.04,brass);
  box(g,-.13,.16,.177,.13,.07,.03,iron);
}
/** A pipe with elbows. With `wall`, small iron clamps tie every long vertical run back to that wall face. */
function gutter(parent:THREE.Object3D,points:THREE.Vector3[],r=.06,wall?:{axis:'x'|'z';value:number}){
  line(parent,points,r,color('#555d69',.52,.4));
  for(const q of points.slice(1,-1))sphere(parent,q.x,q.y,q.z,r*1.6,slate,1);
  if(!wall)return;
  for(let i=0;i+1<points.length;i++){
    const a=points[i],b=points[i+1],dy=Math.abs(a.y-b.y);if(dy<.6)continue;
    const n=Math.max(1,Math.round(dy/1.3));
    for(let k=0;k<n;k++){
      const t=(k+.5)/n,px=THREE.MathUtils.lerp(a.x,b.x,t),py=THREE.MathUtils.lerp(a.y,b.y,t),pz=THREE.MathUtils.lerp(a.z,b.z,t);
      const p=wall.axis==='x'?px:pz,len=Math.abs(wall.value-p);if(len<.012)continue;
      const mid=(p+wall.value)/2;
      if(wall.axis==='x')box(parent,mid,py,pz,len+.03,.09,.09,iron);else box(parent,px,py,mid,.09,.09,len+.03,iron);
    }
  }
}
function facadeServiceDetail(scene:THREE.Object3D){
  // Sparse brick courses and exposed ledgers help the sides read as masonry,
  // without piling more rooms onto the intentionally simple two-box structure.
  const joints=color('#3d4353');
  for(const side of [-1,1]){
    for(let row=0;row<8;row++){
      const yy=.43+row*.47;
      for(let j=0;j<6;j++){
        const zz=-2.80+j*1.03+(row%2)*.25;
        if(zz>2.78||overlapsOpening(side*4.262,yy,zz,.3))continue;
        const unit=box(scene,side*4.262,yy,zz,.025,.022,.54,joints);
        unit.castShadow=false;
      }
    }
  }
  // Narrow maintenance access hatch at the far end of the back service wall.
  box(scene,3.46,1.31,-3.132,.83,1.80,.12,iron);
  box(scene,3.46,1.32,-3.206,.70,1.62,.035,slate);
  box(scene,3.17,1.30,-3.235,.041,.19,.047,brass);
  for(let i=0;i<4;i++)box(scene,3.46,1.80-i*.18,-3.238,.50,.034,.037,zinc);
  boulderRoute(scene);
  // Side cornice and sill bands visually join the two elevations.
  for(const side of [-1,1]){
    box(scene,side*4.28,4.16,0,.19,.12,6.18,stone);
    box(scene,side*4.27,.32,0,.12,.14,6.17,stone);
  }
}
/** Bouldering wall that climbs the whole back of the building, from the pavement to the roof terrace, like a ladder.
 *  One tall plywood panel (four stacked sections with seams) stands just clear of every ledge and slab edge, held to the
 *  walls by steel standoffs, with a bolt-hole grid, a coral route to a finish jug on the roof, a cyan problem down the
 *  right edge, foot chips, two volumes, height ticks, chalk, a lamp either side, a crash pad with shoes, and
 *  a monkey hanging by his tail from a grab bar. At the top, the roof's back rail is open and a grab bar marks the exit. */
const BW={cx:-3.55,w:.70,zf:-3.40,t:.07,bottom:.04,top:8.12};
const hash1=(n:number)=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
function boulderRoute(scene:THREE.Object3D){
  const {cx,w,zf,t,bottom,top}=BW,h=top-bottom,mid=(top+bottom)/2;
  const WZ=ARCH.ground.depth/2,uBack=ARCH.upper.z-ARCH.upper.depth/2;
  const panel=color('#8c93a6',0,.9),edge=color('#3b4252',.2,.7);
  box(scene,cx,mid,zf+t/2,w,h,t,panel);                                         // plywood
  box(scene,cx,top+.015,zf+t/2,w+.04,.03,t+.02,edge);                           // top cap
  for(const sx of [-1,1])box(scene,cx+sx*(w/2+.015),mid,zf+t/2,.03,h+.06,t+.02,edge);
  for(let k=1;k<4;k++)box(scene,cx,bottom+k*h/4,zf+t/2,w+.02,.014,t+.012,edge); // seams between the four stacked sections
  box(scene,cx,.037,zf+.14,w+.10,.03,.28,edge);                                 // steel foot plate on the pavement
  // Standoffs: steel arms from the panel's back to the wall, clear of the terrace slab (y 4.27-4.43) and the roof slab (y 7.72-7.95).
  for(const [by,wallZ] of [[1.2,-WZ],[2.9,-WZ],[5.4,uBack],[6.55,uBack],[7.62,uBack]] as const){
    const z0=zf+t,len=Math.abs(wallZ-z0)+.02;
    for(const sx of [-1,1])box(scene,cx+sx*.23,by,z0+(wallZ-z0)/2+.01,.07,.07,len,iron);
  }
  const g=new THREE.Group();g.position.set(cx,0,zf);g.rotation.y=Math.PI;scene.add(g);   // local +z points out from the wall
  // Bolt-hole grid (T-nuts) on the panel face, one row every 20 cm.
  const rows=Math.round(h/.2);
  const grid=texture((c,W,H)=>{c.clearRect(0,0,W,H);c.fillStyle='#3c4254';for(let i=0;i<4;i++)for(let j=0;j<rows;j++){c.beginPath();c.arc(20+i*40,20+j*40,3.2,0,Math.PI*2);c.fill();}},160,rows*40);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(w-.02,h-.02),new THREE.MeshStandardMaterial({map:grid,transparent:true,roughness:.9,depthWrite:false}));
  face.position.set(0,mid,.002);face.renderOrder=1;g.add(face);
  // Painted height ticks every two metres, so the climb reads as a ladder.
  for(let m=2;m<8;m+=2){box(g,-w/2+.07,m,.004,.09,.016,.006,color('#efeae0'));box(g,w/2-.07,m,.004,.09,.016,.006,color('#efeae0'));}
  const coral=color('#ff7a59',0,.5,'#ff5a3c',.18),cyan2=color('#3fd0e8',0,.5,'#1fb0d0',.18),chip=color('#d9dce6',0,.7),violet2=color('#7c63c9',0,.6),sun=color('#ffbf3f',0,.5,'#ff9a1f',.18),amber2=color('#d98a2b',0,.6);
  type Kind='jug'|'crimp'|'sloper'|'pinch'|'chip';
  const placed:{x:number;y:number}[]=[];
  const chalkMat=new THREE.MeshBasicMaterial({color:'#efeae0',transparent:true,opacity:.16,depthWrite:false});
  const hold=(x:number,y:number,kind:Kind,mat:THREE.Material,spin=0)=>{
    let m:THREE.Mesh;
    if(kind==='jug'){m=sphere(g,x,y,.045,.085,mat,1);m.scale.set(1.05,.85,.8);}
    else if(kind==='sloper'){m=sphere(g,x,y,.03,.12,mat,1);m.scale.set(1,.75,.42);}
    else if(kind==='chip'){m=sphere(g,x,y,.02,.045,mat,1);m.scale.set(1,.8,.6);}
    else if(kind==='crimp')m=box(g,x,y,.03,.17,.035,.07,mat);
    else m=box(g,x,y,.035,.06,.15,.08,mat);
    m.rotation.z=spin;placed.push({x,y});
    const chalk=new THREE.Mesh(new THREE.CircleGeometry(kind==='chip'?.06:.1,9),chalkMat);   // chalk smudge on the panel behind the hold
    chalk.position.set(x,y,.004);chalk.renderOrder=2;g.add(chalk);
    return m;
  };
  const MONKEY={lo:4.12,hi:5.14};                                           // the hanging monkey and his bar occupy this band; routes pass either side of it
  const blocked=(y:number)=>y>MONKEY.lo&&y<MONKEY.hi;
  // Coral route: two taped start holds, a zig-zag all the way up, and a big finish jug just under the roof edge.
  hold(-.14,1.0,'jug',coral);hold(.12,1.08,'jug',coral,.2);
  for(const sx of [-.14,.12])box(g,sx,.86,.003,.17,.03,.006,coral);
  const cx2=[-.13,.14,-.04,.17,-.17,.07,-.12,.16,-.06,.13],kinds:Kind[]=['jug','crimp','sloper','pinch','jug','crimp'];
  let n=0;
  for(let y=1.55;y<7.45;y+=.52,n++){const yy=y+(n%3)*.04;if(blocked(yy))continue;hold(cx2[n%10],yy,kinds[n%6],coral,((n*37)%7-3)*.09);}
  const finish=hold(-.02,7.76,'jug',coral);finish.scale.multiplyScalar(1.3);box(g,-.02,7.60,.003,.2,.03,.006,coral);
  // Cyan problem down the right edge.
  n=0;for(let y=.95;y<7.4;y+=.6,n++){const yy=y+(n%2)*.07;if(blocked(yy)||blocked(yy+.2))continue;hold(.27+(n%3)*.015,yy,(['jug','crimp','sloper'] as Kind[])[n%3],cyan2,(n%2?-.2:.15));}
  hold(.2,7.62,'jug',cyan2);
  // Volumes: a violet prism low down and an amber one near the top.
  for(const [vy,vm] of [[2.5,violet2],[6.2,amber2]] as const){const vol=cyl(g,0,vy,.03,.2,.2,.46,vm,3);vol.rotation.z=Math.PI/2;placed.push({x:0,y:vy});}
  // Neutral foot chips scattered over the whole board, kept clear of the other holds.
  for(let y=.45;y<7.9;y+=.31){
    const x=(hash1(y)-.5)*.56;
    if(blocked(y)||blocked(y+.1)||placed.some(p=>Math.hypot(p.x-x,p.y-y)<.2))continue;
    hold(x,y,'chip',chip);
  }
  // ---- The monkey: hangs upside down from a yellow grab bar by his tail, facing the street, arms and legs dangling. Every limb starts
  // INSIDE the torso (shoulder and hip balls overlap it), and the tail wraps the bar, so the animal is one connected body that is
  // held by the bar, the bar by two steel brackets, and the brackets by the panel. Nothing floats and nothing pokes into the wall.
  const fur=color('#835a37',0,.95),belly=color('#d1a674',0,.95),skin=color('#d8b48c',0,.9),eye=color('#1a1410',0,.5);
  const BAR_Y=5.02,BAR_Z=.15,my=BAR_Y-.50,bz=.21;                                    // body centre 4.52 m up, ~11 cm off the panel
  cyl(g,0,BAR_Y,BAR_Z,.022,.022,.40,sun,8).rotation.z=Math.PI/2;                        // the bar
  for(const sx of [-1,1])box(g,sx*.17,BAR_Y,.08,.04,.05,.18,iron);                       // brackets: panel face (z 0, a little inside it) to the bar
  const torso=sphere(g,0,my,bz,.125,fur,1);torso.scale.set(.86,1.15,.86);              // y +-.144
  const tummy=sphere(g,0,my+.02,bz+.075,.085,belly,1);tummy.scale.set(.85,1.1,.55);
  sphere(g,0,my+.13,bz-.005,.05,fur,1);                                                // rump, where the tail starts
  sphere(g,0,my-.14,bz+.02,.07,fur,1);                                                 // neck, overlaps torso and head
  sphere(g,0,my-.225,bz+.02,.09,fur,1);                                                // head, hanging below the shoulders
  const muzzle=sphere(g,0,my-.205,bz+.085,.05,skin,1);muzzle.scale.set(1,.85,.7);      // upside down, so the muzzle is above the eyes
  for(const sx of [-1,1]){
    sphere(g,sx*.034,my-.245,bz+.1,.013,eye,0);
    sphere(g,sx*.093,my-.235,bz+.02,.033,skin,0);                                      // ears
    sphere(g,sx*.085,my-.075,bz,.058,fur,1);                                           // shoulder ball
    line(g,[V(sx*.085,my-.075,bz),V(sx*.14,my-.20,bz+.03),V(sx*.15,my-.33,bz+.03)],.037,fur);   // arm hangs: shoulder, elbow, hand
    sphere(g,sx*.14,my-.20,bz+.03,.04,fur,1);sphere(g,sx*.15,my-.33,bz+.03,.046,fur,1);
    sphere(g,sx*.065,my+.10,bz,.062,fur,1);                                            // hip ball
    line(g,[V(sx*.065,my+.10,bz),V(sx*.19,my+.01,bz+.02),V(sx*.19,my-.10,bz+.03)],.042,fur);    // leg dangles outside the torso
    sphere(g,sx*.19,my+.01,bz+.02,.046,fur,1);sphere(g,sx*.19,my-.10,bz+.03,.046,fur,1);
  }
  // Tail: up from the rump, round the front of the bar, over the top and back down behind it (about three quarters of a turn).
  line(g,[V(0,my+.13,bz-.01),V(0,my+.26,bz+.005),V(0,my+.38,bz+.005),V(0,4.994,.195),V(0,5.02,.202),V(0,5.057,.187),V(0,5.072,.15),V(0,5.057,.113),V(0,5.02,.098),V(0,4.983,.113)],.024,fur);
  // Light on the panel: warm washes at the two lamp heights (the lamps stand either side, see utilityExterior).
  for(const [ly,lw] of [[3.2,2.4],[6.7,2.4]] as const)glowPatch(g,0,ly,.01,lw,lw*1.2,'#ffc27a',.11);
  // Crash pad on the pavement below the panel, with fold seams and a strap.
  const padX=-3.55,padZ=zf-.07-.45;
  const pad=color('#2a6f7a',0,.85);
  box(scene,padX,GROUND+.08,padZ,1.1,.16,.9,pad);
  for(const sz of [-.15,.15])box(scene,padX,GROUND+.162,padZ+sz,1.1,.004,.025,color('#3f9aa6'));
  box(scene,padX,GROUND+.162,padZ-.40,.5,.004,.05,color('#e8c26a'));
  // Climbing shoes (red and black) on the pad, side by side, toes to the wall.
  for(const [sx,sr] of [[-.30,.05],[-.14,-.05]] as const){
    const sh=new THREE.Group();sh.position.set(padX+.30+sx,GROUND+.16,padZ+.12);sh.rotation.y=sr;scene.add(sh);
    box(sh,0,.014,0,.09,.028,.28,color('#1d2029'));box(sh,0,.06,-.02,.085,.07,.17,color('#c9402f'));box(sh,0,.04,.09,.08,.05,.1,color('#c9402f'));box(sh,0,.062,-.115,.07,.07,.05,color('#1d2029'));
  }
}
function utilityExterior(scene:THREE.Object3D){
  // Everything here is mounted on a wall face: ground-floor walls are at x=+-4.25 / z=+-3.075, the upper block's
  // right wall at x=1.70, its back wall at z=-3.02 and its left wall at x=-3.90. Standoffs are 2-7 cm.
  const WX=ARCH.ground.width/2,WZ=ARCH.ground.depth/2,u=ARCH.upper;
  const uRight=u.x+u.width/2,uLeft=u.x-u.width/2,uBack=u.z-u.depth/2;
  // Right facade: high condenser near the corner, vent and routed power cable.
  hvacUnit(scene,WX+.27,3.67,2.25,Math.PI/2,.88);
  exhaustVent(scene,WX+.075,1.44,2.18,Math.PI/2,.50);
  electricBox(scene,WX+.115,1.08,-2.87,Math.PI/2);
  gutter(scene,[V(WX+.15,4.02,2.25),V(WX+.06,4.04,2.82),V(WX+.06,3.25,2.82),V(WX+.06,.03,2.82)],.044,{axis:'x',value:WX});
  // Left side has its own downspout (upper run on the upper block, lower run on the ground floor), a low utility box and vent.
  exhaustVent(scene,-WX-.075,3.48,1.86,-Math.PI/2,.61);
  electricBox(scene,-WX-.115,1.07,2.17,-Math.PI/2);
  gutter(scene,[V(uLeft-.075,7.8,.79),V(uLeft-.075,4.5,.79)],.065,{axis:'x',value:uLeft});
  gutter(scene,[V(-WX-.075,4.27,.79),V(-WX-.075,.03,.79)],.065,{axis:'x',value:-WX});
  // Upper rear unit exhausts toward open air; its wiring meets the service conduit.
  hvacUnit(scene,-2.40,6.15,uBack-.14,Math.PI,.83);
  // Disconnect box stacked above the condenser, wired to it by a short conduit (it used to sit across the back rail).
  electricBox(scene,-2.4,7.12,uBack-.115,Math.PI);
  gutter(scene,[V(-2.4,6.56,uBack-.12),V(-2.4,6.74,uBack-.12)],.041);
  exhaustVent(scene,uRight+.075,6.97,-2.02,Math.PI/2,.46);
  // Service-facing lamps illuminate the back walkway and the two machines (plate back face on the wall).
  wallLight(scene,-3.0,3.85,-WZ-.057,Math.PI,1.8);    // beside the bouldering panel, above the window, lighting the holds
  wallLight(scene,-2.95,7.0,uBack-.057,Math.PI,1.2,null);   // second lamp, up by the roof exit
  wallLight(scene,-.05,3.56,-WZ-.057,Math.PI,1.25);
  wallLight(scene,3.18,3.59,-WZ-.057,Math.PI,1.6);
  wallLight(scene,-WX-.057,3.57,-2.64,-Math.PI/2,1.1);
  wallLight(scene,WX+.057,3.20,2.10,Math.PI/2,1.0);
  // Condenser on the upper block's right wall, beside the terrace door.
  hvacUnit(scene,uRight+.08+.215*.68,6.15,-1.86,Math.PI/2,.68);
}
/** Ground surface of the plaza paving (tile tops at .0235); things that stand on it start a hair below that. */
const GROUND=.022;
/** A plain wooden crate: body with a slightly larger lid board and four darker corner battens. */
function crate(parent:THREE.Object3D,x:number,z:number,size:number,rotY=0){
  const g=new THREE.Group();g.position.set(x,GROUND,z);g.rotation.y=rotY;parent.add(g);
  const slat=color('#4f3d38');
  box(g,0,size/2,0,size,size,size,wood);
  box(g,0,size+.015,0,size+.04,.03,size+.04,slat);                 // lid
  for(const sx of [-1,1])for(const sz of [-1,1])box(g,sx*(size/2-.025),size/2,sz*(size/2-.025),.05,size+.005,.05,slat);   // corner battens
}
function storefrontDetails(scene:THREE.Object3D){
  // The awning is a fixed canopy: its rear beam rests on the wall and its front valance is part of the canopy itself.
  // Door threshold, brass kick plate, latch and small glass sidelight trim.
  box(scene,.06,.18,3.48,1.79,.21,.37,slate);
  box(scene,.06,.46,3.225,1.28,.34,.03,brass);   // kick plate, now screwed to the door leaf itself
  wallLight(scene,-1.03,3.18,ARCH.ground.depth/2+.057,0,.70);   // between the display window and the door casing
  wallLight(scene,1.12,3.18,ARCH.ground.depth/2+.057,0,.70);
  // The bench gives the entry a practical resting spot without blocking the cart; it faces the street.
  bench(scene,2.15,GROUND,4.0,2.15,6,1.15);
  // Two wooden crates by the display window (merchandise overflow). They stand on the pavement.
  crate(scene,-3.70,4.22,.52,.12);
  crate(scene,-3.12,4.14,.40,-.2);
  // A single waiting chair beside the door, turned to face the street.
  patioChair(scene,-1.92,GROUND,4.2,-1.92,6);
  pot(scene,-1.45,.0,4.04,.34,false);
  pot(scene,1.86,.0,4.10,.36,false);
  box(scene,.03,.04,4.34,1.56,.03,.55,color('#d09354'));
  // The lamps illuminate nearby practical objects rather than washing the facade.
  wallLight(scene,-ARCH.ground.width/2-.057,2.26,2.95,-Math.PI/2,.86);
  wallLight(scene,ARCH.ground.width/2+.057,2.15,2.92,Math.PI/2,1.0);
}
/** Small lantern standing on a table top: base, glass globe and bloom. Returns nothing; `top` is the table surface. */
function tableLantern(parent:THREE.Object3D,x:number,top:number,z:number){
  cyl(parent,x,top+.03,z,.07,.08,.06,iron,8);
  sphere(parent,x,top+.15,z,.09,bright,1);
  halo(parent,x,top+.16,z,1.5,'#ffc27a',.6);
}
/** Four short legs under a slab, so benches/tables do not hover. */
function legsUnder(parent:THREE.Object3D,x:number,z:number,halfW:number,halfD:number,bottomY:number,topY:number,t=.06,mat:THREE.Material=iron){
  const h=topY-bottomY;
  for(const sx of [-1,1])for(const sz of [-1,1])box(parent,x+sx*halfW,bottomY+h/2,z+sz*halfD,t,h+.02,t,mat);
}
/** Low round coffee table with four legs. `y` is the surface it stands on. */
function sideTable(parent:THREE.Object3D,x:number,y:number,z:number,r=.27){
  cyl(parent,x,y+.43,z,r,r,.05,wood,12);
  for(const [dx,dz] of [[1,1],[1,-1],[-1,1],[-1,-1]] as const)box(parent,x+dx*r*.62,y+.21,z+dz*r*.62,.045,.42,.045,iron);
}
function terraceFurnishings(scene:THREE.Object3D){
  const T=ARCH.groundRoof+.123;             // terrace surface (tile top 4.455)
  const h=ARCH.groundRoof+.12;
  // Bistro set on the right terrace: two chairs face each other across a small round table.
  const bt={x:2.95,z:1.45};
  patioTable(scene,bt.x,h,bt.z,.34);
  patioChair(scene,bt.x-.66,h,bt.z,bt.x,bt.z);
  patioChair(scene,bt.x+.66,h,bt.z,bt.x,bt.z);
  // Lounge corner against the upper wall: a bench and a chair face each other across a low table.
  bench(scene,2.0,T-.005,-1.9,2.85,-1.9,1.05);
  sideTable(scene,2.85,T-.005,-1.9);
  patioChair(scene,3.52,h,-1.9,2.85,-1.9);
  // Window-box planters sit on the railing's top rail.
  railingPlanter(scene,2.92,3.23,'x',ARCH.groundRoof);
  railingPlanter(scene,-.70,3.23,'x',ARCH.groundRoof);
  railingPlanter(scene,4.31,-1.54,'z',ARCH.groundRoof);
  railingPlanter(scene,4.31,.60,'z',ARCH.groundRoof);
  // Soft practical lantern on the terrace table (table top is h+.765).
  tableLantern(scene,bt.x,h+.765,bt.z);
  glowPatch(scene,bt.x,4.455,bt.z,4.2,3.6,'#ffbf7a',.12,0,true);
  // Small drainage outlet at the terrace low point, piped through the slab edge into a downspout.
  gutter(scene,[V(4.12,T+.025,-2.94),V(4.33,T+.025,-2.94),V(4.34,3.80,-2.94),V(4.34,.03,-2.94)],.055,{axis:'x',value:ARCH.ground.width/2});
  // String of terrace bulbs in a right angle: three slim poles (front, corner, right) and two runs that follow the front and right rails
  // instead of cutting diagonally across the corner.
  const poleA=V(1.95,T,2.90),poleC=V(4.06,T,2.90),poleB=V(4.06,T,.65),topY=T+1.72;
  for(const pole of [poleA,poleC,poleB]){
    cyl(scene,pole.x,(T+topY)/2,pole.z,.03,.04,topY-T,iron,7);cyl(scene,pole.x,T+.03,pole.z,.11,.13,.06,iron,8);sphere(scene,pole.x,topY+.02,pole.z,.045,brass,1);
  }
  const run=(from:THREE.Vector3,to:THREE.Vector3)=>{
    const pts:THREE.Vector3[]=[];
    for(let i=0;i<=8;i++){const t=i/8;pts.push(V(from.x+(to.x-from.x)*t,topY-.26*4*t*(1-t),from.z+(to.z-from.z)*t));}
    line(scene,pts,.018,dark);
    const curve=new THREE.CatmullRomCurve3(pts);
    for(const t of [.25,.5,.75]){const p=curve.getPoint(t);sphere(scene,p.x,p.y-.09,p.z,.08,bright,1);halo(scene,p.x,p.y-.09,p.z,.85,'#ffc172',.55);}
  };
  run(V(poleA.x,topY,poleA.z),V(poleC.x,topY,poleC.z));
  run(V(poleC.x,topY,poleC.z),V(poleB.x,topY,poleB.z));
}
function roofFurnishings(scene:THREE.Object3D){
  const R=ARCH.upperRoof+.165;               // roof surface (slab top 7.945)
  const h=ARCH.upperRoof+.16;
  // Three chairs around the round lantern table, each turned to face it, plus a small drinks table by one chair.
  const rt={x:-1.17,z:-.30};
  patioChair(scene,rt.x-.74,h,rt.z,rt.x,rt.z);
  patioChair(scene,rt.x+.74,h,rt.z,rt.x,rt.z);
  patioChair(scene,rt.x,h,rt.z-.76,rt.x,rt.z);
  patioTable(scene,-2.66,R-.02,-1.10,.24);
  // A compact tool locker by the HVAC unit, not a random sculpture.
  box(scene,1.36,R+.355,-1.12,.48,.71,.42,slate);
  box(scene,1.36,R+.37,-.89,.35,.58,.04,zinc);
  box(scene,1.48,R+.36,-.845,.04,.14,.03,brass);
  box(scene,.92,R+.15,-1.20,.42,.30,.34,wood);
  // Lantern on the roof table (its top is at 8.695) with a pool of light on the roof.
  tableLantern(scene,-1.17,8.695,-.30);
  glowPatch(scene,-1.15,R,-.30,4.0,3.4,'#ffbe74',.12,0,true);
  cyl(scene,.35,h+1.61,-2.0,.095,.09,.12,iron,9);
  // Planters rest on the parapet railing's top rail (rail base is the parapet top, y+.25).
  const frontRail=ARCH.upper.z+ARCH.upper.depth/2+.08;
  railingPlanter(scene,-2.95,frontRail,'x',ARCH.upperRoof+.25);
  railingPlanter(scene,-.55,frontRail,'x',ARCH.upperRoof+.25);
  pot(scene,1.64,R,.94,.30,true);
}
// Architectural dimensions, in scene units (one unit is approximately one metre).
// A wide ground-floor block carries a smaller, rear-left offset upper floor.
// The uncovered first-floor roof becomes a side/front terrace, and the smaller
// upper-floor roof forms a second, higher terrace. Intentionally only two boxes.
const ARCH={
 ground:{width:8.5,depth:6.15,height:4.25},
 upper:{x:-1.10,z:-.97,width:5.60,depth:4.10,bottom:4.35,height:3.35},
 groundRoof:4.32,
 upperRoof:7.78
} as const;

function perimeterRail(scene:THREE.Object3D,axis:'x'|'z',constant:number,from:number,to:number,base:number,barColor:THREE.Material,interval=.57,foot=0){
 const length=to-from;
 const steps=Math.max(2,Math.ceil(length/interval));
 for(let i=0;i<=steps;i++){
  const t=i/steps;const offset=from+t*length;
  const x=axis==='x'?offset:constant;const z=axis==='z'?offset:constant;
  cyl(scene,x,base+foot+(.80-foot)/2,z,.034,.035,.80-foot,barColor,7);   // `foot` lifts the baluster onto the slab top so it cannot poke through the slab edge
 }
 const mid=(from+to)/2;
 if(axis==='x'){
  box(scene,mid,base+.81,constant,length+.08,.065,.065,barColor);
  box(scene,mid,base+.38,constant,length+.08,.042,.045,barColor);
 }else{
  box(scene,constant,base+.81,mid,.065,.065,length+.08,barColor);
  box(scene,constant,base+.38,mid,.042,.045,length+.08,barColor);
 }
}

function terraceFloor(scene:THREE.Object3D){
 // Terrace is not another floor: these surfaces rest on the exposed ground-floor roof.
 const slab=color('#777687'), joints=color('#48485b'), tile=color('#8e7c77');
 // Slab (top at 4.433) plus a .022 tile layer (top 4.455): every terrace object stands on that same surface (see surfaceBelow).
 box(scene,0,ARCH.groundRoof+.029,0,8.79,.168,6.52,slab);
 // Wide uncovered terrace wrapping the FRONT and RIGHT of the upper cube.
 // Rear-left upper block starts at x=-3.90 and ends at +1.70.
 const walkY=ARCH.groundRoof+.124;
 // One tile lattice for the whole terrace (right side and front strip) with one colour rule, so the pattern runs across the join
 // (the two areas used to sit on different grids, and only the right-hand one had the lighter tiles).
 const tileAt=(x:number,z:number)=>{const m=box(scene,x,walkY,z,.401,.022,.401,((Math.floor(x*4)+Math.floor(z*3))%4===0)?tile:slab);m.castShadow=false;};
 for(let i=0;i<=4;i++)for(let k=0;k<=13;k++)tileAt(1.96+.43*i,-2.82+.43*k);        // right terrace, x 1.96 .. 3.68, z -2.82 .. 2.77
 for(let i=1;i<=13;i++)for(let k=10;k<=13;k++)tileAt(1.96-.43*i,-2.82+.43*k);      // front strip on the same lattice, x 1.53 .. -3.63, z 1.48 .. 2.77
 // A warm seam along the setback edge, showing two legible terraces from title view.
 box(scene,1.77,ARCH.groundRoof+.12,-.94,.08,.04,4.12,joints);
 box(scene,-1.08,ARCH.groundRoof+.12,1.14,5.62,.04,.075,joints);
 // The FRONT and RIGHT outer edges remain open behind the railings.
 perimeterRail(scene,'x',3.23,-4.31,4.00,ARCH.groundRoof,trim,.56,.11);
 // The right rail has a .6 gap at z = -1.85 where the spiral stair arrives (see terraceStair).
 perimeterRail(scene,'z',4.31,-2.95,-2.15,ARCH.groundRoof,trim,.52,.11);
 perimeterRail(scene,'z',4.31,-1.55,3.20,ARCH.groundRoof,trim,.52,.11);
 perimeterRail(scene,'x',-3.22,1.82,4.18,ARCH.groundRoof,trim,.57,.11);
 // LEFT edge (was open) and the rear strip behind the upper block close the terrace all the way round.
 perimeterRail(scene,'z',-4.31,-3.22,3.23,ARCH.groundRoof,trim,.56,.11);
 perimeterRail(scene,'x',-3.22,-4.31,-3.98,ARCH.groundRoof,trim,.57,.11);   // the back rail is open where the bouldering panel passes
 perimeterRail(scene,'x',-3.22,-3.12,1.82,ARCH.groundRoof,trim,.57,.11);
 // A few terrace plants and a restrained seating arrangement provide structure,
 // not any end-game memorabilia or new personal items.
 for(const [x,z,r] of [[3.64,2.53,.56],[3.88,-2.52,.47],[1.86,2.46,.46],[-3.50,2.70,.50]] as const){
  pot(scene,x,ARCH.groundRoof+.13,z,r,true);   // base sits on the tile top (4.455)
 }
}

function upperRoofTerrace(scene:THREE.Object3D){
 const {x,z,width,depth}=ARCH.upper;
 const y=ARCH.upperRoof;
 // Roof slab, top at 7.945 (= surfaceBelow for the roof) so roof furniture stands on it instead of hovering.
 box(scene,x,y+.055,z,width+.38,.22,depth+.38,color('#76748b'));
 // Low parapet and dark railing around the rooftop terrace, no third cube.
 const left=x-width/2-.08,right=x+width/2+.08;
 const front=z+depth/2+.08,back=z-depth/2-.08;
 for(const zz of [front,back]){
  box(scene,x,y+.14,zz,width+.32,.25,.19,stone);
  perimeterRail(scene,'x',zz,zz===back?-3.10:left,right,y+.25,dark,.60);   // the back rail is open at the climbers' exit
 }
 for(const xx of [left,right]){
  box(scene,xx,y+.14,z,.19,.25,depth+.33,stone);
  perimeterRail(scene,'z',xx,back,front,y+.25,dark,.56);
 }
 // Grab bar over the parapet where the bouldering wall tops out: two posts and a rail, in line with the open gap.
 for(const gx of [-3.84,-3.26])cyl(scene,gx,y+.25+.28,back,.022,.022,.56,iron,7);
 cyl(scene,-3.55,y+.25+.56,back,.025,.025,.64,iron,7).rotation.z=Math.PI/2;
 // Water tank on a steel stand, an HVAC cabinet and an antenna mast: a busy rooftop silhouette that still leaves most
 // of the terrace open. The tank stands clear of the cabinet, and the mast is bolted to the cabinet's top.
 const R=y+.165,tankMat=color('#8397ab',.15,.55),tankLid=color('#3b4864',.2,.6),band=color('#4a5a70',.4,.5);
 const tx=.35,tz=-2.0,tr=.62,legTop=R+.40;
 for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;cyl(scene,tx+Math.cos(a)*tr*.78,(R+legTop)/2,tz+Math.sin(a)*tr*.78,.04,.04,legTop-R,iron,6);}
 cyl(scene,tx,legTop-.03,tz,tr*.92,tr*.92,.06,iron,12);                    // stand platform
 cyl(scene,tx,legTop+.68,tz,tr,tr,1.30,tankMat,12);                        // tank body
 for(const by of [.45,1.2])cyl(scene,tx,legTop+by,tz,tr+.012,tr+.012,.05,band,12);   // straps
 cyl(scene,tx,legTop+1.38,tz,tr*.86,tr,.16,tankLid,12);                    // shallow lid
 cyl(scene,tx,legTop+1.52,tz,.16,.16,.12,brass,9);                         // hatch cap
 cyl(scene,tx+tr+.045,R+.76,tz,.03,.03,1.5,iron,6);                        // overflow pipe down the tank's side
 const bx=1.30;
 box(scene,bx,y+.53,-2.62,.70,.83,.60,color('#9297a1',.3,.6));
 box(scene,bx-.01,y+.67,-2.30,.50,.44,.045,dark);
 for(let k=0;k<5;k++)box(scene,bx-.22+k*.11,y+.68,-2.268,.04,.29,.027,color('#5a7280'));
 cyl(scene,bx+.2,y+.945+.9,-2.74,.028,.035,1.8,trim,8);                    // antenna mast, standing on the cabinet
 // Rooftop terrace is intentionally a single outdoor area, not another storey.
 patioTable(scene,-1.17,y+.15,-.30,.36);
 for(const [px,pz,r] of [[-3.30,-1.75,.53],[-3.62,.50,.47],[1.38,.82,.43]] as const){
  pot(scene,px,y+.165,pz,r,true);
 }
 // (The bulb string across the roof, with its two poles, was removed in vtest12; the roof is lit by two lantern posts, see cozyBuilding.)
}

function storefront(scene:THREE.Object3D){
 const brick=color('#52556a'),upperBrick=color('#626579');
 const u=ARCH.upper,gd=ARCH.ground;
 const upperY=u.bottom+u.height/2;
 // 1) Register every window and door first: the walls below are cut around these openings.
 // Ground-floor storefront: two displays and a centered entrance, unchanged routes.
 facadeWindow(scene,-2.53,2.43,3.18,2.28,2.56,0,'planter',true,false);
 facadeWindow(scene,2.62,2.43,3.18,2.28,2.56,0,'warm',true,false);
 doorway(scene,.06,1.795,3.18,1.50,3.01,0);
 // The lit entrance throws light onto its frame and the pavement in front of it.
 glowPatch(scene,.06,1.9,3.145,3.0,3.9,'#ffbd6e',.11);
 glowPatch(scene,.06,.045,4.35,2.7,2.5,'#ffbd6e',.12,0,true);
 // Ground floor side and back remain available to functional interactions.
 facadeWindow(scene,4.37,2.59,-2.00,1.10,2.25,Math.PI/2,'blinds');
 facadeWindow(scene,-4.37,2.60,-1.26,1.45,2.15,-Math.PI/2,'dark');
 facadeWindow(scene,-2.25,2.42,-3.17,1.84,1.99,Math.PI,'warm');
 // The asymmetric upper floor faces the front terrace with windows, and a
 // separate door opens onto the exposed RIGHT side terrace.
 const upperFront=u.z+u.depth/2+.11;
 facadeWindow(scene,-2.56,6.16,upperFront,2.12,1.97,0,'warm');
 facadeWindow(scene,-.05,6.18,upperFront,1.96,1.93,0,'blinds');
 facadeWindow(scene,u.x-u.width/2-.11,6.05,-1.50,1.65,1.94,-Math.PI/2,'planter',false);
 facadeWindow(scene,.29,6.16,u.z-u.depth/2-.11,1.85,1.73,Math.PI,'dark');
 // Door to the right terrace: its sill sits just above the tiles (door leaf is local +Z outward along +X).
 doorway(scene,u.x+u.width/2+.11,5.78,-.45,1.15,2.66,Math.PI/2);
 glowPatch(scene,u.x+u.width/2+.07,5.78,-.45,2.5,3.7,'#ffbd6e',.11,Math.PI/2);
 glowPatch(scene,u.x+u.width/2+1.25,4.455,-.45,2.6,2.3,'#ffbd6e',.12,Math.PI/2,true);
 // 2) Hollow walls: outer brick + inner plaster, cut around the openings above.
 const T=WALL_T,plaster=plasterMat();
 hollowWall(scene,0,0,gd.depth/2,0,gd.width,gd.height,brick,plaster);
 hollowWall(scene,0,0,-gd.depth/2,Math.PI,gd.width,gd.height,brick,plaster);
 hollowWall(scene,gd.width/2,0,0,Math.PI/2,gd.depth-2*T,gd.height,brick,plaster);
 hollowWall(scene,-gd.width/2,0,0,-Math.PI/2,gd.depth-2*T,gd.height,brick,plaster);
 hollowWall(scene,u.x,u.bottom,u.z+u.depth/2,0,u.width,u.height,upperBrick,plaster);
 hollowWall(scene,u.x,u.bottom,u.z-u.depth/2,Math.PI,u.width,u.height,upperBrick,plaster);
 hollowWall(scene,u.x+u.width/2,u.bottom,u.z,Math.PI/2,u.depth-2*T,u.height,upperBrick,plaster);
 hollowWall(scene,u.x-u.width/2,u.bottom,u.z,-Math.PI/2,u.depth-2*T,u.height,upperBrick,plaster);
 // Interior floors and ceilings. The terrace slab is the ground-floor ceiling; the roof slab caps the upper floor.
 box(scene,0,.045,0,gd.width-2*T,.05,gd.depth-2*T,floorMat()).castShadow=false;
 box(scene,0,gd.height-.01,0,gd.width-2*T,.04,gd.depth-2*T,ceilingMat()).castShadow=false;
 box(scene,u.x,4.40,u.z,u.width-2*T,.05,u.depth-2*T,floorMat()).castShadow=false;
 box(scene,u.x,u.bottom+u.height-.02,u.z,u.width-2*T,.04,u.depth-2*T,ceilingMat()).castShadow=false;
 // The two stepped terraces are the building's defining silhouette.
 terraceFloor(scene);
 upperRoofTerrace(scene);
 // Clear vertical corner posts, not extra turrets or additional rooms.
 for(const xx of [-4.24,4.24])for(const zz of [-3.06,3.06]){
  box(scene,xx,2.13,zz,.22,4.21,.25,stone);
 }
 for(const xx of [u.x-u.width/2,u.x+u.width/2])for(const zz of [u.z-u.depth/2,u.z+u.depth/2]){
  box(scene,xx,upperY,zz,.23,u.height+.08,.23,stone);
 }
 // Thin masonry courses break up the flat walls; none are drawn across a window or door.
 const mortar=color('#41475d');
 for(let row=0;row<8;row++){
  const yy=.46+row*.48;
  for(let col=0;col<9;col++){
   const xx=-3.84+col*.95+(row%2)*.28;
   if(xx>4.0||overlapsOpening(xx,yy,3.18,.35))continue;
   const m=box(scene,xx,yy,3.087,.70,.025,.035,mortar);m.castShadow=false;
  }
 }
 for(let row=0;row<6;row++){
  const yy=u.bottom+.44+row*.47;
  for(let col=0;col<6;col++){
   const xx=u.x-2.40+col*.86+(row%2)*.18;
   if(xx>u.x+2.45||overlapsOpening(xx,yy,upperFront,.26))continue;
   const m=box(scene,xx,yy,u.z+u.depth/2+.015,.52,.023,.034,mortar);m.castShadow=false;
  }
 }
 // Striped awning shelters the ground-floor entrance, but does not conceal
 // either balcony. Shorter upper awning makes the silhouette more lively.
 awning(scene,0,3.87,3.14,7.88,1.0);
 awning(scene,u.x,7.72,upperFront-.08,5.20,.45);
 plane(scene,0,3.43,4.119,1.66,.26,labelTexture('THE LITTLE STUDIO','#f7e6c4','#152d36','#c1b09a',1024,160));  // on the awning's front valance; 1024:160 = the 1.66:.26 plane
 // Repositioned limited architectural greenery and lighting.
 for(const [xx,yy,zz,size,trail] of [
  [-3.50,.02,3.65,.60,false],[3.58,.02,3.71,.58,false],
  [4.58,.02,-1.10,.62,true],[-4.52,.02,-2.30,.59,false],
  [-3.78,4.47,1.50,.50,true]
 ] as const)pot(scene,xx,yy,zz,size,trail);
 addVines(scene,'z',ARCH.ground.depth/2,-3.97,3.74,1.65);         // under the awning, front-left corner
 addVines(scene,'x',ARCH.ground.width/2,-2.70,4.10,2.2);          // hanging from the side cornice, rear right
 addVines(scene,'z',ARCH.upper.z+ARCH.upper.depth/2,1.50,7.69,2.5); // hanging from the roof edge, upper front right
 // Awning lamps hang from the awning's underside (cord ends exactly at it).
 for(const [lx,ly,lz,li] of [[-3.20,3.50,3.72,1.95],[-2.08,3.46,3.69,1.35],[-1.05,3.46,3.68,1.4],[1.00,3.46,3.68,1.4],[2.06,3.46,3.69,1.35],[3.10,3.50,3.72,1.95]] as const)
  hangingLamp(scene,lx,ly,lz,li,awningUnder(3.87,3.14,1.0,lz)+.02);
 // Additional warm sconces make the front and terrace feel inhabited without flattening the scene.
 // Upper-floor sconces sit on the wall piers between and beside the windows (not across a window).
 wallLight(scene,-1.265,6.3,u.z+u.depth/2+.057,0,1.0);
 wallLight(scene,1.32,6.3,u.z+u.depth/2+.057,0,1.0);
 // (The left-side lamp post by the old wagon spot was removed in round four: the kei truck parks there now. The two tall street
 // lamps on the right side were removed in vtest10; the code is in git history.)
 // Side utility conduits emphasize compact, lived-in construction.
 line(scene,[V(ARCH.ground.width/2+.057,4.15,-2.46),V(ARCH.ground.width/2+.057,.03,-2.46)],.055,dark);
 line(scene,[V(-ARCH.ground.width/2-.045,4.15,-2.55),V(-ARCH.ground.width/2-.045,.03,-2.55)],.042,dark);
}

/** Warm light bounced up from the lit pavement onto the base of the walls: a faint gradient that is
 *  strongest at street level and fades out by about two metres. It gives the lower masonry a warm
 *  edge to contrast with the cool light on the upper walls, without brightening the whole facade. */
function bounceDecals(scene:THREE.Object3D){
 const map=texture((c,W,H)=>{const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.55,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,1)');c.fillStyle=g;c.fillRect(0,0,W,H);},16,128);
 const mat=new THREE.MeshBasicMaterial({map,color:'#ff9a58',opacity:Math.min(1,.10*tuning.glow),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
 const place=(x:number,z:number,w:number,rotY:number)=>{const m=new THREE.Mesh(planeGeometry,mat);m.position.set(x,1.15,z);m.scale.set(w,2.3,1);m.rotation.y=rotY;scene.add(m);};
 place(0,3.14,8.1,0);
 place(4.39,0,5.9,Math.PI/2);
 place(-4.39,0,5.9,-Math.PI/2);
 place(0,-3.14,8.1,Math.PI);
}

function boardTexture(){return texture((c,W,H)=>{
 c.fillStyle='#8c5b3f';c.fillRect(0,0,W,H);c.fillStyle='#976845';c.fillRect(13,13,W-26,H-26);const notes:[number,number,number,number,string,string][]=[
 [30,32,182,88,'ABOUT ME','#f6e9c8'],[232,32,244,104,'PENN STATE','#c2def0'],[45,148,255,162,'DATA SCIENCE','#f2c6b2'],[330,180,150,120,'MY STORY','#ded8f5'],[64,350,170,105,'SPORTS','#bde6ce'],[260,348,208,105,'HELLO!','#faf2bb']];
 for(let i=0;i<notes.length;i++){const[x,y,w,h,word,fill]=notes[i];c.save();c.translate(x+w/2,y+h/2);c.rotate((i%2?1:-1)*.047);c.fillStyle=fill;c.fillRect(-w/2,-h/2,w,h);c.fillStyle='#26384f';c.textAlign='center';c.textBaseline='middle';c.font=`bold ${Math.min(29,w*.16)}px Arial`;c.fillText(word,0,0);c.fillStyle='#d0595f';c.beginPath();c.arc(0,-h/2+9,6,0,Math.PI*2);c.fill();c.restore();}
 },512,512);}
function noticeboard(scene:THREE.Object3D,hits:HitTarget[]){const g=new THREE.Group();g.position.set(ARCH.ground.width/2+.095,2.82,.40);g.rotation.y=Math.PI/2;scene.add(g);
 box(g,0,0,0,2.35,2.15,.19,wood);plane(g,0,0,.104,2.08,1.86,boardTexture());
 box(g,0,1.2,.1,2.34,.26,.22,dark);plane(g,0,1.20,.229,2.13,.18,labelTexture('ABOUT ME','#ffe3b0','#18283c','#d09a69',1280,108));  // 1280:108 matches the 2.13:.18 plane, so the lettering is not stretched
 // No glow decal on the board itself: a lamp fixture is mounted beside it and a modest corkboard key light
 // lights the wall, so the notes stay readable instead of washed out.
 wallLight(scene,ARCH.ground.width/2+.057,3.62,-1.05,Math.PI/2,.8);
 const target=box(g,0,0,.23,2.35,2.35,.1,new THREE.MeshBasicMaterial({opacity:0,transparent:true,depthWrite:false}));hits.push({object:target,section:'about',label:'Read the corkboard'});
}
/** Mixes two #rrggbb colours in sRGB (t=0 gives a, t=1 gives b), the same blend the CSS shelf on the Projects page uses. */
const mixHex=(a:string,b:string,t:number)=>{const c=(h:string)=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const A=c(a),B=c(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');};
/** Spine art for the cart books, drawn to match the shelf on the Projects page: dark tinted leather, gold bands, the volume
 *  number and a title running down the spine. All generated from project metadata. */
function spineTexture(p:Project,n:number,w:number,h:number){
 const W=160,H=Math.round(W*h/w);
 return texture((c)=>{
  c.fillStyle=mixHex('#1b1320',p.color,.5);c.fillRect(0,0,W,H);
  const sh=c.createLinearGradient(0,0,W,0);
  sh.addColorStop(0,'rgba(0,0,0,.44)');sh.addColorStop(.15,'rgba(0,0,0,0)');sh.addColorStop(.38,'rgba(255,255,255,.15)');sh.addColorStop(.62,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,0,0,.45)');
  c.fillStyle=sh;c.fillRect(0,0,W,H);
  c.fillStyle='rgba(255,255,255,.03)';for(let y=0;y<H;y+=6)c.fillRect(0,y,W,2);
  const gold=(y:number,bh:number)=>{const g=c.createLinearGradient(0,0,W,0);g.addColorStop(0,'#a8782f');g.addColorStop(.35,'#f2d78f');g.addColorStop(.7,'#d6aa55');g.addColorStop(1,'#8f6322');c.fillStyle=g;c.fillRect(0,y,W,bh);};
  const bh=Math.max(9,H*.03),tl=bh*.35,y0=H*.035,yb=H*.965-bh;
  gold(y0,bh);gold(y0+bh*1.7,tl);gold(yb,bh);gold(yb-bh*.7-tl,tl);
  c.textAlign='center';c.textBaseline='middle';
  c.fillStyle='#ecd493';c.font=`600 ${Math.round(W*.2)}px "DM Mono",ui-monospace,Menlo,monospace`;
  const numY=y0+bh*2.9+W*.1;c.fillText(String(n).padStart(2,'0'),W/2,numY);
  // small gold diamond above the bottom band
  const dy=yb-bh*2.6,dr=W*.07;c.fillStyle='#e4c277';c.beginPath();c.moveTo(W/2,dy-dr);c.lineTo(W/2+dr,dy);c.lineTo(W/2,dy+dr);c.lineTo(W/2-dr,dy);c.closePath();c.fill();
  const top=numY+W*.16,bot=dy-dr-W*.12,avail=bot-top;
  let fs=Math.round(W*.3);c.font=`600 ${fs}px Georgia,"Times New Roman",serif`;
  const tw=c.measureText(p.name).width;if(tw>avail){fs=Math.floor(fs*avail/tw);c.font=`600 ${fs}px Georgia,"Times New Roman",serif`;}
  c.save();c.translate(W/2,(top+bot)/2);c.rotate(Math.PI/2);c.fillStyle='#f6e7bd';c.shadowColor='rgba(0,0,0,.55)';c.shadowBlur=3;c.fillText(p.name,0,0);c.restore();
 },W,H);
}
/** One cart book, standing on its base at the group origin with the spine facing +Z. The spine is a rounded strip, the
 *  boards are thin and slightly proud of the page block, and the pages show cream at the top, so it reads as a book rather than a box. */
function cartBook(p:Project,n:number,w:number,h:number,d:number){
 const g=new THREE.Group();
 const bulge=w*.3,zc=d/2-bulge,t=.016,segs=8;
 const leather=color(mixHex('#1b1320',p.color,.3),0,.7),pages=color('#e8dcc0',0,.95,'#b8864a',.10);
 const tex=spineTexture(p,n,w,h);
 const spineMat=new THREE.MeshStandardMaterial({map:tex,emissiveMap:tex,emissive:'#ffffff',emissiveIntensity:.34,roughness:.55,metalness:.04});
 const pos:number[]=[],uv:number[]=[],idx:number[]=[];
 for(let i=0;i<=segs;i++){const u=i/segs,a=u*Math.PI,x=-Math.cos(a)*w/2,z=zc+Math.sin(a)*bulge;pos.push(x,0,z,x,h,z);uv.push(u,0,u,1);}
 for(let i=0;i<segs;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
 const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));sg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));sg.setIndex(idx);sg.computeVertexNormals();
 const spine=new THREE.Mesh(sg,spineMat);spine.castShadow=true;spine.receiveShadow=true;g.add(spine);
 // flat head and tail caps that close the rounded spine
 for(const top of [true,false]){
  const cp:number[]=[0,0,zc],cn:number[]=[0,top?1:-1,0],ci:number[]=[];
  for(let i=0;i<=segs;i++){const a=i/segs*Math.PI;cp.push(-Math.cos(a)*w/2,0,zc+Math.sin(a)*bulge);cn.push(0,top?1:-1,0);}
  for(let i=0;i<segs;i++)ci.push(0,top?i+1:i+2,top?i+2:i+1);
  const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(cp,3));cg.setAttribute('normal',new THREE.Float32BufferAttribute(cn,3));cg.setIndex(ci);
  const cap=new THREE.Mesh(cg,leather);cap.position.y=top?h:0;g.add(cap);
 }
 box(g,-(w/2-t/2),(h+.011)/2,-bulge/2,t,h+.011,d-bulge,leather);   // front and back boards
 box(g,w/2-t/2,(h+.011)/2,-bulge/2,t,h+.011,d-bulge,leather);
 box(g,0,h/2,(-bulge+.014)/2,w-2*t-.004,h-.012,d-bulge-.014,pages);   // page block, a little shorter than the boards and set back from the fore-edge
 return g;
}
/** Small engraved brass plate for a shelf front. */
function shelfPlate(text:string,w:number,h:number){
 const PW=Math.round(w*1000),PH=Math.round(h*1000);
 return texture((c,W,H)=>{
  c.fillStyle='#2b2030';c.fillRect(0,0,W,H);c.strokeStyle='#b88a3e';c.lineWidth=3;c.strokeRect(2,2,W-4,H-4);
  c.fillStyle='#e5cf9b';c.textAlign='center';c.textBaseline='middle';c.font=`500 ${Math.round(H*.5)}px "DM Mono",ui-monospace,Menlo,monospace`;
  (c as CanvasRenderingContext2D&{letterSpacing?:string}).letterSpacing='3px';
  c.fillText(text,W/2,H/2+1,W-24);
 },PW,PH);
}
/** World position of the project book cart (it sits on the pavement in front of the left display window). */
const CART={x:-4.75,z:3.5};
/** The project book cart, built as a small wooden bookcase on casters to echo the shelf on the Projects page: dark walnut frame,
 *  plum back panel with a warm wash, brass shelf plates, and one rounded-spine book per project (spine out, gold bands, vertical titles).
 *  The neon sign now crowns the case, so it no longer hides the lower row. */
function bookCart(scene:THREE.Object3D,hits:HitTarget[]){const g=new THREE.Group();g.position.set(CART.x,-.036,CART.z);g.rotation.y=-.13;scene.add(g);
 const W=2.82,D=.72,frame=color('#5a3b2a',0,.82),frameDark=color('#3d291f',0,.85),shelfWood=color('#6e4b33',0,.8),back=color('#2a1f2d',0,.95,'#ffb866',.06),metal=color('#486777',.58,.36);
 const S1=.66,S2=1.525,CEIL=2.245;   // tops of the lower and upper shelves, and the underside of the top board
 // casters
 for(const x of [-1.18,1.18])for(const z of [-.24,.24]){const wh=cyl(g,x,.105,z,.105,.105,.07,dark,12);wh.rotation.z=Math.PI/2;box(g,x,.205,z,.1,.07,.14,metal);}
 // cabinet base with two doors
 box(g,0,.365,0,W-.04,.39,D-.06,frameDark);
 for(const sx of [-1,1]){box(g,sx*.66,.365,D/2-.03+.014,1.26,.31,.026,frame);box(g,sx*.66,.365,D/2-.03+.03,1.08,.2,.012,shelfWood);sphere(g,sx*.07,.365,D/2-.03+.05,.03,brass,2);}
 // uprights, back panel, planks, header
 for(const sx of [-1,1])box(g,sx*(W/2-.07),1.265,0,.14,2.19,D,frame);
 box(g,0,1.45,-D/2+.045,W-.26,1.62,.04,back);
 for(const yTop of [S1,S2])plank(g,0,yTop-.055,0,W-.16,D-.04,shelfWood);
 plank(g,0,CEIL+.055,0,W-.16,D-.04,shelfWood);
 box(g,0,2.56,0,W,.41,D,frame);
 box(g,0,2.80,0,W+.12,.07,D+.1,frameDark);
 // brass plates on the shelf fronts, like the row labels on the Projects page
 plane(g,0,S2-.055,(D-.04)/2+.004,.82,.075,shelfPlate('DATA SCIENCE & ML',.82,.075));
 plane(g,0,S1-.055,(D-.04)/2+.004,1.72,.075,shelfPlate('SOFTWARE & AI · HARDWARE · ENGINEERING',1.72,.075));
 // warm strip lights under the upper shelf and the top board, with a wash on the back panel (fake light, no new PointLights)
 const strip=new THREE.MeshBasicMaterial({color:'#ffe2b0'});
 for(const [yUnder,yFloor] of [[S2-.11,S1],[CEIL,S2]] as [number,number][]){
  box(g,0,yUnder-.012,.2,W-.4,.016,.04,strip);
  glowPatch(g,0,yUnder-.30,-D/2+.075,2.4,.78,'#ffb866',.24);
  halo(g,0,yUnder-.03,.2,1.4,'#ffc27a',.14);
  glowPatch(g,0,yFloor+.004,.0,2.3,.5,'#ffbd70',.10,0,true);
 }
 // the project books: seven data science volumes up top, four software / hardware / engineering volumes below (same order and grouping as the Projects page)
 const widths=[.22,.27,.25,.22,.27,.25,.22, .27,.25,.23,.27];
 const heights=[.64,.58,.54,.68,.61,.55,.65, .62,.69,.58,.60];
 const rows=[{from:0,to:7,y:S2,gaps:[.03,.03,.03,.03,.03,.03]},{from:7,to:11,y:S1,gaps:[.03,.24,.24]}];
 const z0=-.02,depth=.40,jitter=[.006,-.008,.01,-.004,.008,-.01,.004,-.006,.01,-.008,.006];
 for(const row of rows){
  let total=0;for(let i=row.from;i<row.to;i++)total+=widths[i]+(i<row.to-1?row.gaps[i-row.from]:0);
  let x=-total/2;
  const brassEnd=(ex:number,dir:number)=>{box(g,ex,row.y+.12,z0,.012,.24,.22,brass);box(g,ex+dir*.04,row.y+.006,z0,.09,.012,.22,brass);};
  brassEnd(x-.016,-1);
  for(let i=row.from;i<row.to;i++){
   const p=projects[i],w=widths[i],h=heights[i];
   const book=cartBook(p,i+1,w,h,depth);book.position.set(x+w/2,row.y,z0+jitter[i]);book.rotation.y=(i%3-1)*.03;g.add(book);
   // the whole book (with a little margin) is the click target; the visible spine is lit and readable when the visitor zooms in
   const hit=box(book,0,h/2,0,w+.03,h+.04,depth+.06,new THREE.MeshBasicMaterial({opacity:0,transparent:true,depthWrite:false}));
   hits.push({object:hit,visual:book,section:'projects',projectId:p.id,label:`Open ${p.name}`});
   x+=w+(i<row.to-1?row.gaps[i-row.from]:0);
  }
  brassEnd(x+.016,1);
 }
 // neon sign crowning the case
 plane(g,0,2.56,D/2+.004,2.27,.31,labelTexture('PROJECTS / THE BOOK CART','#d8faff','#263748','#83dfed',1024,140));  // 1024:140 = the 2.27:.31 plane
 glowPatch(g,0,2.56,D/2+.03,3.5,.9,'#83dfed',.07);
 // Warm pool on the pavement in front of the cart, from the nearby streetlamp.
 glowPatch(g,0,.08,.95,4.2,2.6,'#ffbf86',.10,0,true);
 const hit=box(g,0,1.45,-.5,3.0,2.7,.5,new THREE.MeshBasicMaterial({opacity:0,transparent:true,depthWrite:false}));
 // large hit behind the books only, so front book hit areas still win in raycast
 hits.push({object:hit,visual:g,section:'projects',label:'Browse projects'});
}
/** The paved plaza (world units). Kept tight around the building so the whole scene reads from the default view. */
const PLAZA={x0:-7.2,x1:7.2,z0:-4.9,z1:5.2};
function floor(scene:THREE.Object3D){
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(170,170),new THREE.MeshStandardMaterial({color:'#0b1124',metalness:0,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.28;ground.receiveShadow=true;scene.add(ground);  // matte: a glossy ground turned every point light into a huge white-blue specular blob
 const cx=(PLAZA.x0+PLAZA.x1)/2,cz=(PLAZA.z0+PLAZA.z1)/2;
 box(scene,cx,-.16,cz,PLAZA.x1-PLAZA.x0+.4,.32,PLAZA.z1-PLAZA.z0+.4,color('#3a435d'));
 const paving=[color('#5e596d'),color('#746276'),color('#4d5368'),color('#686475')];
 for(let x=PLAZA.x0+.05;x<PLAZA.x1-.4;x+=.73)for(let z=PLAZA.z0+.05;z<PLAZA.z1-.4;z+=.74){let m=box(scene,x+.36,-.004,z+.36,.705,.055,.710,paving[Math.floor(random()*4)]);m.castShadow=false;}
 // (the four corner bollards were replaced in vtest8 by lantern posts and hedges, see cozyWorld)
 // Thin curb edge and pavement joint reflections.
 box(scene,cx,.043,PLAZA.z1+.16,PLAZA.x1-PLAZA.x0+.05,.10,.20,stone);
 // (the black drain-grate bars at the front edge were removed in vtest8: they read as a stray glitch)
 // Front pavement stays clean so the building and signage carry the identity.
 // stylized reflected pools, no postprocessing required
 const glows:[string,number,number,number,number][]=[['#6f30cb',3.8,-5.6,11,5],['#2f97c6',5.2,-4.6,10,5],['#ef7c48',-4.2,-4.4,8,3]];
 for(const[c,x,z,w,d] of glows) {const t=texture((ctx,W,H)=>{const g=ctx.createRadialGradient(W/2,H/2,4,W/2,H/2,W*.46);g.addColorStop(0,c+'99');g.addColorStop(1,c+'00');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)},256,256);const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:t,transparent:true,opacity:.55,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,-.20,z);scene.add(m);}
}
/** World position of the former sign post. The five-sign stack was removed (the on-screen menu already navigates), but the
 *  cool light that used to spill from it stays as general moonlit fill on the right elevation. */
const NEON={x:6.45,z:2.1};
// The tall name sign and its pole were removed in vtest10 (the name is already on the page); the code is in git history.
const RESUME_STAND={x:3.4,z:3.75};
function resumeStand(scene:THREE.Object3D,hits:HitTarget[]){const g=new THREE.Group();g.position.set(RESUME_STAND.x,0,RESUME_STAND.z);g.rotation.y=-.17;scene.add(g);
 box(g,0,.86,0,1.02,1.50,.15,wood);box(g,0,1.15,.105,.89,1.16,.055,color('#efeadb'));
 plane(g,0,1.19,.136,.80,1.04,labelTexture('RESUME','#354653','#eee4ce','#9f9f98',420,512));
 for(const lx of [-.38,.38])box(g,lx,.06,0,.12,.12,.2,wood);                   // feet under the board
 for(const lx of [-.30,.30]){box(g,lx,.55,-.40,.08,1.1,.07,dark);box(g,lx,1.0,-.225,.07,.07,.35,dark);}   // back legs with struts to the board
 glowPatch(g,0,.045,.8,2.4,1.9,'#ffc27a',.10,0,true);
 const hit=box(g,0,1.02,.22,1.1,1.65,.3,new THREE.MeshBasicMaterial({opacity:0,transparent:true,depthWrite:false}));hits.push({object:hit,section:'resume',label:'Read resume'});
}
function machine(scene:THREE.Object3D,hits:HitTarget[],x:number,z:number,type:'contact'|'credits'){
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=Math.PI;scene.add(g);
 const c=type==='contact'?cyan:magenta;const title=type==='contact'?'CONTACT':'CREDITS';
 box(g,0,1.22,0,1.50,2.50,1.04,color(type==='contact'?'#2c7f9d':'#773b83',.20,.46));
 box(g,0,2.21,.53,1.38,.49,.09,dark);plane(g,0,2.21,.592,1.30,.43,labelTexture(title,'#f0faff','#10152d',c,512,180));
 box(g,0,1.24,.548,1.23,1.40,.07,dark);
 if(type==='contact'){
   plane(g,-.14,1.40,.602,.80,1.03,texture((ctx,w,h)=>{
     ctx.fillStyle='#0e3547';ctx.fillRect(0,0,w,h);
     for(let i=0;i<3;i++){let y=25+i*75;ctx.fillStyle=['#2f7b90','#376f8c','#6a58a0'][i];ctx.fillRect(45,y,w-90,60);ctx.fillStyle='#e3f6f4';ctx.font='bold 29px Arial';ctx.textAlign='center';ctx.fillText(['EMAIL','LINKEDIN','GITHUB'][i],w/2,y+39);}
   },512,300));
   box(g,.52,1.45,.605,.23,.48,.06,neon(c,.5));cyl(g,.52,1.04,.64,.055,.055,.04,brass);
   box(g,0,.31,.555,.72,.10,.07,dark);
 }else{
  plane(g,0,1.52,.599,1.08,.87,texture((ctx,w,h)=>{
    ctx.fillStyle='#0c122f';ctx.fillRect(0,0,w,h);for(let i=0;i<60;i++){ctx.fillStyle=i%3?'#88bbef':'#f6a2ec';ctx.fillRect(random()*w,random()*h,3+random()*5,3+random()*5);}
    ctx.fillStyle='#fdc1fa';ctx.font='bold 35px monospace';ctx.textAlign='center';ctx.fillText('THANKS',w/2,h/2);ctx.fillText('FOR PLAYING',w/2,h/2+42);
  }));
  box(g,0,.91,.72,1.07,.24,.41,color('#29273f'));sphere(g,-.28,1.09,.87,.09,neon(magenta,.75));sphere(g,.21,1.08,.85,.065,neon(cyan,.7));
  box(g,0,.27,.56,.73,.20,.09,dark);
 }
 // One real light per machine (these are interaction targets), plus a bloom around the cabinet front
 // and a coloured pool on the pavement where visitors stand.
 keyLight(g,c,2.4*BUILDING_SCALE*BUILDING_SCALE,5.6,0,1.6,.95);
 glowPatch(g,0,1.3,.64,2.5,3.0,c,.12);
 glowPatch(g,0,.045,1.6,3.4,2.6,c,.18,0,true);
 const hit=box(g,0,1.20,.60,1.55,2.55,.36,new THREE.MeshBasicMaterial({opacity:0,transparent:true,depthWrite:false}));hits.push({object:hit,visual:g,section:type,label:type==='contact'?'Use the contact vending machine':'Play the credits arcade'});
}
function serviceBack(scene:THREE.Object3D,hits:HitTarget[]){
 // Machines stand flush against the back wall: cabinet depth is 1.04, so the centre sits .52 (+1 cm) off the wall face.
 machine(scene,hits,1.75,-ARCH.ground.depth/2-.53,'contact');machine(scene,hits,-.22,-ARCH.ground.depth/2-.53,'credits');
 // a few subtle back-of-building details
 hvacUnit(scene,3.78,2.02,-ARCH.ground.depth/2-.165,Math.PI,.72);   // back face .01 from the wall, arms reach into it
 electricBox(scene,2.96,1.16,-3.12,Math.PI);
 pot(scene,3.52,0,-4.50,.60,true);
 pot(scene,-4.80,0,-4.15,.38,false);
}
// ---------------------------------------------------------------------------------------------
// INTERIORS: deliberately simple furnishings seen through the real window openings. Nothing here is
// personal memorabilia. Lamps are emissive meshes + halos + floor pools (no extra PointLights).
// ---------------------------------------------------------------------------------------------
/** Ceiling lamp: cord, shade, bulb, bloom and a pool of light on the floor beneath it. */
function pendant(scene:THREE.Object3D,x:number,ceilingY:number,z:number,lampY:number,floorY:number,size=1){
 box(scene,x,(ceilingY+lampY)/2+.1,z,.02,ceilingY-lampY-.2,.02,dark).castShadow=false;
 cyl(scene,x,lampY+.1,z,.09*size,.27*size,.2*size,brass);
 sphere(scene,x,lampY-.04,z,.11*size,bright,1);
 halo(scene,x,lampY-.04,z,1.5*size,'#ffc78f',.6);
 glowPatch(scene,x,floorY+.012,z,3.3*size,3.3*size,'#ffc27a',.10,0,true);
}
function floorLamp(scene:THREE.Object3D,x:number,floorY:number,z:number){
 cyl(scene,x,floorY+.03,z,.18,.2,.06,iron,10);
 cyl(scene,x,floorY+.8,z,.022,.022,1.5,iron,6);
 cyl(scene,x,floorY+1.58,z,.16,.26,.32,bright,10);
 halo(scene,x,floorY+1.55,z,1.7,'#ffc78f',.6);
 glowPatch(scene,x,floorY+.012,z,3.0,3.0,'#ffc27a',.10,0,true);
}
function bookshelf(scene:THREE.Object3D,x:number,floorY:number,z:number,len:number,height:number,rot:number){
 // Local +Z faces into the room. Back panel, two ends, shelves, and a row of books on each shelf.
 const g=new THREE.Group();g.position.set(x,floorY,z);g.rotation.y=rot;scene.add(g);
 const rows=Math.max(3,Math.round(height/.55)),depth=.34,palette=['#627f6b','#d9b17b','#965857','#d8cab3','#425e6c','#b37d55'];
 box(g,0,height/2,-depth/2+.02,len,height,.04,wood);
 for(const sx of [-len/2+.025,len/2-.025])box(g,sx,height/2,0,.05,height,depth,wood);
 for(let r=0;r<=rows;r++){
  const y=.04+r*(height-.08)/rows;
  box(g,0,y,0,len,.05,depth,wood);
  if(r===rows)continue;
  let cx=-len/2+.12;
  while(cx<len/2-.2){
   const bw=.05+texRandom()*.07,bh=.22+texRandom()*.18;
   if(cx+bw>len/2-.1)break;
   box(g,cx+bw/2,y+.025+bh/2,-.02,bw,bh,.2,color(palette[Math.floor(texRandom()*palette.length)]));
   cx+=bw+.012;
  }
 }
}
function interiors(scene:THREE.Object3D){
 const u=ARCH.upper,gf=.07,uf=4.425,top=ARCH.ground.height,roof=u.bottom+u.height;
 const counterTop=color('#b88d62',0,.7),rug=(hex:string)=>color(hex,0,.95,'#ff7a60',.10*tuning.room);
 // ---- Ground floor: a small shop/studio. Shelves sit on the right wall, the counter below the rear window,
 // a table with stools between the display windows and the door, and a plant by the left display.
 box(scene,-1.7,gf+.55,-2.35,3.4,1.1,.6,wood);
 box(scene,-1.7,gf+1.125,-2.35,3.5,.05,.7,counterTop);
 // The counter top is left bare on purpose (vtest10).
 bookshelf(scene,3.84,gf,.7,2.9,2.3,-Math.PI/2);
 box(scene,.2,gf+.015,.45,3.4,.02,2.2,rug('#7a3f4a'));
 cyl(scene,1.9,gf+.78,.35,.5,.5,.06,wood,14);cyl(scene,1.9,gf+.4,.35,.06,.07,.74,iron,8);cyl(scene,1.9,gf+.04,.35,.3,.3,.06,iron,10);
 for(const [sx,sz] of [[1.2,.1],[2.55,.6]] as const){cyl(scene,sx,gf+.5,sz,.2,.2,.07,color('#6d4b3c'),10);cyl(scene,sx,gf+.25,sz,.04,.05,.5,iron,6);}
 pot(scene,-3.35,gf,2.2,.62,false);
 pendant(scene,-2.0,top,.9,3.05,gf,1);
 pendant(scene,1.9,top,.35,3.0,gf,1);
 pendant(scene,-.2,top,-1.1,3.15,gf,.9);
 // ---- Upper floor: a living room. Sofa on the back wall beside the rear window, bookshelf on the left wall,
 // rug with a low table, floor lamp by the front windows, a plant by the terrace door.
 box(scene,-2.3,uf+.2,-2.3,2.2,.4,.9,color('#7a4a52'));
 box(scene,-2.3,uf+.68,-2.67,2.2,.56,.2,color('#8a5660'));
 for(const ax of [-1.0,1.0])box(scene,-2.3+ax,uf+.34,-2.3,.2,.68,.9,color('#6b3e46'));
 for(const px of [-2.8,-1.8])box(scene,px,uf+.52,-2.5,.55,.28,.14,color('#c9a56b')).rotation.z=.12;
 box(scene,-1.4,uf+.016,-.9,2.8,.02,1.9,rug('#3e5a6b'));
 box(scene,-1.4,uf+.4,-.9,1.1,.05,.6,wood);
 for(const [lx,lz] of [[-.9,-.65],[-.9,-1.15],[-1.9,-.65],[-1.9,-1.15]] as const)box(scene,lx,uf+.2,lz,.05,.4,.05,iron);
 bookshelf(scene,-3.49,uf,.3,.95,1.9,Math.PI/2);
 floorLamp(scene,-3.2,uf,-.05);
 pendant(scene,-1.4,roof-.04,-.9,6.55,uf,1);
 pot(scene,1.1,uf,.45,.5,true,uf+.03);
}
// ---------------------------------------------------------------------------------------------
// END GAME: personal touches. The brief for these props is "evoke, do not copy": every piece is an original, generic
// low-poly object (a ball, a hoop, a wagon, a turntable) in plain colours. No team crests, wordmarks, characters or
// album art are drawn; anything that would need one is deliberately left out (see docs/VTEST_CHANGES.md).
// World-level pieces stand on the plaza in world units; building-level pieces use building-local units.
// ---------------------------------------------------------------------------------------------
const PAVE=.024;                                  // plaza paving top, in world units
const BALL_DIRS=(()=>{const p=(1+Math.sqrt(5))/2,v:[number,number,number][]=[];for(const a of [-1,1])for(const b of [-1,1])v.push([0,a,b*p],[a,b*p,0],[b*p,0,a]);return v.map(([x,y,z])=>{const l=Math.hypot(x,y,z);return [x/l,y/l,z/l] as [number,number,number];});})();
const netMat=new THREE.MeshBasicMaterial({color:'#e9edf5',wireframe:true,transparent:true,opacity:.3,depthWrite:false});
/** Matt, softly self-lit picture material (used for flags, posters and framed shirts so they read at night without a point light). */
function litMaterial(tex:THREE.Texture,glow=.35){return new THREE.MeshStandardMaterial({map:tex,emissiveMap:tex,emissive:'#ffffff',emissiveIntensity:glow,roughness:.9,side:THREE.DoubleSide});}
function litPlane(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,tex:THREE.Texture,rotY=0,glow=.35){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),litMaterial(tex,glow));
  m.position.set(x,y,z);m.rotation.y=rotY;parent.add(m);return m;
}
function soccerBall(parent:THREE.Object3D,x:number,y:number,z:number,r=.11){
  const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
  sphere(g,0,0,0,r,color('#f2f0ea',0,.6),9);
  for(const [dx,dy,dz] of BALL_DIRS)sphere(g,dx*r*.8,dy*r*.8,dz*r*.8,r*.26,color('#1d2029',0,.6),0);   // twelve dark patches
  return g;
}
function basketball(parent:THREE.Object3D,x:number,y:number,z:number,r=.12){
  const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
  sphere(g,0,0,0,r,color('#d9692a',0,.8),9);
  const seam=color('#241c18',0,.9);
  for(const [rx,ry] of [[0,0],[0,Math.PI/2],[Math.PI/2,0]] as const){const t=new THREE.Mesh(new THREE.TorusGeometry(r*1.01,r*.03,4,20),seam);t.rotation.set(rx,ry,0);g.add(t);}
  return g;
}
/** A kid-height hoop on a weighted pole. Local +Z is where the rim faces. */
function hoop(scene:THREE.Object3D,x:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,PAVE,z);g.rotation.y=rotY;scene.add(g);
  const metal=color('#2a3342',.5,.5),board=color('#e6eaf3',0,.5),orange=color('#e8662a',.2,.5);
  cyl(g,0,.05,-.78,.28,.30,.10,metal,12);                  // weighted base
  cyl(g,0,1.25,-.78,.045,.05,2.4,metal,10);                // pole, top at 2.45
  box(g,0,2.42,-.40,.07,.07,.76,metal);                    // arm from the pole to the back of the board
  box(g,0,2.52,0,1.0,.66,.045,board);                      // backboard (2.19 to 2.85)
  for(const [bx,by,bw,bh] of [[0,2.64,.38,.012],[0,2.36,.38,.012],[-.19,2.50,.012,.28],[.19,2.50,.012,.28]] as const)box(g,bx,by,.026,bw,bh,.006,orange);   // target square
  box(g,0,2.31,.045,.06,.03,.05,orange);                   // rim bracket
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.17,.012,5,18),orange);rim.rotation.x=Math.PI/2;rim.position.set(0,2.31,.2325);g.add(rim);
  const net=new THREE.Mesh(new THREE.CylinderGeometry(.17,.095,.34,10,3,true),netMat);net.position.set(0,2.14,.2325);g.add(net);
  basketball(g,.35,.12,.85);                             // the ball waits on the pavement
  return g;
}
/** Table-tennis table with a net, two paddles and a ball, long side along local X. */
function pingPong(scene:THREE.Object3D,x:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,PAVE,z);g.rotation.y=rotY;scene.add(g);
  const L=1.9,W=1.05,top=.72,white=color('#eef1f6',0,.6),metal=color('#2a3342',.5,.5);
  box(g,0,top-.02,0,L,.04,W,color('#1f6b57',0,.5));
  for(const sz of [-1,1])box(g,0,top+.003,sz*(W/2-.02),L-.04,.004,.012,white);
  for(const sx of [-1,1])box(g,sx*(L/2-.02),top+.003,0,.012,.004,W-.04,white);
  box(g,0,top+.003,0,L-.04,.004,.01,white);
  for(const sx of [-1,1]){
    for(const sz of [-1,1])box(g,sx*(L/2-.12),(top-.04)/2,sz*(W/2-.1),.05,top-.04,.05,metal);
    box(g,sx*(L/2-.12),.26,0,.04,.04,W-.2,metal);
  }
  for(const sz of [-1,1])cyl(g,0,top+.075,sz*(W/2+.03),.012,.012,.15,metal,6);
  box(g,0,top+.07,0,.006,.14,W+.06,color('#dfe6f0'));      // net
  for(const [px,pz,pr,pc] of [[-.62,.22,.3,'#c9402f'],[.64,-.26,Math.PI-.4,'#22262f']] as const){
    const p=new THREE.Group();p.position.set(px,top,pz);p.rotation.y=pr;g.add(p);
    cyl(p,0,.006,0,.085,.085,.012,color(pc,0,.7),10);box(p,0,.0075,.12,.026,.015,.09,wood);
  }
  sphere(g,.12,top+.02,.3,.02,white,1);
  return g;
}
/** A small red pull wagon with a cardboard box in it; the handle trails on the ground. */
function wagon(scene:THREE.Object3D,x:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,PAVE,z);g.rotation.y=rotY;scene.add(g);
  const red=color('#c8372d',.1,.6),steel=color('#2a3342',.5,.5),rubber=color('#14171f',0,.9);
  box(g,0,.17,0,.44,.03,.84,red);
  for(const sx of [-1,1])box(g,sx*.215,.245,0,.03,.12,.84,red);
  for(const sz of [-1,1])box(g,0,.245,sz*.41,.40,.12,.03,red);
  for(const az of [-.28,.28]){
    cyl(g,0,.1,az,.018,.018,.52,steel,6).rotation.z=Math.PI/2;box(g,0,.13,az,.06,.06,.06,steel);   // axle and its riser under the pan
    for(const sx of [-1,1]){const w=cyl(g,sx*.27,.1,az,.1,.1,.035,rubber,12);w.rotation.z=Math.PI/2;const hub=cyl(g,sx*.288,.1,az,.04,.04,.01,red,8);hub.rotation.z=Math.PI/2;}
  }
  line(g,[V(0,.17,.44),V(0,.12,.80),V(0,.013,1.18)],.011,steel);   // pull handle, tip resting on the ground
  box(g,0,.02,1.20,.2,.03,.03,steel);
  box(g,.02,.315,-.08,.30,.26,.30,color('#b8925f'),.2);             // cardboard box
  return g;
}
/** A pop-up goal: white tube frame, boxy net, opening toward local +Z. */
function miniGoal(scene:THREE.Object3D,x:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,PAVE,z);g.rotation.y=rotY;scene.add(g);
  const pipe=color('#f1f3f7',0,.4),W=1.5,H=.9,D=.5;
  for(const sx of [-1,1]){
    for(const zz of [0,-D])cyl(g,sx*W/2,H/2,zz,.022,.022,H,pipe,8);
    box(g,sx*W/2,H,-D/2,.044,.044,D,pipe);box(g,sx*W/2,.022,-D/2,.044,.044,D,pipe);
  }
  for(const [yy,zz] of [[H,0],[H,-D],[.022,-D]] as const)cyl(g,0,yy,zz,.022,.022,W,pipe,8).rotation.z=Math.PI/2;
  for(const [px,py,pz,w,h,ry,rx] of [[0,H/2,-D,W,H,0,0],[-W/2,H/2,-D/2,D,H,Math.PI/2,0],[W/2,H/2,-D/2,D,H,Math.PI/2,0],[0,H,-D/2,W,D,0,-Math.PI/2]] as const){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h,8,5),netMat);m.position.set(px,py,pz);m.rotation.set(rx,ry,0);g.add(m);
  }
  return g;
}
function cone(parent:THREE.Object3D,x:number,z:number,y=PAVE){const m=new THREE.Mesh(new THREE.ConeGeometry(.07,.2,8),color('#ff7a2e',0,.6));m.position.set(x,y+.1,z);m.castShadow=true;parent.add(m);cyl(parent,x,y+.007,z,.1,.1,.014,color('#ff7a2e',0,.6),8);}
/** Garden statue of a grey heron on a stone plinth, looking along local +Z. */
function heron(scene:THREE.Object3D,x:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,PAVE,z);g.rotation.y=rotY;scene.add(g);
  const slate2=color('#8da0b3',0,.8),pale2=color('#d3d9e0',0,.8),yellow=color('#d9b43a',0,.6);
  cyl(g,0,.12,0,.26,.30,.24,stone,10);
  for(const sx of [-.04,.04])cyl(g,sx,.54,.02,.016,.016,.6,yellow,6);
  const body=sphere(g,0,.98,0,.17,slate2,1);body.scale.set(.7,.85,1.5);
  line(g,[V(0,1.0,.16),V(0,1.28,.24),V(0,1.46,.12),V(0,1.58,.2),V(0,1.62,.26)],.028,pale2);
  sphere(g,0,1.64,.27,.045,pale2,1);
  const beak=new THREE.Mesh(new THREE.ConeGeometry(.018,.2,5),yellow);beak.rotation.x=Math.PI/2;beak.position.set(0,1.63,.40);g.add(beak);
  line(g,[V(0,1.02,-.2),V(0,.92,-.4),V(0,.8,-.52)],.02,slate2);
  return g;
}
/** Black-and-white cat sitting upright on a seat, looking along local +Z. `y` is the seat surface. */
function cat(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
  const black=color('#1d2029',0,.95),white=color('#ece8e0',0,.95),eye=color('#ffc45a',0,.4,'#ffa21f',.9);
  const body=sphere(g,0,.115,-.04,.12,black,1);body.scale.set(.85,.95,1.15);
  const haunch=sphere(g,0,.09,-.09,.1,black,1);haunch.scale.set(1.1,.9,1);
  sphere(g,0,.15,.06,.07,white,1);
  sphere(g,0,.27,.09,.075,black,1);
  sphere(g,0,.25,.15,.032,white,0);
  for(const sx of [-1,1]){
    const ear=new THREE.Mesh(new THREE.ConeGeometry(.028,.06,4),black);ear.position.set(sx*.045,.34,.08);ear.rotation.z=-sx*.25;g.add(ear);
    sphere(g,sx*.03,.285,.152,.011,eye,0);
    box(g,sx*.04,.07,.07,.04,.14,.05,white);
  }
  line(g,[V(0,.025,-.16),V(.12,.022,-.22),V(.2,.025,-.12),V(.2,.03,.0)],.018,black);
  return g;
}
/** Quetzal perched on a rail top (`y`), facing world +X, long tail streaming out and down on the street side. */
function quetzal(parent:THREE.Object3D,x:number,y:number,z:number){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=Math.PI/2;parent.add(g);
  const green=color('#2fb36c',.25,.45,'#0f7a45',.18),red=color('#d6383a',0,.7),beak=color('#e9c94a',0,.6);
  for(const sx of [-1,1])box(g,sx*.014,.01,0,.014,.02,.04,dark);
  const body=sphere(g,0,.1,-.01,.07,green,1);body.scale.set(.9,1.05,1.3);
  const chest=sphere(g,0,.075,.05,.05,red,1);chest.scale.set(.9,1,1);
  sphere(g,0,.19,.04,.042,green,1);
  const crest=sphere(g,0,.226,.02,.03,green,0);crest.scale.set(.6,1,1);
  const b=new THREE.Mesh(new THREE.ConeGeometry(.012,.04,4),beak);b.rotation.x=Math.PI/2;b.position.set(0,.185,.09);g.add(b);
  for(const sx of [-1,1])line(g,[V(sx*.012,.08,-.07),V(-.07+sx*.01,.0,-.18),V(-.12+sx*.015,-.25,-.24)],.01,green);   // local -x is the street side
  return g;
}
/** Guatemalan-style flag on a short mast: pale blue, white, pale blue vertical bands and a plain green wreath (no coat of arms).
 *  It is ONE continuous cloth: a single subdivided plane whose hoist edge is clamped to the mast and which ripples gently away
 *  from it, so there is no seam anywhere. */
function flag(parent:THREE.Object3D,x:number,y:number,z:number,rotY=0){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
  cyl(g,0,.03,0,.14,.16,.06,iron,10);cyl(g,0,.8,0,.02,.025,1.6,iron,8);sphere(g,0,1.64,0,.04,brass,1);
  const W=.66,H=.42,hoist=.016,cy=1.36;
  const tex=texture((c,w,h)=>{
    c.fillStyle='#4997d0';c.fillRect(0,0,w,h);c.fillStyle='#f4f6f8';c.fillRect(w/3,0,w/3,h);
    c.strokeStyle='#2f7d4a';c.lineWidth=h*.05;c.beginPath();c.arc(w/2,h/2,h*.2,0,Math.PI*2);c.stroke();
    c.fillStyle='#e8d06a';c.beginPath();c.arc(w/2,h/2,h*.06,0,Math.PI*2);c.fill();
  },264,168);
  const geo=new THREE.PlaneGeometry(W,H,18,4);
  const pos=geo.attributes?.position as THREE.BufferAttribute|undefined;
  if(pos){
    for(let i=0;i<pos.count;i++){const u=(pos.getX(i)+W/2)/W;pos.setZ(i,Math.sin(u*Math.PI*2.2)*.04*u);}   // no ripple at the hoist (u=0)
    pos.needsUpdate=true;geo.computeVertexNormals();
  }
  const cloth=new THREE.Mesh(geo,litMaterial(tex,.3));cloth.position.set(hoist+W/2,cy,0);g.add(cloth);
  for(const dy of [-.17,.17])cyl(g,0,cy+dy,0,.034,.034,.03,brass,8);                  // two brass clamps hold the hoist to the mast
  return g;
}
/** Surfboard leaning on a wall, bottom on the ground. The wall's outer face is x=wallX; the board stands off it on the -x side. */
function surfboard(parent:THREE.Object3D,wallX:number,z:number){
  const L=1.9,tilt=Math.asin(.5/L);
  const yaw=new THREE.Group();yaw.position.set(wallX-.57,GROUND+.002,z);yaw.rotation.y=-Math.PI/2;parent.add(yaw);   // local +z faces away from the wall
  const lean=new THREE.Group();lean.rotation.x=-tilt;yaw.add(lean);
  const cream=color('#efe3c8',0,.6),teal=color('#2f9aa1',0,.6);
  const board=sphere(lean,0,L/2,0,1,cream,1);board.scale.set(.23,L/2,.03);
  for(const sy of [.9,1.0])box(lean,0,sy,.0,.40,.07,.062,teal);                // two painted stripes across the middle
  for(const sx of [-.07,0,.07])box(lean,sx,.14,-.05,.02,.12,.06,teal);          // fins
  return yaw;
}
/** Baseball glove, ball and bat resting on the entrance bench seat. */
function baseballSet(parent:THREE.Object3D,benchX:number,benchZ:number){
  const seat=GROUND+.485,tan=color('#8a5a34',0,.85),lace=color('#d9c9a3',0,.8);
  const gl=new THREE.Group();gl.position.set(benchX-.4,seat,benchZ+.02);gl.rotation.y=-.4;parent.add(gl);
  box(gl,0,.025,0,.2,.05,.24,tan);                                              // palm and webbing
  for(let i=0;i<4;i++)box(gl,-.07+i*.047,.027,.15,.042,.04,.12,tan).rotation.y=(i-1.5)*.08;
  box(gl,.12,.03,.02,.05,.045,.14,tan).rotation.y=-.5;                          // thumb
  box(gl,0,.052,-.11,.19,.006,.025,lace);
  sphere(gl,0,.075,.02,.037,color('#f2efe8',0,.6),1);                           // ball in the pocket
  const bat=new THREE.Group();bat.position.set(benchX+.15,seat+.032,benchZ-.02);bat.rotation.y=.2;parent.add(bat);
  const wb=color('#c89b5b',0,.7);
  cyl(bat,0,0,0,.014,.032,.78,wb,8).rotation.z=Math.PI/2;                      // barrel, taper from handle to hitting end
  sphere(bat,-.40,0,0,.024,wb,1);                                              // knob
}
// ---------------------------------------------------------------------------------------------
// END GAME, round two: more small, original objects. Same rule as before (evoke, do not copy): generic things, plain colours,
// no characters, logos, crests or covers. The poster column below carries twelve text-free designs of my own.
// ---------------------------------------------------------------------------------------------
const clothCache=new Map<string,THREE.MeshStandardMaterial>();
/** Plain two-sided cloth colour (pennants, scarves). */
const clothMat=(hex:string)=>{let m=clothCache.get(hex);if(!m){m=new THREE.MeshStandardMaterial({color:hex,roughness:.92,side:THREE.DoubleSide});clothCache.set(hex,m);}return m;};
const SLEEVES=['#d9692a','#2f9aa1','#c9302c','#e8c26a','#425e6c','#7c63c9','#f1efe8','#3b6fb6','#2f7d4a','#b37d55','#b8312b'];

/** Twelve original poster designs on one sheet (6 across, 2 down), drawn with canvas shapes only. Each cell is 342 x 512. */
function posterSheet():THREE.Texture{
  const CW=342,CH=512;
  const ln=(c:CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number)=>{c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();};
  const poly=(c:CanvasRenderingContext2D,pts:number[][],fill:string)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();};
  const dot=(c:CanvasRenderingContext2D,x:number,y:number,r:number,fill:string)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();};
  const art:((c:CanvasRenderingContext2D)=>void)[]=[
    // 0 blueprint of a small building (a nod to puzzle-house games)
    c=>{c.fillStyle='#1c4c8c';c.fillRect(0,0,CW,CH);c.strokeStyle='rgba(255,255,255,.13)';c.lineWidth=1;for(let i=0;i<=CW;i+=19)ln(c,i,0,i,CH);for(let j=0;j<=CH;j+=19)ln(c,0,j,CW,j);
      c.strokeStyle='#e8f1ff';c.lineWidth=5;c.strokeRect(36,70,270,300);c.lineWidth=3;
      ln(c,36,230,190,230);ln(c,190,70,190,230);ln(c,190,300,306,300);ln(c,120,230,120,370);ln(c,250,70,250,160);ln(c,190,160,306,160);
      c.lineWidth=2;c.beginPath();c.arc(120,300,36,-Math.PI/2,0);c.stroke();c.beginPath();c.arc(190,195,30,Math.PI/2,Math.PI);c.stroke();
      c.strokeRect(50,84,40,28);c.strokeRect(210,84,26,26);c.strokeRect(262,176,30,40);
      c.lineWidth=3;c.beginPath();c.arc(171,445,38,0,Math.PI*2);c.stroke();ln(c,171,405,171,485);ln(c,131,445,211,445);poly(c,[[171,405],[163,425],[179,425]],'#e8f1ff');},
    // 1 surf
    c=>{const g=c.createLinearGradient(0,0,0,CH);g.addColorStop(0,'#f6b26b');g.addColorStop(.55,'#f4d9a6');g.addColorStop(1,'#2a7f8e');c.fillStyle=g;c.fillRect(0,0,CW,CH);
      dot(c,171,190,78,'#fff1c4');
      const wave=(y:number,amp:number,col:string)=>{c.fillStyle=col;c.beginPath();c.moveTo(0,CH);c.lineTo(0,y);for(let x=0;x<=CW;x+=6)c.lineTo(x,y+Math.sin(x/CW*Math.PI*3)*amp);c.lineTo(CW,CH);c.closePath();c.fill();};
      wave(300,16,'#3b9aa6');wave(345,20,'#2a7f8e');wave(395,18,'#1d5f73');wave(445,14,'#14465a');
      c.strokeStyle='#f4f6f8';c.lineWidth=9;c.lineCap='round';c.beginPath();c.arc(215,335,54,Math.PI*1.1,Math.PI*1.9);c.stroke();c.lineCap='butt';},
    // 2 longship at dusk
    c=>{const g=c.createLinearGradient(0,0,0,CH);g.addColorStop(0,'#26325e');g.addColorStop(.6,'#c9786a');g.addColorStop(1,'#e8b26b');c.fillStyle=g;c.fillRect(0,0,CW,CH);
      dot(c,171,330,92,'#ffd48a');c.fillStyle='#16213f';c.fillRect(0,345,CW,CH-345);
      poly(c,[[110,172],[232,172],[232,262],[110,262]],'#efe3c8');c.fillStyle='#b8312b';for(let i=0;i<4;i++)c.fillRect(110+i*30.5,172,15,90);
      c.fillStyle='#0d1226';c.fillRect(166,150,8,180);
      c.beginPath();c.moveTo(34,318);c.quadraticCurveTo(171,412,308,318);c.lineTo(294,298);c.quadraticCurveTo(171,352,48,298);c.closePath();c.fill();
      c.strokeStyle='#0d1226';c.lineWidth=8;c.lineCap='round';c.beginPath();c.moveTo(38,310);c.quadraticCurveTo(14,272,42,236);c.stroke();c.beginPath();c.moveTo(304,310);c.quadraticCurveTo(326,278,306,250);c.stroke();c.lineCap='butt';
      dot(c,44,234,9,'#0d1226');for(let i=0;i<6;i++)dot(c,78+i*38,316+Math.sin(i/5*Math.PI)*14,8,i%2?'#e8c26a':'#c9402f');
      c.strokeStyle='rgba(255,255,255,.28)';c.lineWidth=3;for(let i=0;i<5;i++){ln(c,30+i*60,380+i%2*20,70+i*60,380+i%2*20);ln(c,60+i*50,430,95+i*50,430);}},
    // 3 stepped temple in jungle (a nod to Guatemala and its Maya sites)
    c=>{c.fillStyle='#16473a';c.fillRect(0,0,CW,CH);dot(c,171,130,56,'#e9b44c');
      const tiers=[[270,430],[228,396],[186,362],[144,328],[102,294]];
      tiers.forEach(([w,y],i)=>{c.fillStyle=i%2?'#a68f68':'#b9a27a';c.fillRect(171-w/2,y-36,w,36);});
      c.fillStyle='#8a7653';c.fillRect(151,258,40,172);for(let y=262;y<430;y+=12){c.fillStyle='#c8b48a';c.fillRect(151,y,40,5);}
      poly(c,[[135,258],[207,258],[200,222],[142,222]],'#b9a27a');c.fillStyle='#2a2118';c.fillRect(160,232,22,26);
      poly(c,[[150,222],[192,222],[186,170],[156,170]],'#8a7653');
      for(let i=0;i<9;i++){c.fillStyle=i%2?'#0f3a2e':'#1f6a4f';c.beginPath();c.ellipse(20+i*38,470+(i%3)*6,34,42,0,0,Math.PI*2);c.fill();}},
    // 4 whodunit: magnifier, question mark, footprints
    c=>{c.fillStyle='#14303a';c.fillRect(0,0,CW,CH);poly(c,[[171,0],[20,CH],[322,CH]],'rgba(255,240,200,.07)');
      c.strokeStyle='#6d4c2f';c.lineWidth=26;c.lineCap='round';ln(c,215,275,285,360);c.lineCap='butt';
      c.fillStyle='rgba(255,255,255,.10)';c.beginPath();c.arc(150,200,88,0,Math.PI*2);c.fill();c.strokeStyle='#e9c46a';c.lineWidth=14;c.stroke();
      c.fillStyle='#e9c46a';c.font='bold 150px Georgia, serif';c.textAlign='center';c.textBaseline='middle';c.fillText('?',150,208);
      for(const [fx,fy,fr] of [[90,420,-.25],[170,470,.2]] as const){c.save();c.translate(fx,fy);c.rotate(fr);c.fillStyle='rgba(233,196,106,.85)';c.beginPath();c.ellipse(0,0,20,34,0,0,Math.PI*2);c.fill();for(let t=0;t<5;t++){c.beginPath();c.arc(-18+t*9,-44-Math.abs(t-2)*-3,5,0,Math.PI*2);c.fill();}c.restore();}},
    // 5 geometric fox
    c=>{c.fillStyle='#e8dcc0';c.fillRect(0,0,CW,CH);dot(c,171,250,150,'#2f5d50');
      poly(c,[[78,215],[92,56],[170,150]],'#d9692a');poly(c,[[264,215],[250,56],[172,150]],'#d9692a');poly(c,[[96,190],[102,104],[142,160]],'#3b2218');poly(c,[[246,190],[240,104],[200,160]],'#3b2218');
      poly(c,[[62,250],[171,140],[280,250],[171,450]],'#d9692a');poly(c,[[62,250],[171,340],[171,450],[112,388]],'#f4efe3');poly(c,[[280,250],[171,340],[171,450],[230,388]],'#f4efe3');
      poly(c,[[120,262],[150,274],[124,290]],'#1d1612');poly(c,[[222,262],[192,274],[218,290]],'#1d1612');dot(c,171,446,15,'#1d1612');},
    // 6 treasure map
    c=>{const g=c.createRadialGradient(171,256,40,171,256,330);g.addColorStop(0,'#ecd7a4');g.addColorStop(1,'#c9a566');c.fillStyle=g;c.fillRect(0,0,CW,CH);
      c.fillStyle='#7d9a54';for(const [ix,iy,iw,ih] of [[90,120,52,34],[240,200,40,28],[110,330,60,38]] as const){c.beginPath();c.ellipse(ix,iy,iw,ih,.3,0,Math.PI*2);c.fill();c.strokeStyle='#6b5330';c.lineWidth=3;c.stroke();}
      c.setLineDash([12,10]);c.strokeStyle='#a1352a';c.lineWidth=5;c.beginPath();c.moveTo(90,126);c.bezierCurveTo(170,150,260,150,240,200);c.bezierCurveTo(220,260,110,260,112,330);c.stroke();c.setLineDash([]);
      c.strokeStyle='#a1352a';c.lineWidth=12;c.lineCap='round';ln(c,92,318,128,346);ln(c,128,318,92,346);c.lineCap='butt';
      c.strokeStyle='#6b5330';c.lineWidth=3;for(let i=0;i<6;i++){c.beginPath();c.arc(60+i*46,440+(i%2)*14,14,Math.PI*1.1,Math.PI*1.9);c.stroke();}
      c.beginPath();c.arc(262,420,34,0,Math.PI*2);c.stroke();poly(c,[[262,380],[270,420],[262,460],[254,420]],'#6b5330');poly(c,[[222,420],[262,412],[302,420],[262,428]],'#a1352a');},
    // 7 film strip
    c=>{c.fillStyle='#1b1824';c.fillRect(0,0,CW,CH);c.fillStyle='#0b0a10';c.fillRect(60,0,222,CH);
      c.fillStyle='#d8d4c8';for(let y=14;y<CH;y+=34){c.fillRect(70,y,16,18);c.fillRect(256,y,16,18);}
      const fr=[['#f08a4b','#6b2d5c'],['#101a3a','#e9e4c8'],['#2f9aa1','#f4efe3']];
      fr.forEach(([a,b],i)=>{const y=34+i*150;c.fillStyle=a;c.fillRect(100,y,142,120);
        if(i===0){poly(c,[[100,y+120],[150,y+60],[200,y+120]],b);dot(c,205,y+36,18,'#ffe2a0');}
        if(i===1){dot(c,170,y+52,30,b);dot(c,184,y+46,26,a);for(let k=0;k<6;k++)dot(c,110+k*24,y+96+(k%2)*8,2,b);}
        if(i===2){poly(c,[[171,y+16],[183,y+52],[222,y+52],[190,y+74],[202,y+110],[171,y+88],[140,y+110],[152,y+74],[120,y+52],[159,y+52]],b);}});},
    // 8 knight's helm in a gold ring, holly sprigs
    c=>{c.fillStyle='#1c4a33';c.fillRect(0,0,CW,CH);c.strokeStyle='#d9b43a';c.lineWidth=11;c.beginPath();c.arc(171,230,128,0,Math.PI*2);c.stroke();
      c.fillStyle='#2f9a54';c.beginPath();c.moveTo(171,112);c.quadraticCurveTo(250,50,288,120);c.quadraticCurveTo(230,100,200,150);c.closePath();c.fill();
      c.fillStyle='#9aa3ad';c.beginPath();c.moveTo(118,336);c.lineTo(118,200);c.quadraticCurveTo(118,124,171,116);c.quadraticCurveTo(224,124,224,200);c.lineTo(224,336);c.closePath();c.fill();
      c.fillStyle='#c8ced6';c.fillRect(166,120,10,216);c.fillStyle='#1a1d24';c.fillRect(132,212,78,10);c.fillRect(132,244,78,6);
      for(const [lx,ly,lr] of [[80,430,-.5],[262,430,.5],[171,470,0]] as const){c.save();c.translate(lx,ly);c.rotate(lr);c.fillStyle='#2f9a54';c.beginPath();c.ellipse(0,0,48,18,0,0,Math.PI*2);c.fill();c.restore();}
      for(const [bx,by] of [[150,448],[171,456],[192,448]] as const)dot(c,bx,by,9,'#c9302c');},
    // 9 vinyl record
    c=>{c.fillStyle='#2b1f3a';c.fillRect(0,0,CW,CH);dot(c,171,230,132,'#0f0d14');c.strokeStyle='rgba(255,255,255,.09)';c.lineWidth=2;for(let r=56;r<130;r+=9){c.beginPath();c.arc(171,230,r,0,Math.PI*2);c.stroke();}
      dot(c,171,230,46,'#e8662a');dot(c,171,230,7,'#2b1f3a');c.strokeStyle='rgba(255,255,255,.3)';c.lineWidth=6;c.beginPath();c.arc(171,230,112,Math.PI*1.15,Math.PI*1.45);c.stroke();
      c.strokeStyle='#cfd4dc';c.lineWidth=9;c.lineCap='round';ln(c,300,50,222,184);c.lineCap='butt';poly(c,[[206,176],[230,192],[222,206],[198,190]],'#cfd4dc');
      ['#2f9aa1','#e8662a','#e8c26a','#c9302c','#7c63c9','#2f9aa1','#e8c26a'].forEach((col,i)=>{const h=[60,110,80,130,70,100,50][i];c.fillStyle=col;c.fillRect(44+i*38,CH-40-h,26,h);});},
    // 10 playing cards on felt
    c=>{c.fillStyle='#1d5a47';c.fillRect(0,0,CW,CH);
      const card=(x:number,y:number,rot:number,suit:'d'|'s'|'h')=>{c.save();c.translate(x,y);c.rotate(rot);c.fillStyle='#f4f1ea';c.fillRect(-62,-92,124,184);c.strokeStyle='#bdb7a8';c.lineWidth=3;c.strokeRect(-62,-92,124,184);
        const ink=suit!=='s'?'#c9302c':'#14171f';c.fillStyle=ink;
        if(suit==='d')poly(c,[[0,-44],[34,0],[0,44],[-34,0]],ink);
        if(suit==='h'){c.beginPath();c.moveTo(0,40);c.bezierCurveTo(-60,-6,-30,-52,0,-18);c.bezierCurveTo(30,-52,60,-6,0,40);c.fill();}
        if(suit==='s'){c.beginPath();c.moveTo(0,-44);c.bezierCurveTo(-60,10,-30,50,0,18);c.bezierCurveTo(30,50,60,10,0,-44);c.fill();c.fillRect(-5,10,10,34);}
        poly(c,[[-48,-76],[-40,-62],[-48,-48],[-56,-62]],ink);c.restore();};
      card(110,270,-.34,'s');card(232,270,.34,'h');card(171,250,0,'d');dot(c,171,430,26,'#e8c26a');dot(c,171,430,16,'#1d5a47');},
    // 11 teapot over a lattice board
    c=>{const g=c.createLinearGradient(0,0,0,CH);g.addColorStop(0,'#e6a24d');g.addColorStop(1,'#a8552b');c.fillStyle=g;c.fillRect(0,0,CW,CH);
      c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=5;c.lineCap='round';for(let s=0;s<3;s++){c.beginPath();c.moveTo(150+s*22,150);c.bezierCurveTo(130+s*22,110,180+s*22,90,150+s*22,40);c.stroke();}c.lineCap='butt';
      dot(c,171,222,64,'#3a2418');c.fillStyle='#3a2418';c.fillRect(131,152,80,18);dot(c,171,146,12,'#3a2418');poly(c,[[228,212],[292,186],[298,200],[236,236]],'#3a2418');c.strokeStyle='#3a2418';c.lineWidth=14;c.beginPath();c.arc(112,222,34,Math.PI*.5,Math.PI*1.5);c.stroke();
      c.fillStyle='#efe3c8';c.fillRect(66,300,210,176);c.strokeStyle='#6b3d20';c.lineWidth=3;c.strokeRect(66,300,210,176);for(let i=1;i<7;i++){ln(c,66+i*30,300,66,300+i*30);ln(c,276,300+i*30,66+i*30,476);ln(c,66+i*30,300,276,476-i*30>300?476-i*30:300);}
      c.beginPath();c.arc(171,388,34,0,Math.PI*2);c.stroke();dot(c,171,388,8,'#6b3d20');}
  ];
  return texture((c,W,H)=>{
    art.forEach((draw,i)=>{
      const col=i%6,row=Math.floor(i/6);
      c.save();c.translate(col*CW,row*CH);c.beginPath();c.rect(0,0,CW,CH);c.clip();draw(c);c.restore();
      c.strokeStyle='rgba(18,14,22,.9)';c.lineWidth=8;c.strokeRect(col*CW+4,row*CH+4,CW-8,CH-8);
    });
  },CW*6,CH*2);
}
/** A Morris-style advertising column wrapped in the twelve posters: stone plinth, steel cap and a small lamp on top. */
function posterColumn(scene:THREE.Object3D,x:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,PAVE,z);g.rotation.y=rotY;scene.add(g);
  const R=.5,SH=1.56,base=.14,metal=color('#2a3342',.5,.5);
  cyl(g,0,.04,0,R+.12,R+.14,.08,stone,16);cyl(g,0,.11,0,R+.06,R+.06,.06,metal,16);                 // stepped plinth, top at .14
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(R,R,SH,48,1,true),litMaterial(posterSheet(),.42));shaft.position.y=base+SH/2;g.add(shaft);
  cyl(g,0,base+SH+.03,0,R+.04,R+.04,.06,metal,16);                                                  // cap ring, sits on the shaft top
  cyl(g,0,base+SH+.06+.11,0,.12,R+.06,.22,metal,16);                                                // conical roof
  sphere(g,0,base+SH+.06+.22+.03,0,.05,bright,1);halo(g,0,base+SH+.34,0,1.3,'#ffd39c',.5);          // lamp finial
  glowPatch(g,0,.003,0,3.4,3.4,'#ffc27a',.08,0,true);
  return g;
}
/** Small round-cornered display table with a lower shelf. Local origin is the pavement under its centre; the top surface is at TABLE_H. */
const TABLE_H=.8;
function displayTable(scene:THREE.Object3D,x:number,z:number,rotY:number,W=1.7,D=.62){
  const g=new THREE.Group();g.position.set(x,PAVE,z);g.rotation.y=rotY;scene.add(g);
  const legs=color('#3a2f2e',0,.8),top=color('#b88d62',0,.7),cloth=color('#2b3d5c',0,.95);
  box(g,0,TABLE_H-.025,0,W,.05,D,top);
  for(const sx of [-1,1])for(const sz of [-1,1])box(g,sx*(W/2-.06),(TABLE_H-.04)/2,sz*(D/2-.06),.06,TABLE_H-.04,.06,legs);
  box(g,0,.26,0,W-.1,.03,D-.1,top);
  box(g,0,TABLE_H+.003,0,W-.12,.006,D-.14,cloth);                                                   // runner; things stand on its top at TABLE_H+.006
  return g;
}
/** Generic toy roadster: long hood, open cockpit, four wheels. Forward is local +Z; y is the surface it stands on. */
function toyRoadster(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
  const paint=color('#1f5a46',.3,.4),tire=color('#14171f',0,.9),chrome=color('#cfd4dc',.7,.3);
  box(g,0,.04,0,.12,.04,.34,paint);box(g,0,.0725,.09,.10,.025,.16,paint);box(g,0,.0725,-.12,.10,.025,.10,paint);
  box(g,0,.0675,-.015,.09,.015,.08,color('#2a1d18'));
  const wind=box(g,0,.098,.035,.10,.04,.006,color('#a9c8d6',.2,.2));wind.rotation.x=-.45;
  for(const sx of [-1,1])for(const sz of [-1,1]){cyl(g,sx*.065,.03,sz*.105,.03,.03,.022,tire,10).rotation.z=Math.PI/2;cyl(g,sx*.0765,.03,sz*.105,.014,.014,.004,chrome,8).rotation.z=Math.PI/2;}
  for(const sx of [-1,1])sphere(g,sx*.04,.0725,.172,.014,bright,0);
  box(g,0,.04,.172,.09,.014,.008,chrome);
  return g;
}
/** Generic white mini flatbed truck. Forward is local +Z. */
function toyKeiTruck(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
  const white=color('#e8e6df',0,.5),tire=color('#14171f',0,.9);
  box(g,0,.045,0,.12,.03,.30,white);box(g,0,.095,.085,.12,.07,.12,white);box(g,0,.108,.1455,.105,.035,.004,color('#2a3a48',.2,.2));
  box(g,0,.065,-.07,.12,.01,.17,color('#8a929c'));
  for(const sx of [-1,1])box(g,sx*.057,.09,-.07,.006,.04,.17,white);
  box(g,0,.09,-.152,.12,.04,.006,white);
  box(g,.0,.1,-.06,.07,.06,.07,color('#b8925f'),.3);                                                // a small crate in the bed
  for(const sx of [-1,1])for(const sz of [-1,1])cyl(g,sx*.065,.03,sz*.095,.03,.03,.022,tire,10).rotation.z=Math.PI/2;
  return g;
}
/** Generic red go-kart toy. Forward is local +Z. */
function toyKart(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
  const red=color('#d9402a',0,.5),tire=color('#14171f',0,.9),steel=color('#9aa3ad',.6,.4);
  box(g,0,.035,0,.10,.02,.20,red);box(g,0,.07,-.07,.08,.07,.03,red);box(g,0,.0525,-.04,.07,.015,.06,color('#1d2029'));box(g,0,.05,.085,.09,.03,.05,red);
  cyl(g,0,.075,.03,.006,.006,.06,steel,6);
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(.03,.005,5,12),color('#14171f'));wheel.position.set(0,.108,.025);wheel.rotation.x=Math.PI/2-.6;g.add(wheel);
  for(const az of [-.065,.065]){cyl(g,0,.025,az,.005,.005,.16,steel,5).rotation.z=Math.PI/2;for(const sx of [-1,1])cyl(g,sx*.07,.025,az,.025,.025,.03,tire,10).rotation.z=Math.PI/2;}
  box(g,0,.03,.115,.11,.012,.012,steel);
  return g;
}
/** Small orange fox figurine on a round wooden base, looking along local +Z. */
function foxFigure(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
  const orange=color('#d9692a',0,.8),cream=color('#f1ebdd',0,.8),dk=color('#1d1612',0,.6);
  cyl(g,0,.01,0,.075,.08,.02,wood,12);
  sphere(g,0,.075,-.005,.055,orange,1).scale.set(.85,1.2,1);sphere(g,0,.07,.03,.035,cream,1);sphere(g,0,.15,.02,.036,orange,1);
  const snout=new THREE.Mesh(new THREE.ConeGeometry(.014,.05,5),orange);snout.rotation.x=Math.PI/2;snout.position.set(0,.145,.062);g.add(snout);
  sphere(g,0,.145,.088,.007,dk,0);
  for(const sx of [-1,1]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.014,.04,4),orange);ear.position.set(sx*.022,.19,.015);g.add(ear);}
  line(g,[V(0,.04,-.04),V(0,.05,-.1),V(0,.09,-.14)],.02,orange);sphere(g,0,.095,-.145,.02,cream,1);
  return g;
}
/** Horned scarab beetle on a little stone plinth (a quiet nod to a certain novella). */
function beetleFigure(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
  const shell=color('#2a7a63',.4,.35,'#103a30',.35),legm=color('#0f1722',0,.7);
  cyl(g,0,.015,0,.085,.09,.03,stone,10);                                              // plinth, top at .03
  sphere(g,0,.061,0,.05,shell,1).scale.set(1,.62,1.45);                               // wing cases, bottom at the plinth top
  sphere(g,0,.06,.08,.022,shell,1);                                                    // head overlaps the front of the body
  const horn=new THREE.Mesh(new THREE.ConeGeometry(.008,.04,5),shell);horn.rotation.x=1.1;horn.position.set(0,.078,.098);g.add(horn);
  box(g,0,.0925,0,.003,.002,.12,color('#06100d'));                                     // split between the wing cases
  for(const zz of [-.03,.0,.03])for(const sx of [-1,1])line(g,[V(sx*.04,.055,zz),V(sx*.055,.058,zz),V(sx*.058,.031,zz)],.0055,legm);
  return g;
}
/** Three plain hardbacks with a baseball on top (no covers drawn: a nod to a book about numbers and baseball and to a novella). */
function bookStack(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
  const cream=color('#efe3c8',0,.9);let top=0;
  for(const [w,d,h,col,r] of [[.22,.15,.035,'#425e6c',.0],[.20,.14,.03,'#965857',.18],[.18,.13,.028,'#d8cab3',-.12]] as const){
    const b=new THREE.Group();b.position.set(0,top+h/2,0);b.rotation.y=r;g.add(b);
    box(b,0,0,0,w,h,d,color(col));box(b,0,0,d/2+.0005,w-.02,h-.01,.003,cream);box(b,-w/2+.005,0,0,.012,h+.002,d+.002,color(col,0,.7));
    top+=h;
  }
  const ball=new THREE.Group();ball.position.set(.01,top+.037,0);g.add(ball);
  sphere(ball,0,0,0,.037,color('#f2efe8',0,.6),1);
  for(const sx of [-1,1])box(ball,sx*.013,.004,.0345,.0035,.022,.003,color('#b8312b')).rotation.z=sx*.45;   // two short red stitch marks on the front face
  return g;
}
/** Flat lattice board with a handful of plain stones (a generic two-player tile game; no lotus, no emblem). Surface at y+.012. */
function latticeBoard(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number,size=.27){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
  box(g,0,.006,0,size+.02,.012,size+.02,color('#4a2f22',0,.7));
  const tex=texture((c,W,H)=>{
    c.fillStyle='#efe3c8';c.fillRect(0,0,W,H);c.strokeStyle='#6b3d20';c.lineWidth=2;const n=9;
    for(let i=0;i<=n;i++){const p=i*W/n;
      c.beginPath();c.moveTo(p,0);c.lineTo(0,p);c.stroke();c.beginPath();c.moveTo(p,0);c.lineTo(W,W-p);c.stroke();
      c.beginPath();c.moveTo(0,p);c.lineTo(W-p,H);c.stroke();c.beginPath();c.moveTo(p,H);c.lineTo(W,p);c.stroke();}
    c.lineWidth=5;c.strokeRect(2,2,W-4,H-4);c.beginPath();c.arc(W/2,H/2,W*.14,0,Math.PI*2);c.stroke();},256,256);
  const top=new THREE.Mesh(new THREE.PlaneGeometry(size,size),litMaterial(tex,.2));top.rotation.x=-Math.PI/2;top.position.y=.0125;g.add(top);
  for(const [tx,tz,tc] of [[-.06,-.05,'#f1efe8'],[.03,.07,'#2a2523'],[.09,-.02,'#f1efe8'],[-.08,.06,'#2a2523'],[0,0,'#c9302c']] as const)cyl(g,tx,.0165,tz,.016,.016,.008,color(tc,0,.6),10);
  return g;
}
/** A white toque with a puffed top. Stands on its band. */
function chefHat(parent:THREE.Object3D,x:number,y:number,z:number){
  const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);const white=color('#f4f1ea',0,.9);
  cyl(g,0,.035,0,.055,.052,.07,white,12);sphere(g,0,.095,0,.07,white,1).scale.set(1,.75,1);
  return g;
}
/** Over-ear headphones standing on their ear cups. */
function headphones(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);const blk=color('#1d2029',0,.5),pad=color('#c9402f',0,.7);
  const band=new THREE.Mesh(new THREE.TorusGeometry(.075,.007,6,18,Math.PI),blk);band.position.y=.04;g.add(band);
  for(const sx of [-1,1]){cyl(g,sx*.078,.04,0,.04,.04,.03,blk,12).rotation.z=Math.PI/2;cyl(g,sx*.0625,.04,0,.034,.034,.012,pad,12).rotation.z=Math.PI/2;}
  return g;
}
/** Two dice and a short stack of chips. */
function diceAndChips(parent:THREE.Object3D,x:number,y:number,z:number){
  const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
  const white=color('#f4f1ea',0,.4),pip=color('#14171f',0,.6);
  const die=(dx:number,dz:number,rot:number,pips:number[][])=>{const d=new THREE.Group();d.position.set(dx,.016,dz);d.rotation.y=rot;g.add(d);box(d,0,0,0,.032,.032,.032,white);for(const [px,pz] of pips)box(d,px,.0165,pz,.007,.002,.007,pip);};
  die(-.03,0,.4,[[0,0],[-.008,-.008],[.008,-.008],[-.008,.008],[.008,.008]]);
  die(.015,.025,-.3,[[-.008,-.009],[.008,-.009],[-.008,0],[.008,0],[-.008,.009],[.008,.009]]);
  ['#c9302c','#f1efe8','#14171f','#c9302c','#f1efe8','#c9302c'].forEach((cc,i)=>cyl(g,.06,.002+i*.004,-.035,.02,.02,.004,color(cc,0,.6),12));
  return g;
}
/** Wooden crate of records seen from above: plain coloured sleeves, no artwork. Stands on the pavement. */
function recordCrate(scene:THREE.Object3D,x:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,GROUND,z);g.rotation.y=rotY;scene.add(g);
  const W=.5,D=.34,H=.26;
  box(g,0,.01,0,W,.02,D,wood);
  for(const sz of [-1,1])box(g,0,H/2,sz*(D/2-.01),W,H,.02,wood);
  for(const sx of [-1,1])box(g,sx*(W/2-.01),H/2,0,.02,H,D-.04,wood);
  for(let i=0;i<10;i++)box(g,-W/2+.05+i*.043,.02+.15,0,.006,.30,.28,color(SLEEVES[i%SLEEVES.length]),0).rotation.z=((i%3)-1)*.035;
  return g;
}
/** Closed treasure chest on the pavement with a few coins in front. */
function treasureChest(scene:THREE.Object3D,x:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,GROUND,z);g.rotation.y=rotY;scene.add(g);
  const gold=color('#e0b34a',.6,.35),strap=color('#c9a24a',.5,.4);
  box(g,0,.1,0,.50,.20,.32,wood);
  cyl(g,0,.2,0,.16,.16,.5,wood,14).rotation.z=Math.PI/2;
  for(const sx of [-1,1]){box(g,sx*.17,.1,0,.04,.205,.325,strap);cyl(g,sx*.17,.2,0,.163,.163,.04,strap,14).rotation.z=Math.PI/2;}
  box(g,0,.17,.165,.07,.09,.012,gold);box(g,0,.165,.172,.012,.03,.004,color('#14171f'));
  for(const [cx,cz] of [[.1,.3],[.17,.26],[.04,.34],[-.12,.3],[.2,.36]] as const)cyl(g,cx,.003,cz,.035,.035,.006,gold,10);
  return g;
}
/** Round shield hung flat on a rail: wood disc, painted face, steel rim and boss. `z` is the front face of the bars it hangs on. */
function roundShield(parent:THREE.Object3D,x:number,y:number,z:number,a:string,b:string){
  const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
  cyl(g,0,0,.0175,.22,.22,.035,wood,18).rotation.x=Math.PI/2;
  const tex=texture((c,W,H)=>{c.fillStyle=a;c.fillRect(0,0,W,H);c.fillStyle=b;c.beginPath();c.moveTo(W/2,H/2);c.arc(W/2,H/2,W,0,Math.PI/2);c.fill();c.beginPath();c.moveTo(W/2,H/2);c.arc(W/2,H/2,W,Math.PI,Math.PI*1.5);c.fill();},128,128);
  const face=new THREE.Mesh(new THREE.CircleGeometry(.2,24),litMaterial(tex,.25));face.position.z=.0365;g.add(face);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.212,.012,5,24),iron);rim.position.z=.0175;g.add(rim);
  sphere(g,0,0,.045,.05,iron,1).scale.set(1,1,.6);
  return g;
}
/** Striped scarf draped over a rail's top bar (centre height `railY`, bar .065 square): a wrap over the top and two drops. */
function scarf(parent:THREE.Object3D,x:number,railY:number,z:number,a:string,b:string){
  const tex=texture((c,W,H)=>{c.fillStyle=a;c.fillRect(0,0,W,H);c.fillStyle=b;for(let y=0;y<H;y+=36)c.fillRect(0,y+10,W,16);c.fillStyle=b;c.fillRect(0,H-6,W,6);},64,256);
  const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.95});
  const top=railY+.0325;
  box(parent,x,top+.008,z,.12,.016,.10,color(a,0,.95));
  box(parent,x,top+.008-.21,z+.0395,.12,.42,.014,mat);
  box(parent,x,top+.008-.15,z-.0395,.12,.30,.014,mat);
}
/** A swag of pennants strung along the front of a rail between x1 and x2 (string ends touch the rail's top bar). */
function bunting(parent:THREE.Object3D,x1:number,x2:number,railTop:number,zFace:number,cols:string[]){
  const P:THREE.Vector3[]=[];const f=(t:number)=>V(x1+(x2-x1)*t,railTop-.03-.2*4*t*(1-t),zFace+.05*Math.sin(Math.PI*t));
  for(let i=0;i<=16;i++)P.push(f(i/16));
  line(parent,P,.01,dark);
  const N=Math.round((x2-x1)/.2);
  for(let i=1;i<N;i++){
    const p=f(i/N);const r=.095;
    const tri=new THREE.Mesh(new THREE.CircleGeometry(r,3,-Math.PI/2),clothMat(cols[i%cols.length]));
    tri.position.set(p.x,p.y-r*.5+.012,p.z);parent.add(tri);
  }
}
/** Holly wreath with berries and a red ribbon, hung from a door's top rail by a short ribbon. `topY` is the underside of that rail. */
function wreath(parent:THREE.Object3D,x:number,topY:number,zFace:number){
  const R=.17,t=.035,cy=topY-.04-(R+t);
  const green=color('#2e6b3d',0,.9),red=color('#c9302c',0,.6);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(R,t,6,18),green);ring.position.set(x,cy,zFace+.04);parent.add(ring);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;sphere(parent,x+Math.cos(a)*R,cy+Math.sin(a)*R,zFace+.04+t*.6,.028,i%2?color('#3f8a4f',0,.9):green,0);}
  for(const a of [.5,1.7,3.4,4.5,5.5])sphere(parent,x+Math.cos(a)*R*1.05,cy+Math.sin(a)*R*1.05,zFace+.04+t,.016,red,0);
  box(parent,x,topY-.02,zFace+.02,.03,.08,.04,red);                                              // hanging ribbon, overlaps the rail above and the ring below
  box(parent,x,cy-R-t+.02,zFace+.04+t,.05,.05,.03,red);
  for(const s of [-1,1])box(parent,x+s*.03,cy-R-t-.05,zFace+.04+t,.025,.12,.012,red).rotation.z=s*.25;
}

// ---------------------------------------------------------------------------------------------
// ROUND FOUR. Everything below is original, generic low-poly work: no team crests, brand marks, sponsor logos,
// album artwork or copyrighted characters. See docs/VTEST4_CHANGES.md for what each piece stands in for.
// ---------------------------------------------------------------------------------------------
/** A cylinder between two points that lie in the plane x = const (rotation about X only). */
function rod(parent:THREE.Object3D,x:number,y1:number,z1:number,y2:number,z2:number,r:number,mat:THREE.Material,segments=6){
  const dy=y2-y1,dz=z2-z1,m=cyl(parent,x,(y1+y2)/2,(z1+z2)/2,r,r,Math.hypot(dy,dz),mat,segments);
  m.rotation.x=Math.atan2(dz,dy);return m;
}
/** A cylinder between two points that lie in the plane z = const (rotation about Z only). */
function rodX(parent:THREE.Object3D,z:number,x1:number,y1:number,x2:number,y2:number,r:number,mat:THREE.Material,segments=6){
  const dx=x2-x1,dy=y2-y1,m=cyl(parent,(x1+x2)/2,(y1+y2)/2,z,r,r,Math.hypot(dx,dy),mat,segments);
  m.rotation.z=Math.atan2(-dx,dy);return m;
}

/** White kei (mini) pickup, cab-over layout, drawn at real size: about 3.45 m long, 1.48 m wide, 1.77 m to the roof, 1.9 m wheelbase,
 *  12-inch wheels, flat bed 1.94 m long. Nose toward local +Z. The cab is one extruded side profile with wheel-arch cut-outs, so the
 *  wheels sit in real recesses instead of poking through the body. No badges, no lettering. */
function keiTruck(scene:THREE.Object3D,x:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,PAVE,z);g.rotation.y=rotY;scene.add(g);
  const paint=color('#eceff4',.08,.42),shade=color('#d3d8e1',.08,.5),black=color('#171a22',.1,.7),glassDark=color('#1c2c40',.3,.2),steel=color('#2b3340',.5,.5),rubber=color('#12151c',0,.9),capGrey=color('#aab3bf',.6,.4),floorMat=color('#59616f',.2,.7),plateWhite=color('#f1f1ec',0,.6);
  const lamp=color('#fff1cf',0,.3,'#ffe2a0',.7),amberLamp=color('#ffb347',0,.4,'#ff9a1f',.6),tailLamp=color('#c4252d',0,.4,'#ff2a2a',.5);
  // Wheels (r .27 m) and axles; front axle under the cab, rear axle under the bed.
  for(const az of [1.15,-.755]){
    cyl(g,0,.27,az,.03,.03,1.3,steel,8).rotation.z=Math.PI/2;
    for(const sx of [-1,1]){
      cyl(g,sx*.65,.27,az,.27,.27,.15,rubber,16).rotation.z=Math.PI/2;                // tyre
      cyl(g,sx*.728,.27,az,.155,.155,.016,capGrey,12).rotation.z=Math.PI/2;           // wheel face
      cyl(g,sx*.737,.27,az,.045,.045,.012,black,8).rotation.z=Math.PI/2;              // centre cap
    }
  }
  // Chassis: two rails from the rear bumper to the cab floor, and a dark block that fills the cab's wheel-well so the arches read as recesses.
  for(const sx of [-1,1])box(g,sx*.46,.34,-.43,.10,.14,2.54,steel);
  box(g,0,.42,1.15,1.0,.32,.62,black);
  // Cab: side profile (shape x = truck z, shape y = height), extruded across the full 1.46 m width.
  const prof=new THREE.Shape();
  prof.moveTo(.28,.26);prof.lineTo(.84,.26);prof.lineTo(.84,.40);prof.lineTo(.92,.52);prof.lineTo(1.03,.575);prof.lineTo(1.15,.59);prof.lineTo(1.27,.575);prof.lineTo(1.38,.52);prof.lineTo(1.46,.40);prof.lineTo(1.46,.26);
  prof.lineTo(1.62,.26);prof.lineTo(1.62,.80);prof.lineTo(1.58,.95);prof.lineTo(1.40,1.74);prof.lineTo(1.33,1.77);prof.lineTo(.30,1.77);prof.lineTo(.28,1.70);prof.closePath();
  const cab=new THREE.Mesh(new THREE.ExtrudeGeometry(prof,{depth:1.46,bevelEnabled:false}),paint);
  cab.rotation.y=-Math.PI/2;cab.position.set(.73,0,0);cab.castShadow=true;g.add(cab);
  // Windscreen (leans back about 13 degrees), wipers, side glass, rear glass.
  const ws=box(g,0,1.346,1.496,1.24,.66,.02,glassDark);ws.rotation.x=-.224;
  for(const wx of [-.22,.2]){const wp=box(g,wx,1.075,1.566,.40,.012,.012,black);wp.rotation.x=-.224;wp.rotation.z=.06;}
  box(g,0,1.36,.285,.90,.34,.02,glassDark);
  for(const sx of [-1,1]){
    box(g,sx*.735,1.385,.88,.02,.47,.84,glassDark);                                // side window
    box(g,sx*.733,1.10,1.32,.006,1.0,.012,black);                                  // front door shut line
    box(g,sx*.733,.95,.42,.006,1.3,.012,black);                                    // rear door shut line
    box(g,sx*.74,1.0,.50,.02,.03,.12,black);                                       // door handle
    box(g,sx*.735,.31,.56,.012,.08,.52,black);                                     // sill moulding behind the wheel arch
    box(g,sx*.78,1.30,1.37,.10,.02,.02,black);box(g,sx*.845,1.33,1.37,.05,.16,.11,black);   // mirror stalk and mirror
  }
  // Front: headlamps, indicators, a plain grille, bumper and a blank plate.
  for(const sx of [-1,1]){box(g,sx*.46,.70,1.62,.24,.13,.04,lamp);box(g,sx*.665,.69,1.62,.10,.08,.04,amberLamp);}
  box(g,0,.63,1.62,.50,.20,.03,black);
  for(const gy of [.58,.63,.68])box(g,0,gy,1.636,.44,.014,.01,steel);
  box(g,0,.37,1.67,1.48,.17,.10,black);
  box(g,0,.40,1.735,.34,.17,.008,black);box(g,0,.40,1.741,.31,.14,.006,plateWhite);
  // Bed: floor, subframe, drop sides with pressed ribs, tailgate, latches.
  const bedBack=-1.66;
  box(g,0,.72,(.28+bedBack)/2,1.46,.04,.28-bedBack,floorMat);
  for(const sx of [-1,1])box(g,sx*.5,.55,-.69,.08,.30,1.94,black);
  for(const sx of [-1,1]){
    box(g,sx*.72,.89,-.69,.04,.30,1.94,paint);
    box(g,sx*.72,1.055,-.69,.06,.03,1.94,paint);
    for(const rz of [-.15,-.65,-1.15])box(g,sx*.745,.89,rz,.012,.22,.06,shade);
  }
  box(g,0,.89,bedBack+.02,1.40,.30,.04,paint);box(g,0,1.055,bedBack+.02,1.46,.03,.06,paint);
  for(const sx of [-1,1])box(g,sx*.60,.94,bedBack-.005,.05,.07,.015,black);
  // Rear: bumper, tail lamps, plate, exhaust.
  box(g,0,.40,-1.715,1.30,.14,.10,black);
  for(const sx of [-1,1])box(g,sx*.60,.535,-1.705,.16,.13,.05,tailLamp);
  box(g,0,.405,-1.775,.36,.19,.008,black);box(g,0,.405,-1.781,.33,.16,.006,plateWhite);
  cyl(g,.385,.33,-1.27,.035,.035,.79,steel,8).rotation.x=Math.PI/2;
  return g;
}

/** A basketball backboard bolted to an outside wall (building-local `wallX`, hoop facing -X). The group is scaled back up so every
 *  number inside is in metres: backboard 1.05 x .70, rim .38 across at 2.40 m, kid-and-driveway height that keeps the cornice clear. */
function wallHoop(parent:THREE.Object3D,wallX:number,z:number){
  const g=new THREE.Group();g.position.set(wallX,0,z);g.rotation.y=-Math.PI/2;g.scale.setScalar(1/BUILDING_SCALE);parent.add(g);
  const metal=color('#2a3342',.5,.5),board=color('#e8ecf4',0,.5),orange=color('#e8662a',.2,.5),navy=color('#2d4a8a',0,.6);
  const BY=2.62;
  box(g,0,BY,.30,1.05,.70,.045,board);
  for(const [bx,by,bw,bh] of [[0,BY+.335,1.05,.03],[0,BY-.335,1.05,.03],[-.51,BY,.03,.70],[.51,BY,.03,.70]] as const)box(g,bx,by,.3248,bw,bh,.004,navy);   // border
  for(const [bx,by,bw,bh] of [[0,BY+.06,.50,.012],[0,BY-.30,.50,.012],[-.25,BY-.12,.012,.36],[.25,BY-.12,.012,.36]] as const)box(g,bx,by,.3248,bw,bh,.004,orange); // target square
  for(const sx of [-1,1]){
    box(g,sx*.30,2.42,.15,.06,.08,.30,metal);                  // arm from the wall to the back of the board
    rod(g,sx*.30,2.0,.02,2.40,.27,.018,metal);                 // diagonal brace
    box(g,sx*.30,2.42,.012,.14,.18,.024,metal);                // wall plates
    box(g,sx*.30,2.0,.012,.10,.10,.024,metal);
  }
  box(g,0,BY-.22,.3475,.08,.03,.05,orange);                    // rim bracket
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.19,.013,5,18),orange);rim.rotation.x=Math.PI/2;rim.position.set(0,BY-.22,.516);g.add(rim);
  const net=new THREE.Mesh(new THREE.CylinderGeometry(.19,.11,.34,10,3,true),netMat);net.position.set(0,BY-.22-.17,.516);g.add(net);
  basketball(g,.35,PAVE+.12,.75);
  return g;
}

/** Soft plush tiger sitting upright on a seat (y = seat surface), facing local +Z. A generic orange-and-black toy tiger of our own
 *  making: long torso, round ears, cream muzzle, cheek ruffs and tummy, dark stripes, a ringed tail curled on the seat. Every limb
 *  overlaps the torso so nothing floats. No outfit, no character. */
function plushTiger(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;g.scale.setScalar(1.3);parent.add(g);
  const fur=color('#e0842a',0,.98),cream=color('#f3e2bc',0,.98),dk=color('#241812',0,.7),nose=color('#6a3030',0,.6);
  // Long torso (semi-axes .105 x .1575 x .10), centred at y .16.
  const body=sphere(g,0,.16,0,.105,fur,1);body.scale.set(1,1.5,.95);
  const tum=sphere(g,0,.15,.065,.07,cream,1);tum.scale.set(1,1.45,.7);
  // Dark bands around the torso (the cream tummy hides them at the front, so they read as side and back stripes).
  for(const [by,br] of [[.07,.088],[.12,.1036],[.17,.107],[.22,.099],[.27,.077]] as const){
    const band=new THREE.Mesh(new THREE.TorusGeometry(br,.0075,5,16),dk);band.rotation.x=Math.PI/2;band.position.set(0,by,-.004);band.scale.set(1,.95,1);g.add(band);
  }
  // Head, sunk into the top of the torso so there is no neck gap. Features use head-local coordinates.
  const h=new THREE.Group();h.position.set(0,.375,.02);h.scale.setScalar(1.06);g.add(h);
  sphere(h,0,0,0,.08,fur,1);
  const mz=sphere(h,0,-.015,.07,.037,cream,1);mz.scale.set(1,.8,.8);
  sphere(h,0,-.002,.098,.011,nose,0);
  const fc=sphere(h,0,.067,.045,.012,dk,0);fc.scale.set(.45,1.7,.45);                  // centre forehead stripe
  for(const sx of [-1,1]){
    const ruff=sphere(h,sx*.066,-.018,.02,.036,cream,1);ruff.scale.set(1,.9,.8);      // cheek ruff
    sphere(h,sx*.03,.02,.07,.009,dk,0);                                               // eyes
    sphere(h,sx*.058,.067,-.015,.03,fur,1);sphere(h,sx*.058,.065,-.001,.016,cream,0);  // ears with a pale inner
    const fs=sphere(h,sx*.03,.063,.039,.011,dk,0);fs.scale.set(.45,1.6,.45);fs.rotation.z=sx*.3;
    for(const [cy,cz] of [[-.002,.019],[-.026,.031]] as const){const cs=sphere(h,sx*.098,cy,cz,.011,dk,0);cs.scale.set(.4,.6,1.6);}   // cheek stripes
    // Arms start inside the shoulders and end in a cream paw resting on the lap.
    const arm=sphere(g,sx*.105,.2,.03,.042,fur,1);arm.scale.set(.85,1.6,.85);arm.rotation.z=-sx*.25;
    for(const ay of [.17,.21]){const as=sphere(g,sx*(.138-(ay-.17)*.15),ay,.03,.012,dk,0);as.scale.set(.4,.5,1.6);}   // arm stripes
    sphere(g,sx*.118,.138,.05,.03,cream,1);
    // Legs sit forward on the seat, overlapping the bottom of the torso, with cream foot pads.
    const leg=sphere(g,sx*.068,.055,.085,.06,fur,1);leg.scale.set(1,.8,1.5);
    sphere(g,sx*.068,.045,.168,.035,cream,1).scale.set(1,.8,1);
  }
  // Ringed tail resting on the seat beside the right leg; each ball overlaps the next.
  ([[.06,-.095,.03,fur],[.11,-.085,.029,dk],[.14,-.05,.028,fur],[.155,-.01,.027,dk],[.15,.03,.026,fur]] as const).forEach(([tx,tz,tr,m])=>sphere(g,tx,.048,tz,tr,m,0));
  return g;
}

/** A tabletop chess board (size = side of the playing surface) with a middlegame position. White starts on local +Z. Surface at y + .012. */
function chessBoard(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number,size=.32){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
  box(g,0,.006,0,size+.02,.012,size+.02,color('#3b2a20',0,.7));
  const tex=texture((c,W,H)=>{
    for(let r=0;r<8;r++)for(let f=0;f<8;f++){c.fillStyle=(r+f)%2?'#8a5a3c':'#e7d9b8';c.fillRect(f*W/8,r*H/8,W/8,H/8);}
  },256,256);
  const top=new THREE.Mesh(new THREE.PlaneGeometry(size,size),litMaterial(tex,.2));top.rotation.x=-Math.PI/2;top.position.y=.0125;g.add(top);
  const s=size/8,white=color('#efe6d0',0,.55),blackP=color('#2a2523',0,.55);
  const heights:Record<string,number>={p:.03,r:.036,n:.04,b:.044,q:.05,k:.056};
  const piece=(kind:string,file:number,rank:number,mat:THREE.Material,rot:number)=>{
    const h=heights[kind];
    const p=new THREE.Group();p.position.set((file-3.5)*s,.012,(3.5-rank)*s);p.rotation.y=rot;g.add(p);
    cyl(p,0,.004,0,.012,.012,.008,mat,8);
    if(kind==='p'){cyl(p,0,.008+(h-.016)/2,0,.006,.0045,h-.016,mat,8);sphere(p,0,h-.007,0,.0075,mat,0);}
    else if(kind==='r'){cyl(p,0,.008+(h-.016)/2,0,.0085,.0065,h-.016,mat,8);cyl(p,0,h-.005,0,.0105,.0095,.01,mat,8);}
    else if(kind==='n'){cyl(p,0,.008+.008,0,.008,.006,.016,mat,8);box(p,0,h-.012,.002,.010,.022,.016,mat).rotation.x=-.3;box(p,0,h-.018,.011,.008,.01,.012,mat);}
    else if(kind==='b'){cyl(p,0,.008+(h-.016)/2,0,.007,.0045,h-.016,mat,8);const bh=sphere(p,0,h-.012,0,.0085,mat,1);bh.scale.set(1,1.4,1);sphere(p,0,h-.002,0,.003,mat,0);}
    else{cyl(p,0,.008+(h-.016)/2,0,.0085,.005,h-.016,mat,8);cyl(p,0,h-.008,0,.0115,.006,.012,mat,8);
      if(kind==='q')sphere(p,0,h-.001,0,.004,mat,0);
      else{box(p,0,h+.002,0,.003,.012,.003,mat);box(p,0,h+.004,0,.009,.003,.003,mat);}}
  };
  const whites:[string,number,number][]=[['k',6,0],['q',4,1],['r',5,0],['r',0,0],['b',2,3],['n',5,2],['p',0,1],['p',1,1],['p',3,2],['p',4,3],['p',6,1],['p',7,1]];
  const blacks:[string,number,number][]=[['k',6,7],['q',3,6],['r',5,7],['r',0,7],['b',2,4],['n',2,5],['n',5,5],['p',0,6],['p',1,6],['p',3,5],['p',4,4],['p',6,6],['p',7,6]];
  for(const [k,f,r] of whites)piece(k,f,r,white,Math.PI);
  for(const [k,f,r] of blacks)piece(k,f,r,blackP,0);
  return g;
}

// ---- Framed jerseys ---------------------------------------------------------------------------------------
type JCmd=['m',number,number]|['l',number,number]|['q',number,number,number,number];
/** Back-view silhouettes in 0..1 sheet coordinates (y down). The same outline drives the canvas artwork and the extruded cloth. */
const JERSEY_PATH:Record<'tee'|'tank',JCmd[]>={
  tee:[['m',.36,.05],['q',.50,.10,.64,.05],['l',.80,.10],['l',.93,.21],['l',.99,.40],['l',.82,.47],['l',.76,.39],['l',.76,.95],['l',.24,.95],['l',.24,.39],['l',.18,.47],['l',.01,.40],['l',.07,.21],['l',.20,.10]],
  tank:[['m',.30,.03],['l',.40,.03],['q',.50,.10,.60,.03],['l',.70,.03],['q',.73,.30,.84,.46],['l',.84,.95],['l',.16,.95],['l',.16,.46],['q',.27,.30,.30,.03]]
};
type JerseySpec={kind:'tee'|'tank';base:string;stripe?:{style:'pin'|'bands';color:string;alt?:string;width?:number};centerPanel?:string;trim?:string;hem?:boolean;mesh?:boolean;
  label?:string;num:string;numColor:string;outline?:string;labelColor?:string;plaque:string};
function traceJersey(c:CanvasRenderingContext2D,W:number,H:number,kind:'tee'|'tank'){
  c.beginPath();
  for(const s of JERSEY_PATH[kind]){
    if(s[0]==='m')c.moveTo(s[1]*W,s[2]*H);
    else if(s[0]==='l')c.lineTo(s[1]*W,s[2]*H);
    else c.quadraticCurveTo(s[1]*W,s[2]*H,s[3]*W,s[4]*H);
  }
  c.closePath();
}
function jerseyShape(kind:'tee'|'tank',w:number,h:number){
  const sh=new THREE.Shape();const X=(n:number)=>(n-.5)*w,Y=(n:number)=>(.5-n)*h;
  for(const s of JERSEY_PATH[kind]){
    if(s[0]==='m')sh.moveTo(X(s[1]),Y(s[2]));
    else if(s[0]==='l')sh.lineTo(X(s[1]),Y(s[2]));
    else sh.quadraticCurveTo(X(s[1]),Y(s[2]),X(s[3]),Y(s[4]));
  }
  sh.closePath();return sh;
}
function jerseyTexture(s:JerseySpec){
  return texture((c,W,H)=>{
    c.clearRect(0,0,W,H);
    traceJersey(c,W,H,s.kind);c.save();c.clip();
    c.fillStyle=s.base;c.fillRect(0,0,W,H);
    if(s.stripe){
      if(s.stripe.style==='pin'){c.fillStyle=s.stripe.color;for(let px=10;px<W;px+=15)c.fillRect(px,0,2.6,H);}
      else{
        const bw=s.stripe.width??40,k=Math.ceil((W/2-bw/2)/bw),x0=W/2-bw/2-k*bw;
        for(let i=0;i<=2*k+1;i++){c.fillStyle=(i-k)%2===0?s.stripe.color:(s.stripe.alt??s.base);c.fillRect(x0+i*bw,0,bw,H);}
      }
    }
    if(s.centerPanel){c.fillStyle=s.centerPanel;c.fillRect(W*.36,H*.08,W*.28,H*.9);}
    if(s.mesh){c.strokeStyle='rgba(0,0,0,.07)';c.lineWidth=1;for(let i=-H;i<W;i+=9){c.beginPath();c.moveTo(i,0);c.lineTo(i+H,H);c.stroke();c.beginPath();c.moveTo(i+H,0);c.lineTo(i,H);c.stroke();}}
    // Cloth shading: darker toward the edges, a light top, a heavier hem, and a few soft vertical folds.
    const sh=c.createLinearGradient(0,0,W,0);sh.addColorStop(0,'rgba(0,0,0,.34)');sh.addColorStop(.18,'rgba(0,0,0,0)');sh.addColorStop(.82,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,0,0,.34)');c.fillStyle=sh;c.fillRect(0,0,W,H);
    const sv=c.createLinearGradient(0,0,0,H);sv.addColorStop(0,'rgba(255,255,255,.10)');sv.addColorStop(.5,'rgba(0,0,0,0)');sv.addColorStop(1,'rgba(0,0,0,.22)');c.fillStyle=sv;c.fillRect(0,0,W,H);
    for(const [fx,fw,fa] of [[.30,26,.07],[.47,34,.05],[.63,24,.07],[.40,18,.04]] as const){
      const fg=c.createLinearGradient(W*fx-fw,0,W*fx+fw,0);fg.addColorStop(0,'rgba(0,0,0,0)');fg.addColorStop(.5,`rgba(0,0,0,${fa})`);fg.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=fg;c.fillRect(W*fx-fw,H*.18,fw*2,H*.8);
    }
    // Binding: collar, sleeve openings (tee) or armholes and hem (tank). Half of each stroke falls outside the clip, so these read as edge bands.
    c.lineCap='butt';c.strokeStyle=s.trim??'rgba(0,0,0,.28)';
    c.lineWidth=16;c.beginPath();
    if(s.kind==='tee'){c.moveTo(.36*W,.05*H);c.quadraticCurveTo(.50*W,.10*H,.64*W,.05*H);}
    else{c.moveTo(.40*W,.03*H);c.quadraticCurveTo(.50*W,.10*H,.60*W,.03*H);}
    c.stroke();
    if(s.trim){
      if(s.kind==='tee'){
        c.lineWidth=24;
        c.beginPath();c.moveTo(.01*W,.40*H);c.lineTo(.18*W,.47*H);c.stroke();
        c.beginPath();c.moveTo(.99*W,.40*H);c.lineTo(.82*W,.47*H);c.stroke();
      }else{
        c.lineWidth=16;
        c.beginPath();c.moveTo(.30*W,.03*H);c.quadraticCurveTo(.27*W,.30*H,.16*W,.46*H);c.stroke();
        c.beginPath();c.moveTo(.70*W,.03*H);c.quadraticCurveTo(.73*W,.30*H,.84*W,.46*H);c.stroke();
      }
      if(s.hem){c.lineWidth=22;c.beginPath();c.moveTo(.16*W,.95*H);c.lineTo(.84*W,.95*H);c.stroke();}
    }
    // Stitching: side seams, armscyes, hem.
    c.setLineDash([7,6]);c.strokeStyle='rgba(0,0,0,.26)';c.lineWidth=2;
    const seam=(x1:number,y1:number,x2:number,y2:number)=>{c.beginPath();c.moveTo(x1*W,y1*H);c.lineTo(x2*W,y2*H);c.stroke();};
    if(s.kind==='tee'){seam(.745,.41,.745,.92);seam(.255,.41,.255,.92);seam(.80,.12,.745,.40);seam(.20,.12,.255,.40);seam(.27,.915,.73,.915);}
    else{seam(.185,.50,.185,.92);seam(.815,.50,.815,.92);seam(.20,.915,.80,.915);}
    c.setLineDash([]);
    c.restore();
    // Lettering sits on top of the cloth, slightly muted so it reads as print rather than light.
    c.textAlign='center';c.textBaseline='middle';c.globalAlpha=.96;
    let numY=H*.50;
    if(s.label){
      let fs=64;c.font=`bold ${fs}px Arial, Helvetica, sans-serif`;
      while(c.measureText(s.label).width>W*.40&&fs>22){fs-=3;c.font=`bold ${fs}px Arial, Helvetica, sans-serif`;}
      if(s.outline){c.lineWidth=fs*.14;c.strokeStyle=s.outline;c.lineJoin='round';c.strokeText(s.label,W/2,H*.215);}
      c.fillStyle=s.labelColor??s.numColor;c.fillText(s.label,W/2,H*.215);
      numY=H*.52;
    }
    let ns=290;c.font=`bold ${ns}px Impact, "Arial Black", Arial, sans-serif`;
    while(c.measureText(s.num).width>W*.40&&ns>120){ns-=8;c.font=`bold ${ns}px Impact, "Arial Black", Arial, sans-serif`;}
    if(s.outline){c.lineWidth=ns*.07;c.strokeStyle=s.outline;c.lineJoin='round';c.strokeText(s.num,W/2,numY);}
    c.fillStyle=s.numColor;c.fillText(s.num,W/2,numY);
    c.globalAlpha=1;
    // Crisp outline of the garment so the silhouette reads against the felt.
    traceJersey(c,W,H,s.kind);c.strokeStyle='rgba(0,0,0,.45)';c.lineWidth=3;c.stroke();
  },512,640);
}
function plaqueTexture(text:string){
  return texture((c,W,H)=>{
    c.fillStyle='#c9a45c';c.fillRect(0,0,W,H);
    c.strokeStyle='#8f7134';c.lineWidth=4;c.strokeRect(6,6,W-12,H-12);
    c.fillStyle='#2b2113';c.textAlign='center';c.textBaseline='middle';
    let fs=54;c.font=`bold ${fs}px Arial, Helvetica, sans-serif`;
    while(c.measureText(text).width>W-60&&fs>18){fs-=2;c.font=`bold ${fs}px Arial, Helvetica, sans-serif`;}
    c.fillText(text,W/2,H/2+2);
  },620,92);
}
/** A shadow-box frame holding one jersey (extruded cloth with a printed face), with a brass name plate underneath. Hangs on a wall facing local +Z. */
function jerseyFrame(parent:THREE.Object3D,x:number,y:number,z:number,s:JerseySpec){
  const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
  const felt=color('#1d2432',0,.95),brassM=color('#c9a45c',.6,.4);
  for(const sy of [-1,1])box(g,0,sy*.385,.045,.66,.05,.09,wood);
  for(const sx of [-1,1])box(g,sx*.305,0,.045,.05,.72,.09,wood);
  box(g,0,0,.012,.58,.74,.024,felt);
  const w=.50,h=.625;
  const cloth=new THREE.Mesh(new THREE.ExtrudeGeometry(jerseyShape(s.kind,w,h),{depth:.018,bevelEnabled:true,bevelThickness:.005,bevelSize:.005,bevelSegments:2,curveSegments:6}),color(s.base,0,.9));
  cloth.position.set(0,-.01,.03);g.add(cloth);
  const tex=jerseyTexture(s);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,emissiveMap:tex,emissive:'#ffffff',emissiveIntensity:.3,roughness:.92,alphaTest:.5,side:THREE.DoubleSide}));
  face.position.set(0,-.01,.0555);g.add(face);
  box(g,0,-.455,.02,.34,.07,.014,brassM);
  litPlane(g,0,-.455,.0275,.31,.045,plaqueTexture(s.plaque),0,.15);
  return g;
}
/** The six jerseys: team colours, surname and number only. No crests, logos or sponsor marks. */
const JERSEYS:JerseySpec[]=[
  {kind:'tee',base:'#f4f2ec',stripe:{style:'pin',color:'#1b2a4a'},num:'2',numColor:'#1b2a4a',plaque:'JETER  ·  NO. 2'},
  {kind:'tank',base:'#c8102e',trim:'#111111',hem:true,mesh:true,label:'ROSE',num:'1',numColor:'#f4f2ec',outline:'#111111',plaque:'D. ROSE  ·  NO. 1'},
  {kind:'tee',base:'#f1efe8',trim:'#1d6f9c',label:'ICHIRO',num:'51',numColor:'#0e2b4d',outline:'#aeb7c2',plaque:'ICHIRO  ·  NO. 51'},
  {kind:'tee',base:'#f4f2ec',stripe:{style:'bands',color:'#14161b',alt:'#f4f2ec',width:44},centerPanel:'#14161b',trim:'#14161b',label:'DYBALA',num:'10',numColor:'#f4f2ec',plaque:'DYBALA  ·  NO. 10'},
  {kind:'tee',base:'#f4f6f8',stripe:{style:'bands',color:'#74acdf',alt:'#f4f6f8',width:40},trim:'#1c2b4a',label:'MESSI',num:'10',numColor:'#14161b',plaque:'MESSI  ·  NO. 10'},
  {kind:'tank',base:'#f4f6f8',trim:'#0b2a5b',hem:true,mesh:true,label:'NOWITZKI',num:'41',numColor:'#0b4f9c',outline:'#b3bcc8',plaque:'NOWITZKI  ·  NO. 41'}
];

/** Original stylised poster: a lone figure in blue seen from behind, head bowed, hands on hips, on a floodlit night pitch beside the penalty spot.
 *  Natural proportions (about 7.5 heads tall), shaded cloth and skin, mown stripes, a crowd band and floodlight bloom. */
function baggioPoster(parent:THREE.Object3D,x:number,y:number,z:number){
  const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
  box(g,0,0,.02,.82,1.28,.04,color('#15171d',0,.7));
  const tex=texture((c,W,H)=>{
    // Sky and stadium
    const sky=c.createLinearGradient(0,0,0,H*.5);sky.addColorStop(0,'#070b1f');sky.addColorStop(1,'#1d2f66');c.fillStyle=sky;c.fillRect(0,0,W,H*.5);
    // Crowd band: dark stand with a scatter of lit faces
    c.fillStyle='#0b1022';c.fillRect(0,H*.40,W,H*.10);
    let sd=7;const rnd=()=>{sd=(sd*16807)%2147483647;return(sd-1)/2147483646;};
    for(let i=0;i<420;i++){c.fillStyle=`rgba(${200+rnd()*55|0},${170+rnd()*60|0},${130+rnd()*60|0},${.15+rnd()*.35})`;c.fillRect(rnd()*W,H*.40+rnd()*H*.10,2,2);}
    // Floodlight masts and bloom
    for(const fx of [.12,.88]){c.fillStyle='#10152b';c.fillRect(W*fx-2,H*.08,4,H*.34);
      const fl=c.createRadialGradient(W*fx,H*.09,2,W*fx,H*.09,W*.42);fl.addColorStop(0,'rgba(255,246,222,.85)');fl.addColorStop(.25,'rgba(255,240,205,.30)');fl.addColorStop(1,'rgba(255,240,205,0)');c.fillStyle=fl;c.fillRect(0,0,W,H*.6);}
    // Pitch: perspective mown stripes
    const grass=c.createLinearGradient(0,H*.50,0,H);grass.addColorStop(0,'#2f7a4b');grass.addColorStop(1,'#0e2c1d');c.fillStyle=grass;c.fillRect(0,H*.50,W,H*.50);
    for(let i=0;i<9;i++){const y0=H*.50+Math.pow(i/9,1.6)*H*.50,y1=H*.50+Math.pow((i+1)/9,1.6)*H*.50;if(i%2){c.fillStyle='rgba(255,255,255,.045)';c.fillRect(0,y0,W,y1-y0);}}
    // Distant goal with net
    c.strokeStyle='rgba(240,244,250,.9)';c.lineWidth=3;c.beginPath();c.moveTo(W*.36,H*.545);c.lineTo(W*.36,H*.47);c.lineTo(W*.64,H*.47);c.lineTo(W*.64,H*.545);c.stroke();
    c.strokeStyle='rgba(240,244,250,.22)';c.lineWidth=1;for(let i=1;i<14;i++){c.beginPath();c.moveTo(W*(.36+i*.02),H*.47);c.lineTo(W*(.36+i*.02),H*.545);c.stroke();}for(let j=1;j<5;j++){c.beginPath();c.moveTo(W*.36,H*(.47+j*.015));c.lineTo(W*.64,H*(.47+j*.015));c.stroke();}
    // Markings: goal line, penalty arc, spot
    c.strokeStyle='rgba(240,244,250,.55)';c.lineWidth=2.5;c.beginPath();c.moveTo(W*.04,H*.555);c.lineTo(W*.96,H*.555);c.stroke();
    c.beginPath();c.ellipse(W*.5,H*.80,W*.30,H*.06,0,0,Math.PI*2);c.stroke();
    c.fillStyle='#eef1f6';c.beginPath();c.ellipse(W*.5,H*.835,W*.014,H*.005,0,0,Math.PI*2);c.fill();
    // Figure, from behind. All numbers are pixels on a 400 x 640 sheet; feet at y 515.
    c.save();c.translate(W/2,515);c.scale(1.28,1.28);c.translate(-W/2,-515);   // enlarge the figure about his feet
    const cx=W/2,skin='#b98660',skinDk='#8f6446',blue='#2b62c0',blueDk='#1b3f84',blueLt='#3d78d8',white='#e9edf3',hair='#17100d';
    c.lineCap='round';c.lineJoin='round';
    // soft contact shadow, thrown away from the right-hand mast
    const sh=c.createRadialGradient(cx-14,518,2,cx-14,518,70);sh.addColorStop(0,'rgba(0,0,0,.55)');sh.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=sh;c.save();c.translate(cx-14,518);c.scale(1,.16);c.translate(-(cx-14),-518);c.beginPath();c.arc(cx-14,518,70,0,Math.PI*2);c.fill();c.restore();
    // legs: knees, calves (socks), boots
    for(const s of [-1,1]){
      const lx=cx+s*13;
      const leg=c.createLinearGradient(lx-9,0,lx+9,0);leg.addColorStop(0,skinDk);leg.addColorStop(.5,skin);leg.addColorStop(1,skinDk);
      c.fillStyle=leg;c.beginPath();c.moveTo(lx-9,400);c.quadraticCurveTo(lx-10,425,lx-7,445);c.lineTo(lx+7,445);c.quadraticCurveTo(lx+10,425,lx+9,400);c.closePath();c.fill();      // thigh-to-knee
      const sock=c.createLinearGradient(lx-8,0,lx+8,0);sock.addColorStop(0,blueDk);sock.addColorStop(.5,blue);sock.addColorStop(1,blueDk);
      c.fillStyle=sock;c.beginPath();c.moveTo(lx-7,440);c.quadraticCurveTo(lx-10,470,lx-6,506);c.lineTo(lx+6,506);c.quadraticCurveTo(lx+10,470,lx+7,440);c.closePath();c.fill();           // sock / calf
      c.fillStyle=white;c.fillRect(lx-7.5,444,15,4);                                                                                                                                  // sock band
      c.fillStyle='#111319';c.beginPath();c.moveTo(lx-7,505);c.lineTo(lx+7,505);c.lineTo(lx+9,516);c.lineTo(lx-9,516);c.closePath();c.fill();                                             // boot heel
    }
    // shorts
    const shg=c.createLinearGradient(cx-34,0,cx+34,0);shg.addColorStop(0,'#aeb6c4');shg.addColorStop(.5,white);shg.addColorStop(1,'#aeb6c4');
    c.fillStyle=shg;c.beginPath();c.moveTo(cx-24,338);c.lineTo(cx+24,338);c.quadraticCurveTo(cx+30,375,cx+30,408);c.lineTo(cx+3,410);c.lineTo(cx,380);c.lineTo(cx-3,410);c.lineTo(cx-30,408);c.quadraticCurveTo(cx-30,375,cx-24,338);c.closePath();c.fill();
    c.strokeStyle='rgba(0,0,0,.18)';c.lineWidth=1.5;c.beginPath();c.moveTo(cx,345);c.lineTo(cx,382);c.stroke();
    // shirt body: shoulders at 262, waist at 340, with side shading
    const shirt=c.createLinearGradient(cx-38,0,cx+38,0);shirt.addColorStop(0,blueDk);shirt.addColorStop(.3,blue);shirt.addColorStop(.55,blueLt);shirt.addColorStop(1,blueDk);
    c.fillStyle=shirt;c.beginPath();c.moveTo(cx-20,258);c.quadraticCurveTo(cx-36,262,cx-37,274);c.quadraticCurveTo(cx-31,305,cx-27,342);c.lineTo(cx+27,342);c.quadraticCurveTo(cx+31,305,cx+37,274);c.quadraticCurveTo(cx+36,262,cx+20,258);c.quadraticCurveTo(cx,266,cx-20,258);c.closePath();c.fill();
    // arms: short sleeves, then forearms to the hips
    for(const s of [-1,1]){
      c.strokeStyle=blue;c.lineWidth=17;c.beginPath();c.moveTo(cx+s*36,270);c.quadraticCurveTo(cx+s*52,288,cx+s*50,306);c.stroke();                       // sleeve and upper arm
      c.strokeStyle=blueDk;c.lineWidth=17;c.beginPath();c.moveTo(cx+s*46,299);c.lineTo(cx+s*51,308);c.stroke();                                           // sleeve hem shade
      c.strokeStyle=skin;c.lineWidth=13;c.beginPath();c.moveTo(cx+s*50,306);c.quadraticCurveTo(cx+s*47,326,cx+s*30,342);c.stroke();                       // forearm to the hip
      c.fillStyle=skinDk;c.beginPath();c.arc(cx+s*28,343,6,0,Math.PI*2);c.fill();                                                                        // hand on the hip
    }
    // collar, neck, head bowed with hair and tied-back hair
    c.fillStyle=blueDk;c.beginPath();c.ellipse(cx,259,15,6,0,0,Math.PI*2);c.fill();
    c.fillStyle=skinDk;c.beginPath();c.moveTo(cx-8,243);c.lineTo(cx+8,243);c.lineTo(cx+9,258);c.lineTo(cx-9,258);c.closePath();c.fill();
    c.fillStyle=skin;c.beginPath();c.ellipse(cx-17,240,3.5,6,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(cx+17,240,3.5,6,0,0,Math.PI*2);c.fill();       // ears
    const hd=c.createRadialGradient(cx-5,232,2,cx,238,22);hd.addColorStop(0,'#2a1d17');hd.addColorStop(1,hair);c.fillStyle=hd;c.beginPath();c.ellipse(cx,236,17.5,21,0,0,Math.PI*2);c.fill();
    c.strokeStyle=hair;c.lineWidth=5;c.beginPath();c.moveTo(cx+1,250);c.quadraticCurveTo(cx+7,268,cx+3,284);c.stroke();                                    // tied-back hair
    c.fillStyle='#d9d2c4';c.fillRect(cx-3,251,7,3);                                                                                                       // hair tie
    // lettering on the shirt
    c.fillStyle='rgba(240,244,250,.95)';c.textAlign='center';c.textBaseline='middle';
    c.font=`bold 13px Arial, Helvetica, sans-serif`;c.fillText('BAGGIO',cx,282);
    c.font=`bold 44px Impact, "Arial Black", Arial, sans-serif`;c.fillText('10',cx,312);
    c.restore();c.textAlign='center';c.textBaseline='middle';
    // Headline and caption
    c.fillStyle='#eef1f6';c.font=`bold ${W*.088}px Impact, "Arial Black", Arial, sans-serif`;c.fillText('THE LONG WALK',cx,H*.085);
    c.fillStyle='#b9cdf0';c.font=`bold ${W*.04}px Arial, Helvetica, sans-serif`;c.fillText('PASADENA  ·  17 JULY 1994',cx,H*.935);
    // Film grain, vignette, border
    for(let i=0;i<1400;i++){c.fillStyle=`rgba(255,255,255,${rnd()*.06})`;c.fillRect(rnd()*W,rnd()*H,1.5,1.5);}
    const vg=c.createRadialGradient(W/2,H/2,W*.30,W/2,H/2,H*.70);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.5)');c.fillStyle=vg;c.fillRect(0,0,W,H);
    c.strokeStyle='rgba(238,241,246,.75)';c.lineWidth=4;c.strokeRect(10,10,W-20,H-20);
  },400,640);
  litPlane(g,0,0,.0415,.76,1.216,tex,0,.34);
  return g;
}

/** A framed record sleeve hanging facing local +Z. It starts as a plain titled sleeve (drawn instantly, and the fallback if the file is missing),
 *  then swaps in the owner-supplied image from public/albums/<img> as soon as it has loaded. */
function albumFrame(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number,title:string,artist:string,bg:string,fg:string,img?:string){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
  const fr=color('#1b1714',0,.7);
  for(const sy of [-1,1])box(g,0,sy*.1675,.0175,.36,.025,.035,fr);
  for(const sx of [-1,1])box(g,sx*.1675,0,.0175,.025,.31,.035,fr);
  box(g,0,0,.006,.335,.335,.012,color('#101114',0,.9));
  const tex=texture((c,W,H)=>{
    const k=W/256;
    c.fillStyle=bg;c.fillRect(0,0,W,H);
    c.strokeStyle=fg;c.globalAlpha=.35;c.lineWidth=3*k;c.strokeRect(14*k,14*k,W-28*k,H-28*k);
    c.beginPath();c.arc(W/2,H/2,W*.36,0,Math.PI*2);c.stroke();c.beginPath();c.arc(W/2,H/2,W*.05,0,Math.PI*2);c.stroke();c.globalAlpha=1;
    c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';
    let fs=72*k;c.font=`bold ${fs}px Arial, Helvetica, sans-serif`;
    while(c.measureText(title).width>W*.78&&fs>20*k){fs-=3*k;c.font=`bold ${fs}px Arial, Helvetica, sans-serif`;}
    c.fillText(title,W/2,H/2-10*k);
    c.globalAlpha=.8;c.font=`bold ${22*k}px Arial, Helvetica, sans-serif`;c.fillText(artist.toUpperCase(),W/2,H/2+34*k);c.globalAlpha=1;
  },512,512);
  if(img&&typeof Image!=='undefined'){
    const im=new Image();
    im.onload=()=>{const cv=tex.image as HTMLCanvasElement;const c=cv.getContext('2d');if(!c)return;c.drawImage(im,0,0,cv.width,cv.height);tex.needsUpdate=true;};
    im.src=`${import.meta.env.BASE_URL}albums/${img}`;
  }
  litPlane(g,0,0,.0135,.31,.31,tex,0,.28);
  return g;
}

/** A world-level cluster of props on the plaza. */
function endgameWorld(scene:THREE.Object3D){
  // Round four: the wagon and its lamp are gone; a white kei pickup parks on the left and the heron moved forward to give it room.
  keiTruck(scene,-5.25,-.8,.04);
  heron(scene,-6.4,2.25,.7);
}
/** A small red toy seaplane (generic biplane on floats) hung from the ceiling by two cords. */
function toyPlane(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number,ceilingY:number){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
  const red=color('#c53a2a',0,.6),cream=color('#efe3c8',0,.6),metal=color('#2a3342',.4,.5);
  const body=sphere(g,0,0,0,.1,red,1);body.scale.set(.5,.5,2.0);
  box(g,0,.07,-.2,.015,.1,.09,red);box(g,0,.015,-.21,.18,.012,.07,cream);       // tail fin and stabiliser
  box(g,0,.082,.02,.7,.012,.16,cream);box(g,0,-.04,.04,.62,.012,.14,cream);       // upper and lower wing
  for(const sx of [-.2,.2])box(g,sx,.022,.03,.012,.12,.012,metal);               // wing struts
  for(const sx of [-.12,.12]){box(g,sx,-.13,.04,.05,.04,.32,cream);box(g,sx,-.085,.04,.012,.09,.012,metal);}   // floats on struts
  box(g,0,0,.2,.012,.18,.012,metal);box(g,0,0,.2,.18,.012,.012,metal);          // propeller
  for(const sx of [-.15,.15]){const top=.09,len=ceilingY-y-top;box(g,sx,top+len/2,.02,.014,len,.014,color('#d9cfb9',0,.9));}   // twine up to the ceiling, thick and pale enough to read from the street
}
/** A framed poster that shows a supplied picture from public/posters (a flat colour until it loads). Faces +Z; w x h in metres. */
function imagePoster(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,file:string,fallback:string,pix=0,glow=.22,rotY=0){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;parent.add(g);
  box(g,0,0,.02,w+.06,h+.06,.04,color('#15171d',0,.7));
  const tex=texture((c,W,H)=>{c.fillStyle=fallback;c.fillRect(0,0,W,H);},512,Math.round(512*h/w));
  if(typeof Image!=='undefined'){
    const im=new Image();
    im.onload=()=>{
      const cv=tex.image as HTMLCanvasElement;const c=cv.getContext('2d');if(!c)return;
      if(pix>0){
        // 8-bit look: shrink the picture to `pix` pixels across, then blow it back up without smoothing.
        const s=document.createElement('canvas');s.width=pix;s.height=Math.max(1,Math.round(pix*cv.height/cv.width));
        const sc=s.getContext('2d');
        if(sc){sc.drawImage(im,0,0,s.width,s.height);c.imageSmoothingEnabled=false;c.drawImage(s,0,0,cv.width,cv.height);}
        else c.drawImage(im,0,0,cv.width,cv.height);
      }else c.drawImage(im,0,0,cv.width,cv.height);
      tex.needsUpdate=true;
    };
    im.src=`${import.meta.env.BASE_URL}posters/${file}`;
  }
  litPlane(g,0,0,.0405,w,h,tex,0,glow);
  return g;
}
/** Small gaming corner against the ground-floor back wall (building-local units): a CRT on a low open cabinet, three unbranded consoles in
 *  its cubbies (a chunky dark box, a flat black slab and a slim upright white one), two pads on top, a low coffee table with a clamshell
 *  handheld, a pouf and a small round rug. No logos, no lettering, no copied product designs: the consoles differ by shape and colour only. */
function gamingCorner(scene:THREE.Object3D){
  const gf=.07,cx=2.2,cz=-2.58,top=gf+.52;
  const wood2=color('#5a4640',0,.8),topWood=color('#b88d62',0,.7),black=color('#1b1e25',0,.55),white=color('#eceae4',0,.5);
  // Cabinet: plinth, base board, two sides, two dividers, back and top board; open at the front so the consoles show.
  box(scene,cx,gf+.03,cz,1.52,.06,.40,dark);
  box(scene,cx,gf+.08,cz,1.56,.04,.46,wood);
  for(const dx of [-.78,.78])box(scene,cx+dx,gf+.29,cz,.04,.40,.46,wood);
  for(const dx of [-.253,.253])box(scene,cx+dx,gf+.29,cz,.03,.40,.44,wood);
  box(scene,cx,gf+.29,cz-.20,1.56,.40,.02,wood2);
  box(scene,cx,gf+.50,cz,1.64,.04,.50,topWood);
  const shelf=gf+.10;
  // Console 1: chunky dark box with a disc tray and a green LED.
  const x1=cx-.51;
  box(scene,x1,shelf+.07,cz,.36,.14,.30,black);box(scene,x1,shelf+.145,cz,.34,.01,.28,color('#2b313b'));
  box(scene,x1+.05,shelf+.085,cz+.152,.15,.014,.004,dark);
  box(scene,x1-.11,shelf+.05,cz+.152,.03,.012,.004,color('#7dff9a',0,.4,'#43ff7a',1.6));halo(scene,x1-.11,shelf+.05,cz+.17,.3,'#7dff9a',.45);
  // Console 2: flat black slab with a tray slit and a blue LED.
  box(scene,cx,shelf+.04,cz,.34,.08,.22,color('#14161c',0,.5));box(scene,cx,shelf+.082,cz,.32,.006,.2,color('#20242c'));
  box(scene,cx+.02,shelf+.05,cz+.112,.17,.012,.004,dark);
  box(scene,cx-.12,shelf+.03,cz+.112,.02,.012,.004,color('#6bd0ff',0,.4,'#35b6ff',1.5));halo(scene,cx-.12,shelf+.03,cz+.13,.28,'#6bd0ff',.45);
  // Console 3: slim upright white box on a small foot, with a glowing disc slot.
  const x3=cx+.51;
  box(scene,x3,shelf+.006,cz,.13,.012,.13,color('#d6d4cc'));
  box(scene,x3,shelf+.012+.12,cz,.075,.24,.17,white);
  box(scene,x3,shelf+.012+.17,cz+.0875,.012,.1,.004,color('#6bd0ff',0,.4,'#35b6ff',1.3));halo(scene,x3,shelf+.19,cz+.105,.3,'#6bd0ff',.4);
  // CRT: front body and bezel with the tube housing tapering behind, a generic pixel-art screen, rabbit ears.
  box(scene,cx,top+.27,cz+.06,.66,.54,.26,color('#3a3f4b'));
  box(scene,cx,top+.2,cz-.12,.38,.36,.20,color('#2a2f3a'));
  box(scene,cx,top+.27,cz+.195,.62,.50,.02,color('#1d2029'));
  const screen=texture((c,W,H)=>{
    const sky=c.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#1b3f73');sky.addColorStop(1,'#7fc6e8');c.fillStyle=sky;c.fillRect(0,0,W,H);
    c.fillStyle='#2f7a4d';c.beginPath();c.moveTo(0,H*.78);c.lineTo(W*.28,H*.42);c.lineTo(W*.56,H*.78);c.fill();
    c.beginPath();c.moveTo(W*.4,H*.78);c.lineTo(W*.7,H*.5);c.lineTo(W,H*.78);c.fill();
    c.fillStyle='#8a5a34';c.fillRect(0,H*.78,W,H*.22);c.fillStyle='#a8703f';
    for(let y=H*.78;y<H;y+=16)for(let x=((y/16)%2)*16;x<W;x+=32)c.fillRect(x+2,y+2,28,12);
    c.fillStyle='#ffc13a';for(const [x,y] of [[W*.5,H*.5],[W*.5+30,H*.44],[W*.5+60,H*.5]])c.fillRect(x,y,14,14);
    c.fillStyle='#e8662a';c.fillRect(W*.2,H*.78-26,24,26);c.fillStyle='#1b1e25';c.fillRect(W*.2+14,H*.78-20,4,6);
    c.fillStyle='rgba(0,0,0,.22)';for(let y=0;y<H;y+=4)c.fillRect(0,y,W,2);
  },256,192);
  plane(scene,cx,top+.28,cz+.2065,.5,.38,screen);
  cyl(scene,cx,top+.55,cz+.05,.05,.06,.02,color('#1d2029'),8);
  for(const sr of [-.55,.55]){const rod=new THREE.Group();rod.position.set(cx,top+.56,cz+.05);rod.rotation.z=sr;scene.add(rod);cyl(rod,0,.15,0,.005,.005,.3,zinc,5);}
  halo(scene,cx,top+.28,cz+.4,1.5,'#8fe8ff',.35);
  glowPatch(scene,cx,gf+.012,cz+1.1,2.6,1.9,'#8fe8ff',.07,0,true);
  // Two pads on the top board: a dark gamepad and a slim white remote.
  box(scene,cx-.68,top+.0125,cz+.14,.13,.025,.07,color('#2a2f3a'));
  for(const gx of [-.035,.035])cyl(scene,cx-.68+gx,top+.0375,cz+.14,.012,.012,.025,color('#14171f'),8);
  box(scene,cx+.68,top+.0125,cz+.1,.035,.025,.14,white,.2);sphere(scene,cx+.68,top+.027,cz+.06,.008,color('#6bd0ff',0,.4,'#35b6ff',1.2),0);
  // Coffee table with the handheld, a pouf and a small round rug.
  const tx=cx-.1,tz=-1.45,tt=gf+.36;
  cyl(scene,tx,gf+.008,tz,.72,.72,.016,color('#3f5d70',0,.95),24);
  box(scene,tx,tt-.025,tz,.9,.05,.5,wood);
  for(const lx of [-.4,.4])for(const lz of [-.2,.2])box(scene,tx+lx,gf+.165,tz+lz,.05,.33,.05,iron);
  const hh=tt+.0;
  box(scene,tx,hh+.008,tz+.05,.18,.016,.10,color('#cfd4dc'));
  box(scene,tx,hh+.0172,tz+.05,.11,.002,.07,color('#7be0ff',0,.4,'#35b6ff',1));
  const lid=new THREE.Group();lid.position.set(tx,hh+.016,tz);lid.rotation.x=-1.75;scene.add(lid);   // hinged along its back edge, opened past 90 degrees
  box(lid,0,0,.05,.18,.012,.10,color('#cfd4dc'));box(lid,0,-.0066,.05,.13,.002,.075,color('#7be0ff',0,.4,'#35b6ff',1));
  halo(scene,tx,hh+.05,tz+.06,.35,'#7be0ff',.3);
  cyl(scene,tx-.15,gf+.17,-.82,.26,.29,.32,color('#8a5a6e',0,.9),12);
}
function endgameInteriors(scene:THREE.Object3D){
  const uf=4.425;
  const cream=color('#efe3c8',0,.7);
  // ---- Ground floor ---------------------------------------------------------------------------------------
  toyPlane(scene,2.6,2.85,1.75,.6,ARCH.ground.height-.03);
  // Gaming corner against the back wall, right of the counter (vtest11).
  gamingCorner(scene);
  // Counter top left empty (the copper pot, snare drum and stapler were removed in vtest10).
  // ---- Upper floor ----------------------------------------------------------------------------------------
  // Six framed jerseys in two rows above the sofa (inner face of the back wall is z = -2.78).
  const wallZ=-2.78;
  JERSEYS.forEach((spec,i)=>jerseyFrame(scene,-3.1+(i%3)*.8,i<3?7.0:6.0,wallZ,spec));
  // Plush tiger on the sofa, leaning against the backrest between the two cushions.
  plushTiger(scene,-2.3,uf+.4,-2.45,0);
  // Turntable on a sideboard against the right wall, flanked by two small speakers.
  const sx=1.26,sz=-2.0;
  box(scene,sx,uf+.4,sz,.4,.8,1.2,wood);
  box(scene,sx,uf+.825,sz,.34,.05,.40,color('#1d2029'));
  cyl(scene,sx,uf+.865,sz,.15,.15,.02,color('#9aa3ad',.6,.4),14);
  cyl(scene,sx,uf+.878,sz,.14,.14,.006,color('#0f1116',0,.3),14);
  cyl(scene,sx,uf+.882,sz,.045,.045,.004,color('#d9422b'),10);
  box(scene,sx+.1,uf+.86,sz-.16,.012,.012,.2,color('#9aa3ad',.6,.4));
  for(const dz of [-.45,.45]){
    box(scene,sx,uf+.8+.17,sz+dz,.2,.34,.22,color('#2b2f3a'));
    cyl(scene,sx-.1,uf+.8+.12,sz+dz,.07,.07,.01,color('#14171f'),10).rotation.z=Math.PI/2;
    cyl(scene,sx-.1,uf+.8+.26,sz+dz,.03,.03,.01,color('#14171f'),8).rotation.z=Math.PI/2;
  }
  // Coffee table: just the candle now (the playing cards and two paperbacks were removed in vtest10).
  const tt=uf+.425;
  cyl(scene,-1.7,tt+.05,-.9,.03,.03,.1,cream,8);
  sphere(scene,-1.7,tt+.115,-.9,.014,bright,0);halo(scene,-1.7,tt+.12,-.9,.5,'#ffb866',.5);
  soccerBall(scene,-.7,uf+.11,-2.5);
  shipInBottle(scene,-1.25,tt,-.9);                                 // on the coffee table, bottle lying along x (vtest12)
  // Six framed pictures in a 2 wide x 3 tall grid (top row: two supplied pictures; below: four record sleeves) on the right wall above the turntable (inner face x = 1.46), turned to face into the room.
  ([['','','#2d6fb8','#ffffff','skydive.jpg'],['','','#c9371f','#ffffff','red-pool.jpg'],['RAM','Daft Punk','#2c2f36','#eae6dc','ram.jpg'],['Luv(sic) Hexology','Nujabes','#a98a64','#2b2113','luv-sic-hexology.jpg'],['Mm..Food','MF DOOM','#4a5b66','#e9eef1','mm-food.jpg'],['Graduation','Kanye West','#e6dcc6','#2b2f38','graduation.jpg']] as const).forEach(([t,a,bg,fg,im],i)=>albumFrame(scene,1.46,6.6-Math.floor(i/2)*.4,-2.19+(i%2)*.40,-Math.PI/2,t,a,bg,fg,im));
  // Poster on the ground-floor back wall (inner face z = -2.835), right of the counter.
  baggioPoster(scene,1.5,2.2,-2.835);
  // Supplied desert poster, further right on the same wall (same inner face), clear of the Baggio poster.
  imagePoster(scene,2.85,2.2,-2.835,.94,1.28,'desert-poster.jpg','#d9b27a');
  // vtest12: four supplied pictures, pixelated for the 8-bit look. Left wall (inner face x = -4.01, turned to face +X), clear of the dark
  // window (z -1.98 .. -.54) and the plant (z 2.2); the fourth on the back wall above the counter, between the window and the Baggio poster.
  imagePoster(scene,-4.01,2.55,.10,.86,1.29,'battlefront2.jpg','#16202e',120,.22,Math.PI/2);
  imagePoster(scene,-4.01,2.55,1.15,.90,1.20,'xbalanque.jpg','#4a6a3a',80,.22,Math.PI/2);
  imagePoster(scene,-4.01,2.55,2.20,.90,1.20,'joker.jpg','#3a55b0',90,.22,Math.PI/2);
  imagePoster(scene,-.55,2.45,-2.835,.90,1.27,'kafka.jpg','#ece8e0',110,.12);
  // vtest12: a workbench and a storage chest along the left wall under the pictures.
  workbench(scene,-3.54,.07,.10,Math.PI/2);
  woodChest(scene,-3.62,.07,1.20,Math.PI/2);
}
/** Building-level end-game pieces outside the walls (building-local units): the cat, the quetzal, the flag, the surfboard and the baseball kit. */
// ---------------------------------------------------------------------------------------------
// COZY PASS (vtest8): a hedged courtyard, small warm lights and lived-in props.
// World-level pieces use world units; pieces on the building use its local (unscaled) units.
// Every light here is faked (emissive mesh + halo + pool decal), see LIGHTING BUDGET: no new PointLights.
// ---------------------------------------------------------------------------------------------
/** Own generator, so this pass never disturbs the seeded scatter used by the plants above. */
const cozyRandom=(()=>{let s=7771;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646;};})();
const bulbMat=color('#ffecc0',0,.4,'#ffd08a',1.7);
const lanternGlass=color('#ffd8a0',0,.3,'#ffb35a',1.3);
const flowerCols=['#e86a7a','#f2c14e','#f4efe6','#b79bf0','#ee8f5a'].map(c=>color(c,0,.7));

/** Festoon of little bulbs sagging between two points, with a bloom on each bulb. */
function festoon(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,sag:number,n:number,hex='#ffc884'){
  const pts:THREE.Vector3[]=[];
  for(let i=0;i<=8;i++){const t=i/8;pts.push(V(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t-sag*4*t*(1-t),a.z+(b.z-a.z)*t));}
  line(parent,pts,.011,dark);
  const curve=new THREE.CatmullRomCurve3(pts);
  for(let i=0;i<n;i++){const p=curve.getPoint((i+.5)/n);sphere(parent,p.x,p.y-.045,p.z,.04,bulbMat,1);halo(parent,p.x,p.y-.045,p.z,.5,hex,.5);}
}
/** Candle in a glass jar (sits at y). */
function candleJar(parent:THREE.Object3D,x:number,y:number,z:number){
  cyl(parent,x,y+.035,z,.04,.04,.07,color('#ffd9a8',0,.25,'#ffb05a',.9),8);
  halo(parent,x,y+.08,z,.42,'#ffbf75',.55);
  glowPatch(parent,x,y+.005,z,.9,.9,'#ffbd70',.12,0,true);
}
/** Low clipped hedge with leafy blobs on top and a few fairy bulbs tucked into it. */
function hedge(parent:THREE.Object3D,x:number,z:number,len:number,along:'x'|'z',h=.34){
  const g=new THREE.Group();g.position.set(x,PAVE,z);parent.add(g);
  const d=.30;
  box(g,0,h/2,0,along==='x'?len:d,h,along==='x'?d:len,moss);
  const n=Math.max(2,Math.round(len/.2));
  for(let i=0;i<n;i++){
    const t=-len/2+(i+.5)*len/n,off=(i%2?1:-1)*.05,r=.15+cozyRandom()*.05;
    const bx=along==='x'?t:off,bz=along==='x'?off:t;
    sphere(g,bx,h-.02,bz,r,i%3?leaf:leaf2,1);
    if(i%4===1){const bb=sphere(g,bx+(along==='x'?0:.14),h+r*.7,bz+(along==='x'?.14:0),.028,bulbMat,1);if(i%8===1)halo(g,bb.position.x,bb.position.y,bb.position.z,.45,'#ffc884',.5);}
  }
}
/** Wooden flower trough for the curb. */
function trough(parent:THREE.Object3D,x:number,z:number,len=.95,rotY=0){
  const g=new THREE.Group();g.position.set(x,PAVE,z);g.rotation.y=rotY;parent.add(g);
  box(g,0,.15,0,len,.30,.26,wood);box(g,0,.31,0,len-.06,.03,.2,color('#3b2c2a'));
  const n=Math.round(len/.17);
  for(let i=0;i<n;i++){const fx=-len/2+.1+i*(len-.2)/(n-1);sphere(g,fx,.38+cozyRandom()*.04,(cozyRandom()-.5)*.1,.065,i%3===1?leaf:flowerCols[Math.floor(cozyRandom()*flowerCols.length)],1);}
}
/** The four corner lantern posts, their bulb strings, hedges, curb troughs and the small stuff that makes the courtyard lived in.
 *  (vtest10: the floor lanterns, the bicycle and the couch floor lamp were removed.) */
function cozyWorld(scene:THREE.Object3D){
  const {x0,x1,z0,z1}=PLAZA,px0=x0+.3,px1=x1-.3,pz0=z0+.3,pz1=z1-.35,top=2.55;
  // Posts with a lantern on top and a pool of light below.
  for(const [x,z] of [[px0,pz0],[px1,pz0],[px0,pz1],[px1,pz1]] as const){
    cyl(scene,x,top/2,z,.05,.07,top,dark,8);
    box(scene,x,top+.1,z,.18,.2,.18,lanternGlass);cyl(scene,x,top+.26,z,.02,.15,.1,iron,4);sphere(scene,x,top+.34,z,.03,brass,1);
    for(const sx of [-1,1])for(const sz of [-1,1])box(scene,x+sx*.095,top+.1,z+sz*.095,.02,.22,.02,iron);
    halo(scene,x,top+.1,z,1.25,'#ffbf75',.6);
    glowPatch(scene,x,PAVE+.012,z,3.4,3.4,'#ffbd70',.11,0,true);
  }
  // Bulb strings follow the plaza edge and turn at the corner posts: down both sides, and along the back edge from each corner post
  // to a slim stake at the end of its hedge. The gap between the stakes (behind the vending machine and the arcade cabinet) stays
  // open, and the front stays open so the shop front is never crossed.
  const P=(x:number,z:number)=>V(x,top-.12,z);
  const stakeL=-2.55,stakeR=3.55;
  for(const sx of [stakeL,stakeR]){
    cyl(scene,sx,(top-.05)/2,pz0,.028,.036,top-.05,dark,6);sphere(scene,sx,top-.04,pz0,.045,brass,1);
  }
  festoon(scene,P(px0,pz0),P(stakeL,pz0),.3,16);festoon(scene,P(px1,pz0),P(stakeR,pz0),.28,13);
  festoon(scene,P(px0,pz0),P(px0,pz1),.5,15);
  festoon(scene,P(px1,pz0),P(px1,pz1),.5,15);
  // Hedges close the courtyard on the sides and back, with gaps for the machines, the truck and the heron.
  hedge(scene,(px0+px0+0)/2-.05+.0,(pz0+1.0)/2,Math.abs(1.0-pz0)-.5,'z');          // left, behind the truck
  hedge(scene,px1+.05,(pz0+3.2)/2,Math.abs(3.2-pz0)-.5,'z',.3);                   // right
  hedge(scene,(px0+.4-2.4)/2,pz0,Math.abs(-2.4-(px0+.4)),'x');                      // back left
  hedge(scene,(3.4+px1-.4)/2,pz0,Math.abs(px1-.4-3.4),'x');                         // back right
  // Curb flower troughs by the shop.
  trough(scene,-2.45,4.95,1.0);trough(scene,.1,4.98,1.0);trough(scene,2.45,4.95,.9);
  // Back: a bench and a stack of crates with a plant.
  const g=new THREE.Group();g.position.set(-4.2,PAVE,-3.75);g.scale.setScalar(.85);scene.add(g);
  bench(g,0,.02,0,0,2,1.5);box(g,-.35,.56,.02,.42,.12,.3,color('#d9b45a'),.1);
  for(const sx of [-1,1])box(g,sx*.9,.18,.45,.2,.2,.2,color('#4f3d38'));
  crate(scene,-6.1,-3.7,.46,.2);crate(scene,-6.15,-3.2,.34,-.3);
  pot(scene,-6.1,.02+.46+.03,-3.7,.5,true);
  // vtest12: couch with a raccoon and a blue jay, back against the right wall under the corkboard (the sill band sticks out to world
  // x = 3.377, the couch back sits at 3.40 and the couch faces +X; the corkboard's lower edge is well above the backrest).
  tuftedCouch(scene,3.71,.31,Math.PI/2);
}
/** Details on the building itself, in its local units. */
function cozyBuilding(b:THREE.Object3D){
  // Ivy on the left wall and the back wall, hanging from the cornice like the existing vines.
  const left=new THREE.Group();left.position.set(-ARCH.ground.width/2,0,0);left.rotation.y=-Math.PI/2;b.add(left);
  addVines(left,'z',0,2.05,4.1,2.1);addVines(left,'z',0,-2.35,4.0,1.5);
  const back=new THREE.Group();back.position.set(0,0,-ARCH.ground.depth/2);back.rotation.y=Math.PI;b.add(back);
  addVines(back,'z',0,.55,4.0,1.5);   // was at 1.35, which put it on the back window's frame (vtest12)
  const upBack=new THREE.Group();upBack.position.set(0,0,ARCH.upper.z-ARCH.upper.depth/2-.01);upBack.rotation.y=Math.PI;b.add(upBack);
  addVines(upBack,'z',0,1.85,7.7,2.3);addVines(upBack,'z',0,-1.55,7.7,1.7);
  // Candle jars on the shop-front crates.
  candleJar(b,-3.70,.52+.03+GROUND,4.22);candleJar(b,-3.12,.40+.03+GROUND,4.14);
  // Bracket lamp on the second-floor left wall, on the blank stretch to the right of the window (vtest12: moved up from the
  // ground-floor corner at your request). The upper block's left wall face is x = -3.90.
  const ux=ARCH.upper.x-ARCH.upper.width/2,uz=.10,uy=6.45;
  box(b,ux-.04,uy-.08,uz,.06,.34,.14,iron);                    // wall plate
  box(b,ux-.30,uy,uz,.58,.06,.06,iron);                        // arm out from the wall
  rodX(b,uz,ux-.02,uy-.46,ux-.52,uy-.03,.02,iron);             // brace under the arm
  const lampX=ux-.54,lampY=uy-.56;
  line(b,[V(lampX,uy+.03,uz),V(lampX,lampY+.14,uz)],.025,dark); // cord from the arm
  cyl(b,lampX,lampY+.05,uz,.19,.29,.22,brass);                 // shade
  sphere(b,lampX,lampY-.08,uz,.16,bright);                     // bulb
  halo(b,lampX,lampY-.06,uz,1.55,'#ffc78f',.65);
  glowPatch(b,ux-.012,uy-.45,uz,2.6,3.0,'#ffc27a',.13,-Math.PI/2);   // warm wash on the wall (no floor pool: nothing is below it but the roof edge)
  // Lights where they were asked for (vtest12): two lantern posts on the roof terrace (back-left near the climbers' exit, and behind the
  // water tank), one at the left end of the terrace by the upper block's corner, and a wall lamp at the back end of the upper right wall.
  terraceLantern(b,-3.45,7.945,-2.55);
  terraceLantern(b,.62,7.945,-2.90);
  terraceLantern(b,-3.72,4.455,1.55);
  wallLight(b,ARCH.upper.x+ARCH.upper.width/2+.057,6.2,-2.72,Math.PI/2,1.1);
  terraceStair(b);
}
// ---------------------------------------------------------------------------------------------
// VTEST12: a spiral stair up to the side terrace, lantern posts, a couch with a raccoon and a blue jay under the corkboard, and indoors
// a ship in a bottle, a workbench and a chest. (The rooster standee, sleeping bear and bistro sign were removed again; git history has them.)
// Everything is generic low-poly. No characters, logos or copied designs: where a request named one, a generic stand-in is built.
// None of it uses the seeded generators, so nothing built earlier moves.
// ---------------------------------------------------------------------------------------------
/** Short lantern post for the terraces and the roof (building-local units): post, foot plate, lantern, bloom and a warm pool on the floor.
 *  Fake light only (halo + decal), no real PointLight. `floorY` is the walking surface. */
function terraceLantern(parent:THREE.Object3D,x:number,floorY:number,z:number,h=1.25){
  cyl(parent,x,floorY+h/2,z,.032,.042,h,dark,7);
  cyl(parent,x,floorY+.03,z,.11,.13,.06,iron,8);
  box(parent,x,floorY+h+.1,z,.17,.2,.17,lanternGlass);
  for(const sx of [-1,1])for(const sz of [-1,1])box(parent,x+sx*.085,floorY+h+.1,z+sz*.085,.02,.22,.02,iron);
  cyl(parent,x,floorY+h+.26,z,.02,.14,.1,iron,4);sphere(parent,x,floorY+h+.33,z,.03,brass,1);
  halo(parent,x,floorY+h+.1,z,1.2,'#ffbf75',.6);
  glowPatch(parent,x,floorY+.012,z,3.0,3.0,'#ffbd70',.11,0,true);
}
/** Spiral stair from the courtyard up to the side terrace (building-local units): one turn of 15 treads plus a top landing, 16 equal
 *  risers from the pavement (.03) to the terrace tile top (4.455). The landing faces the wall, crosses the cornice on a short bridge and
 *  meets the terrace slab through the gap in the right-hand rail (z = -2.15 .. -1.55). The terrace door on the upper block then leads
 *  into the second floor. */
function terraceStair(b:THREE.Object3D){
  const cx=5.5,cz=-1.85,R=.95,y0=.03,yTop=4.455,N=16,rise=(yTop-y0)/N,dA=Math.PI*2/N;
  const stepMat=color('#59627a',.3,.55),edgeMat=color('#d4a574',.2,.5);
  const theta=(k:number)=>Math.PI-(N-k)*dA;               // tread 16 (the landing) faces the wall; tread 1 starts 22.5 deg past it
  const top=(k:number)=>y0+k*rise;
  cyl(b,cx,.045,cz,.22,.24,.03,iron,12);                    // base plate on the pavement
  cyl(b,cx,5.25/2,cz,.075,.075,5.25,iron,10);               // centre pole, up to the rail height so the landing rail can meet it
  for(let k=1;k<=N;k++){
    const a=theta(k),landing=k===N,w=landing?.64:.44,rc=(R+.04)/2;
    box(b,cx+rc*Math.cos(a),top(k)-.03,cz+rc*Math.sin(a),R-.04,.06,w,stepMat,-a);   // radial plank, tangential width w
    box(b,cx+(R-.02)*Math.cos(a),top(k)-.03,cz+(R-.02)*Math.sin(a),.04,.075,w,edgeMat,-a);   // lighter edge guard on the outer end
  }
  // Bridge from the landing over the cornice to the terrace slab (slab edge x = 4.395).
  box(b,4.48,4.4275,cz,.24,.055,.6,stepMat);
  // Hand rail on the outer edge: a post at every tread from 2 to 15, a top rail and a mid rail through the post tops.
  const Rr=.92,tops:THREE.Vector3[]=[],mids:THREE.Vector3[]=[];
  for(let k=2;k<N;k++){
    const a=theta(k),px=cx+Rr*Math.cos(a),pz=cz+Rr*Math.sin(a);
    cyl(b,px,top(k)+.385,pz,.022,.022,.83,iron,6);
    tops.push(V(px,top(k)+.8,pz));mids.push(V(px,top(k)+.4,pz));
  }
  line(b,tops,.028,trim);line(b,mids,.016,trim);
  // From the last post to the terrace rail post at the gap, and along the landing's open side from the wall to the pole.
  line(b,[tops[tops.length-1],V(4.31,ARCH.groundRoof+.80,-1.55)],.028,trim);
  line(b,[mids[mids.length-1],V(4.31,ARCH.groundRoof+.38,-1.55)],.016,trim);
  perimeterRail(b,'x',-2.15,4.31,5.40,ARCH.groundRoof,trim,.55,.11);
  // A small lantern on the pole top lights the landing (halo only: no real light).
  sphere(b,cx,5.27,cz,.07,brass,1);
  box(b,cx,5.40,cz,.2,.22,.2,lanternGlass);
  for(const sx of [-1,1])for(const sz of [-1,1])box(b,cx+sx*.1,5.40,cz+sz*.1,.02,.24,.02,iron);
  cyl(b,cx,5.57,cz,.02,.15,.1,iron,4);
  halo(b,cx,5.40,cz,1.5,'#ffbf75',.6);
  glowPatch(b,cx,.045,cz,3.6,3.6,'#ffbd70',.12,0,true);
}
/** A low brown tufted couch on slim metal legs, with a seated raccoon and a blue jay perched on the backrest (world units; built facing +Z,
 *  x along its length). The animals are plain low-poly animals. */
function tuftedCouch(parent:THREE.Object3D,x:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,PAVE,z);g.rotation.y=rotY;parent.add(g);
  const leather=color('#8e5a33',0,.7),deep=color('#6a4025',0,.75),btn=color('#2a170d',0,.6),metal=color('#9aa3b2',.7,.35);
  const L=1.5,D=.62;
  for(const sx of [-1,1])for(const sz of [-1,1])cyl(g,sx*(L/2-.1),.07,sz*(D/2-.1),.016,.02,.15,metal,6);   // legs, floor to the frame
  box(g,0,.22,0,L,.16,D,deep);                                    // frame .14 - .30
  box(g,-.305,.35,.05,.6,.10,.5,leather);box(g,.305,.35,.05,.6,.10,.5,leather);   // two seat cushions, top at .40
  box(g,0,.52,-.24,L-.02,.46,.14,leather);                        // backrest, top at .75
  for(const sx of [-1,1])box(g,sx*(L/2-.07),.42,0,.14,.26,D,leather);   // arms, top at .55
  for(let r=0;r<2;r++)for(let i=0;i<6-r;i++)box(g,-.525+i*.21+r*.105,r?.45:.63,-.165,.03,.03,.02,btn);   // tufting buttons on the backrest face
  // Raccoon, sitting on the left cushion and facing out of the couch.
  const rac=new THREE.Group();rac.position.set(-.25,.40,.04);rac.rotation.y=.25;g.add(rac);
  const fur=color('#8c8780',0,.9),lightFur=color('#cfc9bd',0,.9),mask=color('#26252a',0,.8),paw=color('#3a3639',0,.85);
  const body=sphere(rac,0,.13,0,.12,fur,1);body.scale.set(1,1.2,.9);
  const belly=sphere(rac,0,.12,.07,.08,lightFur,1);belly.scale.set(.9,1.1,.5);
  const head=sphere(rac,0,.30,.04,.085,fur,1);head.scale.set(1.15,.95,1);
  const muzzle=sphere(rac,0,.275,.115,.04,lightFur,1);muzzle.scale.set(1,.8,1.1);
  sphere(rac,0,.282,.150,.014,mask,0);
  for(const sx of [-1,1]){
    box(rac,sx*.04,.315,.108,.06,.035,.02,mask);                // eye mask
    box(rac,sx*.04,.318,.12,.012,.012,.008,color('#f3f1ea'));   // eye glint
    sphere(rac,sx*.06,.37,.01,.03,paw,1);                       // ears
    box(rac,sx*.06,.07,.09,.045,.12,.05,fur);sphere(rac,sx*.06,.018,.11,.028,paw,1);   // front leg and paw
    const hip=sphere(rac,sx*.095,.07,-.01,.075,fur,1);hip.scale.set(.8,1,1.1);          // haunch
  }
  const tail:[number,number,number][]=[[-.12,.05,-.11],[-.20,.045,-.06],[-.26,.045,0],[-.28,.045,.07],[-.26,.045,.14]];
  tail.forEach(([tx,ty,tz],i)=>sphere(rac,tx,ty,tz,.05,i%2?mask:fur,1));   // ringed tail curling on the seat
  // Blue jay perched on the top of the backrest (top at .75), turned a little towards the seat.
  const jay=new THREE.Group();jay.position.set(.30,.75,-.24);jay.rotation.y=.6;g.add(jay);
  const blue=color('#3f78c4',0,.8),blue2=color('#2d5fa8',0,.8),white=color('#e8ecf2',0,.8),ink=color('#1a1c26',0,.7);
  for(const sx of [-1,1]){box(jay,sx*.02,.02,0,.012,.04,.012,ink);box(jay,sx*.02,.004,.008,.02,.012,.03,ink);}   // legs and feet
  const jb=sphere(jay,0,.075,-.01,.05,blue,1);jb.scale.set(1,1.1,1.5);jb.rotation.x=-.35;
  const jw=sphere(jay,0,.062,.02,.04,white,1);jw.scale.set(.9,.9,1.2);
  sphere(jay,0,.115,.04,.035,blue,1);
  sphere(jay,0,.105,.068,.02,white,1);
  const crest=new THREE.Mesh(new THREE.ConeGeometry(.02,.05,4),blue);crest.position.set(0,.15,.0);crest.rotation.x=-.4;jay.add(crest);
  const beak=new THREE.Mesh(new THREE.ConeGeometry(.012,.04,4),ink);beak.position.set(0,.112,.085);beak.rotation.x=Math.PI/2;jay.add(beak);
  box(jay,0,.075,.055,.07,.012,.03,ink);                          // necklace band
  for(const sx of [-1,1]){box(jay,sx*.045,.08,-.01,.015,.05,.09,blue2);box(jay,sx*.052,.085,-.01,.008,.01,.04,white);}   // wings with a white bar
  const tailBox=box(jay,0,.06,-.12,.045,.012,.14,blue);tailBox.rotation.x=.25;box(jay,0,.052,-.185,.045,.012,.025,white).rotation.x=.25;
}
/** Ship in a bottle: a dark-sailed galleon on a little sea inside a glass bottle that lies in a wooden cradle. `y` is the table top; the bottle
 *  lies along X (neck towards +X). */
function shipInBottle(parent:THREE.Object3D,x:number,y:number,z:number){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=Math.PI/2;parent.add(g);   // local +Z becomes +X
  const glassMat=new THREE.MeshStandardMaterial({color:'#bfe3ee',transparent:true,opacity:.26,roughness:.12,metalness:0,depthWrite:false});
  const axis=.125;
  for(const dz of [-.1,.1])box(g,0,.025,dz,.14,.05,.045,wood);       // cradle blocks, top at .05
  const lay=(m:THREE.Mesh)=>{m.rotation.x=Math.PI/2;return m;};
  lay(cyl(g,0,axis,0,.085,.085,.26,glassMat,12));                     // body, z -.13 .. .13
  lay(cyl(g,0,axis,.165,.035,.085,.07,glassMat,12));                  // shoulder
  lay(cyl(g,0,axis,.25,.035,.035,.10,glassMat,10));                   // neck
  lay(cyl(g,0,axis,.32,.033,.04,.05,color('#b9895a',0,.9),8));        // cork
  // The scene inside.
  const seaMat=color('#2d7f93',0,.5);                                  // sea: three stacked slabs that follow the curve of the glass
  box(g,0,.052,-.01,.05,.011,.22,seaMat);box(g,0,.0625,-.01,.09,.011,.22,seaMat);box(g,0,.074,-.01,.12,.011,.22,seaMat);
  for(const [wx,wz] of [[-.03,.06],[.025,-.05],[0,-.1]] as const)box(g,wx,.081,wz,.025,.008,.03,color('#d8eef0',0,.6));   // wave tips
  const black=color('#1c1a22',0,.7),mast=color('#3a2a20',0,.8),sail=color('#17151d',0,.9);
  box(g,0,.095,-.01,.05,.035,.20,black);                              // hull
  box(g,0,.122,-.085,.05,.03,.05,black);                              // stern castle
  box(g,0,.113,.095,.03,.02,.04,black);                               // bow
  box(g,0,.118,.13,.01,.01,.06,mast).rotation.x=-.3;                  // bowsprit
  for(const [mz,mh,sw] of [[.05,.07,.08],[-.01,.085,.09],[-.07,.06,.07]] as const){
    cyl(g,0,.115+mh/2-.005,mz,.004,.004,mh,mast,5);                   // mast from the deck up (tops stay under the glass at .21)
    box(g,0,.115+mh*.55,mz+.006,sw,mh*.6,.004,sail);                  // square sail
    box(g,0,.115+mh*.55+mh*.3+.002,mz+.006,sw,.006,.006,mast);   // yard
  }
}
/** Chunky wooden workbench: a cube body with plank lines, a dark top with a raised 3 x 3 inlay, and a saw and hammer hung on the front.
 *  Faces +Z; `gfy` is the floor height. */
function workbench(parent:THREE.Object3D,x:number,gfy:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,gfy,z);g.rotation.y=rotY;parent.add(g);
  const planks=color('#a8794a',0,.85),seam=color('#7d5530',0,.9),topDark=color('#5e3d22',0,.85),inlay=color('#d1a46c',0,.8);
  box(g,0,.30,0,.76,.60,.76,planks);
  box(g,0,.64,0,.84,.07,.84,topDark);
  for(let ix=-1;ix<=1;ix++)for(let iz=-1;iz<=1;iz++)box(g,ix*.19,.678,iz*.19,.17,.012,.17,inlay);
  for(const sy of [.15,.30,.45]){
    box(g,0,sy,.382,.76,.014,.006,seam);box(g,0,sy,-.382,.76,.014,.006,seam);
    box(g,.382,sy,0,.006,.014,.76,seam);box(g,-.382,sy,0,.006,.014,.76,seam);
  }
  box(g,-.17,.36,.386,.30,.08,.008,color('#b9c0cc',.5,.5));box(g,-.35,.36,.388,.07,.06,.014,color('#6b4528',0,.9));   // saw: blade and handle
  box(g,.17,.32,.388,.035,.24,.014,color('#6b4528',0,.9));box(g,.17,.46,.39,.13,.06,.022,color('#4a4f5a',.4,.5));    // hammer: handle and head
}
/** Wooden storage chest with iron straps and a brass lock. Faces +Z. */
function woodChest(parent:THREE.Object3D,x:number,gfy:number,z:number,rotY:number){
  const g=new THREE.Group();g.position.set(x,gfy,z);g.rotation.y=rotY;parent.add(g);
  box(g,0,.17,0,.80,.34,.50,color('#8b5a2b',0,.85));
  box(g,0,.40,0,.82,.12,.52,color('#7a4c22',0,.85));
  for(const sx of [-.28,.28])box(g,sx,.23,0,.06,.46,.54,iron);
  box(g,0,.33,.265,.09,.10,.03,brass);
}
function endgameExterior(scene:THREE.Object3D){
  const bt={x:2.95,z:1.45};
  cat(scene,bt.x-.66,ARCH.groundRoof+.12+.5525,bt.z,faceTo(bt.x-.66,bt.z,bt.x,bt.z));   // on the left bistro chair, watching the lantern
  quetzal(scene,-1.75,ARCH.upperRoof+.25+.81+.0325,ARCH.upper.z+ARCH.upper.depth/2+.08);   // on the roof's front rail
  baseballSet(scene,2.15,4.0);
  wallHoop(scene,-ARCH.ground.width/2,.85);                                               // left wall, in front of the parked truck
  chessBoard(scene,2.85,4.893,-1.9,.4);                                                   // terrace side table, where the lattice board stood
  // Parked (not placed): flag, surfboard, rail scarves, pennant swag, round shields, door wreath, lattice board, wagon, free-standing hoop.
}
export function buildWorld():World{
 keyLights.length=0;openings.length=0;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#080b19');scene.fog=new THREE.FogExp2('#080b19',.013);
 scene.add(new THREE.HemisphereLight('#b1c1e2','#2a2038',.78));
 const smallScreen=typeof window.matchMedia==='function'&&window.matchMedia('(max-width: 750px)').matches;
 const key=new THREE.DirectionalLight('#d2d6f3',1.08);key.position.set(-6,10,6);key.castShadow=true;key.shadow.mapSize.set(smallScreen?1024:2048,smallScreen?1024:2048);key.shadow.camera.left=-13;key.shadow.camera.right=13;key.shadow.camera.top=13;key.shadow.camera.bottom=-13;key.shadow.bias=-.0004;scene.add(key);
 const rim=new THREE.DirectionalLight('#9777df',.78);rim.position.set(7,10,-8);scene.add(rim);
 // Cool moonlight raking in from the right gives the +X elevation a defined edge instead of one flat dark slab.
 const rimRight=new THREE.DirectionalLight('#79a8ff',.7);rimRight.position.set(14,6,3);scene.add(rimRight);
 // ---- The real point-light budget (see LIGHTING BUDGET). Each light is placed where the lamps it stands in for
 // are densest; the lamps themselves add halos and light pools on top. The two rear machines add 2 more.
 // The building is one uniformly scaled group; lights that belong to it are positioned with `at()` and their
 // intensity is scaled by S^2 so that shrinking distances does not make surfaces brighter (E = I / d^2).
 const S=BUILDING_SCALE,at=(x:number,y:number,z:number):[number,number,number]=>[x*S,y*S,z*S],k=S*S;
 keyLight(scene,'#f28aca',3.1,13.0,CART.x-.3,2.6,CART.z-.3,.075,.61,0);   // magenta glow around the book cart and left front
 keyLight(scene,'#39e5ff',2.95,12.0,NEON.x+.4,4.2,NEON.z+.2,.075,.61,1.4); // cool blue fill along the right elevation
 keyLight(scene,'#a271ff',2.55,10.5,.15,1.6,-4.3,.075,.61,2.8);            // violet wash over the rear service area
 keyLight(scene,'#9cc8ff',1.45,21,0,9.5,5);                                // cool moon fill from above
 keyLight(scene,'#ffc27a',5.2*k,10,...at(-2.4,2.9,4.6),.12*k,.8,.3);       // storefront, left display window and awning lamps
 keyLight(scene,'#ffc27a',5.2*k,10,...at(2.5,2.9,4.6),.12*k,.8,1.9);       // storefront, right display window and resume stand
 keyLight(scene,'#ffbf7a',4.5*k,8.5,...at(2.95,5.5,1.2),.1*k,.7,.9);        // right terrace table, string bulbs and door
 keyLight(scene,'#ffc27a',3.6*k,7.5,...at(-1.2,6.6,2.4),.08*k,.75,2.2);    // upper-floor windows and sconces
 keyLight(scene,'#ffbe74',3.6*k,8,...at(-1.15,9.0,-.30),.08*k,.65,3.1);    // rooftop terrace
 keyLight(scene,'#ffb872',1.7*k,6.5,...at(5.4,3.4,-.6),.05*k,.7,.5);       // corkboard: the lamp beside it; kept gentle so the board does not glow
 const hits:HitTarget[]=[];
 // World-level pieces: plaza and the props that are not part of the building (cart, signs, resume stand).
 floor(scene);endgameWorld(scene);
 // The building and everything mounted on it or standing against it live in one group, uniformly scaled.
 const building=new THREE.Group();building.scale.setScalar(S);scene.add(building);
 storefront(building);bounceDecals(building);
 // Purposeful V4 architectural detail, intentionally separated from all navigation targets.
 storefrontDetails(building);terraceFurnishings(building);roofFurnishings(building);facadeServiceDetail(building);utilityExterior(building);
 bookCart(scene,hits);noticeboard(building,hits);resumeStand(scene,hits);serviceBack(building,hits);
 endgameExterior(building);
 // Interiors come last so they never shift the random sequence used by the plants and paving above.
 interiors(building);
 endgameInteriors(building);
 // Last, so the seeded scatter used by every plant above is untouched.
 cozyBuilding(building);cozyWorld(scene);
 const lightCount=keyLights.length;
 if(import.meta.env.DEV&&lightCount>POINT_LIGHT_BUDGET)console.warn(`Point-light budget exceeded: ${lightCount} real lights (budget ${POINT_LIGHT_BUDGET}). Use halo()/glowPatch() for new lamps.`);
 // Everything solid and visible can hide a hit target. Invisible hit boxes and see-through decals (glow patches,
 // glare, floor glows: all transparent with opacity < .6) are excluded, so they never block the pointer.
 const hitObjects=new Set<THREE.Object3D>(hits.map(h=>h.object));
 const occluders:THREE.Object3D[]=[];
 scene.traverse((o:THREE.Object3D)=>{
  const mesh=o as THREE.Mesh;
  if(!mesh.isMesh||hitObjects.has(o))return;
  const mat=mesh.material as THREE.Material;
  if(Array.isArray(mat)||(mat.transparent&&mat.opacity<.6))return;
  occluders.push(o);
 });
 const hoverVisuals=[...new Set(hits.flatMap(h=>h.visual?[h.visual]:[]))];
 let currentHover:THREE.Object3D|null=null;
 const reduced=typeof window.matchMedia==='function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 return {scene,hits,occluders,setHovered:(hit:HitTarget|null)=>{currentHover=hit?.visual??null;},animate:(elapsed:number)=>{
   for(const visual of hoverVisuals){
     const isHover=visual===currentHover;
     const target=isHover?1.045:1;
     const value=reduced?target:THREE.MathUtils.lerp(visual.scale.x,target,.17);
     visual.scale.setScalar(value);
   }
   // Every real light breathes around the intensity it was configured with, so tuning a light
   // above can never be undone by the animation (the old hard-coded base values caused that).
   for(const k of keyLights)k.light.intensity=reduced||k.amp===0?k.base:k.base+Math.sin(elapsed*k.speed+k.phase)*k.amp;
 }};
}
