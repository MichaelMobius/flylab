import * as THREE from '../vendor/three/build/three.module.js';
import {seededRandom} from './runtime.js';
import {tripodFoot} from './gait.js';
import {cornerFoot} from './corner.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function mesh(parent,geo,mat,pos=[0,0,0],scale=[1,1,1]){const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;parent.add(m);return m;}
function ellipsoid(parent,mat,pos,scale){return mesh(parent,new THREE.SphereGeometry(1,32,24),mat,pos,scale);}
function line(parent,points,mat){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>V(...p))),mat);parent.add(l);return l;}
function segments(parent,points,material){const m=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),material);parent.add(m);return m;}
function segment(parent,a,b,r,mat){const m=mesh(parent,new THREE.CylinderGeometry(r*.68,r,a.distanceTo(b),8),mat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize());return m;}

// Anatomical reference: Jürgens et al. 2024, Genetics, doi:10.1093/genetics/iyae129.
// An original procedural adult Drosophila model, not a scan or measured specimen.
export function createFly(){
 const g=new THREE.Group();g.name='drosophila-adult';const visual=new THREE.Group();g.add(visual);
 const cuticle=new THREE.MeshPhysicalMaterial({color:0x876038,roughness:.66,clearcoat:.06});
 const dark=new THREE.MeshStandardMaterial({color:0x382619,roughness:.65});
 const gold=new THREE.MeshStandardMaterial({color:0xa8824e,roughness:.7});
 const bristleMat=new THREE.LineBasicMaterial({color:0x352b20,transparent:true,opacity:.76});
 const thorax=ellipsoid(visual,cuticle,[0,.015,0],[.139,.127,.171]);thorax.name='mesothorax';
 ellipsoid(visual,cuticle,[0,.073,-.156],[.094,.055,.074]).name='scutellum';
 ellipsoid(visual,gold,[0,-.025,.195],[.116,.094,.077]).name='head';
 // Smooth tapered abdomen with bands following the surface, not floating rings.
 const abdomenGeo=new THREE.SphereGeometry(1,56,48),ap=abdomenGeo.attributes.position,colors=[];
 for(let i=0;i<ap.count;i++){
  const z=ap.getZ(i),u=(1-z)/2,taper=.98-.24*u;
  ap.setXYZ(i,ap.getX(i)*.142*taper,ap.getY(i)*.106*taper-.022,-.30+z*.235);
  const band=(u*6.2)%1>.70, base=new THREE.Color(band?0x49301e:0xbc9254);
  base.multiplyScalar(.93+.07*Math.cos(u*40));colors.push(base.r,base.g,base.b);
 }
 abdomenGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));abdomenGeo.computeVertexNormals();
 mesh(visual,abdomenGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.59})).name='segmented-abdomen';
 // Large ellipsoidal compound eyes with hundreds of fitted ommatidial facets.
 const eyeMat=new THREE.MeshPhysicalMaterial({color:0x861b12,roughness:.51,clearcoat:.10});
 const facetGeo=new THREE.SphereGeometry(1,6,4),facetMat=new THREE.MeshStandardMaterial({color:0xbd3c24,roughness:.47});
 const rng=seededRandom(417);
 for(const side of [-1,1]){
  const center=V(.092*side,.002,.201),r=V(.050,.096,.076);
  ellipsoid(visual,eyeMat,center.toArray(),r.toArray()).name='compound-eye';
  const entries=[];
  for(let row=1;row<36;row++){const theta=row/36*Math.PI,n=Math.max(5,Math.round(Math.sin(theta)*56));
   for(let j=0;j<n;j++){const phi=(j+(row%2)*.5)/n*Math.PI*2;const unit=V(Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi));entries.push(unit);}}
  const facets=new THREE.InstancedMesh(facetGeo,facetMat,entries.length),dummy=new THREE.Object3D();facets.name='ommatidia';
  entries.forEach((u,i)=>{dummy.position.copy(center).add(V(u.x*r.x,u.y*r.y,u.z*r.z));dummy.quaternion.setFromUnitVectors(V(0,0,1),V(u.x/r.x,u.y/r.y,u.z/r.z).normalize());dummy.scale.set(.0028,.0028,.00045);dummy.updateMatrix();facets.setMatrixAt(i,dummy.matrix);facets.setColorAt(i,new THREE.Color().setHSL(.017+rng()*.014,.72,.19+rng()*.07));});visual.add(facets);
 }
 // Three dorsal ocelli, short antennal segments, branched aristae and palps.
 for(const [x,z] of [[0,.239],[-.022,.216],[.022,.216]])ellipsoid(visual,dark,[x,.073,z],[.008,.006,.008]).name='ocellus';
 for(const side of [-1,1]){
  ellipsoid(visual,gold,[side*.033,.027,.270],[.013,.019,.014]);
  ellipsoid(visual,cuticle,[side*.036,.006,.284],[.018,.029,.022]).name='funiculus';
  const start=V(side*.045,.02,.297),end=V(side*.108,.105,.314);segment(visual,start,end,.0018,dark);
  const hairs=[];for(let k=1;k<6;k++){const p=start.clone().lerp(end,k/7);for(const dir of [-1,1])hairs.push(p,p.clone().add(V(side*.012,dir*(.028-k*.002),.012)));}segments(visual,hairs,bristleMat).name='arista';
  ellipsoid(visual,gold,[side*.023,-.068,.268],[.009,.015,.026]).name='maxillary-palp';
 }
 // Macrochaetae and sparse microchaetae, batched into one draw call.
 const hairs=[];
 for(const side of [-1,1])for(let k=0;k<6;k++){const z=.112-k*.045,x=side*(k%2?.074:.043),y=.015+.127*Math.sqrt(Math.max(0,1-(z/.19)**2-(x/.17)**2));const a=V(x,y,z);hairs.push(a,a.clone().add(V(side*.014,.043,-.032)));}
 for(let i=0;i<95;i++){const a=rng()*Math.PI*2,z=(rng()*2-1)*.135,y=.015+.123*Math.sin(a),x=.136*Math.cos(a)*Math.sqrt(1-(z/.18)**2);if(y<.02)continue;const p=V(x,y,z);hairs.push(p,p.clone().add(V(x*.06,.008+rng()*.009,-.006)));}
 for(const side of [-1,1]){hairs.push(V(side*.055,.112,-.168),V(side*.065,.153,-.225));hairs.push(V(side*.06,.076,.233),V(side*.077,.118,.225));}
 segments(visual,hairs,bristleMat).name='thoracic-setae';
 // One pair of wings. Veins are children of the membrane rig and flap with it.
 const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(.06,.02,.16,.13,.18,.30);shape.bezierCurveTo(.20,.49,.13,.66,.048,.665);shape.bezierCurveTo(-.045,.63,-.078,.46,-.047,.25);shape.bezierCurveTo(-.037,.12,-.016,.05,0,0);
 const membraneMat=new THREE.MeshPhysicalMaterial({color:0xd7c8a0,transparent:true,opacity:.25,roughness:.24,metalness:0,side:THREE.DoubleSide,depthWrite:false,iridescence:.24,iridescenceIOR:1.32});
 const veinMat=new THREE.LineBasicMaterial({color:0x756448,transparent:true,opacity:.68});
 const wings=[];
 for(const side of [-1,1]){
  const pivot=new THREE.Group();pivot.position.set(.100*side,.105,-.02);visual.add(pivot);
  const rig=new THREE.Group();rig.rotation.x=-Math.PI/2;rig.scale.x=side;pivot.add(rig);
  mesh(rig,new THREE.ShapeGeometry(shape,40),membraneMat).castShadow=false;
  const paths=[[[0,0],[.066,.083],[.137,.22],[.166,.38],[.126,.555],[.048,.665]],[[.012,.04],[.034,.18],[.082,.33],[.094,.50],[.06,.645]],[[.004,.07],[.004,.22],[.03,.40],[.021,.635]],[[-.005,.07],[-.028,.22],[-.022,.43],[-.003,.584]],[[.035,.20],[.004,.24]],[[.080,.415],[.030,.44],[-.023,.42]]];
  for(const path of paths)line(rig,path.map(([x,y])=>[x,y,.001]),veinMat);
  line(rig,shape.getPoints(80).map(p=>[p.x,p.y,.001]),veinMat);
  wings.push({pivot,mesh:rig,side});
 }
 // Halteres: a pair of reduced hindwings behind the wing bases.
 const halteres=[];
 for(const side of [-1,1]){const h=new THREE.Group();h.position.set(side*.111,.018,-.139);segment(h,V(),V(side*.058,.032,-.038),.005,gold);ellipsoid(h,gold,[side*.065,.036,-.042],[.017,.022,.017]);visual.add(h);halteres.push({group:h,side});}
 const legs=[];
 for(let pair=0;pair<3;pair++)for(const side of [-1,1]){
  const group=new THREE.Group();visual.add(group);const parts=[];
  // coxa, trochanter, femur, tibia, and five distinct tarsomeres.
  for(const r of [.013,.010,.012,.007,.005,.0042,.0037,.0032,.0027])parts.push(mesh(group,new THREE.CylinderGeometry(r*.7,r,1,8),gold));
  const claws=new THREE.Group();for(const d of [-1,1])line(claws,[[d*.002,0,0],[d*.007,-.002,.007],[d*.005,-.006,.013]],bristleMat);group.add(claws);
  legs.push({group,parts,claws,side,pair,baseZ:.096-pair*.105,phase:((side<0&&pair!==1)||(side>0&&pair===1))?0:Math.PI});
 }
 const proboscis=new THREE.Group();proboscis.position.set(0,-.062,.249);
 segment(proboscis,V(),V(0,-.055,.072),.010,gold);for(const s of [-1,1])ellipsoid(proboscis,gold,[s*.009,-.058,.078],[.011,.008,.018]);proboscis.visible=false;visual.add(proboscis);
 const pick=mesh(visual,new THREE.SphereGeometry(.34,12,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),[0,0,-.04]);pick.userData.flyPick=true;pick.castShadow=false;
 Object.assign(g.userData,{visual,wings,halteres,legs,proboscis});g.scale.setScalar(1.20);return g;
}

export function animateFlyLegs(g,gait,f,feeding){
 const walking=f.mode==='ground'||f.mode==='landing';
 const stepping=f.mode==='ground'&&!feeding;
 g.updateWorldMatrix(true,true);
 for(const [legIndex,leg] of g.userData.legs.entries()){
  const {side:s,pair,baseZ:z}=leg;
  const k=stepping?tripodFoot(gait,{side:s,pair,offset:leg.phase}):{fore:0,lift:0,stance:true};
  leg.stance=walking&&k.stance;
  const spread=[.142,.012,-.145][pair];
  // Smaller stride amplitude is matched to body translation; the old value made feet scrub
  // backwards much faster than the fly moved, which looked like loss of coordination.
  const stride=.036*k.fore, lift=.046*k.lift;
  const base=V(.076*s,-.045,z),coxa=V(.097*s,-.067,z+spread*.05),troch=V(.116*s,-.073,z+spread*.16);
  const knee=walking?V(.179*s,-.064+lift*.28,z+spread*.52-stride*.16):V(.139*s,-.064,z-.045);
  const ankle=walking?V(.251*s,-.151+lift*.88,z+spread*.90+stride*.72):V(.184*s,-.104,z-.113);
  const foot=walking?V(.305*s,-.181+lift,z+spread+stride):V(.219*s,-.119,z-.162);
  if(f.corner&&walking){
   const target=cornerFoot(f.corner,leg,legIndex);leg.stance=target.stance;leg.supportSurface=target.surface;
   const c=f.corner,worldQ=new THREE.Quaternion().fromArray(c.start.quaternion).slerp(new THREE.Quaternion().fromArray(c.end.quaternion),target.blend);
   leg.claws.quaternion.copy(leg.group.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldQ));
   const local=leg.group.worldToLocal(target.point).sub(V(0,-.006,.013).applyQuaternion(leg.claws.quaternion)),delta=local.clone().sub(foot);
   // Keep proximal joints attached; distribute the reach through tibia and tarsus.
   knee.addScaledVector(delta,.35);ankle.addScaledVector(delta,.8);foot.copy(local);
  }else {leg.supportSurface=f.surface;leg.claws.quaternion.identity();}
  const points=[base,coxa,troch,knee,ankle];
  // Five tarsomeres follow a shallow arc. During stance the terminal claw remains nearly planar,
  // while during swing it lifts with the tibia instead of snapping through the floor.
  for(let i=1;i<=5;i++){
    const u=i/5,p=ankle.clone().lerp(foot,u);
    if(walking&&!k.stance)p.y+=Math.sin(Math.PI*u)*lift*.12;
    points.push(p);
  }
  leg.parts.forEach((m,i)=>{const a=points[i],b=points[i+1],d=b.clone().sub(a);m.position.copy(a).add(b).multiplyScalar(.5);m.scale.y=d.length();m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());});leg.claws.position.copy(foot);
 }
}

const textureCache=new Map();
function skin(type){
 if(textureCache.has(type))return textureCache.get(type);
 const rng=seededRandom(810+type.length),c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
 const palettes={apple:['#a51e22','#dd5542'],orange:['#ea7510','#ffc140'],banana:['#eec52e','#fae276'],grape:['#4e315e','#aa80a5'],strawberry:['#ab171e','#ed4240']};
 const [base,light]=palettes[type],grad=ctx.createLinearGradient(0,0,512,512);grad.addColorStop(0,light);grad.addColorStop(.5,base);grad.addColorStop(1,light);ctx.fillStyle=grad;ctx.fillRect(0,0,512,512);
 for(let i=0;i<11000;i++){const x=rng()*512,y=rng()*512;ctx.fillStyle=`rgba(${rng()>.45?'255,231,168':'75,32,16'},${.03+rng()*.10})`;ctx.beginPath();ctx.ellipse(x,y,.35+rng()*.75,type==='apple'?1.1+rng()*2:.5+rng(),0,0,Math.PI*2);ctx.fill();}
 if(type==='banana')for(let i=0;i<130;i++){ctx.fillStyle=`rgba(98,64,20,${.12+rng()*.3})`;ctx.beginPath();ctx.ellipse(rng()*512,rng()*512,.6+rng()*1.8,.6+rng()*2.2,0,0,Math.PI*2);ctx.fill();}
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
 // Independent microrelief avoids turning broad pigment gradients into geometry.
 const b=document.createElement('canvas');b.width=b.height=256;const bc=b.getContext('2d');bc.fillStyle='#888';bc.fillRect(0,0,256,256);
 for(let i=0;i<6000;i++){const grey=80+Math.floor(rng()*95);bc.fillStyle=`rgb(${grey},${grey},${grey})`;bc.beginPath();bc.arc(rng()*256,rng()*256,type==='orange'?1.2:.5,0,Math.PI*2);bc.fill();}
 const bump=new THREE.CanvasTexture(b),result={map,bump};textureCache.set(type,result);return result;
}
function fruitMaterial(type){const {map,bump}=skin(type);return new THREE.MeshPhysicalMaterial({map,bumpMap:bump,bumpScale:type==='orange'?.014:.003,roughness:type==='grape'?.46:type==='orange'?.62:.43,clearcoat:type==='apple'?.24:.08,clearcoatRoughness:.34});}
function leaf(parent,pos,scale=1,angle=0){
 const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.06,.08,-.04,.18,0,.24);shape.bezierCurveTo(.075,.15,.05,.04,0,0);
 const geo=new THREE.ShapeGeometry(shape,12);const p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getY(i)/.24*Math.PI)*.022);
 geo.computeVertexNormals();const group=new THREE.Group();group.position.set(...pos);group.rotation.order='YXZ';group.rotation.set(-Math.PI*.38,angle,.4);group.scale.setScalar(scale);parent.add(group);
 mesh(group,geo,new THREE.MeshStandardMaterial({color:0x46652a,side:THREE.DoubleSide,roughness:.77}));line(group,[[0,0,.001],[0,.12,.025],[0,.23,.005]],new THREE.LineBasicMaterial({color:0x82944b}));return group;
}
export function createFruitMesh(type){
 const root=new THREE.Group();root.userData.isFruit=true;root.userData.type=type;const visual=new THREE.Group();root.add(visual);root.userData.visual=visual;
 const mat=fruitMaterial(type),stemMat=new THREE.MeshStandardMaterial({color:0x65502a,roughness:.88});
 if(type==='apple'||type==='orange'){
  const geo=new THREE.SphereGeometry(1,64,48),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),polar=Math.abs(y),lobe=type==='apple'?1+.045*Math.cos(a*5)*(1-polar*.6):1+.008*Math.cos(a*7);
   const r=type==='apple'?.375:.363;let yy=y*(type==='apple'?.34:.35);
   if(type==='apple')yy-=.051*Math.exp(-(((1-y)/.10)**2));else yy-=.012*Math.exp(-(((1-y)/.05)**2));
   p.setXYZ(i,x*r*lobe,yy+.35,z*r*lobe);
  }geo.computeVertexNormals();mesh(visual,geo,mat);
  if(type==='apple'){segment(visual,V(0,.639,0),V(.024,.777,.01),.022,stemMat);leaf(visual,[.015,.712,0],.82,.6);}
  else{ellipsoid(visual,stemMat,[0,.688,0],[.038,.009,.035]);for(let i=0;i<5;i++){const l=leaf(visual,[0,.692,0],.22,i*Math.PI*2/5);l.rotation.z=0;}}
 }else if(type==='banana'){
  const path=new THREE.CatmullRomCurve3([V(-.46,.18,.09),V(-.29,.18,-.10),V(0,.18,-.19),V(.29,.22,-.10),V(.43,.30,.06)]);
  const geo=new THREE.TubeGeometry(path,52,.112,14,false),positions=geo.attributes.position;
  for(let i=0;i<=52;i++){const u=i/52,center=path.getPointAt(u),radius=.025+.09*Math.sin(Math.PI*u)**.45;
   for(let j=0;j<=14;j++){const k=i*15+j,p=V().fromBufferAttribute(positions,k).sub(center).multiplyScalar(radius/.112).add(center);positions.setXYZ(k,p.x,p.y,p.z);}}
  geo.computeVertexNormals();mesh(visual,geo,mat);
  for(const u of [0,1])ellipsoid(visual,mat,path.getPoint(u).toArray(),[.026,.026,.026]);
  const seamMat=new THREE.LineBasicMaterial({color:0xb39b39,transparent:true,opacity:.3});
  for(const j of [3,10]){const pts=[];for(let i=0;i<=52;i++)pts.push(V().fromBufferAttribute(positions,i*15+j).toArray());line(visual,pts,seamMat);}
  segment(visual,path.getPoint(0),V(-.49,.18,.13),.04,stemMat);segment(visual,path.getPoint(1),V(.48,.335,.10),.034,stemMat);
 }else if(type==='grape'){
  const rng=seededRandom(812);
  for(let layer=0;layer<4;layer++){const n=layer===3?3:5,r=layer===0?.09:.135;
   for(let j=0;j<n;j++){const a=j/n*Math.PI*2+layer*.7;const berry=ellipsoid(visual,mat,[Math.cos(a)*r,.13+layer*.124,Math.sin(a)*r],[.13,.135,.13]);berry.rotation.z=(rng()-.5)*.3;}}
  segment(visual,V(0,.5,0),V(.055,.68,-.025),.018,stemMat);
 }else{
  // Broad shoulders and rounded taper, with achenes on the actual surface.
  const profile=[];for(let i=0;i<=40;i++){const u=i/40;profile.push(new THREE.Vector2(.30*Math.sin(Math.PI*u)**.72*(.40+.60*u),.035+u*.55));}
  mesh(visual,new THREE.LatheGeometry(profile,64),mat);
  const seedMat=new THREE.MeshStandardMaterial({color:0xc6a64a,roughness:.6});
  const count=110,seeds=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),seedMat,count),dummy=new THREE.Object3D();
  for(let i=0;i<count;i++){const u=.13+.75*(i+.5)/count,a=i*2.399963,r=.30*Math.sin(Math.PI*u)**.72*(.40+.60*u);dummy.position.set(Math.cos(a)*(r+.002),.035+u*.55,Math.sin(a)*(r+.002));dummy.scale.set(.007,.013,.004);dummy.rotation.y=-a+Math.PI/2;dummy.updateMatrix();seeds.setMatrixAt(i,dummy.matrix);}visual.add(seeds);
  for(let i=0;i<7;i++){const l=leaf(visual,[0,.564,0],.52,i*Math.PI*2/7);l.rotation.z=0;}
  segment(visual,V(0,.56,0),V(.023,.66,.012),.018,stemMat);
 }
 const pick=mesh(visual,new THREE.CylinderGeometry(.57,.57,.82,18),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),[0,.40,0]);pick.userData.pickProxy=true;pick.castShadow=false;
 const ring=mesh(root,new THREE.TorusGeometry(.50,.012,8,48),new THREE.MeshBasicMaterial({color:0xd0a95f,transparent:true,opacity:0,depthWrite:false}),[0,.012,0]);ring.rotation.x=-Math.PI/2;ring.castShadow=false;root.userData.consumeRing=ring;
 root.userData.materials=[];visual.traverse(o=>{if(o.material&&!o.userData.pickProxy&&!root.userData.materials.includes(o.material))root.userData.materials.push(o.material);});return root;
}

