import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import * as THREE from '../vendor/three/build/three.module.js';
import {engine} from './regressions.test.mjs';import {visibleBounds} from '../src/containment.js';import {poseFly} from '../src/body.js';
const walls=['wall-x+','wall-x-','wall-z+','wall-z-'];
test('staged corners keep four anchors, continuous attitude and body inside real glass on all routes',()=>{
 for(const from of walls)for(const to of walls.filter(w=>w[5]!==from[5]))for(const sign of [1,-1]){
  const {ctx,state}=engine(),f=state.fly;ctx.attachWall(from,new THREE.Vector3(0,1,0));
  f[to[5]]=(to.endsWith('+')?1:-1)*5.1;f.y=2;f.speed=sign*.45;
  state.gait.phase=sign>0?4.7:1.9;state.gait.amplitude=.6;
  const dir=new THREE.Vector3();dir[to[5]]=(to.endsWith('+')?1:-1)*sign;f.heading=ctx.headingFromWorld(from,dir);
  for(let i=0;i<300&&!f.corner;i++){ctx.moveOnSurface(1/120,sign*.45,0);ctx.resolveBodyContact(1/120);}
  assert(f.corner);let steps=0;let q=new THREE.Quaternion().fromArray(f.bodyQuaternion);let position=new THREE.Vector3(f.x,f.y,f.z);
  while(f.corner&&steps++<100){
   ctx.moveOnSurface(1/120,sign*.45,0);ctx.resolveBodyContact(1/120);
   const next=new THREE.Quaternion().fromArray(f.bodyQuaternion),pos=new THREE.Vector3(f.x,f.y,f.z);
   assert(q.angleTo(next)<.04,'no attitude snap');assert(position.distanceTo(pos)<.06,'no position jump');q=next;position=pos;
   assert.equal(f.mode,'ground');assert(f.support.feet>=4);assert(f.support.maxGap<1e-7);
   const b=visibleBounds(ctx.bodyCollider.root,new THREE.Box3());
   assert(b.max.x<=5.985&&b.min.x>=-5.985&&b.max.z<=5.985&&b.min.z>=-5.985,JSON.stringify({from,to,sign,steps,min:b.min,max:b.max}));
  }
  assert(steps>=80&&steps<=88);assert.equal(f.corner,null);
  ctx.resolveBodyContact(1/120);assert.equal(f.mode,'ground');assert(f.support.maxGap<1e-7);
 }
});
test('ocular camera stays at head and faces travel on floor, every wall and air despite stale orbit target',()=>{
 const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 function extract(name){const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}
 for(const surface of ['floor',...walls,'air'])for(const speed of [.4,-.4,0]){
  const {ctx:engineCtx,state}=engine();state.fly.surface=surface;state.fly.mode=surface==='air'?'flight':'ground';state.fly.y=2;state.fly.speed=speed;
  const frame=engineCtx.surfaceFrame(surface==='air'?'floor':surface,.4);
  const camera=new THREE.PerspectiveCamera(),root=new THREE.Group(),anchor=new THREE.Object3D();anchor.position.set(0,.008,.355);root.add(anchor);
  root.position.set(1,2,3);root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.right,frame.normal,frame.forward));
  const pose={pos:new THREE.Vector3(),quat:new THREE.Quaternion(),forward:new THREE.Vector3(),right:new THREE.Vector3(),up:new THREE.Vector3()};
  state.flyView=true;state.flyVisionMode='ocular';state.running=false;let orbitalCalls=0;
  const sandbox=vm.createContext({THREE,state,camera,flyPovAnchor:anchor,compoundTmp:pose,controls:{target:new THREE.Vector3(-90,40,25),update(){orbitalCalls++;camera.lookAt(this.target);}},stepper:{clear(){}},last:null,lastUI:0,updateFlyMesh(){},flyMesh:{visible:true},ui:{compoundVisionCanvas:{}},scene:{},renderer:{render(){}},requestAnimationFrame(){}});
  vm.runInContext(extract('getFlyEyePose'),sandbox);vm.runInContext(extract('updateFlyViewCamera'),sandbox);
  const start=source.indexOf('function frame(now)');vm.runInContext(source.slice(start,source.indexOf('}requestAnimationFrame(frame);',start)+1),sandbox);
  sandbox.frame(1000);assert.equal(orbitalCalls,0);
  const expected=frame.forward.clone().multiplyScalar(speed<0?-1:1);
  assert(camera.getWorldDirection(new THREE.Vector3()).dot(expected)>.999999);
  assert(camera.position.distanceTo(anchor.getWorldPosition(new THREE.Vector3()))<1e-9);
 }
});

