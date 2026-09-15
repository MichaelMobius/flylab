import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import {engine} from './regressions.test.mjs';
import {supportPlane,footContacts} from '../src/body.js';
const walls=['wall-x+','wall-x-','wall-z+','wall-z-'],dt=1/120;
test('all eight directed corners transfer support while walking forward and backward',()=>{
 for(const from of walls)for(const to of walls.filter(w=>w[5]!==from[5]))for(const sign of [1,-1]){
  const {state,ctx}=engine(),events=[];ctx.logEvent=(type,data)=>events.push({type,...data});
  ctx.attachWall(from,new THREE.Vector3(0,1,0));
  const targetSign=to.endsWith('+')?1:-1;
  state.fly[to[5]]=targetSign*4.95;state.fly.y=2;state.fly.speed=sign*.45;state.fly.modeTime=4;
  const dir=new THREE.Vector3(to[5]==='x'?targetSign:0,.15,to[5]==='z'?targetSign:0).normalize().multiplyScalar(sign);
  state.fly.heading=ctx.headingFromWorld(from,dir);state.gait.phase=.27;
  const expected=dir.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ctx.SURFACES[from].normal,ctx.SURFACES[to].normal));
  for(let i=0;i<450&&state.fly.surface===from;i++){
   state.t+=dt;state.fly.modeTime+=dt;ctx.moveOnSurface(dt,sign*.45,0);const y=state.fly.y;
   ctx.resolveBodyContact(dt);
   assert.equal(state.fly.mode,'ground',`${from} -> ${to}, sign ${sign}`);
   assert.equal(state.gait.phase,.27);assert(state.fly.support.feet>=3);assert(state.fly.support.maxGap<1e-7);
   if(state.fly.surface===to)assert(Math.abs(state.fly.y-y)<1e-8);
  }
  assert.equal(state.fly.surface,to,`${from} -> ${to}, sign ${sign}`);
  assert(ctx.surfaceFrame(to,state.fly.heading).forward.dot(expected)>.999999);
  assert(Math.abs(state.fly.speed-sign*.45)<1e-9);assert(state.fly.modeTime>=4);
  const feet=footContacts(ctx.bodyCollider.root,supportPlane(to));
  assert(feet.every(({point})=>Math.abs(point.x)<=6.00001&&Math.abs(point.z)<=6.00001&&point.y>=0));
  for(let i=0;i<90;i++){ctx.moveOnSurface(dt,sign*.45,0);ctx.resolveBodyContact(dt);assert.equal(state.fly.surface,to);assert.equal(state.fly.mode,'ground');}
  assert.equal(events.filter(e=>e.type==='wall-transfer').length,1);
  assert.equal(events.find(e=>e.type==='wall-transfer').source,'body-contact');
 }
});
test('vertical climbing next to a corner does not invent a lateral transfer',()=>{
 const {state,ctx}=engine();ctx.attachWall('wall-x+',new THREE.Vector3(0,1,0));
 Object.assign(state.fly,{y:2,z:5.7,heading:Math.PI/2,speed:.3});
 for(let i=0;i<100;i++){ctx.moveOnSurface(dt,.3,0);ctx.resolveBodyContact(dt);assert.equal(state.fly.surface,'wall-x+');assert.equal(state.fly.mode,'ground');}
});
