import * as THREE from '../vendor/three/build/three.module.js';
import {createFly,animateFlyLegs} from './models.js';
import {visibleBounds} from './containment.js';
import {advanceCorner} from './corner.js';
const up=new THREE.Vector3(0,1,0);
export function supportPlane(surface,half=6){
 const edge=half-.0175;
 if(surface==='floor')return {normal:up.clone(),constant:0,axis:'y'};
 const defs={'wall-x+':[-1,0,0],'wall-x-':[1,0,0],'wall-z+':[0,0,-1],'wall-z-':[0,0,1]};
 return defs[surface]?{normal:new THREE.Vector3(...defs[surface]),constant:-edge,axis:surface[5]}:null;
}
export function footContacts(root,plane,stanceOnly=true){
 root.updateWorldMatrix(true,true);
 return root.userData.legs.filter(l=>!stanceOnly||l.stance).map(l=>{
  const point=l.claws.localToWorld(new THREE.Vector3(0,-.006,.013));
  return {point,gap:point.dot(plane.normal)-plane.constant};
 });
}
export function poseFly(root,f,gait,feeding,t,frame){
 root.position.set(f.x,f.y,f.z);
 if(f.bodyQuaternion)root.quaternion.fromArray(f.bodyQuaternion);
 else root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.right,frame.normal,frame.forward));
 const air=f.mode!=='ground';
 // Ground contact takes precedence over decorative pitch/roll: all stance claws
 // must lie on the supporting plane. Airborne attitude remains free.
 root.userData.visual.rotation.set(air?(f.pitch||0):0,0,air?(f.roll||0):0,'XYZ');
 for(const w of root.userData.wings){w.pivot.rotation.y=-w.side*(air&&!f.landingSurface?1.04:.16);w.mesh.rotation.set(-Math.PI/2,air&&!f.landingSurface?Math.sin(t*88)*.65*w.side:.035*w.side,0);}
 const freq=f.mode==='flight'?118:f.mode==='takeoff'?126:f.mode==='landing'?90:14;
 for(const h of root.userData.halteres)h.group.rotation.z=(air?Math.sin(t*freq*.52+(h.side>0?.7:0))*.52:Math.sin(t*10)*.04)*h.side;
 animateFlyLegs(root,gait,f,feeding);
 root.userData.proboscis.visible=feeding;root.userData.proboscis.scale.z=1+.09*Math.sin(t*8.5);
}
export class FlyBodyCollider {
 constructor(){this.root=null;this.bounds=new THREE.Box3();this.q=new THREE.Quaternion();this.target=new THREE.Quaternion();this.matrix=new THREE.Matrix4();}
 resolve(f,gait,{frame,dt,t,feeding=false,half=6}={}){
  this.root??=createFly();
  const old={x:f.x,y:f.y,z:f.z};
  if(f.corner&&f.mode==='ground'){
   f.corner.gaitPhase??=gait.phase;gait.phase=f.corner.gaitPhase;
   advanceCorner(f,dt);poseFly(this.root,f,gait,false,t,frame);
   // Fit the whole animated body inside both panes, then restore anchored feet.
   for(let fit=0;fit<2;fit++){
   visibleBounds(this.root,this.bounds);const edge=half-.0175,b=this.bounds;
   for(const axis of ['x','z'])f[axis]+=b.max[axis]>edge?edge-b.max[axis]:b.min[axis]<-edge?-edge-b.min[axis]:0;
   f.y+=Math.max(0,-b.min.y);poseFly(this.root,f,gait,false,t,frame);
   }
   const feet=this.root.userData.legs.filter(l=>l.stance);
   const gaps=feet.map(l=>{const point=l.claws.localToWorld(new THREE.Vector3(0,-.006,.013)),plane=supportPlane(l.supportSurface,half);return Math.abs(point.dot(plane.normal)-plane.constant);});
   f.support={surface:f.surface,feet:feet.length,maxGap:Math.max(...gaps),transition:true};
   f.bodyContact={x:0,z:0,floor:0,supportLost:false,correction:{x:f.x-old.x,y:f.y-old.y,z:f.z-old.z}};
   if(f.corner.elapsed>=f.corner.duration)f.corner=null;
   return f.bodyContact;
  }
  if(f.mode!=='ground')f.corner=null;
  this.target.setFromRotationMatrix(this.matrix.makeBasis(frame.right,frame.normal,frame.forward));
  if(f.mode==='ground'||!f.bodyQuaternion)this.q.copy(this.target);
  else this.q.fromArray(f.bodyQuaternion).rotateTowards(this.target,Math.PI*3*dt);
  f.bodyQuaternion=this.q.toArray();poseFly(this.root,f,gait,feeding,t,frame);
  let plane=f.mode==='ground'?supportPlane(f.surface,half):null,supportLost=false;
  // Fit the tangent directions before testing support at a finite wall edge.
  // Otherwise a claw extending past the adjacent glass would cause a false fall.
  let edgeX=0,edgeZ=0;
  if(plane&&plane.axis!=='y'){
   visibleBounds(this.root,this.bounds);const b=this.bounds,edge=half-.0175;
   edgeX=plane.axis==='x'?0:b.max.x>edge?edge-b.max.x:b.min.x<-edge?-edge-b.min.x:0;
   edgeZ=plane.axis==='z'?0:b.max.z>edge?edge-b.max.z:b.min.z<-edge?-edge-b.min.z:0;
   f.x+=edgeX;f.z+=edgeZ;f.y+=Math.max(0,-b.min.y);this.root.position.set(f.x,f.y,f.z);
  }
  if(f.mode==='ground'){
   const feet=plane?footContacts(this.root,plane):[];
   const gap=feet.length?Math.min(...feet.map(p=>p.gap)):Infinity;
   const valid=plane&&Math.abs(gap)<.16&&feet.length>=3&&feet.every(({point})=>Math.abs(point.x)<=half+.02&&Math.abs(point.z)<=half+.02&&(plane.axis==='y'||point.y>=-.08&&point.y<=5.05));
   if(!valid){
    supportLost=true;plane=null;f.mode='flight';f.surface='air';f.modeTime=0;f.vy=Math.min(f.vy||0,-.2);gait.grounded=false;
    const forward=new THREE.Vector3(Math.cos(f.heading),0,Math.sin(f.heading)),right=up.clone().cross(forward);
    f.bodyQuaternion=this.q.setFromRotationMatrix(this.matrix.makeBasis(right,up,forward)).toArray();
    poseFly(this.root,f,gait,false,t,{forward,right,normal:up});
   }else{
    f.x-=plane.normal.x*gap;f.y-=plane.normal.y*gap;f.z-=plane.normal.z*gap;
    this.root.position.set(f.x,f.y,f.z);
   }
  }
  visibleBounds(this.root,this.bounds);const b=this.bounds,edge=half-.0175;
  // Tangential collision corrections can never move the body off its support.
  const dx=plane?.axis==='x'?0:b.max.x>edge?edge-b.max.x:b.min.x<-edge?-edge-b.min.x:0;
  const dz=plane?.axis==='z'?0:b.max.z>edge?edge-b.max.z:b.min.z<-edge?-edge-b.min.z:0;
  let floor=0;
  if(!plane){const feet=footContacts(this.root,supportPlane('floor'),false);floor=Math.max(0,-Math.min(...feet.map(p=>p.gap)));}
  else if(plane.axis!=='y')floor=Math.max(0,-b.min.y);
  f.x+=dx;f.y+=floor;f.z+=dz;this.root.position.set(f.x,f.y,f.z);
  f.bodyFloorHeight=f.y-b.min.y;
  const contacts=plane?footContacts(this.root,plane):[];
  f.support={surface:plane?f.surface:null,feet:contacts.length,maxGap:contacts.length?Math.max(...contacts.map(p=>Math.abs(p.gap))):null};
  f.bodyContact={x:dx+edgeX,z:dz+edgeZ,floor,supportLost,correction:{x:f.x-old.x,y:f.y-old.y,z:f.z-old.z}};
  return f.bodyContact;
 }
}
export function bodySensorFrame(f,fallback){
 if(!f.bodyQuaternion)return fallback;
 const q=new THREE.Quaternion().fromArray(f.bodyQuaternion);
 return {forward:new THREE.Vector3(0,0,1).applyQuaternion(q),right:new THREE.Vector3(1,0,0).applyQuaternion(q),normal:up.clone().applyQuaternion(q)};
}
