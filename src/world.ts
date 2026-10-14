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
    // Unlit room: dark glass set back in the opening.
    box(node,0,0,-.19,w,h,.03,color('#283440',.12,.27));
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
function lampPost(parent:THREE.Object3D,x:number,z:number,scale=1){cyl(parent,x,1.72*scale,z,.07,.10,3.4*scale,dark,10);sphere(parent,x,3.42*scale,z,.13,brass);line(parent,[V(x,3.1*scale,z),V(x+.45*scale,3.25*scale,z),V(x+.68*scale,2.9*scale,z)],.05,dark);hangingLamp(parent,x+.68*scale,2.84*scale,z,1.8,2.84*scale);}
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
 *  right edge, foot chips, two volumes, height ticks, chalk, a lamp either side, a crash pad, a bench with a chalk bag, and
 *  a monkey who has stopped halfway up. At the top, the roof's back rail is open and a grab bar marks the exit. */
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
  const MONKEY={lo:3.70,hi:5.02};                                           // the monkey occupies this band; routes pass either side of it
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
  // The monkey's holds: two sun-yellow jugs for the hands, two slopers for the feet.
  hold(-.2,4.72,'jug',sun);hold(.19,4.80,'jug',sun);hold(-.13,3.98,'sloper',sun);hold(.15,4.06,'sloper',sun);
  // Volumes: a violet prism low down and an amber one near the top.
  for(const [vy,vm] of [[2.5,violet2],[6.2,amber2]] as const){const vol=cyl(g,0,vy,.03,.2,.2,.46,vm,3);vol.rotation.z=Math.PI/2;placed.push({x:0,y:vy});}
  placed.push({x:0,y:4.35},{x:0,y:4.58});                                     // keeps foot chips from poking into the monkey's back
  // Neutral foot chips scattered over the whole board, kept clear of the other holds.
  for(let y=.45;y<7.9;y+=.31){
    const x=(hash1(y)-.5)*.56;
    if(placed.some(p=>Math.hypot(p.x-x,p.y-y)<.2))continue;
    hold(x,y,'chip',chip);
  }
  // ---- The monkey: belly to the wall, one hand and one foot on each side, tail hanging. Every limb starts INSIDE the torso
  // (shoulder and hip balls overlap it) and ends INSIDE a hold (hands and feet are pressed into the yellow holds), so
  // the whole animal is one connected body.
  const fur=color('#6b4a2f',0,.95),belly=color('#b58b62',0,.95),skin=color('#caa57d',0,.9),eye=color('#1a1410',0,.5);
  const my=4.40,bz=.15;                                                              // body centre; the back sits ~4 cm off the panel
  const torso=sphere(g,0,my,bz,.125,fur,1);torso.scale.set(.86,1.15,.86);            // x +-.107, y +-.144, z .043 to .257
  const tummy=sphere(g,0,my-.02,bz+.075,.085,belly,1);tummy.scale.set(.85,1.1,.55);
  sphere(g,0,my+.14,bz+.02,.07,fur,1);                                                // neck, overlaps torso and head
  sphere(g,0,my+.225,bz+.02,.09,fur,1);                                               // head
  const muzzle=sphere(g,0,my+.205,bz+.085,.05,skin,1);muzzle.scale.set(1,.85,.7);
  for(const sx of [-1,1]){
    sphere(g,sx*.034,my+.245,bz+.1,.013,eye,0);                                       // eyes sit on the face
    sphere(g,sx*.093,my+.235,bz+.02,.033,skin,0);                                     // ears on the head's sides
    const hx=sx>0?.19:-.2,hy=sx>0?4.80:4.72;                                          // the yellow jug this hand holds
    sphere(g,sx*.085,my+.075,bz,.058,fur,1);                                          // shoulder ball
    line(g,[V(sx*.085,my+.075,bz),V(sx*.165,my+.2,.125),V(hx,hy-.01,.1)],.037,fur);   // arm: shoulder, elbow, hand
    sphere(g,sx*.165,my+.2,.125,.04,fur,1);                                            // elbow ball hides the bend
    sphere(g,hx,hy-.01,.1,.046,fur,1);                                                 // hand, pressed into the jug
    const fx=sx>0?.15:-.13,fy=sx>0?4.06:3.98;                                          // the sloper this foot stands on
    sphere(g,sx*.065,my-.1,bz,.062,fur,1);                                             // hip ball
    line(g,[V(sx*.065,my-.1,bz),V(sx*.165,my-.2,.14),V(fx,fy+.02,.105)],.042,fur);     // leg: hip, knee, foot
    sphere(g,sx*.165,my-.2,.14,.046,fur,1);                                            // knee ball
    sphere(g,fx,fy+.02,.105,.046,fur,1);                                               // foot, pressed onto the sloper
  }
  line(g,[V(0,my-.14,bz-.02),V(.03,my-.3,.12),V(.11,my-.48,.12),V(.19,my-.6,.11),V(.2,my-.62,.11)],.024,fur);   // tail starts inside the torso
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
  // Bench facing the panel, with a chalk bag on it.
  const benchZ=padZ-.86;
  bench(scene,-3.55,GROUND,benchZ,-3.55,zf,1.1);
  const bag=cyl(scene,-3.28,GROUND+.485+.075,benchZ,.08,.095,.15,color('#3b6fb6',0,.9),9);
  cyl(scene,-3.28,GROUND+.485+.158,benchZ,.045,.075,.03,color('#efeae0',0,.9),9);bag.castShadow=true;
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
  // Exterior wall sconce beside the actual terrace doorway.
  wallLight(scene,ARCH.upper.x+ARCH.upper.width/2+.057,6.13,.90,Math.PI/2,1.42);
  // Soft practical lantern on the terrace table (table top is h+.765).
  tableLantern(scene,bt.x,h+.765,bt.z);
  glowPatch(scene,bt.x,4.455,bt.z,4.2,3.6,'#ffbf7a',.12,0,true);
  // Small drainage outlet at the terrace low point, piped through the slab edge into a downspout.
  gutter(scene,[V(4.12,T+.025,-2.94),V(4.33,T+.025,-2.94),V(4.34,3.80,-2.94),V(4.34,.03,-2.94)],.055,{axis:'x',value:ARCH.ground.width/2});
  // String of terrace bulbs between two slim poles (it used to hang from nothing).
  const poleA=V(1.95,T,2.90),poleB=V(4.05,T,.65);
  const terraceBulbs=[V(poleA.x,T+1.72,poleA.z),V(2.65,T+1.50,2.24),V(3.36,T+1.52,1.57),V(poleB.x,T+1.70,poleB.z)];
  for(const [pole,top] of [[poleA,terraceBulbs[0]],[poleB,terraceBulbs[3]]] as const){
    cyl(scene,pole.x,(T+top.y)/2,pole.z,.03,.04,top.y-T,iron,7);cyl(scene,pole.x,T+.03,pole.z,.11,.13,.06,iron,8);sphere(scene,pole.x,top.y+.02,pole.z,.045,brass,1);
  }
  line(scene,terraceBulbs,.018,dark);
  terraceBulbs.slice(1,-1).forEach(b=>{sphere(scene,b.x,b.y-.09,b.z,.08,bright,1);halo(scene,b.x,b.y-.09,b.z,.85,'#ffc172',.55);});
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
 for(let x=1.96;x<=4.05;x+=.43){
  for(let z=-2.82;z<=2.77;z+=.43){
   const m=box(scene,x,walkY,z,.401,.022,.401,((Math.floor(x*4)+Math.floor(z*3))%4===0)?tile:slab);m.castShadow=false;
  }
 }
 for(let x=-3.82;x<1.86;x+=.43){
  for(let z=1.40;z<=2.75;z+=.43){
   const m=box(scene,x,walkY,z,.40,.021,.40,slab);m.castShadow=false;
  }
 }
 // A warm seam along the setback edge, showing two legible terraces from title view.
 box(scene,1.77,ARCH.groundRoof+.12,-.94,.08,.04,4.12,joints);
 box(scene,-1.08,ARCH.groundRoof+.12,1.14,5.62,.04,.075,joints);
 // The FRONT and RIGHT outer edges remain open behind the railings.
 perimeterRail(scene,'x',3.23,-4.31,4.00,ARCH.groundRoof,trim,.56,.11);
 perimeterRail(scene,'z',4.31,-2.95,3.20,ARCH.groundRoof,trim,.52,.11);
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
 // Single decorative wall lantern by the terrace door.
 hangingLamp(scene,1.99,5.66,.79,1.10);
 box(scene,1.85,6.02,.79,.32,.05,.05,iron);   // bracket from the upper wall (x=1.70) to the lantern cord
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
 // Warm patio bulbs strung across the edge, subtly chaotic rather than crowded.
 const roofTop=y+.165;
 const bulbs=[V(-3.19,y+1.44,.74),V(-2.15,y+1.21,.86),V(-1.18,y+1.09,.86),V(-.18,y+1.13,.85),V(.70,y+1.38,.75)];
 // Two slim poles carry the string (it used to start and end in mid-air).
 for(const e of [bulbs[0],bulbs[4]]){cyl(scene,e.x,(roofTop+e.y)/2,e.z,.03,.04,e.y-roofTop,iron,7);cyl(scene,e.x,roofTop+.03,e.z,.11,.13,.06,iron,8);sphere(scene,e.x,e.y+.02,e.z,.045,brass,1);}
 line(scene,bulbs,.019,dark);
 for(let i=1;i<bulbs.length-1;i++){
  const b=bulbs[i];sphere(scene,b.x,b.y-.11,b.z,.105,bright,1);
  halo(scene,b.x,b.y-.11,b.z,1.05,'#ffbc72',.6);
  if(i===2)glowPatch(scene,b.x,y+.165,b.z-.2,4.6,3.0,'#ffbc72',.10,0,true);
 }
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
 lampPost(scene,-6.4,-.6,1.18);
 lampPost(scene,6.4,-1.6,1.12);
 lampPost(scene,5.4,-4.4,.92);
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
/** World position of the project book cart (it sits on the pavement in front of the left display window). */
const CART={x:-4.75,z:3.5};
function bookCart(scene:THREE.Object3D,hits:HitTarget[]){const g=new THREE.Group();g.position.set(CART.x,-.036,CART.z);g.rotation.y=-.13;scene.add(g);
 const shelfmat=color('#6a5143'),metal=color('#486777',.58,.36);
 for(let y of [.73,1.6])plank(g,0,y,0,2.75,.93,shelfmat);
 for(let x of [-1.24,1.24])for(let z of [-.36,.36])box(g,x,1.0,z,.10,1.84,.11,metal);
 for(let x of [-.97,.97])for(let z of [-.34,.34]){cyl(g,x,.19,z,.18,.18,.26,dark);cyl(g,x,.19,z,.11,.11,.28,metal);}
 const map=new THREE.Group();g.add(map);
 projects.forEach((p:Project,i)=>{
  const row=i<6?0:1;const col=row===0?i:i-6;const count=row===0?6:5;
  const x=(col-(count-1)/2)*.38;
  const y=(row===0?1.6:.73)+.055+.375;   // plank top + half a book, so the books sit on the shelf
  const book=new THREE.Group();book.position.set(x,y,.05);book.rotation.y=(i%3-1)*.07;map.add(book);
  box(book,0,0,0,.325,.75,.32,color(p.color));
  plane(book,0,0,.166,.311,.737,bookCoverTexture(p));
  box(book,.156,0,0,.025,.69,.27,color('#f0e7d7'));
  box(book,0,.29,.172,.285,.044,.023,brass);
  box(book,0,-.29,.172,.285,.044,.023,brass);
  // The book cover itself is readable when the visitor zooms toward the cart.
  const hit=box(book,0,0,0,.35,.80,.43,new THREE.MeshBasicMaterial({opacity:0,transparent:true,depthWrite:false}));
  hits.push({object:hit,visual:book,section:'projects',projectId:p.id,label:`Open ${p.name}`});
 });
 // large little banner at base of cart
 plane(g,0,1.22,.52,2.27,.31,labelTexture('PROJECTS / THE BOOK CART','#d8faff','#263748','#83dfed',1024,140));  // 1024:140 = the 2.27:.31 plane
 // Warm pool on the pavement in front of the cart, from the nearby streetlamp.
 glowPatch(g,0,.08,.95,4.2,2.6,'#ffbf86',.10,0,true);
 const hit=box(g,0,1.25,0,2.80,2.3,1.05,new THREE.MeshBasicMaterial({opacity:0,transparent:true,depthWrite:false}));
 // large hit behind the books only, so front book hit areas still win in raycast
 hit.position.z=-.38;hits.push({object:hit,visual:g,section:'projects',label:'Browse projects'});
}
/** The paved plaza (world units). Kept tight around the building so the whole scene reads from the default view. */
const PLAZA={x0:-7.2,x1:7.2,z0:-4.9,z1:5.2};
function floor(scene:THREE.Object3D){
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(170,170),new THREE.MeshStandardMaterial({color:'#0b1124',metalness:0,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.28;ground.receiveShadow=true;scene.add(ground);  // matte: a glossy ground turned every point light into a huge white-blue specular blob
 const cx=(PLAZA.x0+PLAZA.x1)/2,cz=(PLAZA.z0+PLAZA.z1)/2;
 box(scene,cx,-.16,cz,PLAZA.x1-PLAZA.x0+.4,.32,PLAZA.z1-PLAZA.z0+.4,color('#3a435d'));
 const paving=[color('#5e596d'),color('#746276'),color('#4d5368'),color('#686475')];
 for(let x=PLAZA.x0+.05;x<PLAZA.x1-.4;x+=.73)for(let z=PLAZA.z0+.05;z<PLAZA.z1-.4;z+=.74){let m=box(scene,x+.36,-.004,z+.36,.705,.055,.710,paving[Math.floor(random()*4)]);m.castShadow=false;}
 for(let x of [PLAZA.x0+.5,PLAZA.x1-.5])for(let z of [PLAZA.z0+.4,PLAZA.z1-.4])cyl(scene,x,.45,z,.11,.12,.92,dark);
 // Thin curb edge and pavement joint reflections.
 box(scene,cx,.043,PLAZA.z1+.16,PLAZA.x1-PLAZA.x0+.05,.10,.20,stone);
 for(let i=0;i<8;i++)box(scene,3.0+i*.13,.036,PLAZA.z1-.55,.063,.025,.28,dark);
 // Front pavement stays clean so the building and signage carry the identity.
 // stylized reflected pools, no postprocessing required
 const glows:[string,number,number,number,number][]=[['#6f30cb',3.8,-5.6,11,5],['#2f97c6',5.2,-4.6,10,5],['#ef7c48',-4.2,-4.4,8,3]];
 for(const[c,x,z,w,d] of glows) {const t=texture((ctx,W,H)=>{const g=ctx.createRadialGradient(W/2,H/2,4,W/2,H/2,W*.46);g.addColorStop(0,c+'99');g.addColorStop(1,c+'00');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)},256,256);const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:t,transparent:true,opacity:.55,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,-.20,z);scene.add(m);}
}
/** World position of the former sign post. The five-sign stack was removed (the on-screen menu already navigates), but the
 *  cool light that used to spill from it stays as general moonlit fill on the right elevation. */
const NEON={x:6.45,z:2.1};
/** Placeholder blade sign on a street pole. It is intentionally blank: no lettering and no glow decals.
 *  Change `w`/`h` for another shape, `x/y/z` to move it, `rotY` to turn it. `pole.x` is where the pole stands. */
const NAME_SIGN={x:-4.0,y:5.2,z:2.0,rotY:-.15,w:.80,h:2.72,thick:.17,pole:{x:-4.55,z:2.0},neon:'#ffba72'};
function nameSign(scene:THREE.Object3D){
 const {x,y,z,rotY,w,h,thick,pole,neon:hex}=NAME_SIGN;
 // Pole and arm, so the sign is held up by something instead of floating over the pavement.
 const top=y+h/2+.28;
 cyl(scene,pole.x,top/2,pole.z,.065,.085,top,dark,10);
 sphere(scene,pole.x,top+.05,pole.z,.10,brass);
 box(scene,(pole.x+x)/2,top-.08,z,Math.abs(x-pole.x)+.1,.07,.07,iron);
 const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;scene.add(g);
 for(const dx of [-w*.3,w*.3])box(g,dx,h/2+.12,0,.035,.30,.035,iron);   // hangers from the arm
 box(g,0,0,0,w,h,thick,dark);
 // Slim lit border on both faces; the middle stays an empty dark panel.
 const frame=neon(hex,.7),t=.05;
 for(const side of [1,-1]){
  const zf=side*(thick/2+.012);
  box(g,0,h/2-t/2-.03,zf,w-.06,t,.025,frame);box(g,0,-h/2+t/2+.03,zf,w-.06,t,.025,frame);
  box(g,-w/2+t/2+.03,0,zf,t,h-.06,.025,frame);box(g,w/2-t/2-.03,0,zf,t,h-.06,.025,frame);
 }
}
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
 box(scene,-.55,gf+1.35,-2.45,.46,.4,.38,zinc);
 for(const cx of [-2.3,-2.0,-1.5])cyl(scene,cx,gf+1.15+.07,-2.3,.07,.06,.14,color('#e8dfd0'),8);
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
/** Teapot and two cups on a round tray. The tray top is at y+.012. */
function teaSet(parent:THREE.Object3D,x:number,y:number,z:number){
  const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
  const clay=color('#8a4a33',0,.7),cup=color('#efe3c8',0,.6);
  cyl(g,0,.006,0,.11,.11,.012,color('#2a2523',0,.7),14);
  sphere(g,0,.0545,0,.05,clay,1).scale.set(1,.85,1);
  cyl(g,0,.095,0,.03,.03,.012,clay,10);sphere(g,0,.108,0,.01,clay,0);
  const spout=new THREE.Mesh(new THREE.ConeGeometry(.014,.07,6),clay);spout.rotation.z=-1.1;spout.position.set(.053,.08,0);g.add(spout);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.03,.006,5,12),clay);handle.position.set(-.058,.058,0);g.add(handle);
  for(const dz of [-.07,.07])cyl(g,0,.032,dz,.026,.02,.04,cup,10);
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

/** A world-level cluster of props on the plaza. */
function endgameWorld(scene:THREE.Object3D){
  hoop(scene,5.9,4.25,Math.PI);                           // front-right corner, shooting toward the building; clear of the About Me board and the goal
  pingPong(scene,-5.7,-3.55,.3);
  wagon(scene,-6.2,-1.2,2.7);
  miniGoal(scene,6.4,2.75,-Math.PI/2);
  soccerBall(scene,5.7,PAVE+.11,2.45);
  cone(scene,5.0,1.9);cone(scene,5.0,3.5);
  heron(scene,-6.5,1.2,.7);
  posterColumn(scene,6.0,-3.0,.9);                         // back-right corner: clear of the cart, the resume stand, every hit target and the lamps
  // Sidewalk display table in front of the left window: toy vehicles, a fox, a beetle, books and a baseball, a toque, headphones, dice.
  const table=displayTable(scene,-1.45,4.2,0),top=TABLE_H+.006;
  toyRoadster(table,-.55,top,.12,Math.PI/2);toyKeiTruck(table,-.55,top,-.12,Math.PI/2);toyKart(table,-.18,top,.12,Math.PI/2);
  foxFigure(table,-.18,top,-.12,.3);bookStack(table,.2,top,-.1,.1);beetleFigure(table,.2,top,.14,.5);
  chefHat(table,.5,top,-.1);headphones(table,.52,top,.13,.4);diceAndChips(table,.7,top,0);
  recordCrate(scene,-2.85,3.95,.15);
  treasureChest(scene,-2.95,4.75,.5);
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
/** Framed plain shirt: a painted garment on a cream mat in a thin wood frame, hung flat on a wall facing local +Z of `parent`. */
function framedShirt(parent:THREE.Object3D,x:number,y:number,z:number,kind:'tank'|'jersey'|'kit',num:string){
  box(parent,x,y,z,.52,.64,.025,wood);
  const tex=texture((c,W,H)=>{
    c.fillStyle='#e9dfcc';c.fillRect(0,0,W,H);
    c.beginPath();
    if(kind==='tank'){c.moveTo(W*.3,H*.1);c.lineTo(W*.4,H*.1);c.quadraticCurveTo(W*.5,H*.3,W*.6,H*.1);c.lineTo(W*.7,H*.1);c.lineTo(W*.78,H*.9);c.lineTo(W*.22,H*.9);c.closePath();}
    else{c.moveTo(W*.36,H*.1);c.quadraticCurveTo(W*.5,H*.2,W*.64,H*.1);c.lineTo(W*.92,H*.28);c.lineTo(W*.8,H*.42);c.lineTo(W*.74,H*.36);c.lineTo(W*.74,H*.9);c.lineTo(W*.26,H*.9);c.lineTo(W*.26,H*.36);c.lineTo(W*.2,H*.42);c.lineTo(W*.08,H*.28);c.closePath();}
    c.save();c.clip();
    if(kind==='tank'){c.fillStyle='#c9302c';c.fillRect(0,0,W,H);c.fillStyle='#f3efe6';c.fillRect(W*.2,H*.84,W*.6,H*.06);}
    else if(kind==='jersey'){c.fillStyle='#f3f1ea';c.fillRect(0,0,W,H);c.fillStyle='#1d2c55';for(let i=0;i<W;i+=18)c.fillRect(i,0,4,H);}
    else{c.fillStyle='#f1efe8';c.fillRect(0,0,W,H);c.fillStyle='#15171c';for(let i=0;i<W;i+=56)c.fillRect(i,0,28,H);}
    c.restore();
    c.fillStyle=kind==='kit'?'#c9302c':'#1d2029';c.font=`bold ${H*.28}px Arial`;c.textAlign='center';c.textBaseline='middle';c.fillText(num,W/2,H*.56);
  },220,270);
  litPlane(parent,x,y,z+.014,.44,.56,tex,0,.3);
}
function endgameInteriors(scene:THREE.Object3D){
  const gf=.07,uf=4.425,counter=gf+1.15;   // counter top
  const copper=color('#b9683a',.5,.4),cream=color('#efe3c8',0,.7);
  // ---- Ground floor ---------------------------------------------------------------------------------------
  toyPlane(scene,2.6,2.85,1.75,.6,ARCH.ground.height-.03);
  // Counter: a copper pot with a wooden spoon, a snare drum with sticks, and a plain red stapler.
  cyl(scene,-2.65,counter+.1,-2.40,.15,.17,.2,copper,10);
  cyl(scene,-2.65,counter+.205,-2.40,.16,.16,.012,copper,10);
  for(const sx of [-1,1])box(scene,-2.65+sx*.185,counter+.14,-2.40,.04,.03,.05,copper);
  cyl(scene,-2.62,counter+.36,-2.38,.012,.012,.3,wood,5).rotation.z=.18;
  cyl(scene,-3.15,counter+.05,-2.35,.13,.13,.09,color('#ddd8ce',0,.5),12);
  cyl(scene,-3.15,counter+.05,-2.35,.135,.135,.02,color('#9aa3ad',.6,.4),12);
  for(const [sz,sr] of [[-.03,.12],[.03,-.1]] as const)box(scene,-3.15,counter+.1,-2.35+sz,.28,.014,.014,wood,sr);
  box(scene,-.9,counter+.0125,-2.28,.17,.025,.05,color('#b8312b'));box(scene,-.9,counter+.037,-2.28,.17,.02,.045,color('#c23a31'));
  // Retro gaming corner in the right-hand shop window: a CRT on a proper shop-display cabinet. The cabinet is counter height so the
  // set sits above the window sill and shows from the street; the TV stands wholly inside the cabinet top, screen toward the glass.
  const cabX=2.75,cabZ=2.5,cabTop=gf+1.18;
  box(scene,cabX,gf+.05,cabZ,1.24,.1,.44,dark);                                         // recessed plinth
  box(scene,cabX,gf+.1+(cabTop-.04-(gf+.1))/2,cabZ,1.28,cabTop-.04-(gf+.1),.48,wood);  // carcass
  for(const dx of [-.31,.31]){box(scene,cabX+dx,gf+.62,cabZ+.2425,.56,.80,.012,color('#5a4640'));box(scene,cabX+dx*.2,gf+.62,cabZ+.254,.02,.2,.012,brass);}   // two doors with pulls
  box(scene,cabX,cabTop-.02,cabZ,1.36,.04,.54,color('#b88d62',0,.7));                  // top board, 2 cm overhang
  const tvX=cabX-.30,tvZ=cabZ+.12;
  box(scene,tvX,cabTop+.22,tvZ,.5,.44,.24,color('#3a3f4b'));                           // CRT body, z 2.50 to 2.74
  box(scene,tvX,cabTop+.15,tvZ-.22,.30,.30,.20,color('#2a2f3a'));                       // tapered tube housing behind it
  box(scene,tvX,cabTop+.22,tvZ+.125,.46,.38,.02,color('#1d2029'));                    // bezel
  const pong=texture((c,W,H)=>{c.fillStyle='#0b1a24';c.fillRect(0,0,W,H);c.fillStyle='#bff7e8';for(let y=0;y<H;y+=24)c.fillRect(W/2-2,y,4,12);c.fillRect(24,H*.3,10,48);c.fillRect(W-34,H*.52,10,48);c.fillRect(W*.62,H*.5,10,10);},256,192);
  plane(scene,tvX,cabTop+.22,tvZ+.1365,.34,.26,pong);
  cyl(scene,tvX,cabTop+.45,tvZ-.02,.05,.06,.02,color('#1d2029'),8);                    // antenna base on the top of the set
  for(const sr of [-.55,.55]){const rod=new THREE.Group();rod.position.set(tvX,cabTop+.46,tvZ-.02);rod.rotation.z=sr;scene.add(rod);cyl(rod,0,.15,0,.005,.005,.3,zinc,5);}   // rabbit ears
  halo(scene,tvX,cabTop+.22,tvZ+.33,1.2,'#8fe8ff',.35);
  // Two generic consoles, a clamshell handheld and a gamepad on the same top board.
  box(scene,3.08,cabTop+.025,cabZ-.03,.24,.05,.30,color('#1d2029'));box(scene,3.08,cabTop+.0475,cabZ-.03,.2,.005,.26,color('#2a2f3a'));
  box(scene,3.08,cabTop+.03,cabZ-.03+.151,.14,.008,.004,color('#6bd0ff',0,.4,'#35b6ff',1.2));
  box(scene,3.31,cabTop+.06,cabZ+.0,.16,.12,.20,color('#e8e6df'));box(scene,3.31,cabTop+.06,cabZ+.101,.02,.07,.004,color('#8a929c'));
  box(scene,3.0,cabTop+.007,cabZ+.2,.15,.014,.09,color('#cfd4dc'));                       // handheld, base
  const lid=new THREE.Group();lid.position.set(3.0,cabTop+.014,cabZ+.2-.045);lid.rotation.x=-1.75;scene.add(lid);   // hinged along its back edge, opened past 90 degrees
  box(lid,0,0,.045,.15,.012,.09,color('#cfd4dc'));box(lid,0,-.0066,.045,.12,.002,.07,color('#7be0ff',0,.4,'#35b6ff',1));
  box(scene,3.2,cabTop+.0125,cabZ+.2,.13,.025,.07,color('#2a2f3a'));                    // gamepad
  for(const gx of [-.035,.035])cyl(scene,3.2+gx,cabTop+.0375,cabZ+.2,.012,.012,.025,color('#14171f'),8);
  // ---- Upper floor ----------------------------------------------------------------------------------------
  const wallZ=-2.78;
  framedShirt(scene,-3.2,uf+1.75,wallZ+.0125,'tank','1');
  framedShirt(scene,-2.4,uf+1.75,wallZ+.0125,'jersey','2');
  framedShirt(scene,-1.6,uf+1.75,wallZ+.0125,'kit','10');
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
  // Coffee table: a fan of playing cards, a lit candle and two paperbacks.
  const tt=uf+.425;
  for(let i=0;i<5;i++){
    const card=new THREE.Group();card.position.set(-1.12,tt+.001+i*.0022,-.85);card.rotation.y=(i-2)*.28;scene.add(card);
    box(card,0,0,.035,.058,.002,.09,i%2?color('#a02c35'):color('#f1efe8'));
    if(i%2===0)box(card,0,.0016,.02,.018,.001,.018,color('#c9302c'));
  }
  cyl(scene,-1.7,tt+.05,-.9,.03,.03,.1,cream,8);
  sphere(scene,-1.7,tt+.115,-.9,.014,bright,0);halo(scene,-1.7,tt+.12,-.9,.5,'#ffb866',.5);
  box(scene,-1.02,tt+.015,-1.05,.2,.03,.28,color('#425e6c'),.2);box(scene,-1.02,tt+.04,-1.05,.19,.02,.27,color('#d9cfb9'),.15);
  box(scene,-1.55,tt+.012,-.72,.17,.024,.25,color('#965857'),-.3);
  soccerBall(scene,-.7,uf+.11,-2.5);
}
/** Building-level end-game pieces outside the walls (building-local units): the cat, the quetzal, the flag, the surfboard and the baseball kit. */
function endgameExterior(scene:THREE.Object3D){
  const bt={x:2.95,z:1.45};
  cat(scene,bt.x-.66,ARCH.groundRoof+.12+.5525,bt.z,faceTo(bt.x-.66,bt.z,bt.x,bt.z));   // on the left bistro chair, watching the lantern
  quetzal(scene,-1.75,ARCH.upperRoof+.25+.81+.0325,ARCH.upper.z+ARCH.upper.depth/2+.08);   // on the roof's front rail
  flag(scene,1.40,ARCH.upperRoof+.165,.2,Math.PI);
  surfboard(scene,-ARCH.ground.width/2,1.45);
  baseballSet(scene,2.15,4.0);
  // Front terrace rail (z 3.23, top bar centre y 5.13): club-coloured scarves, a swag of pennants, three round shields, like a ship's rail.
  const railZ=3.23,railY=ARCH.groundRoof+.81;
  scarf(scene,-3.95,railY,railZ,'#14171f','#f1efe8');scarf(scene,-3.65,railY,railZ,'#c9302c','#14171f');scarf(scene,-3.35,railY,railZ,'#2b4a8c','#8a2f3f');
  bunting(scene,-2.75,-1.05,railY+.0325,railZ+.0325,['#c9302c','#f1efe8','#1d2c55','#e8c26a','#2f9aa1']);
  roundShield(scene,.45,ARCH.groundRoof+.58,railZ+.035,'#b8312b','#efe3c8');roundShield(scene,1.1,ARCH.groundRoof+.58,railZ+.035,'#2b4a8c','#efe3c8');roundShield(scene,1.75,ARCH.groundRoof+.58,railZ+.035,'#2f7d4a','#e8c26a');
  wreath(scene,.06,3.18,3.20);                                                           // on the shop door's top rail
  teaSet(scene,-1.17+.19,8.695,-.30+.10);                                                // roof table
  latticeBoard(scene,2.85,4.893,-1.9,.4);                                                // terrace side table
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
 nameSign(scene);bookCart(scene,hits);noticeboard(building,hits);resumeStand(scene,hits);serviceBack(building,hits);
 endgameExterior(building);
 // Interiors come last so they never shift the random sequence used by the plants and paving above.
 interiors(building);
 endgameInteriors(building);
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
