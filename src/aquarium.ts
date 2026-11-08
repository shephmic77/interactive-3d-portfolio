import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import names from './project-names.json';

/** Procedural reef and animated portfolio creatures for the standalone scene preview. */
type Creature = { key: string; holder: THREE.Group; visual: THREE.Group; anim: (t: number) => void; move: (t: number) => void; hover: number };
type HitTarget = { object: THREE.Object3D; label: string; visual: THREE.Object3D };

// small helpers
// ---------------------------------------------------------------------------------------------
type Geo=THREE.BufferGeometry;
type V3=[number,number,number];
const col=(hex:string)=>new THREE.Color(hex);
const hash=(n:number)=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
const clamp01=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(a:number,b:number,v:number)=>{const t=clamp01((v-a)/(b-a));return t*t*(3-2*t);};
const mix=(a:THREE.Color,b:THREE.Color,t:number)=>a.clone().lerp(b,t);

/** One material for every animal and rock: flat-shaded, vertex-coloured, matte. Double sided so thin fins need no careful winding. */
const bodyMat=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true,side:THREE.DoubleSide});

function finish(g:Geo,colorAt:(x:number,y:number,z:number,face:number)=>THREE.Color){
  if(g.index)g=g.toNonIndexed();
  const pos=g.getAttribute('position');const colors=new Float32Array(pos.count*3);
  for(let t=0;t<pos.count;t+=3){
    const cx=(pos.getX(t)+pos.getX(t+1)+pos.getX(t+2))/3,cy=(pos.getY(t)+pos.getY(t+1)+pos.getY(t+2))/3,cz=(pos.getZ(t)+pos.getZ(t+1)+pos.getZ(t+2))/3;
    const c=colorAt(cx,cy,cz,t/3);
    for(let k=0;k<3;k++){colors[(t+k)*3]=c.r;colors[(t+k)*3+1]=c.g;colors[(t+k)*3+2]=c.b;}
  }
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  g.deleteAttribute('uv');g.computeVertexNormals();return g;
}
const shade=(c:THREE.Color,face:number,amount:number,seedN=0)=>c.clone().multiplyScalar(1+(hash(face*3.17+seedN)-.5)*amount);

interface BlobO{
  s:V3;p?:V3;r?:V3;top:string;belly?:string;bellyAt?:number;detail?:number;kind?:'ico'|'octa'|'tetra'|'box';
  warp?:(v:THREE.Vector3)=>void;jit?:number;seed?:number;color?:(x:number,y:number,z:number,face:number)=>THREE.Color;
}
/** A faceted ellipsoid (or octahedron, tetrahedron, rounded box) with its colours baked in. */
function blob(o:BlobO):Geo{
  let g:Geo;
  if(o.kind==='octa')g=new THREE.OctahedronGeometry(1,o.detail??0);
  else if(o.kind==='tetra')g=new THREE.TetrahedronGeometry(1,o.detail??0);
  else if(o.kind==='box')g=new THREE.BoxGeometry(2,2,2,2,2,2);
  else g=new THREE.IcosahedronGeometry(1,o.detail??1);
  if(g.index)g=g.toNonIndexed();
  const pos=g.getAttribute('position');const v=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(pos,i);
    if(o.kind==='box'){const k=.38;v.multiplyScalar(1-k).addScaledVector(v.clone().normalize(),1.18*k);}
    o.warp?.(v);
    pos.setXYZ(i,v.x,v.y,v.z);
  }
  const top=col(o.top),belly=col(o.belly??o.top),at=o.bellyAt??-.2;
  g=finish(g,(x,y,z,f)=>o.color?o.color(x,y,z,f):shade(top.clone().lerp(belly,1-smooth(at-.13,at+.13,y)),f,o.jit??.085,o.seed??0));
  const m=new THREE.Matrix4().compose(new THREE.Vector3(...(o.p??[0,0,0])),new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.r??[0,0,0]))),new THREE.Vector3(...o.s));
  g.applyMatrix4(m);g.computeVertexNormals();return g;
}
/** A thin triangular fin: three corners and a thickness. */
function fin(a:V3,b:V3,c:V3,hex:string,th=.05,jit=.1):Geo{
  const A=new THREE.Vector3(...a), B=new THREE.Vector3(...b), C=new THREE.Vector3(...c);
  const normal=new THREE.Vector3().crossVectors(B.clone().sub(A),C.clone().sub(A)).normalize();
  const center=A.clone().add(B).add(C).multiplyScalar(1/3);
  const rim:THREE.Vector3[]=[];
  // Sweep the tips and soften the corners while retaining a broad fin root.
  for(const [from,to,bulge] of [[A,B,.11],[B,C,.19],[C,A,.02]] as const){
    const mid=from.clone().lerp(to,.5);
    const control=mid.clone().addScaledVector(mid.clone().sub(center),bulge);
    for(let i=0;i<8;i++){
      const t=.045+.91*i/8;
      rim.push(from.clone().multiplyScalar((1-t)**2).addScaledVector(control,2*t*(1-t)).addScaledVector(to,t*t));
    }
  }
  const crest=center.clone().addScaledVector(normal,th*.60);
  const keel=center.clone().addScaledVector(normal,-th*.40);
  const tris:THREE.Vector3[]=[];
  // An intermediate ring gives each face a curved cross section from root to edge.
  const upperRim=rim.map(point=>center.clone().lerp(point,.58).addScaledVector(normal,th*.49));
  const lowerRim=rim.map(point=>center.clone().lerp(point,.58).addScaledVector(normal,-th*.31));
  for(let i=0;i<rim.length;i++){
    const next=(i+1)%rim.length;
    const p=rim[i],q=rim[next];
    const u=upperRim[i],v=upperRim[next];
    const l=lowerRim[i],m=lowerRim[next];
    tris.push(crest,u,v,u,p,q,u,q,v,keel,m,l,l,q,p,l,m,q);
  }
  const base=col(hex);
  return finish(new THREE.BufferGeometry().setFromPoints(tris),(x,y,z,f)=>{
    const distance=Math.hypot(x-B.x,y-B.y,z-B.z)/Math.max(.01,A.distanceTo(B));
    return shade(base,f,jit*.48,9).multiplyScalar(.86+.24*Math.min(distance,1));
  });
}
/** A cone/spike from a base centre along a direction. */
function spike(c:V3,dir:V3,r:number,len:number,hex:string,seg=4):Geo{
  const g=new THREE.ConeGeometry(r,len,seg,1,true);g.translate(0,len/2,0);
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...dir).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...c),q,new THREE.Vector3(1,1,1)));
  const base=col(hex);return finish(g,(_x,_y,_z,f)=>shade(base,f,.12,4));
}
const merge=(parts:Geo[])=>{const g=mergeGeometries(parts,false)!;g.computeBoundingSphere();return g;};
const piece=(parts:Geo[])=>new THREE.Mesh(merge(parts),bodyMat);
const eyes=(x:number,y:number,z:number,r=.06):Geo[]=>[-1,1].flatMap(side=>[
  blob({s:[r*1.13,r*1.08,r*.60],p:[x,y,z*side],top:'#dcae70',detail:1,jit:.05}),
  blob({s:[r*.75,r*.84,r*.42],p:[x+r*.10,y,(z+r*.36)*side],top:'#101b29',detail:1,jit:.04}),
  blob({s:[r*.23,r*.24,r*.12],p:[x+r*.29,y+r*.34,(z+r*.70)*side],top:'#fff9df',detail:1,jit:0}),
]);
// ---------------------------------------------------------------------------------------------
// creatures. Every builder returns an object facing +x, plus a function that animates it at time t.
// ---------------------------------------------------------------------------------------------
interface Built{root:THREE.Group;anim:(t:number)=>void;}
/** Bend all body and fin vertices in the same space so their roots move together. */
function swimmer(parts:Geo[], frequency:number, amplitude:number):Built{
  const root=new THREE.Group();
  const mesh=piece(parts);
  root.add(mesh);
  const positions=mesh.geometry.getAttribute('position');
  const rest=new Float32Array(positions.array);
  mesh.geometry.computeBoundingBox();
  const {min,max}=mesh.geometry.boundingBox!;
  const length=max.x-min.x;
  mesh.geometry.boundingSphere!.radius+=amplitude*length;
  return {root,anim(t){
    for(let i=0;i<positions.count;i++){
      const along=(max.x-rest[i*3])/length;
      const bend=Math.max(0,(along-.24)/.76);
      positions.setZ(i,rest[i*3+2]+amplitude*length*bend*bend*Math.sin(t*frequency-3*along));
    }
    positions.needsUpdate=true;
  }};
}
/** Pivot groups for flapping fins or flippers; `side` is +1 for the z>0 side. */
function flap(parent:THREE.Object3D,parts:Geo[],at:V3):THREE.Group{const g=new THREE.Group();g.position.set(...at);g.add(piece(parts));parent.add(g);return g;}

type Section = [x:number, height:number, width:number, centerY:number];

function loft(sections: Section[], paint: Parameters<typeof finish>[1], sides=18, maxStep=Infinity):Geo {
  const samples:Section[]=[sections[0]];
  for(let i=1;i<sections.length;i++){
    const from=sections[i-1],to=sections[i];
    const steps=Math.max(1,Math.ceil(Math.abs(to[0]-from[0])/maxStep));
    for(let j=1;j<=steps;j++)samples.push(from.map((value,k)=>THREE.MathUtils.lerp(value,to[k],j/steps)) as Section);
  }
  const rings=samples.map(([x,height,width,centerY])=>
    Array.from({length:sides},(_,i)=>{
      const angle=i/sides*Math.PI*2;
      return new THREE.Vector3(x,centerY+height*Math.cos(angle),width*Math.sin(angle));
    }));
  const faces:THREE.Vector3[]=[];
  for(let i=0;i<rings.length-1;i++){
    for(let j=0;j<sides;j++){
      const k=(j+1)%sides;
      faces.push(rings[i][j],rings[i+1][j],rings[i][k],
        rings[i][k],rings[i+1][j],rings[i+1][k]);
    }
  }
  return finish(new THREE.BufferGeometry().setFromPoints(faces),paint);
}

/** Sculpt a fin from its complete outline, with a raised center and a thin rim. */
function sculptFin(outline: V3[], axis: V3, thickness: number, paint: Parameters<typeof finish>[1]): Geo {
  const rim=outline.map(point=>new THREE.Vector3(...point));
  const center=rim.reduce((sum,point)=>sum.add(point),new THREE.Vector3()).divideScalar(rim.length);
  const normal=new THREE.Vector3(...axis).normalize();
  const winding=rim.reduce((sum,point,i)=>sum.add(point.clone().sub(center).cross(rim[(i+1)%rim.length].clone().sub(center))),new THREE.Vector3());
  if(winding.dot(normal)<0)rim.reverse();
  const top=center.clone().addScaledVector(normal,thickness);
  const bottom=center.clone().addScaledVector(normal,-thickness*.65);
  const ridge=rim.map(point=>center.clone().lerp(point,.56).addScaledVector(normal,thickness*.65));
  const faces:THREE.Vector3[]=[];
  for(let i=0;i<rim.length;i++){
    const j=(i+1)%rim.length;
    faces.push(top,ridge[i],ridge[j],ridge[i],rim[i],rim[j],ridge[i],rim[j],ridge[j],bottom,rim[j],rim[i]);
  }
  return finish(new THREE.BufferGeometry().setFromPoints(faces),paint);
}

const finPaint=(hex:string)=>{const color=col(hex);return (_x:number,_y:number,_z:number,f:number)=>shade(color,f,.10);};

function countershade(top:string, underside:string, belly:number) {
  const back=col(top), pale=col(underside);
  return (_x:number,y:number,_z:number,face:number)=>
    shade(mix(pale,back,smooth(belly-.08,belly+.08,y)),face,.075);
}

function whaleShark():Built {
  const blue='#344e63', ivory='#d6dfd9';
  const profile:Section[]=[
    [2.13,0,0,-.11],[2.08,.16,.48,-.095],[1.93,.31,.65,-.055],
    [1.64,.43,.72,-.015],[1.23,.49,.73,0],[.72,.51,.68,.01],
    [.18,.47,.58,.015],[-.39,.39,.47,.02],[-.91,.3,.36,.025],
    [-1.38,.23,.27,.035],[-1.8,.155,.18,.045],[-2.15,.095,.10,.055],
    [-2.44,.065,.066,.065],[-2.57,0,0,.07],
  ];
  const paint=countershade(blue,ivory,-.16);
  const details:Geo[]=[
    loft(profile,paint,22),
    blob({s:[.065,.058,.48],p:[2.055,-.14,0],top:'#142331',detail:3}),
    blob({s:[.075,.032,.43],p:[2.067,-.192,0],top:ivory,detail:3}),
    ...[-1,1].flatMap(side=>[
      blob({s:[.049,.035,.021],p:[1.94,-.031,side*.642],top:'#101d27',detail:2,jit:.03}),
      blob({s:[.012,.011,.006],p:[1.952,-.018,side*.660],top:'#a6bcc3',detail:1,jit:0}),
    ]),
    sculptFin([[.61,.33,0],[.38,.68,0],[.05,1.05,0],[-.23,1.16,0],[-.31,.91,0],[-.38,.62,0],[-.71,.23,0]],[0,0,1],.064,finPaint(blue)),
    fin([-1.18,.13,0],[-1.64,.49,0],[-1.87,.08,0],blue,.052),
    fin([-2.28,.06,0],[-3.14,1.08,0],[-2.76,.045,0],blue,.08),
    fin([-2.28,.072,0],[-2.94,-.81,0],[-2.76,.085,0],blue,.08),
  ];
  for(const side of [-1,1]){
    details.push(fin([.94,-.19,side*.37],[.05,-.65,side*1.64],[-.43,-.19,side*.30],blue,.11));
    details.push(fin([-.97,-.145,side*.22],[-1.56,-.33,side*.66],[-1.65,-.095,side*.13],blue,.06));
    for(let i=0;i<5;i++){
      const x=1.48-i*.123;
      const width=x>1.23 ? THREE.MathUtils.lerp(.73,.72,(x-1.23)/.41) : THREE.MathUtils.lerp(.68,.73,(x-.72)/.51);
      const gill: THREE.Vector3[]=[];
      for(let j=0;j<=8;j++){
        const t=j/8, angle=side*(1.45+.64*t);
        const sweep=x-.095*Math.sin(t*Math.PI*.65);
        const z=Math.sin(angle)*(width+.004);
        const y=.475*Math.cos(angle);
        gill.push(new THREE.Vector3(sweep-.012*Math.sin(Math.PI*t),y,z),
          new THREE.Vector3(sweep+.012*Math.sin(Math.PI*t),y,z));
      }
      const faces: THREE.Vector3[]=[];
      for(let j=0;j<16;j+=2)faces.push(gill[j],gill[j+1],gill[j+2],gill[j+1],gill[j+3],gill[j+2]);
      details.push(finish(new THREE.BufferGeometry().setFromPoints(faces),()=>col('#283e50')));
    }
  }
  // Place spots against the same sampled surface that defines the body.
  for(let i=1;i<profile.length-2;i++){
    const [x0,h0,w0,y0]=profile[i], [x1,h1,w1,y1]=profile[i+1];
    for(let row=0;row<3;row++){
      const t=(row+.5)/3;
      const x=THREE.MathUtils.lerp(x0,x1,t);
      const height=THREE.MathUtils.lerp(h0,h1,t), width=THREE.MathUtils.lerp(w0,w1,t);
      const y=THREE.MathUtils.lerp(y0,y1,t);
      for(let j=0;j<13;j++){
        const angle=(j-6)*.25+(row%2)*.09;
        const size=(.014+hash(i*47+row*13+j)*.013)*Math.min(1,width/.26);
        details.push(blob({s:[size*1.25,size,size*.32],
          p:[x,y+Math.cos(angle)*height*.994,Math.sin(angle)*width*.994],
          r:[angle-Math.PI/2,0,0],top:'#b7cbd0',detail:0,jit:.08}));
      }
    }
  }
  const root=new THREE.Group();
  const mesh=piece(details);
  root.add(mesh);
  const positions=mesh.geometry.getAttribute('position');
  const rest=new Float32Array(positions.array);
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.boundingSphere!.radius+=.5;
  return {root,anim(t){
    for(let i=0;i<positions.count;i++){
      const x=rest[i*3];
      const bend=Math.max(0,Math.min(1,(.85-x)/4));
      positions.setZ(i,rest[i*3+2]+bend*bend*.38*Math.sin(t*1.85+x*1.08));
    }
    positions.needsUpdate=true;
  }};
}

function turtle():Built {
  const root=new THREE.Group();
  const olive=col('#858d71'), seam=col('#b5b798');
  const rings=[
    [1.23,.79,-.025],[1.25,.83,.105],[1.02,.71,.34],[.57,.43,.60],
  ].map(([length,width,y])=>Array.from({length:8},(_,i)=>{
    const angle=(i+.5)*Math.PI/4, x=Math.cos(angle);
    return new THREE.Vector3(length*x-.10,y,width*Math.sin(angle)*(.96+.12*x));
  }));
  const shellFaces:THREE.Vector3[]=[];
  const shellColors:THREE.Color[]=[];
  function triangle(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,color:THREE.Color){
    shellFaces.push(a,b,c);shellColors.push(color);
  }
  function plate(corners:THREE.Vector3[],color:THREE.Color){
    const center=corners.reduce((sum,v)=>sum.add(v),new THREE.Vector3()).divideScalar(corners.length);
    const inset=corners.map(v=>v.clone().lerp(center,.04));
    const crown=center.clone().add(new THREE.Vector3(0,.016,0));
    for(let i=0;i<corners.length;i++){
      const j=(i+1)%corners.length;
      triangle(crown,inset[j],inset[i],shade(color,i,.10));
      triangle(inset[i],corners[j],corners[i],seam);
      triangle(inset[i],inset[j],corners[j],seam);
    }
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<8;j++){
    const k=(j+1)%8;
    const corners=[rings[i][j],rings[i][k],rings[i+1][k],rings[i+1][j]];
    if(i===0){
      const rim=shade(col('#424f3c'),j,.15);
      triangle(corners[0],corners[2],corners[1],rim);
      triangle(corners[0],corners[3],corners[2],rim);
    }else plate(corners,shade(olive,i*8+j,.32,8));
  }
  plate(rings[3],olive);
  const underside=new THREE.Vector3(-.10,-.24,0);
  for(let j=0;j<8;j++)triangle(underside,rings[0][j],rings[0][(j+1)%8],shade(col('#d9cca5'),j,.15));
  const shell=finish(new THREE.BufferGeometry().setFromPoints(shellFaces),(_x,_y,_z,f)=>shellColors[f]);

  const skin=(x:number,y:number,z:number,f:number)=>{
    const pale=col('#ccc9a4'), green=col('#738261');
    const row=Math.round(y*13);
    const u=x*14+Math.abs(z)*3+(row%2)*.5;
    const tile=Math.abs(u-Math.round(u))<.35&&Math.abs(y*13-row)<.37;
    return shade(y<.12||x<1.16?pale:tile?green:pale,f,.13);
  };
  root.add(piece([
    shell,
    loft([[1.96,0,0,.27],[1.90,.105,.156,.28],[1.76,.185,.22,.285],[1.56,.20,.224,.26],
      [1.38,.145,.173,.17],[1.22,.125,.164,.105],[.98,.14,.17,.055],[.82,0,0,.025]],skin,22,.04),
     ...[-1,1].flatMap(side=>[blob({s:[.061,.057,.026],p:[1.69,.333,side*.211],top:'#202821',detail:2}),blob({s:[.018,.014,.009],p:[1.709,.354,side*.234],top:'#e4e4cf',detail:1})]),
    blob({s:[.18,.012,.022],p:[1.78,.215,.189],r:[0,.39,-.075],top:'#505a47',detail:1}),
    blob({s:[.18,.012,.022],p:[1.78,.215,-.189],r:[0,-.39,-.075],top:'#505a47',detail:1}),
    blob({s:[.25,.075,.095],p:[-1.23,-.11,0],top:'#84906b',detail:1}),
  ]));

  const paddle=(side:number,rear:boolean)=>{
    const outline:V3[]=rear
      ? [[.20,.035,-.16],[.19,.015,.25],[-.04,-.045,.53],[-.24,-.05,.57],[-.39,-.04,.36],[-.30,0,-.14]]
      : [[.22,.04,-.22],[.29,.045,.28],[.20,-.035,.67],[-.07,-.12,1.08],[-.48,-.20,1.44],
        [-.65,-.19,1.54],[-.67,-.13,1.30],[-.56,-.07,.92],[-.40,.02,.57],[-.28,.035,-.21]];
    return sculptFin(outline.map(([x,y,z])=>[x,y,z*side]),[0,1,0],rear?.053:.094,
      (_x,y,z,f)=>shade(col(f%4===3||y<-.07?'#c9c39c':Math.abs(z)<.39?'#697956':'#87946d'),f,.16));
  };
  const fronts=[-1,1].map(side=>flap(root,[paddle(side,false)],[.59,-.078,side*.51]));
  const backs=[-1,1].map(side=>flap(root,[paddle(side,true)],[-.82,-.095,side*.45]));
  return {root,anim(t){
    for(let i=0;i<2;i++){
      const side=i*2-1, stroke=Math.sin(t*1.65);
      fronts[i].rotation.set(side*(-.34+.42*stroke),side*.16*Math.cos(t*1.65),0);
      backs[i].rotation.x=side*.17*Math.sin(t*1.65+1.2);
    }
  }};
}

function mantaRay():Built{
  const root=new THREE.Group();
  const slate='#3e5277', ivory='#e3e9e5';
  const parts:Geo[]=[
    loft([[1.16,.055,.40,-.015],[.99,.11,.52,.015],[.62,.185,.60,.01],
      [.1,.18,.56,0],[-.38,.13,.41,0],[-.78,.07,.21,0],[-1.05,.04,.09,0]],
      countershade(slate,ivory,-.035),18),
    blob({s:[.064,.047,.36],p:[1.155,-.038,0],top:'#172330',detail:1}),
    ...eyes(.94,.065,.515,.038),
    sculptFin([[-.56,.08,0],[-.81,.30,0],[-1.04,.035,0]],[0,0,1],.035,finPaint(slate)),
  ];
  for(const side of [-1,1]){
    parts.push(sculptFin([[.96,-.025,side*.33],[1.12,-.035,side*.57],
      [1.39,-.10,side*.62],[1.65,-.18,side*.44],[1.43,-.16,side*.40],
      [1.15,-.08,side*.39]],[0,1,0],.075,
      (_x,_y,_z,f)=>shade(col(f%4===3?ivory:slate),f,.09)));
  }
  root.add(piece(parts));

  const tail=swimmer([loft([[-.81,.055,.08,0],[-1.14,.047,.06,0],
    [-1.65,.033,.039,0],[-2.19,.02,.026,.01],[-2.79,.011,.014,.04],
    [-3.27,0,0,.10]],finPaint('#344561'),10)],1.65,.09);
  root.add(tail.root);

  const wings=[1,-1].map(side=>flap(root,[
    sculptFin([[1.01,.015,side*.27],[.82,.03,side*.66],[.60,.046,side*1.06],
      [.24,.07,side*1.56],[-.22,.12,side*2.04],[-.77,.28,side*2.58],
      [-.74,.10,side*2.03],[-.58,.01,side*1.52],[-.61,-.025,side*1.02],
      [-.79,-.036,side*.65],[-.98,-.025,side*.22]], [0,1,0],.105,
      (_x,_y,z,f)=>shade(col(f%4===3?ivory:Math.abs(z)>2?'#2b3d5e':slate),f,.15)),
  ],[0,0,0]));
  return {root,anim:(t)=>{
    const stroke=.31*Math.sin(t*1.4);
    wings[0].rotation.x=-stroke;
    wings[1].rotation.x=stroke;
    tail.anim(t);
  }};
}

function submarine():Built{
  const root=new THREE.Group();
  const yellow='#edbb3d', brass='#a78447', glass='#63a8cf';
  const parts:Geo[]=[
    loft([[1.58,0,0,.03],[1.48,.39,.35,.03],[1.22,.59,.56,.02],
      [.76,.65,.62,0],[.18,.64,.61,0],[-.40,.55,.53,0],[-.92,.39,.39,0],
      [-1.28,.23,.24,.02],[-1.50,.15,.15,.02]],(x,y,_z,f)=>
        shade(col(x>1.24?glass:y<-.27?'#bf8a27':yellow),f,.15),14),
    finish(new THREE.CylinderGeometry(.32,.46,.32,10).translate(.18,.66,0),finPaint(yellow)),
    finish(new THREE.CylinderGeometry(.066,.066,.37,8).translate(.18,.98,0),finPaint('#d27638')),
    finish(new THREE.CylinderGeometry(.079,.079,.23,8).rotateZ(Math.PI/2).translate(.25,1.16,0),finPaint('#d27638')),
    fin([-1.01,.24,0],[-1.43,.61,0],[-1.52,.16,0],'#c76832',.049),
  ];
  for(const side of [-1,1]){
    for(const [x,z] of [[.68,.591],[-.04,.587]]){
      const radius=x>0?.235:.179;
      parts.push(finish(new THREE.TorusGeometry(radius,.045,5,12).translate(x,.045,side*z),finPaint(brass)),
        blob({s:[radius*.89,radius*.89,.075],p:[x,.045,side*z],top:glass,belly:'#3c719e',detail:1}));
    }
    parts.push(fin([-1.07,0,side*.23],[-1.43,.035,side*.68],[-1.56,0,side*.16],'#c76832',.06));
  }
  root.add(piece(parts));
  const propeller=flap(root,Array.from({length:3},(_,i)=>
    fin([0,.02,0],[0,.26,.11],[0,.33,-.04],'#a76b35',.035).rotateX(i*Math.PI*2/3)),[-1.56,0,0]);
  return {root,anim(t){
    propeller.rotation.x=t*10;
    root.rotation.x=.095*Math.sin(t*1.4);
    root.rotation.z=.045*Math.sin(t*1.1);
  }};
}

function mahi():Built{
  const teal=col('#259786'), gold=col('#dfc45e'), blue=col('#245e92');
  const parts:Geo[]=[
    loft([[1.33,.04,.07,-.055],[1.27,.18,.14,-.01],[1.15,.30,.19,.05],
      [1.00,.38,.22,.077],[.78,.43,.245,.056],[.54,.44,.25,.024],
      [.29,.415,.245,.007],[.02,.37,.23,0],[-.24,.33,.207,0],
      [-.51,.28,.181,0],[-.75,.232,.155,0],[-1.00,.182,.125,0],
      [-1.25,.129,.092,0],[-1.48,.081,.07,0],[-1.75,.055,.053,0],
      [-1.90,.045,.044,0]],(x,y,z,f)=>{
        const flank=mix(gold,teal,smooth(-.26,.18,y));
        const back=mix(flank,blue,smooth(.17,.42,y)*.72);
        const fleck=Math.abs(z)>.12 && Math.sin(x*38+y*17)*Math.cos(y*38)>.69;
        return shade(fleck?mix(back,blue,.65):back,f,.16);
      },20),
    ...eyes(1.11,.11,.174,.054),
    blob({s:[.074,.018,.081],p:[1.281,-.082,0],top:'#34584d',detail:1}),
    sculptFin([[1.04,.34,0],[.99,.57,0],[.86,.72,0],[.62,.70,0],
      [.36,.64,0],[.07,.57,0],[-.22,.47,0],[-.52,.40,0],[-.85,.32,0],
      [-1.16,.24,0],[-1.48,.14,0],[-1.61,.057,0],[-.80,.19,0],
      [-.24,.29,0],[.44,.39,0]],[0,0,1],.032,
      (x,y,_z,f)=>shade(mix(blue,col('#53a3b4'),smooth(-.3,.7,Math.cos(x*29-y*13))*.48),f,.13)),
    sculptFin([[-.38,-.25,0],[-.55,-.41,0],[-.87,-.36,0],[-1.23,-.23,0],
      [-1.62,-.066,0],[-1.00,-.135,0]],[0,0,1],.027,finPaint('#c9b658')),
    sculptFin([[-1.78,.04,0],[-2.02,.38,0],[-2.54,.68,0],[-2.34,.36,0],
      [-2.19,0,0],[-2.34,-.34,0],[-2.51,-.65,0],[-2.01,-.36,0],
      [-1.78,-.04,0]],[0,0,1],.047,finPaint('#d0bd59')),
  ];
  for(const side of [-1,1]){
    parts.push(sculptFin([[.66,-.09,side*.207],[.49,-.13,side*.29],
      [-.07,-.31,side*.43],[.13,-.29,side*.28],[.42,-.20,side*.18]],
      [0,1,0],.033,finPaint('#529c85')));
    parts.push(fin([.38,-.26,side*.11],[-.05,-.50,side*.20],[-.03,-.29,side*.11],'#d2b75e',.022));
  }
  return swimmer(parts,3.2,.15);
}

function cowfish():Built{
  const gold='#d6aa3f', pale='#f5d97d', blue='#a7b5a5';
  const shell=loft([[1.03,.19,.20,-.04],[.88,.41,.32,.02],[.63,.51,.42,.02],
    [.29,.49,.43,0],[-.07,.39,.35,0],[-.43,.27,.25,0],[-.71,.14,.15,0],
    [-.95,.064,.075,0],[-1.13,.054,.061,0]],(x,y,z,f)=>{
      const scales=Math.cos(x*30+y*10)*Math.cos(y*31-z*11)>.65;
      return shade(col(y<-.27?'#9d793b':scales?blue:gold),f,.19);
    },10,.09);
  const parts:Geo[]=[shell,...eyes(.78,.20,.31,.074),
    blob({s:[.10,.060,.105],p:[1.04,-.125,0],top:pale,detail:1}),
    blob({s:[.038,.018,.062],p:[1.125,-.125,0],top:'#5f4b34',detail:1}),
    sculptFin([[-.44,.21,0],[-.60,.43,0],[-.78,.39,0],[-.91,.11,0]],
      [0,0,1],.026,finPaint(pale)),
    sculptFin([[-.61,-.12,0],[-.81,-.32,0],[-.94,-.22,0],[-1.00,-.05,0]],
      [0,0,1],.025,finPaint(gold)),
    sculptFin([[-1.08,.04,0],[-1.48,.25,0],[-1.63,.20,0],[-1.68,0,0],
      [-1.63,-.20,0],[-1.49,-.25,0],[-1.08,-.04,0]],[0,0,1],.033,
      (x,y,_z,f)=>shade(col(Math.cos(Math.atan2(y,-x-1.02)*37)>.36?gold:pale),f,.13)),
  ];
  for(const side of [-1,1]){
    parts.push(spike([.72,.39,side*.25],[.88,.34,side*.22],.103,.79,pale,6),
      spike([-.49,-.17,side*.13],[-.86,-.32,side*.27],.079,.44,gold,6),
      sculptFin([[.40,-.08,side*.38],[.19,.04,side*.50],[-.19,.18,side*.64],
        [-.23,-.04,side*.57],[-.08,-.19,side*.49],[.26,-.17,side*.38]],
        [0,1,0],.031,finPaint(pale)));
  }
  return swimmer(parts,4,.105);
}

function lionfish():Built{
  const root=new THREE.Group();
  const cream='#f1dcc2', rust='#a94430', amber='#d88658';
  const stripe=(x:number,y:number,z:number,f:number)=>{
    const band=Math.cos((x+.20*y+.20*y*y+.09*Math.abs(z))*24);
    return shade(col(band>.16?rust:cream),f,.13,14);
  };
  const spotted=(_x:number,y:number,z:number,f:number)=>
    shade(col(Math.cos(y*37)*Math.cos(z*31+y*8)>.63?rust:amber),f,.17);
  const parts:Geo[]=[
    loft([[1.29,.035,.063,-.06],[1.18,.16,.15,-.075],[1.03,.22,.223,-.033],
      [.87,.34,.27,.016],[.65,.39,.314,.029],[.40,.375,.313,.015],
      [.13,.336,.272,0],[-.16,.275,.211,0],[-.41,.211,.147,0],
      [-.67,.116,.101,0],[-.88,.071,.064,0],[-1.01,.06,.053,0]],stripe,18,.055),
    ...eyes(.96,.15,.225,.056),
    blob({s:[.063,.025,.10],p:[1.232,-.112,0],top:'#713e35',detail:1}),
    sculptFin([[-.91,.055,0],[-1.23,.25,0],[-1.48,.36,0],[-1.58,.21,0],
      [-1.61,-.04,0],[-1.54,-.29,0],[-1.43,-.34,0],[-1.19,-.20,0],
      [-.91,-.055,0]],[0,0,1],.032,spotted),
    sculptFin([[-.39,.16,0],[-.65,.49,0],[-.90,.45,0],[-1.02,.24,0],
      [-.86,.066,0]],[0,0,1],.026,spotted),
    sculptFin([[-.29,-.19,0],[-.55,-.49,0],[-.80,-.46,0],[-.95,-.22,0],
      [-.84,-.068,0]],[0,0,1],.026,spotted),
  ];
  for(let i=0;i<10;i++){
    const x=.68-i*.128;
    const y=.383-.0017*i*i;
    const height=.39+.54*Math.sin(Math.PI*(i+.65)/11.3);
    const sweep=.09+.035*i;
    parts.push(sculptFin([[x+.048,y-.043,0],[x+.014-sweep*.39,y+height*.42,0],
      [x-sweep,y+height,0],[x-sweep-.074,y+height*.78,0],
      [x-.075-sweep*.40,y+height*.38,0],[x-.072,y-.044,0]],
      [0,0,1],.019,(_x,py,_z,f)=>shade(col(Math.cos((py-y)*35)>.17?cream:rust),f,.11)));
  }
  for(const side of [-1,1]){
    parts.push(sculptFin([[.96,.20,side*.20],[1.07,.38,side*.24],[1.19,.54,side*.29],
      [1.21,.39,side*.29],[1.04,.23,side*.25]],[0,0,1],.018,finPaint(amber)));
  }
  root.add(piece(parts));

  const fans=[1,-1].map(side=>{
    const rays:V3[]=[[.21,.42,side*.69],[.02,.48,side*.91],[-.23,.45,side*1.13],
      [-.53,.32,side*1.25],[-.79,.12,side*1.18],[-.89,-.09,side*.98],
      [-.81,-.31,side*.77],[-.62,-.46,side*.57],[-.37,-.45,side*.34]];
    const scallops=rays.flatMap((tip,i)=>{
      if(i===rays.length-1)return [tip];
      const next=rays[i+1];
      const notch:V3=[(tip[0]+next[0])*.45,(tip[1]+next[1])*.45,(tip[2]+next[2])*.45];
      return [tip,notch];
    });
    const web=sculptFin([[.03,-.035,-side*.07],...scallops], [0,1,0],.041,
      (x,y,z,f)=>shade(col(Math.cos(Math.hypot(x,y,z)*24)>.21?cream:amber),f,.19));
    const ribs=rays.map(([x,y,z])=>spike([0,.016,0],[x,y,z],.014,Math.hypot(x,y,z),cream,5));
    return flap(root,[web,...ribs],[.35,-.06,side*.25]);
  });
  return {root,anim(t){
    const stroke=.20*Math.sin(t*2.45);
    fans[0].rotation.x=-stroke;
    fans[1].rotation.x=stroke;
    root.rotation.y=.065*Math.sin(t*1.8);
  }};
}

function triggerfish():Built{
  const c=(x:number,y:number,z:number,f:number)=>{
    const row=Math.round((y+.54)/.205);
    const spotX=(x+.66)/.224-(row%2)*.5;
    const spot=Math.hypot((spotX-Math.round(spotX))/.38,(y+.54-row*.205)/.087)<1;
    const mask=x>.68 && Math.abs(y-.19+x*.05)<.051;
    const crown=y>.29 && Math.cos(x*45)*Math.cos(z*48+y*21)>.27;
    return shade(col(mask?'#e8e7c0':spot&&y<.11&&x<.65?'#cedfe4':
      crown?'#a5ae79':y>.16?'#334969':'#1a263e'),f,.11);
  };
  const front:Geo[]=[
    loft([[1.04,0,0,-.12],[.91,.17,.13,-.10],[.73,.37,.20,-.035],[.43,.55,.27,0],[.05,.61,.29,0],[-.33,.5,.24,0],[-.59,.33,.18,0],[-.83,.12,.09,0],[-.89,0,0,0]],c,22,.043),
    blob({s:[.098,.088,.101],p:[1.005,-.129,0],top:'#edc541',detail:2}),
    blob({s:[.030,.017,.067],p:[1.083,-.14,0],top:'#242532',detail:1}),
    sculptFin([[.54,.40,0],[.39,.80,0],[.27,.68,0],[.22,.45,0]],
      [0,0,1],.025,finPaint('#605072')),
    ...eyes(.6,.25,.2,.06),
    sculptFin([[.38,.36,0],[.09,.64,0],[-.21,.84,0],[-.41,.72,0],[-.61,.41,0],[-.53,.23,0],[-.12,.36,0]],[0,0,1],.032,(_x,y,_z,f)=>shade(col(y>.68?'#a35e98':'#b4c6d7'),f,.14)),
    sculptFin([[.16,-.40,0],[-.23,-.68,0],[-.43,-.76,0],[-.62,-.51,0],[-.73,-.23,0],[-.28,-.31,0]],[0,0,1],.027,(_x,y,_z,f)=>shade(col(y<-.59?'#a35e98':'#b4c6d7'),f,.14)),
    fin([.25,-.05,.22],[0,-.3,.55],[-.2,-.05,.20],'#a9bac5',.03),fin([.25,-.05,-.22],[0,-.3,-.55],[-.2,-.05,-.20],'#a9bac5',.03),
  ];
  const tail:Geo[]=[sculptFin([[-.73,.055,0],[-1.22,.29,0],[-1.45,.29,0],[-1.49,.12,0],[-1.49,-.13,0],[-1.42,-.28,0],[-1.22,-.27,0],[-.73,-.055,0]],[0,0,1],.04,(x,_y,_z,f)=>shade(col(x<-1.42?'#423353':x>-.97?'#29364e':'#b4a3bc'),f,.15))];
  return swimmer([...front,...tail],3,.15);
}

function butterflyfish():Built{
  const yellow='#f6d33b', ink='#332748', white='#f4f2eb';
  const skin=(x:number,y:number,_z:number,f:number)=>{
    const face=x>.56+y*.29;
    return shade(col(face?(y<-.065-x*.035?white:ink):yellow),f,.16);
  };
  const parts:Geo[]=[
    loft([[1.43,.018,.03,-.13],[1.18,.037,.049,-.14],[.91,.075,.083,-.14],
      [.73,.18,.128,-.093],[.55,.38,.174,-.02],[.30,.54,.205,0],[.03,.60,.213,0],
      [-.24,.55,.185,0],[-.48,.40,.143,0],[-.69,.205,.098,0],[-.85,.072,.065,0]],
      skin,16,.08),
    ...eyes(.68,.005,.133,.043),
    sculptFin([[.52,.33,0],[.37,.60,0],[.23,.75,0],[.08,.80,0],[-.11,.80,0],
      [-.29,.76,0],[-.51,.68,0],[-.62,.52,0],[-.70,.24,0],[-.36,.34,0]],
      [0,0,1],.037,(x,y,_z,f)=>shade(col(Math.cos(x*47+y*21)>.79?'#dbad2d':yellow),f,.15)),
    sculptFin([[.24,-.44,0],[-.08,-.63,0],[-.38,-.70,0],[-.56,-.62,0],
      [-.69,-.36,0],[-.73,-.12,0],[-.39,-.34,0]],[0,0,1],.035,finPaint(yellow)),
    sculptFin([[-.79,.04,0],[-1.17,.25,0],[-1.25,.18,0],[-1.26,-.17,0],
      [-1.16,-.23,0],[-.79,-.04,0]],[0,0,1],.026,
      (x,_y,_z,f)=>shade(col(x<-1.12?ink:white),f,.14)),
  ];
  for(const side of [-1,1]){
    parts.push(fin([.30,-.15,side*.18],[-.04,-.32,side*.34],[-.11,-.13,side*.19],'#e5bf34',.028));
    parts.push(blob({s:[.063,.068,.021],p:[-.58,-.27,side*.094],top:ink,detail:1}));
  }
  return swimmer(parts,3.4,.14);
}

function dumbo():Built{
  const root=new THREE.Group();
  const body=new THREE.Group();
  root.add(body);
  const orange='#dc8a50', cream='#efad70';
  body.add(piece([
    loft([[.77,0,0,0],[.67,.34,.33,0],[.48,.52,.48,0],
      [.22,.62,.56,-.015],[-.05,.58,.54,0],[-.28,.48,.46,0],
      [-.46,.38,.38,0],[-.58,.25,.25,0],[-.62,0,0,0]],
      (x,_y,_z,f)=>shade(mix(col(orange),col(cream),smooth(-.65,.77,x)),f,.18),12)
      .rotateZ(Math.PI/2),
    ...eyes(.49,.06,.30,.090),
  ]));
  const ears=[1,-1].map(side=>flap(body,[
    sculptFin([[.18,-.08,-side*.10],[.20,.09,side*.13],
      [.06,.34,side*.44],[-.20,.28,side*.40],[-.33,.13,side*.22],
      [-.20,-.10,-side*.06]],[0,1,0],.07,finPaint('#d28249')),
  ],[-.13,.23,side*.44]));
  const arms=Array.from({length:8},(_,i)=>{
    const angle=i*Math.PI/4;
    return arm(body,[Math.cos(angle)*.29,-.41,Math.sin(angle)*.29],-angle,
      .19+(i%3)*.018,.123,i%2?orange:'#e39859',angle,2.12+.22*(i%3));
  });
  return {root,anim(t){
    const stroke=.48*Math.sin(t*2.5);
    ears.forEach((ear,i)=>{ear.rotation.x=(i*2-1)*stroke;});
    arms.forEach(move=>move(t*.72));
    body.scale.set(1,1+.065*Math.sin(t*1.5),1);
    body.position.y=.05*Math.sin(t*1.5+1);
  }};
}

function clownfish():Built{
  const paint=(x:number,y:number,_z:number,f:number)=>{
    const band=Math.min(Math.abs(x-.32),Math.abs(x+.15-y*.19),Math.abs(x+.55));
    return shade(col(band<.065?'#fff4e6':band<.09?'#3c2a2c':'#ff761c'),f,.08);
  };
  const profile:Section[]=[[.68,0,0,0],[.6,.14,.115,0],[.47,.24,.17,0],[.36,.29,.20,0],[.28,.31,.21,0],[.16,.325,.215,0],[-.07,.30,.19,0],[-.15,.28,.18,0],[-.24,.26,.16,0],[-.43,.19,.12,0],[-.51,.13,.085,0],[-.58,.07,.06,0],[-.65,0,0,0]];
  const finColor=(edge:number,below=false)=>(_x:number,y:number,_z:number,f:number)=>
    shade(col((below?y<edge:y>edge)?'#282a34':'#f47a20'),f,.19);
  const front:Geo[]=[
    loft(profile,paint,16,.048),
    ...eyes(.46,.1,.14,.045),
    blob({s:[.039,.018,.075],p:[.625,-.059,0],top:'#6e3429',detail:1}),
    sculptFin([[.28,.245,0],[.23,.43,0],[.13,.49,0],[.01,.46,0],
      [-.06,.36,0],[-.09,.26,0]],[0,0,1],.032,finColor(.431)),
    sculptFin([[-.14,.23,0],[-.23,.37,0],[-.34,.38,0],[-.43,.28,0],
      [-.46,.15,0]],[0,0,1],.027,finColor(.327)),
    ...[-1,1].map(side=>sculptFin([[.15,-.11,side*.17],[.05,-.093,side*.28],
      [-.10,-.15,side*.39],[-.17,-.26,side*.36],[-.09,-.32,side*.28],
      [.05,-.26,side*.18]],[0,1,0],.03,
      (_x,y,z,f)=>shade(col(Math.abs(z)>.34||y<-.27?'#282a34':'#ee6c1d'),f,.17))),
  ];
  const tail:Geo[]=[sculptFin([[-.53,.035,0],[-.79,.235,0],[-.94,.255,0],[-1.04,.18,0],[-1.08,0,0],
    [-1.04,-.16,0],[-.94,-.24,0],[-.78,-.21,0],[-.53,-.04,0]],[0,0,1],.027,
    (x,_y,_z,f)=>shade(col(x<-.99||Math.abs(_y)>.207?'#282a34':'#ff7a1a'),f,.10))];
  return swimmer([...front,...tail],4,.15);
}

function sardine():Built{
  const front:Geo[]=[
    loft([[.58,0,0,0],[.47,.11,.075,0],[.31,.153,.112,0],[.06,.16,.116,0],[-.19,.134,.095,0],[-.39,.082,.061,0],[-.55,.045,.035,0],[-.61,0,0,0]],(x,y,z,f)=>{
      const silver=col('#c3d7d5'), slate=col('#506b80');
      const sheen=smooth(-.025,.125,y)*.74;
      const fleck=Math.sin(x*58+y*22)*Math.cos(y*52+z*17)>.48;
      return shade(mix(silver,slate,sheen+(fleck?.13:0)),f,.15);
    },14,.085),...eyes(.4,.04,.081,.039),
    sculptFin([[.09,.12,0],[.02,.24,0],[-.07,.28,0],[-.23,.20,0],[-.37,.075,0]],[0,0,1],.015,finPaint('#668590')),
    ...[-1,1].map(side=>fin([.23,-.05,side*.072],[.02,-.125,side*.17],[-.10,-.055,side*.082],'#99bccb',.013)),
  ];
  const tail:Geo[]=[blob({s:[.14,.06,.06],p:[-.62,0,0],top:'#8aaed0',detail:1}),fin([-.59,.01,0],[-.99,.18,0],[-.86,.015,0],'#8aaed0',.02),fin([-.59,-.01,0],[-.98,-.17,0],[-.86,.015,0],'#8aaed0',.02)];
  return swimmer([...front,...tail],8,.24);
}

function sailfish():Built {
  const blue='#3e608c', silver='#d2e2e1', dark='#284266';
  const outline:V3[]=[[.65,.16,0],[.58,.96,0],[.38,1.10,0],[.19,1.04,0],
    [-.03,1.21,0],[-.24,1.16,0],[-.46,1.26,0],[-.67,1.09,0],
    [-.86,.84,0],[-1.03,.53,0],[-1.15,.09,0]];
  const sail=sculptFin([...outline,[-.81,.11,0],[-.27,.18,0],[.29,.19,0]],
    [0,0,1],.045,(x,y,_z,f)=>{
      const spread=Math.atan2(x+.49,y-.13);
      const rib=Math.cos(spread*28)>.44;
      const spot=Math.cos(spread*35)*Math.cos(y*40)>.73;
      return shade(col(spot?dark:rib?'#6484a9':blue),f,.14);
    });
  const parts:Geo[]=[
    loft([[2.24,0,0,.11],[1.75,.02,.021,.073],[1.27,.044,.051,.031],
      [.97,.125,.112,.015],[.73,.21,.165,.008],[.39,.249,.213,0],
      [-.07,.233,.203,0],[-.52,.181,.158,0],[-.91,.106,.091,0],
      [-1.26,.064,.061,0],[-1.51,.045,.045,0]],countershade(blue,silver,-.045),14),
    sculptFin([[1.38,-.06,0],[.96,-.02,0],[.69,-.14,0],[.96,-.13,0]],
      [0,0,1],.056,finPaint(silver)),
    ...eyes(.83,.075,.143,.045),
    sail,
    sculptFin([[-1.43,.06,0],[-1.64,.37,0],[-2.05,.68,0],
      [-1.85,.30,0],[-1.73,.015,0],[-1.84,-.27,0],[-2.01,-.62,0],
      [-1.65,-.35,0],[-1.43,-.06,0]],[0,0,1],.043,finPaint(dark)),
    fin([-.55,-.11,0],[-.91,-.39,0],[-1.0,-.08,0],blue,.032),
  ];
  for(const side of [-1,1]){
    parts.push(sculptFin([[.44,-.095,side*.16],[.19,-.17,side*.31],
      [-.46,-.39,side*.58],[-.11,-.24,side*.23],[.25,-.16,side*.14]],
      [0,1,0],.032,finPaint(blue)));
    parts.push(fin([.31,-.18,side*.071],[-.16,-.59,side*.18],
      [.18,-.18,side*.103],dark,.015));
  }
  return swimmer(parts,3.4,.10);
}

function napoleonWrasse():Built{
  const cobalt=col('#376e9e'), teal=col('#469b97'), pale=col('#8dc1be'), ink=col('#245b70');
  const body=loft([[1.66,.095,.16,-.25],[1.51,.25,.29,-.18],[1.34,.36,.36,-.096],
    [1.17,.54,.40,.04],[1.00,.69,.44,.145],[.79,.74,.48,.17],[.51,.72,.51,.13],
    [.22,.68,.53,.065],[-.09,.62,.50,.015],[-.39,.54,.43,-.01],[-.68,.43,.34,-.035],
    [-.95,.30,.245,-.05],[-1.18,.19,.165,-.05],[-1.40,.127,.118,-.04],
    [-1.54,.116,.105,-.04]],(x,y,z,f)=>{
      const head=smooth(.32,1.26,x);
      const flank=mix(teal,pale,(1-smooth(-.48,.23,y))*.53);
      const skin=mix(flank,cobalt,head*.81);
      const scales=Math.cos(x*31+Math.cos(y*18)*.7);
      const cheek=Math.cos(y*26+x*8+2*Math.sin(x*13));
      const mark=Math.max(smooth(.64,.98,scales)*(1-head),
        smooth(.72,.98,cheek)*head*.62)*smooth(.14,.34,Math.abs(z));
      return shade(mix(skin,ink,mark*.48),f,.17);
    },18,.085);
  const finPainted=(x:number,y:number,_z:number,f:number)=>
    shade(mix(cobalt,teal,.43+.24*Math.cos(x*24-y*19)),f,.16);
  const fish=swimmer([
    body, ...eyes(1.07,.36,.399,.065),
    blob({s:[.192,.058,.171],p:[1.57,-.26,0],top:'#244961',detail:1}),
    blob({s:[.185,.090,.171],p:[1.59,-.205,0],top:'#6196b4',detail:2}),
    blob({s:[.165,.087,.162],p:[1.61,-.309,0],top:'#78a8b6',detail:2}),
    sculptFin([[.68,.79,0],[.45,.91,0],[.10,.89,0],[-.32,.80,0],
      [-.69,.68,0],[-1.00,.52,0],[-1.35,.38,0],[-1.46,.29,0],
      [-1.29,.15,0],[-.88,.25,0],[-.45,.40,0],[-.03,.58,0],[.41,.69,0]],
      [0,0,1],.034,finPainted),
    sculptFin([[.22,-.53,0],[-.19,-.67,0],[-.60,-.67,0],[-1.07,-.51,0],
      [-1.38,-.39,0],[-1.19,-.26,0],[-.91,-.24,0],[-.44,-.41,0]],
      [0,0,1],.032,finPainted),
    sculptFin([[-1.45,.064,0],[-1.72,.20,0],[-1.98,.34,0],[-2.13,.31,0],
      [-2.20,.16,0],[-2.22,-.05,0],[-2.18,-.26,0],[-2.06,-.40,0],
      [-1.90,-.39,0],[-1.68,-.24,0],[-1.45,-.14,0]],
      [0,0,1],.057,(x,y,_z,f)=>shade(mix(cobalt,teal,.35+.20*Math.cos(Math.atan2(y+.04,-x-1.40)*29)),f,.17)),
    ...[-1,1].map(side=>fin([.61,-.48,side*.17],[.10,-.74,side*.32],
      [.15,-.51,side*.18],'#3f878d',.036)),
  ],2.3,.092);
  const fins=[-1,1].map(side=>flap(fish.root,[
    sculptFin([[.055,.034,-side*.044],[-.18,.13,side*.12],[-.46,.09,side*.25],
      [-.62,-.04,side*.30],[-.54,-.20,side*.25],[-.33,-.24,side*.16],[-.10,-.12,side*.036]],
      [0,1,0],.042,finPainted),
  ],[.61,-.14,side*.426]));
  return {root:fish.root,anim(t){
    fish.anim(t);
    fins.forEach((fin,i)=>{fin.rotation.y=(i*2-1)*.25*Math.sin(t*2.65+i*.65);});
  }};
}

function manatee(): Built {
  const grey='#807c71', underside='#555851';
  const root=new THREE.Group();
  const skin=countershade(grey,underside,-.27);
  const muzzle='#928c7c';
  const features:Geo[]=[
    loft([[1.79,.06,.14,-.14],[1.73,.28,.34,-.065],[1.56,.45,.46,.055],
      [1.27,.61,.56,.11],[.88,.75,.71,.13],[.38,.87,.81,.12],[-.24,.92,.84,.08],
      [-.73,.85,.77,.03],[-1.16,.66,.59,-.05],[-1.48,.37,.36,-.11],
      [-1.68,.16,.20,-.14],[-1.82,0,0,-.15]],skin,14),
    blob({s:[.10,.024,.275],p:[1.73,-.305,0],top:'#50574f',detail:2}),
  ];
  for(const side of [-1,1]){
    features.push(
      blob({s:[.252,.187,.219],p:[1.68,-.186,side*.147],top:muzzle,detail:2,
        color:(x,y,z,f)=>shade(col(x>.56&&Math.cos(y*36+z*14)*Math.sin(z*32)>.73?'#6d7069':muzzle),f,.09)}),
      blob({s:[.027,.024,.018],p:[1.861,-.080,side*.155],top:'#3c423e',detail:1}),
      blob({s:[.063,.055,.037],p:[1.49,.226,side*.433],top:'#252c29',detail:2}),
      blob({s:[.016,.013,.009],p:[1.508,.248,side*.466],top:'#b2b6a7',detail:1}),
    );
  }
  for(const side of [-1,1]){
    for(let i=0;i<10;i++){
      const row=Math.floor(i/5), column=i%5;
      const x=1.83-column*.025, y=-.15-row*.073-column*.011;
      const z=side*(.254+column*.019);
      features.push(spike([x,y,z],[.64,-.12-row*.31,side*.67],
        .008,.062+.035*hash(i*13+side),'#a59a84',4));
    }
  }
  root.add(piece(features));
  const tail=flap(root,[
    sculptFin([[.22,.07,-.13],[-.15,.025,-.22],[-.51,-.015,-.42],[-.85,-.055,-.61],
      [-1.10,-.075,-.56],[-1.27,-.085,-.28],[-1.32,-.095,0],[-1.27,-.085,.28],
      [-1.10,-.075,.56],[-.85,-.055,.61],[-.51,-.015,.42],[-.15,.025,.22],[.22,.07,.13]],
      [0,1,0],.12,skin),
  ],[-1.53,-.14,0]);
  const paddles=[-1,1].map(side=>flap(root,[
    sculptFin([[.23,.16,-side*.14],[.27,-.14,side*.04],[.13,-.44,side*.17],
      [-.04,-.76,side*.24],[-.23,-.89,side*.26],[-.44,-.80,side*.23],
      [-.44,-.49,side*.14],[-.32,-.14,-side*.045],[-.19,.13,-side*.14]],
      [0,0,side],.091,skin),
  ],[.77,-.32,side*.47]));
  return {root,anim(t){
    tail.rotation.z=.19*Math.sin(t*1.55);
    paddles.forEach((p,i)=>{
      p.rotation.x=(i*2-1)*.19*Math.sin(t*1.55+.8);
      p.rotation.z=.16*Math.sin(t*1.55+i*.6);
    });
  }};
}

/** One continuous tapered arm, bent by a traveling wave. */
function arm(parent: THREE.Group, origin: V3, direction: number, length: number, width: number, color: string, phase: number, curl = 0, stroke = 0) {
  const reach=length*4;
  const sections:Section[]=Array.from({length:13},(_,i)=>{
    const u=i/12, radius=width*(1-u)**.76;
    return [-reach*u,radius,radius,0];
  });
  const geometry=loft(sections,(x,y,_z,f)=>shade(col(color),f,.13).multiplyScalar(1+.13*y/width+.06*x/reach),8);
  geometry.rotateZ(Math.PI/2);
  const mesh=piece([geometry]);
  mesh.position.set(...origin);
  mesh.rotation.y=direction;
  parent.add(mesh);
  const position=mesh.geometry.getAttribute('position');
  const rest=new Float32Array(position.array);
  mesh.geometry.boundingSphere!.radius+=reach*(stroke ? .9 : .5);
  return (t:number)=>{
    for(let i=0;i<position.count;i++){
      const u=Math.max(0,-rest[i*3+1]/reach);
      const wave=.23+.19*Math.sin(t*2.1+phase-u*4);
      const bend=(curl+.83*Math.sin(t*2.8+phase-u*3.6)*u)*u;
      const spread=reach*u*u*wave;
      if(stroke){
        // The tips respond later than the roots as the squid accelerates.
        const jet=smooth(-.3,.9,Math.sin(t*2-u*.82));
        const angle=THREE.MathUtils.lerp(curl,.09,jet);
        const radius=reach/angle;
        const edge=radius-rest[i*3];
        position.setXYZ(i,radius-edge*Math.cos(angle*u),-edge*Math.sin(angle*u),
          rest[i*3+2]+reach*stroke*u*u*(1-.72*jet)*Math.sin(t*2+phase-u*2.6));
      }else if(curl){
        const radius=reach/curl;
        const edge=radius-rest[i*3];
        position.setXY(i,radius-edge*Math.cos(bend)+spread*.30,
          -edge*Math.sin(bend));
      }else{
        position.setX(i,rest[i*3]+spread);
      }
    }
    position.needsUpdate=true;
  };
}

function jelly(): Built {
  const root = new THREE.Group();
  const bell = new THREE.Group();
  root.add(bell);
  const deep=col('#5764aa'), ice=col('#a7e7f4');
  const canopy=loft([[.77,0,0,0],[.69,.35,.35,0],[.49,.65,.65,0],
    [.21,.80,.80,0],[.03,.79,.79,0],[-.055,.69,.69,0]],
    (x,_y,_z,f)=>shade(mix(deep,ice,smooth(-.12,.69,x)),f,.24),13).rotateZ(Math.PI/2);
  const glass=new THREE.MeshLambertMaterial({
    vertexColors:true, flatShading:true, side:THREE.DoubleSide,
    transparent:true, opacity:.74, depthWrite:false,
  });
  bell.add(new THREE.Mesh(canopy,glass));
  bell.add(piece([
    finish(new THREE.TorusGeometry(.72,.026,5,26).rotateX(Math.PI/2).translate(0,-.034,0),finPaint('#9ed6eb')),
    blob({s:[.37,.13,.37],p:[0,.04,0],top:'#9a81c4',belly:'#8c71bb',detail:1}),
  ]));
  const arms = Array.from({length:10},(_,i) => {
    const angle=i*Math.PI/5;
    const inner=i%3===0;
    const radius=inner?.21:.69;
    const length=inner?.37+i%4*.027:.39+i%4*.045;
    return arm(bell,[radius*Math.cos(angle),inner?-.015:-.025,radius*Math.sin(angle)],
      angle,length,inner?.105:.023,inner?'#aa8ed2':i%2?'#729dd9':'#9584ca',angle);
  });
  return {root,anim(t){
    const pulse=Math.sin(t*2.2);
    bell.scale.set(1+.08*pulse,1-.09*pulse,1+.08*pulse);
    arms.forEach(move=>move(t));
  }};
}

function squid(): Built {
  const root = new THREE.Group();
  const coral='#ca6258', salmon='#e78f79', pale='#f4c1ac';
  const mantle = piece([
    loft([[1.88,0,0,0],[1.63,.10,.12,0],[1.26,.22,.25,0],
      [.85,.34,.37,0],[.47,.43,.46,0],[.16,.45,.47,0],
      [-.03,.36,.39,0],[-.12,.27,.31,0]],
      (_x,y,_z,f)=>shade(col(y<-.18?salmon:coral),f,.22),12).rotateZ(Math.PI/2),
  ]);
  root.add(mantle);
  root.add(piece([
    loft([[.19,.28,.30,0],[.02,.35,.39,0],[-.21,.31,.33,0],[-.39,.18,.21,0]],
      finPaint(salmon),12).rotateZ(Math.PI/2),
    ...eyes(.20,-.10,.31,.087),
  ]));
  const fins = [-1,1].map(side => flap(root,[
    sculptFin([[0,-.62,0],[0,-.34,side*.32],[0,.02,side*.51],
      [0,.63,-side*.15],[0,.15,-side*.17]],
      [1,0,0],.048,finPaint('#b95354')),
  ],[0,1.23,side*.16]));
  const arms=Array.from({length:10},(_,i)=>{
    const angle=i*Math.PI/5;
    const tentacle=i===2||i===7;
    return arm(root,[.17*Math.cos(angle),-.32,.17*Math.sin(angle)],-angle,
      tentacle?.64:.33+.025*(i%3),tentacle?.091:.086,
      tentacle||i%2===0?pale:salmon,angle,tentacle?.72:.49+.09*(i%3),tentacle?.19:.09);
  });
  root.rotation.z = -Math.PI*.4;
  return {root,anim(t){
    const phase=t*2;
    const jet=smooth(-.25,.95,Math.sin(phase));
    const width=1.055-.17*smooth(-.38,.93,Math.sin(phase-.25));
    mantle.scale.set(width,1+.025*jet,width);
    root.rotation.z=-Math.PI*.47+.045*Math.sin(t*2-.5);
    fins.forEach((fin,i)=>{
      const side=i*2-1;
      const finStroke=1-.72*jet;
      fin.rotation.x=side*(.19*jet+.33*finStroke*Math.sin(t*4.2));
      fin.rotation.y=side*.15*finStroke*Math.sin(t*4.2-.60);
    });
    arms.forEach(move=>move(t));
  }};
}

function gradientTexture(stops:[number,string][],w=4,h=512){
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d')!;
  const g=ctx.createLinearGradient(0,0,0,h);stops.forEach(([p,hex])=>g.addColorStop(p,hex));ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function glowTexture(inner:string,outer:string){
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!;
  const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,inner);g.addColorStop(1,outer);ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function shaftTexture(){
  const c=document.createElement('canvas');c.width=64;c.height=256;const ctx=c.getContext('2d')!;
  const gx=ctx.createLinearGradient(0,0,64,0);gx.addColorStop(0,'rgba(255,255,255,0)');gx.addColorStop(.5,'rgba(255,255,255,1)');gx.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gx;ctx.fillRect(0,0,64,256);
  ctx.globalCompositeOperation='destination-in';
  const gy=ctx.createLinearGradient(0,0,0,256);gy.addColorStop(0,'rgba(0,0,0,1)');gy.addColorStop(.55,'rgba(0,0,0,.45)');gy.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gy;ctx.fillRect(0,0,64,256);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function rockWarp(sd:number){return (v:THREE.Vector3)=>{const k=.82+.36*hash(Math.round(v.x*9)*1.3+Math.round(v.y*9)*2.1+Math.round(v.z*9)*3.7+sd);v.multiplyScalar(k);};}

export function buildAquarium(){
  const scene=new THREE.Scene();
  scene.background=gradientTexture([[0,'#40b9cf'],[.27,'#248eaa'],[.55,'#165e84'],[.83,'#164d70'],[1,'#164d70']]);
  scene.fog=new THREE.Fog('#164d70',72,158);
  scene.add(new THREE.HemisphereLight('#bdf0ff','#2a6fae',1.15));
  const sun=new THREE.DirectionalLight('#f2fcff',1.35);sun.position.set(-8,22,10);scene.add(sun);
  const fill=new THREE.DirectionalLight('#7fc4ff',.45);fill.position.set(12,4,-10);scene.add(fill);

  const occluders:THREE.Object3D[]=[];
  const hits:HitTarget[]=[];
  const creatures:Creature[]=[];
  const swayers:{g:THREE.Object3D;ph:number;amp:number}[]=[];

  let seabed: THREE.Mesh;
  // ---- sea floor: a polar grid of faceted triangles, fine near the island and coarse far away
  {
    const radii:number[]=[0];let rr=2.4;while(rr<370){radii.push(rr);rr*=1.15;}
    const SEG=64;const verts:THREE.Vector3[][]=[];
    radii.forEach((r,i)=>{
      const row:THREE.Vector3[]=[];
      for(let j=0;j<SEG;j++){
        const th=(j+(i%2)*.5)/SEG*Math.PI*2+(hash(i*7+j*3)-.5)*.05,rad=r*(1+(hash(i*3.1+j*5.7)-.5)*.06);
        const x=Math.cos(th)*rad,z=Math.sin(th)*rad,k=smooth(10,50,r);
        row.push(new THREE.Vector3(x,i===0?0:(hash(x*.173+z*.911)-.5)*1.0*(.12+k)+Math.sin(x*.05)*Math.cos(z*.04)*2.6*k-.05,z));
      }
      verts.push(row);
    });
    const pts:THREE.Vector3[]=[];
    for(let i=0;i<verts.length-1;i++)for(let j=0;j<SEG;j++){
      const a0=verts[i][j],b0=verts[i][(j+1)%SEG],c0=verts[i+1][j],d0=verts[i+1][(j+1)%SEG];
      if(i===0)pts.push(a0,c0,d0);else pts.push(a0,c0,b0,b0,c0,d0);
    }
    const sand=col('#ecdfae'),sandDark=col('#d3c797'),water=col('#317d97'),deep=col('#164d70');
    const mesh=new THREE.Mesh(finish(new THREE.BufferGeometry().setFromPoints(pts),(x,_y,z,f)=>{
      const d=Math.hypot(x,z),edge=smooth(19,46,d+(hash(f*.37)-.5)*2);
      const near=mix(mix(sand,sandDark,hash(f*1.3)*.5),water,edge);
      return shade(mix(near,deep,smooth(29,95,d)),f,.055,5);
    }),bodyMat);
    seabed=mesh;
    scene.add(mesh);occluders.push(mesh);
  }

  // ---- the island: sand, stacked rocks, a cave, weed, coral
  const island=new THREE.Group();island.scale.set(3.6, 4.2, 3.2);island.rotation.y=.46;scene.add(island);
  {
    const sandPad=new THREE.CylinderGeometry(5.0,6.4,.9,13,1);
    const sp=sandPad.getAttribute('position');
    for(let i=0;i<sp.count;i++){const x=sp.getX(i),z=sp.getZ(i);const k=.9+.2*hash(Math.round(x*3)+Math.round(z*3)*5);sp.setX(i,x*k);sp.setZ(i,z*k);}
    const pad=new THREE.Mesh(finish(sandPad,(_x,y,_z,f)=>shade(y>0?col('#f1e6b6'):col('#d7cb9a'),f,.12,6)),bodyMat);
    pad.position.y=.35;island.add(pad);occluders.push(pad);

    const rocks:Geo[]=[];
    const R=(x:number,y:number,z:number,sx:number,sy:number,sz:number,ry:number,sd:number,top='#c09570',side='#88674f')=>
      rocks.push(blob({s:[sx,sy,sz],p:[x,y,z],r:[0,ry,0],top,belly:side,bellyAt:-.2,detail:2,warp:rockWarp(sd),jit:.16,seed:sd}));
    // Fuse offset crags into one solid, then carve the passage out of the same field.
    const resolution = 60;
    const rearEdge=-6.4, frontEdge=4.8;
    const depth=frontEdge-rearEdge;
    const surface = new MarchingCubes(resolution,bodyMat,false,false,90000);
    surface.isolation = 0;
    const crags = [
      [-.25,1.0,0,6.15,1.85,3.45],
      [-3.7,1.8,-.38,2.35,2.15,2.55],
      [3.85,1.7,-.42,2.15,2.08,2.5],
      [3.08,3.5,-.65,1.74,2.8,2.02],
      [-.7,3.3,-1.65,3.6,3.7,1.85],
      [-2.47,3.15,-.05,2.26,3.45,2.15],
      [-2.45,5.15,-.32,1.63,1.62,1.67],
      [1.65,3.3,-.24,2.12,3.62,2.26],
      [1.95,5.95,-.64,1.51,3.02,1.74],
      [2.29,7.88,-.91,1.05,1.45,1.09],
      [-.13,.98,1.36,2.52,1.16,1.81],
      [-1.45,1.18,2.25,1.9,1.46,1.64],
      [-.87,.85,2.87,1.36,.94,1.28],
      [-.53,1.58,1.76,1.88,1.65,2.15],
      [-.88,2.48,1.18,1.05,1.46,1.55],
      // Offset shelves and a small buttress break up the outer faces.
      [-3.65,3.05,1.45,1.55,.56,1.47],
      [3.66,2.3,1.15,1.49,.66,1.58],
      [2.96,5.12,-.26,1.07,.60,1.30],
      [-3.14,5.12,-1.72,.87,1.39,.92],
      // Offset slabs and a leaning spur add a second silhouette at the rear.
      [-2.64,2.30,-2.72,1.85,.92,1.24],
      [-2.86,3.69,-2.93,.82,1.82,.92],
      [2.25,2.18,-2.88,1.57,1.02,1.13],
      [2.79,4.20,-2.40,1.06,1.58,1.10],
      [3.31,4.86,-2.51,1.14,.57,1.10],
      // Stagger the shoulders and break the taller crown into two offset crests.
      [-4.37,2.56,.19,1.33,.72,1.83],
      [-3.32,4.39,.80,.93,1.57,1.05],
      [3.64,3.80,.46,1.19,.68,1.23],
      [2.80,7.17,-1.61,.82,1.66,.84],
      [1.61,7.61,-.32,.72,.86,.65],
      // A low, offset ridge closes the rear of the cleft.
      [-.55,2.07,-2.87,2.24,1.95,1.16],
      [.37,3.63,-2.78,1.20,1.74,.91],
      [.91,4.57,-2.50,.87,1.13,.75],
      // Overlapping shoulders step down from the back face to the sand.
      [-2.53,1.06,-3.22,2.15,1.24,1.57],
      [-1.55,2.36,-3.67,1.36,1.28,1.12],
      [.46,1.35,-4.14,1.94,1.29,1.39],
      [.95,2.85,-3.31,1.29,1.40,1.13],
      [2.72,.88,-3.60,1.45,.96,1.12],
      [2.22,3.62,-2.89,.85,1.38,1.05],
    ];
    for(let k=0;k<resolution;k++)for(let j=0;j<resolution;j++)for(let i=0;i<resolution;i++){
      const x=14.8*i/resolution-7.4;
      const y=11.2*j/resolution-1.0;
      const z=rearEdge+depth*k/resolution;
      let stone=-Infinity;
      for(const [cx,cy,cz,rx,ry,rz] of crags){
        const lean=(y-cy)*(.08+.14*Math.sin(cx*2+cz));
        const u=(x-cx-lean)/rx, v=(y-cy)/ry, w=(z-cz)/rz;
        const radius=Math.sqrt(u*u+v*v+w*w);
        const block=Math.max(Math.abs(u),Math.abs(v),Math.abs(w));
        const crag=1-(radius*.79+block*.21);
        const blend=Math.max(0,.20-Math.abs(stone-crag));
        stone=Math.max(stone,crag)+blend*blend/0.8;
      }
      const bedding=y+.18*x-.11*z+.09*Math.sin(z*2+x);
      const fracture=bedding+.20*Math.sin(x*1.6+z*1.3)*Math.cos(y*.83);
      const ledges=(.026+.020*Math.sin(x*1.7-z*1.8)**2)*Math.sin(13*fracture)
        +.015*Math.sin(26*fracture+.65);
      const seams=ledges+.062*Math.sin(4*x-3*z+2*y)
        +.027*Math.cos(11*x+7*z-5*y)+.016*Math.sin(18*x-13*z+9*y);
      const tunnel=Math.hypot((x+.35-.12*z-.055*y)/(.72+.075*Math.abs(z)),(y-3.12-.08*z)/2.43);
      // Rounded, overlapping ribs rise into the left wall and fall toward the front.
      const lowerRib=1-Math.hypot((x+.72)/1.8,(y-1.42)/1.65,(z-1.8)/2.32);
      const upperRib=1-Math.hypot((x+1.06-.18*(y-2.4))/1.12,(y-2.27)/1.74,(z-.75)/1.94);
      const shoulder=Math.max(lowerRib,upperRib)+seams*.85;
      // Shallow recesses in the outer faces leave irregular overhangs.
      const frontNotch=Math.hypot((x-2.54)/.78,(y-3.10)/.44,(z-2.51)/.84)-1;
      const cleft=Math.max(tunnel-1,(-z-1.65)*.76);
      const core=Math.min(stone+seams,cleft,frontNotch);
      const rock=Math.max(core,shoulder);
      surface.field[i+resolution*(j+resolution*k)]=Math.min(rock,(y+.12)*.8);
    }
    surface.update();
    const positions = surface.geometry.getAttribute('position');
    const vertices = new Float32Array(surface.count*3);
    for(let i=0;i<surface.count;i++){
      vertices[i*3]=positions.getX(i)*7.4;
      vertices[i*3+1]=positions.getY(i)*5.6+4.6;
      vertices[i*3+2]=rearEdge+(positions.getZ(i)+1)*depth*.5;
    }
    surface.geometry.dispose();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
    const shadedStone=col('#8d684f'), sunlitStone=col('#e4b98c'), moss=col('#55794b'), ochre=col('#bd8054');
    rocks.push(finish(geometry,(x,y,z,f)=>{
      const layers=.45+.21*Math.sin(y*15+x*1.7)+.16*Math.cos(x*4-z*5+y*2);
      const weathered=mix(shadedStone,sunlitStone,clamp01(layers+.18));
      const bedding=y+.18*x-.11*z+.09*Math.sin(z*2+x);
      const mineral=smooth(.68,.98,Math.cos(bedding*4.5))*.33;
      const weatheredSeam=smooth(.78,.99,Math.cos(bedding*4.5+.55))*.15;
      const growth=y>1 ? smooth(.17,.73,Math.sin(x*1.8+z*2.4)*Math.sin(y*1.7-z))*.48 : 0;
      return shade(mix(mix(weathered,ochre,mineral),moss,growth).multiplyScalar(1-weatheredSeam),f,.13,31);
    }));
    R(2.8,.65,.4,1.0,.6,.9,.9,8);
    R(.3,.5,2.8,.7,.45,.7,.4,9);
    R(3.4,.45,-1.2,.7,.45,.6,.9,10);
    R(-3.1,.5,-.6,.8,.5,.8,.2,11);
    R(-1.2,.45,-2.6,.9,.55,.8,.6,12);
    R(1.2,.5,-2.7,1.0,.55,.9,.1,13);
    // small stones on the sand
    [[2.6,2.2],[-3.0,2.2],[.8,3.7],[-1.8,3.1],[3.7,1.1],[-3.9,.6]].forEach(([x,z],i)=>R(x,.45,z,.28+.1*hash(i),.18,.26,i,20+i,'#7b94c4','#5c78ab'));
    const rockMesh=piece(rocks);island.add(rockMesh);occluders.push(rockMesh);
    // Plant the entire outcrop, from the outer walls to the summit.
    island.updateMatrixWorld(true);
    const growthParts:Geo[]=[];
    const ray=new THREE.Raycaster();
    const localNormal=new THREE.Vector3();
    const up=new THREE.Vector3(0,1,0);
    const palette=['#b86d72','#c18a66','#8e789e','#689d99','#b5a16a'];
    const leaves=['#527d61','#738b59','#899b67'];
    function tube(from:V3,to:V3,base:number,tip:number,color:string){
      const start=new THREE.Vector3(...from), end=new THREE.Vector3(...to);
      const axis=end.clone().sub(start);
      const geometry=new THREE.CylinderGeometry(tip,base,axis.length(),7,1);
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,axis.normalize()));
      const center=start.lerp(end,.5);
      return finish(geometry.translate(center.x,center.y,center.z),finPaint(color));
    }
    // Sample the same field used to build the rock mesh.
    function stoneAt(point:THREE.Vector3){
      const x=(point.x+7.4)*resolution/14.8;
      const y=(point.y+1)*resolution/11.2;
      const z=(point.z-rearEdge)*resolution/depth;
      const i=Math.floor(x), j=Math.floor(y), k=Math.floor(z);
      if(Math.min(i,j,k)<0 || Math.max(i,j,k)>=resolution-1)return -1;
      let density=0;
      for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
        const weight=(dx?x-i:1-x+i)*(dy?y-j:1-y+j)*(dz?z-k:1-z+k);
        density+=weight*surface.field[i+dx+resolution*(j+dy+resolution*(k+dz))];
      }
      return density;
    }
    function colony(seed:number,point:THREE.Vector3,normal:THREE.Vector3,ledge=false){
      const parts:Geo[]=[];
      const color=palette[Math.floor(hash(seed*7.1)*palette.length)];
      const leaf=leaves[seed%leaves.length];
      const size=ledge ? .57 : .43+hash(seed*3.33)*.39;
      switch(seed%5){
        case 0:
          for(let branch=-1;branch<=1;branch++){
            const base:V3=[branch*.16,0,0], elbow:V3=[branch*.23,.35,.04], tip:V3=[branch*.40,.61+hash(seed+branch)*.29,.02];
            parts.push(tube(base,elbow,.10,.086,color),tube(elbow,tip,.086,.057,color));
            parts.push(tube(elbow,[elbow[0]-.16,.58,.18],.059,.038,color));
            parts.push(blob({s:[.061,.065,.061],p:tip,top:color,detail:1}));
          }
          break;
        case 1:
          for(let i=0;i<5;i++){
            const angle=i*2.4, x=Math.cos(angle)*.25,z=Math.sin(angle)*.25;
            const height=.29+hash(seed*5+i)*.48, radius=.10+hash(seed+i*7)*.065;
            parts.push(finish(new THREE.CylinderGeometry(radius,radius*.69,height,9,1,true).translate(x,height*.5,z),
              (_x,y,_z,f)=>shade(col(color),f,.14).multiplyScalar(.78+.28*y/height)));
            parts.push(finish(new THREE.TorusGeometry(radius*.90,.023,5,9).rotateX(Math.PI/2).translate(x,height,z),finPaint('#c7ac80')));
            parts.push(finish(new THREE.CircleGeometry(radius*.77,9).rotateX(-Math.PI/2).translate(x,height*.57,z),finPaint('#593960')));
          }
          break;
        case 2:
          for(let i=0;i<3;i++){
            const radius=.30+i*.068, y=.12+i*.17, x=(i-1)*.14;
            const outline:V3[]=Array.from({length:13},(_,j)=>{
              const angle=j*Math.PI*2/13, r=radius*(.84+.22*hash(seed+i*13+j));
              return [x+r*Math.cos(angle),y+.042*Math.sin(angle*3),r*Math.sin(angle)];
            });
            parts.push(sculptFin(outline,[0,1,0],.047,(_x,py,_z,f)=>shade(col(f%4===3?'#8c666b':color),f,.20).multiplyScalar(.85+py*.32)));
          }
          break;
        case 3:
          for(let stem=-1;stem<=1;stem++){
            const lean=stem*.22;
            parts.push(tube([stem*.13,0,0],[lean,.89,0],.046,.019,leaf));
            for(let i=0;i<5;i++){
              const side=i%2?1:-1, y=.22+i*.14, x=lean*y/.89;
              parts.push(sculptFin([[x,y,0],[x+side*.16,y+.024,.07],[x+side*.28,y+.17,.11],
                [x+side*.13,y+.16,.06],[x,y+.055,0]],[0,0,1],.035,finPaint(i%2?'#91a578':leaf)));
            }
          }
          break;
        default:
          for(let i=0;i<9;i++){
            const angle=i*2.4, radius=.10+.06*hash(seed*3+i);
            const x=Math.cos(angle)*radius*2.0,z=Math.sin(angle)*radius*2.0;
            parts.push(blob({s:[radius,.14+hash(seed+i)*.15,radius],p:[x,.12,z],top:color,belly:'#796c80',detail:1}));
          }
      }
      const rotation=new THREE.Quaternion().setFromUnitVectors(up,normal.clone().lerp(up,.68).normalize());
      rotation.multiply(new THREE.Quaternion().setFromAxisAngle(up,hash(seed*8.3)*Math.PI*2));
      const transform=new THREE.Matrix4().compose(point,rotation,new THREE.Vector3(size,size*.58,size));
      if(ledge){
        const vertex=new THREE.Vector3();
        let embedded=false, clear=true;
        for(const part of parts){
          const positions=part.getAttribute('position');
          for(let i=0;i<positions.count;i++){
            vertex.fromBufferAttribute(positions,i);
            const root=vertex.y<.19;
            const density=stoneAt(vertex.applyMatrix4(transform));
            if(root && density>.003)embedded=true;
            if(!root && density>.015)clear=false;
          }
        }
        if(!embedded || !clear){
          for(const part of parts)part.dispose();
          return false;
        }
      }
      for(const part of parts)growthParts.push(part.applyMatrix4(transform));
      return true;
    }
    function plant(origin:THREE.Vector3,target:THREE.Vector3,seed:number){
      const direction=island.localToWorld(target).sub(island.localToWorld(origin)).normalize();
      ray.set(origin,direction);
      const hit=ray.intersectObject(rockMesh)[0];
      if(!hit?.face)return;
      const point=island.worldToLocal(hit.point);
      if(point.y<.45)return;
      localNormal.copy(hit.face.normal);
      const localOrigin=island.worldToLocal(origin);
      if(localNormal.dot(localOrigin.sub(point))<0)localNormal.negate();
      // Keep taller colonies on shelves and use low plate or mound growth on steep faces.
      const shelf=localNormal.y>.44;
      if(!shelf && seed%5!==2 && seed%5!==4)return;
      colony(seed,point.addScaledVector(localNormal,-.105),localNormal);
    }
    for(let level=0;level<11;level++){
      const y=.7+level*.70;
      for(let i=0;i<24;i++){
        const seed=level*24+i, angle=(i+(level%2)*.5)*Math.PI/12;
        if(hash(seed*13.7)<.14)continue;
        plant(new THREE.Vector3(Math.cos(angle)*8,y+hash(seed*6.1)*.48,Math.sin(angle)*6),
          new THREE.Vector3(0,y,0),seed);
      }
    }
    for(let i=0;i<36;i++){
      const angle=i*2.39996,radius=5.4*Math.sqrt((i+.5)/36);
      const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius*.66;
      plant(new THREE.Vector3(x,11,z),new THREE.Vector3(x,0,z),270+i);
    }
    // Stagger colonies on the terraces where the rear rock steps down to the sand.
    for(let row=0;row<5;row++){
      for(let column=0;column<8;column++){
        const seed=810+row*8+column;
        const x=-3.9+column*1.06+(hash(seed*9.8)-.5)*.57;
        const z=-2.25-row*.66+(hash(seed*5.3)-.5)*.43;
        plant(new THREE.Vector3(x,11,z),new THREE.Vector3(x,0,z),seed);
      }
    }
    // Probe each new shelf for a spot with an embedded root and exposed growth.
    for(const [x,y,z,seed] of [[-3.8,3.05,2.28,503],[-4.42,3.05,1.9,510],
      [3.9,2.3,2.12,518],[4.52,2.3,1.55,525],[3.32,5.12,.65,533],
      [3.63,5.12,.24,540],[-3.48,5.12,-2.1,548],
      [-3.45,3.05,2.45,553],[-4.65,3.05,1.44,557],[4.45,2.3,1.85,563],
      [3.55,2.3,2.31,569],[3.62,5.12,.46,574],[-3.47,5.12,-2.42,578]]){
      for(const [dx,dz] of [[0,0],[.23,0],[-.23,0],[0,.23],[0,-.23]]){
        ray.set(island.localToWorld(new THREE.Vector3(x+dx,y+1.1,z+dz)),new THREE.Vector3(0,-1,0));
        const hit=ray.intersectObject(rockMesh)[0];
        if(!hit?.face || Math.abs(hit.face.normal.y)<.45)continue;
        const point=island.worldToLocal(hit.point);
        if(point.y<y || point.y>y+1)continue;
        point.y-=.052;
        if(colony(seed,point,up,true))break;
      }
    }
    // A few low patches in the sand around the foot of the reef.
    for(const [x,z,seed] of [[-2.4,3.5,403],[-1.25,4.1,407],[1.7,3.65,413],
      [2.45,3.1,419],[4.1,1.1,423],[-4.25,-.3,427],[2.6,-3.1,433],[-1.7,-3.9,439],
      [-2.75,3.37,443],[-.6,4.15,447],[.87,4.18,449],[1.38,3.92,453],
      [3.02,3.03,457],[4.28,1.65,463],[-4.35,.65,468],[-3.61,-2.3,472],
      [-.95,-4.13,478],[2.95,-2.95,484],
      [-2.65,2.95,773],[-1.55,3.55,775],[-.3,3.72,779],[.62,3.58,783],
      [2.68,2.68,786],[3.54,2.08,788]]){
      ray.set(island.localToWorld(new THREE.Vector3(x,10,z)),new THREE.Vector3(0,-1,0));
      const sandHit=ray.intersectObject(pad)[0];
      if(!sandHit || ray.intersectObject(rockMesh).some(hit=>hit.distance<sandHit.distance))continue;
      const point=island.worldToLocal(sandHit.point);
      point.y-=.045;
      colony(seed,point,up);
    }
    // Small colonies trace the sides of the wreck, leaving gaps between them.
    for(const [x,z,seed] of [[-3,28,603],[.5,31,605],[3.7,31.6,608],
      [7.2,30.9,612],[10.5,28.7,618],[13.3,25.8,620],[7.1,23.4,624]]){
      ray.set(new THREE.Vector3(x,12,z),new THREE.Vector3(0,-1,0));
      const sandHit=ray.intersectObjects([seabed,pad])[0];
      if(!sandHit)continue;
      const point=island.worldToLocal(sandHit.point);
      point.y-=.035;
      colony(seed,point,up);
    }
    // Loose patches on the middle and outer sand, away from the wreck.
    for(const [x,z,seed] of [[-24,14,703],[-25,10,705],[-20,23,708],[-17,25,714],
      [-11,33,718],[-8,34,721],[15,34,723],[18,32,729],[24,25,733],[27,22,737],
      [30,12,738],[30,8,744],[27,-13,748],[24,-17,752],[10,-27,753],
      [6,-29,757],[-16,-24,763],[-19,-22,769],
      [-16,16,773],[-13,19,775],[-9,22,778],[16,17,783],[19,15,787],
      [21,8,789],[19,-10,793],[-15,-15,798],
      [-26,-15,900],[-23,-19,903],[-21,-16,907],[-19,-24,910],
      [-16,-26,913],[-14,-22,917],[-12,-27,922],[-9,-24,925],
      [-7,-27,928],[-5,-22,934],[-3,-26,938],[-1,-29,942],
      [2,-24,945],[4,-26,948],[8,-23,954],[10,-20,958],
      [14,-21,963],[15,-17,967],[18,-21,969],[22,-18,973],
      [-29,2,978],[-26,7,982],[-22,12,985],[25,5,988],
      [27,-2,993],[24,-6,997],[20,29,1003],[24,28,1007]]){
      ray.set(new THREE.Vector3(x,12,z),new THREE.Vector3(0,-1,0));
      const sandHit=ray.intersectObjects([seabed,pad])[0];
      if(!sandHit || ray.intersectObject(rockMesh).some(hit=>hit.distance<sandHit.distance))continue;
      const point=island.worldToLocal(sandHit.point);
      point.y-=.04;
      colony(seed,point,up);
      growthParts.push(blob({s:[.18,.085,.14],p:[point.x+.24,point.y+.025,point.z],
        top:'#a59377',detail:1,seed}));
    }
    if(growthParts.length)island.add(piece(growthParts));

    const rubble:Geo[]=[];
    for(let i=0;i<29;i++){
      const angle=i*2.39996, radius=4.05+1.47*hash(i*3.74);
      const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius*.76;
      const size=.09+.25*hash(i*8.2);
      rubble.push(blob({s:[size*1.45,size*.65,size],p:[x,.67,z],top:i%3===0?'#b49b79':'#8f806b',
        detail:1,jit:.20,warp:rockWarp(i+70)}));
    }
    island.add(piece(rubble));
  }

  // A sunken pirate ship rests off the left shoulder of the reef.
  const wreck=new THREE.Group();
  wreck.position.set(5,1.0,28);
  wreck.scale.setScalar(2.45);
  wreck.rotation.set(.18,.28,-.06);
  const wreckParts:Geo[]=[];
  const frames=[
    [-4.25,.10,.80],[-3.40,1.12,.22],[-2.25,1.48,0],[-.85,1.58,-.08],[.60,1.42,-.02],[1.78,1.11,.16],[2.95,.60,.44],[3.62,.12,.82],
  ];
  function plankPoint(station:number, band:number, side:number){
    const [x,width,keel]=frames[station];
    const t=band/5;
    return new THREE.Vector3(x,keel+1.38*t,side*width*(.17+.83*Math.sin(t*Math.PI*.52)));
  }
  const boards:THREE.Vector3[]=[];
  for(const side of [-1,1])for(let i=0;i<frames.length-1;i++)for(let j=0;j<5;j++){
    if((side===1&&i>=4&&j>=3)||(i===6&&j===4))continue;
    const a=plankPoint(i,j+.035,side), b=plankPoint(i+1,j+.035,side);
    const c=plankPoint(i,j+.96,side), d=plankPoint(i+1,j+.96,side);
    boards.push(a,b,c,b,d,c);
  }
  const timber=col('#6d7160'), darkTimber=col('#363c35'), algae=col('#4d6b52');
  wreckParts.push(finish(new THREE.BufferGeometry().setFromPoints(boards),
    (x,y,z,f)=>{
      const wood=mix(darkTimber,timber,smooth(0,1.8,y));
      const growth=smooth(.12,.75,Math.sin(x*4+z*9)*Math.cos(y*8+x));
      return shade(mix(wood,algae,growth*.76),Math.floor(f/2),.36,72);
    }));
  function beam(from:THREE.Vector3,to:THREE.Vector3,width:number,color:string){
    const direction=to.clone().sub(from);
    const wood=new THREE.BoxGeometry(width,direction.length(),width);
    wood.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));
    const center=from.clone().lerp(to,.5);
    wood.translate(center.x,center.y,center.z);
    wreckParts.push(finish(wood,finPaint(color)));
  }
  for(const side of [-1,1]){
    for(let i=1;i<frames.length-1;i++)for(let j=0;j<5;j++){
      beam(plankPoint(i,j,side).multiply(new THREE.Vector3(1,1,.93)),
        plankPoint(i,j+1,side).multiply(new THREE.Vector3(1,1,.93)),.14,'#593c2c');
    }
    for(let i=0;i<(side===1?4:6);i++)beam(plankPoint(i,5,side),plankPoint(i+1,5,side),.18,'#8c6548');
  }
  for(let i=0;i<6;i++){
    const x=-3.20+i*.46, width=.69+i*.06;
    beam(new THREE.Vector3(x,.87,-width),new THREE.Vector3(x,.87,width),.19,'#856044');
  }
  // The raised stern, bowsprit, and two square-rigged masts define the silhouette.
  for(let i=0;i<5;i++){
    const z=(i-2)*.36;
    beam(new THREE.Vector3(-3.35,1.53,z),new THREE.Vector3(-1.9,1.53,z),.34,'#896044');
  }
  for(const side of [-1,1]){
    const z=side*.91;
    beam(new THREE.Vector3(-3.4,1.45,z),new THREE.Vector3(-3.4,2.22,z),.16,'#604431');
    beam(new THREE.Vector3(-2.1,1.35,z),new THREE.Vector3(-2.1,2.12,z),.16,'#604431');
    beam(new THREE.Vector3(-3.4,2.22,z),new THREE.Vector3(-2.1,2.12,z),.18,'#997151');
  }
  beam(new THREE.Vector3(2.6,1.56,0),new THREE.Vector3(4.8,2.65,0),.23,'#896044');
  for(const [x,height,span] of [[-.85,7.3,2.0],[1.65,5.5,1.45]]){
    beam(new THREE.Vector3(x,.68,0),new THREE.Vector3(x-.5,height,0),.26,'#775439');
    const top=height-.64, bottom=top-span*1.25;
    beam(new THREE.Vector3(x-.44,top,-span),new THREE.Vector3(x-.44,top,span),.14,'#896044');
    // Curved scraps hang from each yard with open gaps and frayed hems.
    for(let i=0;i<9;i++){
      const left=span*(-.94+i*.21), right=left+span*.205;
      const hem=bottom+hash(i*7.5+x)*.72;
      const tear=(i===3||i===7)? .46 : .10;
      wreckParts.push(sculptFin([
        [x-.43,top,left],[x-.43,top,right],
        [x+.16,hem+tear,right],[x+.24,hem+.14,left+span*.14],
        [x+.29,hem-.19,left+span*.085],[x+.13,hem+.25,left],
      ],[1,0,0],.066,(_x,y,z,f)=>shade(col(Math.sin(z*18+y*5)>.29?'#596c65':'#78857a'),f,.22)));
    }
    for(const side of [-1,1]){
      beam(new THREE.Vector3(x-.47,top+.18,0),new THREE.Vector3(x-.85,1.51,side*1.35),.047,'#62513b');
    }
  }
  wreckParts.push(sculptFin([[-1.34,7.23,0],[-2.58,7.14,0],[-2.25,6.91,0],
    [-2.55,6.65,0],[-1.34,6.72,0]],[0,0,1],.035,finPaint('#313336')));
  for(let i=0;i<13;i++){
    const x=-3.6+i*.55, side=i%2===0?1:-1;
    const z=side*(.65+.8*Math.sin(Math.PI*(i+1)/14));
    const y=1.36+.36*hash(i*5);
    wreckParts.push(blob({s:[.12,.095,.10],p:[x,y,z],top:i%3===0?'#8b876b':'#526a50',detail:1,seed:i}));
  }
  const wreckMesh=piece(wreckParts);
  // Seat the central keel in the actual terrain under the tilted hull.
  const seabedRay=new THREE.Raycaster();
  const down=new THREE.Vector3(0,-1,0);
  const keelOffsets:number[]=[];
  for(const [x,,keel] of frames.slice(2,6)){
    const contact=wreck.localToWorld(new THREE.Vector3(x,keel,0));
    seabedRay.set(new THREE.Vector3(contact.x,20,contact.z),down);
    const sand=seabedRay.intersectObject(seabed)[0];
    if(sand)keelOffsets.push(sand.point.y-contact.y);
  }
  if(keelOffsets.length)wreck.position.y+=Math.min(...keelOffsets)-.85;
  wreck.add(wreckMesh);scene.add(wreck);occluders.push(wreckMesh);

  const chestParts:Geo[]=[];
  const chestWood=['#72503a','#906346','#80583d'];
  for(let i=0;i<5;i++){
    chestParts.push(finish(new THREE.BoxGeometry(.43,.85,1.42)
      .translate((i-2)*.437,.38,0),finPaint(chestWood[i%3])));
  }
  for(let i=0;i<9;i++){
    const angle=(i-4)*Math.PI/10;
    const y=.79+Math.cos(angle)*.48, z=Math.sin(angle)*.70;
    chestParts.push(finish(new THREE.BoxGeometry(2.23,.15,.25)
      .rotateX(-angle).translate(0,y,z),finPaint(chestWood[i%3])));
    for(const x of [-.76,.76]){
      chestParts.push(finish(new THREE.BoxGeometry(.14,.047,.25)
        .rotateX(-angle).translate(x,y+.075*Math.cos(angle),z+.065*Math.sin(angle)),finPaint('#ad8a45')));
    }
  }
  chestParts.push(finish(new THREE.BoxGeometry(.31,.30,.10).translate(0,.77,.72),finPaint('#b79855')));
  chestParts.push(finish(new THREE.BoxGeometry(.059,.092,.019).translate(0,.76,.779),finPaint('#362e25')));
  const chest=piece(chestParts);
  seabedRay.set(new THREE.Vector3(14,20,31),down);
  const chestBed=seabedRay.intersectObject(seabed)[0];
  chest.position.set(14,(chestBed?.point.y??0)-.12,31);
  chest.rotation.y=.53;
  scene.add(chest);
  occluders.push(chest);

  // ---- soft glow under the island and light shafts
  {
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(59,59),new THREE.MeshBasicMaterial({map:glowTexture('rgba(255,252,220,.22)','rgba(255,252,220,0)'),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
    glow.rotation.x=-Math.PI/2;glow.position.y=.82;scene.add(glow);
  }
  const shafts=new THREE.Group();scene.add(shafts);
  const shaftMap=shaftTexture();
  for(let i=0;i<6;i++){
    const mat=new THREE.MeshBasicMaterial({map:shaftMap,color:'#a8e8ea',transparent:true,
      opacity:.065+.045*hash(i),depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    const beam=new THREE.Mesh(new THREE.PlaneGeometry(15+hash(i*3.3)*15,100),mat);
    beam.position.set(-48+i*16,50,-16+hash(i*8.7)*14);
    beam.rotation.set(0,.55,.19+.09*hash(i*2),'YXZ');
    shafts.add(beam);
  }

  // Small suspended particles carry the current through the scene.
  const particlePositions:number[]=[];
  for(let i=0;i<185;i++){
    particlePositions.push((hash(i*2.1)-.5)*128,2+hash(i*4.3)*53,(hash(i*6.7)-.5)*128);
  }
  const particleGeometry=new THREE.BufferGeometry();
  particleGeometry.setAttribute('position',new THREE.Float32BufferAttribute(particlePositions,3));
  const motes=new THREE.Points(particleGeometry,new THREE.PointsMaterial({
    map:glowTexture('rgba(255,255,255,1)','rgba(255,255,255,0)'),
    color:'#b8e4e8',size:.34,transparent:true,opacity:.52,depthWrite:false,
  }));
  scene.add(motes);

  // Low reef shelves overlap at two distances and dissolve into the water.
  const distantReefs:Geo[]=[];
  for(let layer=0;layer<2;layer++){
    const count=layer===0?15:20;
    for(let i=0;i<count;i++){
      const angle=(i+layer*.5)/count*Math.PI*2;
      const distance=67+layer*33+hash(i*5.1+layer)*10;
      const height=4+hash(i*5.3+layer)*9;
      const width=8+hash(i*7.7)*9;
      distantReefs.push(blob({s:[width,height,width*.57],p:[Math.cos(angle)*distance,height*.32-2,Math.sin(angle)*distance],
        r:[0,-angle+Math.PI*.5,0],top:layer===0?'#296679':'#29617a',belly:'#224e62',bellyAt:-.15,
        detail:1,jit:.07,seed:i,warp:rockWarp(i+layer*30)}));
    }
  }
  scene.add(piece(distantReefs));

  // ---- creatures
  const label=(id: keyof typeof names) => names[id];
  /** Scale a creature so its longest horizontal extent is `size`. */
  const fit=(b:Built,size:number)=>{
    b.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(b.root);const s=box.getSize(new THREE.Vector3());
    const k=size/Math.max(s.x,s.z);b.root.scale.setScalar(k);const c=box.getCenter(new THREE.Vector3());b.root.position.set(-c.x*k,-c.y*k,-c.z*k);
    return Math.max(s.x,s.y,s.z)*k;
  };
  const add=(key:string,b:Built,size:number,label:string,move:(holder:THREE.Group,t:number)=>void,minHit=1.4)=>{
    const holder=new THREE.Group(),visual=new THREE.Group();holder.add(visual);visual.add(b.root);
    const extraScale = key === "futwar" ? 1 : 1.2;
    const currentSize = size * 1.15 * extraScale;
    const displaySize = key === 'futwar' || key === 'rag'
      ? currentSize
      : Math.max(1.54, currentSize * 1.89);
    fit(b, key === 'submarine' ? displaySize : displaySize * 1.10);
    // click target: a box around the creature's rest pose, padded so thin animals (rays, eels, sardines) are still easy to hit
    const bb=new THREE.Box3().setFromObject(b.root),bs=bb.getSize(new THREE.Vector3()),bc=bb.getCenter(new THREE.Vector3());
    const proxy=new THREE.Mesh(new THREE.BoxGeometry(Math.max(minHit,bs.x*1.05),Math.max(minHit*.8,bs.y*1.15),Math.max(minHit,bs.z*1.05)),new THREE.MeshBasicMaterial({visible:false}));
    proxy.position.copy(bc);
    visual.add(proxy);scene.add(holder);
    const c:Creature={key,holder,visual,anim:b.anim,move:(t)=>move(holder,t),hover:0};
    creatures.push(c);
    hits.push({object:proxy,label,visual});
    (proxy.userData as {key:string}).key=key;
    return c;
  };
  /** Circle the island. Fish face their direction of travel, bank slightly, bob, and the circle breathes a little. */
  const orbit=(R0:number,y0:number,w:number,th0:number,o:{wobble?:number;bob?:number;cx?:number;cz?:number;clearWreck?:boolean}={})=>(h:THREE.Group,t:number)=>{
    const th=th0+w*t*.68;
    const radius=R0*1.87*(1+(o.wobble??.05)*Math.sin(th*1.7+th0));
    // Ease outward on the wreck side of the reef and return to the usual route.
    const angle=Math.atan2(Math.sin(th),Math.cos(th));
    const detour=o.clearWreck ? 1-smooth(.72,1.07,Math.abs(angle-1.34)) : 0;
    const rr=radius+Math.max(0,46-radius)*detour;
    const x=(o.cx??0)+Math.cos(th)*rr,z=(o.cz??0)+Math.sin(th)*rr;
    h.position.set(x,y0*2.25+(o.bob??.35)*Math.sin(t*.45+th0*2),z);
    const dir=Math.sign(w),vx=-Math.sin(th)*dir,vz=Math.cos(th)*dir;
    h.rotation.set(.1*dir,Math.atan2(-vz,vx),0,'YXZ');
  };
  // Use the path tangent for heading, including climbs and dives.
  const swim = (path: (t: number, point: THREE.Vector3) => void) => {
    const ahead = new THREE.Vector3();
    return (holder: THREE.Group, t: number) => {
      path(t, holder.position);
      path(t + .04, ahead);
      ahead.sub(holder.position);
      holder.rotation.set(0, Math.atan2(-ahead.z, ahead.x),
        Math.atan2(ahead.y, Math.hypot(ahead.x, ahead.z)), 'YXZ');
    };
  };
  const patrol = (x: number, y: number, z: number, width: number, depth: number,
    rise: number, speed: number, phase = 0) => swim((t, point) => {
    const a = t * speed + phase;
    point.set(x + width * Math.sin(a), y + rise * Math.sin(a * 2), z + depth * Math.cos(a));
  });

  const jellyDrift = (holder: THREE.Group, t: number) => {
    const pulse = (t + 'kaggle'.length * .37) * 2.2;
    holder.position.set(-15 + 1.45 * Math.sin(t * .13),
      21 + 2.5 * Math.sin(t * .38) - .23 * Math.cos(pulse),
      24 + .8 * Math.sin(t * .17));
    holder.rotation.z = .085 * Math.sin(t * .54);
  };
  // The butterflyfish passes the mouth of the cleft and circles the outside.
  const butterflySwim = patrol(26,9,19,4,3,1.4,.19,.8);
  const squidJets = swim((t, point) => {
    const phase=t*2;
    // The second harmonic concentrates acceleration into the mantle squeeze.
    const a=t*.19-.055*Math.cos(phase)-.011*Math.sin(2*phase);
    point.set(30 * Math.sin(a), 24 + 2.4 * Math.sin(a * 2), 26 * Math.cos(a));
  });
  // Sizes approximate adult animals in meters: length for fish, wingspan for the ray, and bell diameter for the jelly.
  const wanted: [keyof typeof names, () => Built, number, ReturnType<typeof orbit>][] = [
    ['futwar', whaleShark, 12, orbit(17,10,.095,1.2)],
    // The turtle's wider route clears the wreck and both sails.
    ['spotify', turtle, 1.65, orbit(20.8,6.1,.19,1.0,{bob:2.1,wobble:.025,clearWreck:true})],
    ['rag', manatee, 3.6, orbit(17.1,4.0,-.15,.12,{bob:1.25,clearWreck:true})],
    ['gas', mantaRay, 2.8, orbit(16.4,10.7,.22,2.55,{bob:2.7})],
    ['kaggle', jelly, 0.65, jellyDrift],
    ['ds310project2', sailfish, 2.7, orbit(20.0,13.8,-.29,3.25,{bob:2.4})],
    ['purchase', squid, 0.85, squidJets],
    ['allstar', mahi, 1.35, orbit(18.8,10.5,.32,5.2,{bob:1.9})],
    ['letterboxd', dumbo, 0.48, patrol(-19,5,21,3.5,2.5,1.2,.26,1.25)],
    ['skillissue', lionfish, 0.38, patrol(23,5,24,2.4,2.2,.5,.22,.86)],
    ['moneyball', butterflyfish, .63, butterflySwim],
    ['archetypes', cowfish, 0.43, patrol(-16,6,28,5,3,.9,.24,2.75)],
    ['singapore', napoleonWrasse, 2.05, orbit(16.7,8.9,-.15,4.5,{bob:1.3,clearWreck:true})],
    ['nbawins', triggerfish, 0.56, orbit(16.0,4.9,.21,3.45,{bob:1.6,clearWreck:true})],
    ['macropad', clownfish, 0.15, patrol(4,3.5,41,1.25,1.1,.3,.52,.55)],
  ];
  for (const [id,make,size,move] of wanted) add(id,make(),size,label(id),move);

  // Eight sardines share the same route with fixed offsets in the school's frame.
  const bio=submarine();
  add('submarine',bio,1.42,'About me',patrol(29,10,12,4.3,5,1.1,.32,.8));

  const school = orbit(18.1,4.7,-.25,2.12,{bob:1.6,clearWreck:true});
  for (let i = 0; i < 8; i++) {
    const offset = new THREE.Vector3((i % 3 - 1) * 1.89, (i % 2 - .5) * .672, (Math.floor(i / 3) - 1) * 1.19);
    const drift = new THREE.Vector3();
    const fish=sardine();
    const animateTail=fish.anim;
    fish.anim=t=>animateTail(t+i*.089);
    add('engineering-' + i, fish, .24, names.engineering, (holder,t) => {
      school(holder,t);
      drift.copy(offset);
      drift.y += .045 * Math.sin(t * 2 + i);
      holder.position.add(drift.applyQuaternion(holder.quaternion));
    });
  }

  // ---- hover handling and per-frame update
  let hoverKey:string|null=null;
  const keyOf=(hit:HitTarget|null)=>hit?((hit.object.userData as {key?:string}).key??null):null;
  const setHovered=(hit:HitTarget|null)=>{hoverKey=keyOf(hit);};
  const calm=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;   // slow everything down for people who ask for less motion
  const animate=(elapsed:number)=>{
    const t=calm?elapsed*.35:elapsed;
    for(const c of creatures){
      c.move(t);c.anim(c.key==='purchase'?t:t+c.key.length*.37);
      c.hover+=(( c.key===hoverKey?1:0)-c.hover)*.18;
      c.visual.scale.setScalar(1+.12*c.hover);
    }
    for(const s of swayers){s.g.rotation.z=s.amp*Math.sin(t*.9+s.ph);s.g.rotation.x=s.amp*.7*Math.cos(t*.7+s.ph*1.3);}
    shafts.rotation.y=Math.sin(t*.04)*.15;
    motes.rotation.y=t*.006;motes.position.y=Math.sin(t*.3)*.6;
    return false;
  };
  animate(0);
  return {scene,hits,occluders,setHovered,animate};
}
