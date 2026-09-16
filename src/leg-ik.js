import * as THREE from '../vendor/three/build/three.module.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;
// Model limits, not measured biological constants. Angles are radians.
export const JOINT_LIMITS=Object.freeze({kneeMin:.12,kneeMax:2.85,hipCone:2.3,ankleMax:2.8,reachCone:1.48});
function boundDirection(direction,axis,min,max){
 const angle=direction.angleTo(axis),target=clamp(angle,min,max);
 if(Math.abs(target-angle)<1e-10)return direction;
 let rotation=axis.clone().cross(direction);
 if(rotation.lengthSq()<1e-12)rotation=axis.clone().cross(Math.abs(axis.y)<.9?V(0,1,0):V(1,0,0));
 return axis.clone().applyAxisAngle(rotation.normalize(),target);
}
export function legRest(side,pair){
 const z=.096-pair*.105,spread=[.142,.012,-.145][pair];
 const base=V(.076*side,-.045,z),coxa=V(.097*side,-.067,z+spread*.05),hip=V(.116*side,-.073,z+spread*.16);
 const foot=V(.305*side,-.181,z+spread);
 const lengths=[base.distanceTo(coxa),coxa.distanceTo(hip),[.155,.165,.180][pair],[.180,.19,.21][pair],.014,.012,.011,.009,.008];
 return {base,coxa,hip,foot,lengths,axis:foot.clone().sub(hip).normalize(),distal:V(side*.88,-.48,0).normalize()};
}
export function solveLeg(rest,target,pole=V(0,1,0),reachCone=JOINT_LIMITS.reachCone){
 const L=rest.lengths,a=L[2],b=L[3],tail=L.slice(4).reduce((x,y)=>x+y,0);
 const ankleTarget=target.clone().addScaledVector(rest.distal,-tail),direction=ankleTarget.clone().sub(rest.hip);
 let distance=direction.length();direction.normalize();
 const hipAngle=Math.acos(clamp(direction.dot(rest.axis),-1,1));
 if(hipAngle>reachCone)direction.copy(boundDirection(direction,rest.axis,0,reachCone));
 // knee angle = turning angle between femur and tibia (zero means straight).
 const minD=Math.sqrt(a*a+b*b+2*a*b*Math.cos(JOINT_LIMITS.kneeMax));
 const maxD=Math.sqrt(a*a+b*b+2*a*b*Math.cos(JOINT_LIMITS.kneeMin));
 distance=clamp(distance,minD,maxD);
 const ankle=rest.hip.clone().addScaledVector(direction,distance);
 let bend=pole.clone().addScaledVector(direction,-pole.dot(direction));
 if(bend.lengthSq()<1e-8)bend=V(0,0,1).addScaledVector(direction,-direction.z);
 bend.normalize();
 const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
 const knee=rest.hip.clone().addScaledVector(direction,along).addScaledVector(bend,height);
 const upper=boundDirection(knee.clone().sub(rest.hip).normalize(),rest.axis,0,JOINT_LIMITS.hipCone);
 knee.copy(rest.hip).addScaledVector(upper,a);
 const lower=boundDirection(ankle.clone().sub(knee).normalize(),upper,JOINT_LIMITS.kneeMin,JOINT_LIMITS.kneeMax);
 ankle.copy(knee).addScaledVector(lower,b);
 const distal=boundDirection(rest.distal.clone(),lower,0,JOINT_LIMITS.ankleMax);
 const points=[rest.base.clone(),rest.coxa.clone(),rest.hip.clone(),knee,ankle];
 let tip=ankle.clone();for(const length of L.slice(4)){tip=tip.clone().addScaledVector(distal,length);points.push(tip);}
 return {points,error:tip.distanceTo(target),kneeAngle:upper.angleTo(lower),hipAngle:upper.angleTo(rest.axis),ankleAngle:lower.angleTo(distal)};
}
