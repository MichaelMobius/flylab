import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import {engine} from './regressions.test.mjs';
import {supportPlane,footContacts,poseFly} from '../src/body.js';
import {createFly} from '../src/models.js';
import {updateTripodGait} from '../src/gait.js';
import {visibleBounds} from '../src/containment.js';
const surfaces=['floor','wall-x+','wall-x-','wall-z+','wall-z-'];
test('tiny instanced eye facets do not create a unit-sized invisible collider',()=>{
 const root=new THREE.Group(),facets=new THREE.InstancedMesh(new THREE.SphereGeometry(1),new THREE.MeshBasicMaterial(),1);
 facets.setMatrixAt(0,new THREE.Matrix4().makeScale(.01,.01,.01).setPosition(0,.05,0));root.add(facets);
 const b=visibleBounds(root);assert(b.max.x<.011);assert(b.min.y>.039);assert(b.max.y<.061);
});
test('stance claws touch actual floor or inner glass across headings, gait phases and feeding',()=>{
 const rendered=createFly();
 for(const surface of surfaces){
  const {state,ctx}=engine();if(surface!=='floor'){ctx.attachWall(surface,new THREE.Vector3(1,0,0));state.fly.y=2;}
  for(let i=0;i<120;i++){
   const feeding=i>=100;state.fly.heading=i*Math.PI/60;state.metabolism.feeding=feeding;
   updateTripodGait(state.gait,1/120,{grounded:true,feeding,speed:.4,desiredSpeed:.4,turn:.3});
   ctx.resolveBodyContact(1/120);
   assert.equal(state.fly.mode,'ground');assert.equal(state.fly.surface,surface);
   poseFly(rendered,state.fly,state.gait,feeding,i/120,ctx.surfaceFrame(surface,state.fly.heading));
   const contacts=footContacts(rendered,supportPlane(surface));
   assert(contacts.length>=3);assert(contacts.every(p=>Math.abs(p.gap)<1e-7),`${surface}, phase ${i}`);
   for(const {point} of contacts){assert(Math.abs(point.x)<=6.001&&Math.abs(point.z)<=6.001);assert(point.y>=-1e-7&&point.y<=5.05);}
  }
 }
});
test('ground state without reachable real support becomes airborne instead of snapping to an invisible plane',()=>{
 for(const surface of surfaces){
  const {state,ctx}=engine();Object.assign(state.fly,{surface,mode:'ground',x:0,y:2,z:0});
  ctx.resolveBodyContact(1/120);
  assert.equal(state.fly.mode,'flight');assert.equal(state.fly.surface,'air');assert.equal(state.fly.support.feet,0);
  assert.equal(state.fly.x,0);assert.equal(state.fly.z,0);assert(state.fly.vy<0);
 }
});
test('wing pose cannot establish floor support before the feet arrive',()=>{
 const {state,ctx}=engine();Object.assign(state.fly,{mode:'landing',surface:'air',y:.7,vy:-.3,pitch:0});
 ctx.resolveBodyContact(1/120);assert.equal(state.fly.mode,'landing');assert.equal(state.fly.support.feet,0);
 state.fly.y=.18;ctx.resolveBodyContact(1/120);assert.equal(state.fly.mode,'ground');assert(state.fly.support.feet>=3);assert(state.fly.support.maxGap<1e-7);
});
