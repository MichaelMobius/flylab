import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import {legRest,solveLeg,JOINT_LIMITS} from '../src/leg-ik.js';
import {engine} from './regressions.test.mjs';
import {visibleBounds} from '../src/containment.js';
test('IK preserves all nine segment lengths for reachable and impossible targets',()=>{
 for(const side of [-1,1])for(let pair=0;pair<3;pair++){
  const rest=legRest(side,pair);
  for(let i=0;i<100;i++){
   const target=new THREE.Vector3(Math.sin(i*.67)*.7,Math.cos(i*.43)*.7,Math.sin(i*.27)*.7),ik=solveLeg(rest,target);
   for(let j=0;j<9;j++)assert(Math.abs(ik.points[j].distanceTo(ik.points[j+1])-rest.lengths[j])<1e-10);
   const upper=ik.points[3].clone().sub(ik.points[2]).normalize(),lower=ik.points[4].clone().sub(ik.points[3]).normalize();
   const angle=upper.angleTo(lower);assert(angle>=JOINT_LIMITS.kneeMin-1e-8&&angle<=JOINT_LIMITS.kneeMax+1e-8);
   assert(upper.angleTo(rest.axis)<=JOINT_LIMITS.hipCone+1e-8);
   assert(lower.angleTo(ik.points[5].clone().sub(ik.points[4]))<=JOINT_LIMITS.ankleMax+1e-8);
  }
 }
});
test('planted feet stay at fixed world points during translation and turning on floor and four walls',()=>{
 for(const surface of ['floor','wall-x+','wall-x-','wall-z+','wall-z-']){
  const {state,ctx}=engine();if(surface!=='floor'){ctx.attachWall(surface,new THREE.Vector3(0,1,0));state.fly.y=2;}
  const previous=[];let retained=0,lifts=0;
  for(let tick=0;tick<360;tick++){
   ctx.updateTripodGait(state.gait,1/120,{grounded:true,speed:.35,desiredSpeed:.35,turn:.18});
   ctx.moveOnSurface(1/120,.35,.15);ctx.resolveBodyContact(1/120);
   assert.equal(state.fly.mode,'ground');
   const root=ctx.bodyCollider.root;root.updateWorldMatrix(true,true);
   for(const [i,l] of root.userData.legs.entries()){
    const anchor=state.fly.legAnchors[i],point=l.claws.localToWorld(new THREE.Vector3(0,-.006,.013));
    if(l.stance&&anchor&&previous[i]?.anchor===anchor){assert(point.distanceTo(previous[i].point)<1e-8);retained++;}
    if(!l.stance&&previous[i]?.stance)lifts++;
    previous[i]={point,anchor,stance:l.stance};
    for(let j=0;j<9;j++)assert(Math.abs(l.parts[j].scale.y-l.rest.lengths[j])<1e-10);
   }
  }
  assert(retained>500);assert(lifts>10);
 }
});
test('wall landing aligns before contact, keeps wings active in approach and folds them after adhesion',()=>{
 const {ctx,state,step}=engine();Object.assign(state.fly,{mode:'landing',surface:'air',x:5.2,y:2,z:0,heading:0,speed:.5,vy:0,modeTime:3});
 const fr=ctx.surfaceFrame('floor',0);state.fly.bodyQuaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(fr.right,fr.normal,fr.forward)).toArray();
 let sawApproach=false,sawRotation=false,previous=null;
 for(let i=0;i<500&&state.fly.mode!=='ground';i++){
  step(1/120);const f=state.fly;
  if(f.mode==='landing'&&f.landingSurface){sawApproach=true;assert.equal(f.wingFold,0);assert(Math.abs(ctx.bodyCollider.root.userData.wings[0].pivot.rotation.y)>1);}
  if(previous){const q=new THREE.Quaternion().fromArray(f.bodyQuaternion);if(q.angleTo(previous)>.001)sawRotation=true;assert(q.angleTo(previous)<.15);}
  previous=new THREE.Quaternion().fromArray(f.bodyQuaternion);
 }
 assert(sawApproach&&sawRotation);assert.equal(state.fly.surface,'wall-x+');assert(state.fly.landingAligned);assert.equal(state.fly.wingFold,0);
 for(let i=0;i<40;i++)step(1/120);assert.equal(state.fly.wingFold,1);assert(state.fly.support.feet>=3);
});
