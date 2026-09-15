import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import {engine} from './regressions.test.mjs';
import {createFly} from '../src/models.js';
import {poseFly} from '../src/body.js';
import {visibleBounds} from '../src/containment.js';
const dt=1/120;
test('physical position, rendered position and sensory origin agree after glass contact',()=>{
 const {state,ctx}=engine(),rendered=createFly();
 Object.assign(state.fly,{x:5.95,z:5.95,y:1,mode:'flight',surface:'air',heading:Math.PI/4,speed:1});
 ctx.resolveBodyContact(dt);
 poseFly(rendered,state.fly,state.gait,false,state.t,ctx.surfaceFrame('floor',state.fly.heading));
 assert.equal(rendered.position.x,state.fly.x);assert.equal(rendered.position.z,state.fly.z);
 const bounds=visibleBounds(rendered);assert(bounds.max.x<=5.9825+1e-8);assert(bounds.max.z<=5.9825+1e-8);
 const sensor=ctx.antennaPositions();assert(Math.hypot(sensor.center.x-state.fly.x,sensor.center.y-state.fly.y,sensor.center.z-state.fly.z)<.26);
 assert(Math.cos(state.fly.heading)<0&&Math.sin(state.fly.heading)<0);
});
test('body contact attaches to glass before the point collider reaches the wall',()=>{
 const {state,ctx}=engine();Object.assign(state.fly,{x:5.7,heading:0,speed:.3});
 ctx.resolveBodyContact(dt);assert.equal(state.fly.surface,'wall-x+');assert(state.fly.x<5.78);
});
test('floor to wall orientation follows the supporting plane without suspended feet',()=>{
 const {state,ctx}=engine();ctx.resolveBodyContact(dt);
 const initial=new THREE.Quaternion().fromArray(state.fly.bodyQuaternion);
 ctx.attachWall('wall-x+',new THREE.Vector3(1,0,0));state.fly.y=1;
 ctx.resolveBodyContact(dt);const next=new THREE.Quaternion().fromArray(state.fly.bodyQuaternion);
 assert(initial.angleTo(next)>0);assert(state.fly.support.feet>=3);assert(state.fly.support.maxGap<1e-7);
 for(let i=0;i<60;i++){
  state.t+=dt;ctx.resolveBodyContact(dt);
  const bounds=visibleBounds(ctx.bodyCollider.root);
  assert(bounds.max.x<=5.9825+1e-8);assert(bounds.min.y>=-1e-8);
 }
});
test('physical contact corrections cannot masquerade as wall walking progress',()=>{
 const {state,ctx,step}=engine(),events=[];
 ctx.logEvent=(type,data)=>events.push({type,...data});ctx.maleMotor=()=>({controlReady:true,v:0,turn:0,takeoffTriggered:false});
 ctx.attachWall('wall-x+',new THREE.Vector3(1,0,0));state.fly.y=2;
 for(let i=0;i<650&&state.fly.mode==='ground';i++)step(dt);
 assert(['takeoff','flight'].includes(state.fly.mode));assert.equal(events.at(-1).reason,'wall-stall');
});
