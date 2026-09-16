import * as THREE from '../vendor/three/build/three.module.js';
import {legRest,solveLeg} from './leg-ik.js';

// Staged kinematic contact transfer. Foot targets stay on the two real planes;
// only the pair changing support is allowed to swing between them.
export function captureCornerPose(root,f){
 root.updateWorldMatrix(true,true);
 return {position:[f.x,f.y,f.z],quaternion:[...f.bodyQuaternion],feet:root.userData.legs.map(l=>{const point=l.claws.localToWorld(new THREE.Vector3(0,-.006,.013));point[f.surface[5]]=(f.surface.endsWith('+')?1:-1)*5.9825;return point.toArray();})};
}
export function startCorner(f,from,to,start,end){
 f.corner={from,to,start,end,elapsed:0,duration:1.2,reverse:f.speed<0};
 Object.assign(f,{x:start.position[0],y:start.position[1],z:start.position[2],bodyQuaternion:[...start.quaternion]});
}
export function advanceCorner(f,dt){
 const c=f.corner;c.elapsed=Math.min(c.duration,c.elapsed+dt);
 const u=c.elapsed/c.duration,s=u*u*(3-2*u);
 const p=new THREE.Vector3().fromArray(c.start.position).lerp(new THREE.Vector3().fromArray(c.end.position),s);
 f.x=p.x;f.y=p.y;f.z=p.z;
 f.bodyQuaternion=new THREE.Quaternion().fromArray(c.start.quaternion).slerp(new THREE.Quaternion().fromArray(c.end.quaternion),s).toArray();
}
function legacyCornerFoot(c,leg,index){
 const order=c.reverse?2-leg.pair:leg.pair;
 const u=THREE.MathUtils.clamp(c.elapsed/c.duration*3-order,0,1),s=u*u*(3-2*u);
 const a=new THREE.Vector3().fromArray(c.start.feet[index]),b=new THREE.Vector3().fromArray(c.end.feet[index]);
 const point=a.lerp(b,s);
 // A small inward lift clears the glass during swing. Other four feet stay fixed.
 if(u>0&&u<1){point[c.from[5]]-=(c.from.endsWith('+')?1:-1)*.015*Math.sin(Math.PI*u);point[c.to[5]]-=(c.to.endsWith('+')?1:-1)*.015*Math.sin(Math.PI*u);}
 return {point,blend:s,stance:u===0||u===1,surface:u===1?c.to:c.from};
}

export function planCornerFeet(f){
 const c=f.corner,period=.12,cycle=Math.min(9,Math.floor((c.elapsed+1e-8)/period));
 if(c.cycle===cycle)return;
 c.plans??=c.start.feet.map(point=>({point:[...point],surface:c.from}));
 if(c.cycle!==undefined)for(const p of c.plans)if(p.target){p.point=p.target;p.surface=p.next;p.target=null;}
 c.cycle=cycle;
 const u=Math.min(1,(cycle+1)*period/c.duration),s=u*u*(3-2*u);
 const q=new THREE.Quaternion().fromArray(c.start.quaternion).slerp(new THREE.Quaternion().fromArray(c.end.quaternion),s);
 const pos=new THREE.Vector3().fromArray(c.start.position).lerp(new THREE.Vector3().fromArray(c.end.position),s);
 for(let i=0;i<6;i++){
  const pair=Math.floor(i/2),side=i%2?1:-1,tripod=((side<0&&pair!==1)||(side>0&&pair===1))?0:1;
  if(tripod!==cycle%2)continue;
  const p=c.plans[i],rest=legRest(side,pair);
  const tip=rest.foot.clone().add(new THREE.Vector3(0,-.006,.013)).multiplyScalar(1.2).applyQuaternion(q).add(pos);
  const evaluate=wall=>{
   const point=tip.clone();point[wall[5]]=(wall.endsWith('+')?1:-1)*5.9825;
   const other=wall[5]==='x'?'z':'x';point[other]=THREE.MathUtils.clamp(point[other],-5.96,5.96);
   let error=0;
   for(const fraction of [u,Math.min(1,u+.10)]){
    const smooth=fraction*fraction*(3-2*fraction),rotation=new THREE.Quaternion().fromArray(c.start.quaternion).slerp(new THREE.Quaternion().fromArray(c.end.quaternion),smooth);
    const center=new THREE.Vector3().fromArray(c.start.position).lerp(new THREE.Vector3().fromArray(c.end.position),smooth);
    const localQ=rotation.clone().invert().multiply(new THREE.Quaternion().fromArray(wall===c.from?c.start.quaternion:c.end.quaternion));
    const target=point.clone().sub(center).applyQuaternion(rotation.clone().invert()).divideScalar(1.2).sub(new THREE.Vector3(0,-.006,.013).applyQuaternion(localQ));
    error+=solveLeg(rest,target).error;
   }
   return {wall,point,score:error*100+point.distanceTo(tip)};
  };
  const candidates=[evaluate(c.from),evaluate(c.to)].sort((a,b)=>a.score-b.score),best=candidates[0],wall=best.wall;tip.copy(best.point);
  p.target=tip.toArray();p.next=wall;
 }
}
export function cornerFoot(c,leg,index){
 if(!c.plans)return legacyCornerFoot(c,leg,index);
 const p=c.plans[index],u=THREE.MathUtils.clamp((c.elapsed-c.cycle*.12)/.12,0,1),s=u*u*(3-2*u);
 const point=new THREE.Vector3().fromArray(p.point);
 if(p.target){point.lerp(new THREE.Vector3().fromArray(p.target),s);for(const wall of [c.from,c.to])point[wall[5]]-=(wall.endsWith('+')?1:-1)*.022*Math.sin(Math.PI*u);}
 const surface=p.target&&u>=1?p.next:p.surface;
 return {point,stance:!p.target||u>=1,surface,blend:p.target?((p.surface===c.to?1:0)*(1-s)+(p.next===c.to?1:0)*s):(surface===c.to?1:0)};
}
