import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import {engine} from './regressions.test.mjs';
import {createFly,animateFlyLegs} from '../src/models.js';
import {createTripodGaitState} from '../src/gait.js';
import {confineFlyVisual,visibleBounds} from '../src/containment.js';

test('all four walls return to floor inward, including reverse walking',()=>{
 for(const wall of ['wall-x+','wall-x-','wall-z+','wall-z-'])for(const reverse of [false,true]){
  const {state,ctx}=engine();ctx.attachWall(wall,new THREE.Vector3(1,0,0));
  Object.assign(state.fly,{y:.23,heading:reverse?Math.PI/2:-Math.PI/2,speed:reverse?-.3:.3});
  ctx.moveOnSurface(1/120,state.fly.speed,0);
  assert.equal(state.fly.surface,'floor');
  const normal=ctx.SURFACES[wall].normal;
  assert(Math.cos(state.fly.heading)*normal.x+Math.sin(state.fly.heading)*normal.z>.99);
  for(let tick=0;tick<120;tick++)ctx.moveOnSurface(1/120,.3,0);
  assert.equal(state.fly.surface,'floor');
 }
});
test('stalled MaleCNS wall control exits at low and high altitude with a body-assist event',()=>{
 for(const y of [.3,2]){
  const {state,ctx}=engine(),events=[];
  ctx.logEvent=(type,data)=>events.push({type,...data});
  ctx.maleMotor=()=>({controlReady:true,v:0,turn:0,takeoffTriggered:false});
  ctx.attachWall('wall-x+',new THREE.Vector3(1,0,0));state.fly.y=y;
  for(let tick=0;tick<510&&state.fly.surface==='wall-x+';tick++){
   state.fly.modeTime+=1/120;ctx.moveOnSurface(1/120,0,0);
   ctx.autonomousModeDecision(0,{approach:0},1/120);
  }
  assert.notEqual(state.fly.surface,'wall-x+');
  assert.equal(state.fly.mode,y<.65?'ground':'takeoff');
  assert.equal(events[0].source,'body-assist');
  assert.equal(events[0].reason,'wall-stall');
 }
});
test('continued wall movement is not interrupted solely by elapsed residence time',()=>{
 const {state,ctx}=engine();ctx.maleMotor=()=>({controlReady:true,takeoffTriggered:false});
 ctx.attachWall('wall-z-',new THREE.Vector3(0,0,-1));state.fly.y=2;
 state.fly.modeTime=2;ctx.autonomousModeDecision(0,{},1/120);assert.equal(state.fly.mode,'ground');
 state.fly.modeTime=14.1;ctx.autonomousModeDecision(0,{},1/120);assert.equal(state.fly.mode,'ground');
 assert.equal(state.fly.surface,'wall-z-');
});
test('animated fly geometry stays inside glass at all four corners and varied orientations',()=>{
 const fly=createFly(),gait=createTripodGaitState();
 for(const x of [-5.78,5.78])for(const z of [-5.78,5.78])for(let pose=0;pose<8;pose++){
  fly.position.set(x,1,z);fly.rotation.set(pose%2?Math.PI/2:0,pose*Math.PI/4,.2);
  gait.phase=pose;gait.amplitude=1;
  animateFlyLegs(fly,gait,{mode:pose%2?'flight':'ground'},false);
  for(const w of fly.userData.wings){w.pivot.rotation.y=-w.side*(pose%2?1.04:.16);w.mesh.rotation.set(-Math.PI/2,.65*w.side,0);}
  confineFlyVisual(fly);const b=visibleBounds(fly);
  assert(b.min.x>=-5.975-1e-8&&b.max.x<=5.975+1e-8);
  assert(b.min.z>=-5.975-1e-8&&b.max.z<=5.975+1e-8);
 }
});
