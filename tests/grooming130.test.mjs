import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import {engine} from './regressions.test.mjs';
import {updateGrooming,groomingTarget,groomingPole} from '../src/grooming.js';
import {legRest,solveLeg} from '../src/leg-ik.js';
function segmentHitsEye(a,b,eyeSide){
 const center=new THREE.Vector3(.092*eyeSide,.002,.201),radii=new THREE.Vector3(.050,.096,.076);
 for(let i=0;i<=200;i++){
  const p=a.clone().lerp(b,i/200),d=p.clone().sub(center);
  const q=(d.x/radii.x)**2+(d.y/radii.y)**2+(d.z/radii.z)**2;
  if(q<1)return true;
 }
 return false;
}
test('front-leg rubbing crosses the midline, keeps segment lengths, and clears the compound eyes',()=>{
 let crossed=false;
 for(let i=0;i<=480;i++)for(const side of [-1,1]){
  const rest=legRest(side,0),target=groomingTarget({pair:0,side,rest},i/120),pole=groomingPole({pair:0,side,rest},i/120),ik=solveLeg(rest,target,pole,2.3);
  if(target.x*side<0)crossed=true;
  assert(ik.error<1e-6,`target unreachable at ${i}: ${ik.error}`);
  for(let j=0;j<9;j++)assert(Math.abs(ik.points[j].distanceTo(ik.points[j+1])-rest.lengths[j])<1e-10);
  for(let j=0;j<ik.points.length-1;j++){
   assert(!segmentHitsEye(ik.points[j],ik.points[j+1],-1),`left eye penetration at ${i} segment ${j}`);
   assert(!segmentHitsEye(ik.points[j],ik.points[j+1],1),`right eye penetration at ${i} segment ${j}`);
  }
 }
 assert(crossed);
});
test('grooming keeps four supporting feet on floor and walls and resumes walking',()=>{
 for(const surface of ['floor','wall-x+','wall-x-','wall-z+','wall-z-']){
  const {ctx,state,step}=engine();if(surface!=='floor'){ctx.attachWall(surface,new THREE.Vector3(0,1,0));state.fly.y=2;}
  ctx.resolveBodyContact(0);updateGrooming(state.fly,0,{request:true,support:6});
  let activeTicks=0;
  for(let i=0;i<490;i++){
   step(1/120);assert.equal(state.fly.mode,'ground',surface+' tick '+i);
   if(state.fly.groom.active){activeTicks++;assert(state.fly.support.feet>=4);assert(state.fly.support.maxGap<1e-7);}
  }
  assert(activeTicks>400);assert.equal(state.fly.groom.active,false);
  for(let i=0;i<120;i++)step(1/120);assert(state.fly.speed>.05);
 }
});
test('manual takeoff interrupts grooming and feeding/corners postpone it',()=>{
 const {ctx,state,step}=engine();ctx.resolveBodyContact(0);updateGrooming(state.fly,0,{request:true,support:6});assert(state.fly.groom.active);
 state.fly.command='takeoff';step(1/120);assert.equal(state.fly.mode,'takeoff');assert(!state.fly.groom.active);
 for(const condition of [{feeding:true},{corner:{}}]){
  const f={mode:'ground',speed:0,corner:condition.corner};updateGrooming(f,1,{request:true,support:6,feeding:condition.feeding});assert(!f.groom.active);assert(!f.groom.pause);
 }
});
