import * as THREE from '../vendor/three/build/three.module.js';

// Staged kinematic contact transfer. Foot targets stay on the two real planes;
// only the pair changing support is allowed to swing between them.
export function captureCornerPose(root,f){
 root.updateWorldMatrix(true,true);
 return {position:[f.x,f.y,f.z],quaternion:[...f.bodyQuaternion],feet:root.userData.legs.map(l=>{const point=l.claws.localToWorld(new THREE.Vector3(0,-.006,.013));point[f.surface[5]]=(f.surface.endsWith('+')?1:-1)*5.9825;return point.toArray();})};
}
export function startCorner(f,from,to,start,end){
 f.corner={from,to,start,end,elapsed:0,duration:.72,reverse:f.speed<0};
 Object.assign(f,{x:start.position[0],y:start.position[1],z:start.position[2],bodyQuaternion:[...start.quaternion]});
}
export function advanceCorner(f,dt){
 const c=f.corner;c.elapsed=Math.min(c.duration,c.elapsed+dt);
 const u=c.elapsed/c.duration,s=u*u*(3-2*u);
 const p=new THREE.Vector3().fromArray(c.start.position).lerp(new THREE.Vector3().fromArray(c.end.position),s);
 f.x=p.x;f.y=p.y;f.z=p.z;
 f.bodyQuaternion=new THREE.Quaternion().fromArray(c.start.quaternion).slerp(new THREE.Quaternion().fromArray(c.end.quaternion),s).toArray();
}
export function cornerFoot(c,leg,index){
 const order=c.reverse?2-leg.pair:leg.pair;
 const u=THREE.MathUtils.clamp(c.elapsed/c.duration*3-order,0,1),s=u*u*(3-2*u);
 const a=new THREE.Vector3().fromArray(c.start.feet[index]),b=new THREE.Vector3().fromArray(c.end.feet[index]);
 const point=a.lerp(b,s);
 // A small inward lift clears the glass during swing. Other four feet stay fixed.
 if(u>0&&u<1){point[c.from[5]]-=(c.from.endsWith('+')?1:-1)*.015*Math.sin(Math.PI*u);point[c.to[5]]-=(c.to.endsWith('+')?1:-1)*.015*Math.sin(Math.PI*u);}
 return {point,blend:s,stance:u===0||u===1,surface:u===1?c.to:c.from};
}
