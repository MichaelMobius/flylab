import test from 'node:test';
import assert from 'node:assert/strict';
import {engine} from './regressions.test.mjs';
const routes=[['wall-x+',1,0],['wall-x-',-1,0],['wall-z+',0,1],['wall-z-',0,-1]],dt=1/120;
function trial(wall,x,z,mode){
 const e=engine();e.events=[];e.ctx.logEvent=(type,data)=>e.events.push({type,...data});
 e.ctx.maleMotor=()=>({controlReady:true,v:.5,turn:0,takeoffTriggered:false});
 Object.assign(e.state.fly,{x:x*5.1,z:z*5.1,y:mode==='ground'?.2244:2,mode,surface:mode==='ground'?'floor':'air',heading:Math.atan2(z,x),speed:.5,vy:0,modeTime:3});
 return e;
}
test('walking from floor reaches all four walls and continues climbing with real support',()=>{
 for(const [wall,x,z] of routes){
  const e=trial(wall,x,z,'ground');
  for(let i=0;i<500&&e.state.fly.surface!==wall;i++)e.step(dt);
  assert.equal(e.state.fly.surface,wall);assert.equal(e.state.fly.mode,'ground');
  const y=e.state.fly.y;for(let i=0;i<180;i++)e.step(dt);
  assert.equal(e.state.fly.surface,wall);assert(e.state.fly.y>y+.3);assert(e.state.fly.support.feet>=3);assert(e.state.fly.support.maxGap<1e-7);
 }
});
test('flight and explicit landing can attach to each wall, walk and take off again',()=>{
 for(const mode of ['flight','landing'])for(const [wall,x,z] of routes){
  const e=trial(wall,x,z,mode);
  for(let i=0;i<600&&e.state.fly.surface!==wall;i++)e.step(dt);
  assert.equal(e.state.fly.surface,wall,`${mode} -> ${wall}`);assert.equal(e.state.fly.mode,'ground');
  assert(e.events.some(e=>e.type==='wall-landing'));assert.equal(e.state.fly.landingSurface,null);
  const y=e.state.fly.y;for(let i=0;i<120;i++)e.step(dt);
  assert.equal(e.state.fly.surface,wall);assert(e.state.fly.y>y+.2);assert(e.state.fly.support.feet>=3);assert(e.state.fly.support.maxGap<1e-7);
  e.state.fly.command='takeoff';e.step(dt);assert.equal(e.state.fly.surface,'air');
  for(let i=0;i<90;i++)e.step(dt);assert.equal(e.state.fly.surface,'air');
 }
});
test('brief flight or strong satiety does not force every wall collision into landing',()=>{
 for(const [age,energy] of [[.2,.5],[3,.95]]){
  const e=trial('wall-x+',1,0,'flight');e.state.fly.x=5.7;e.state.fly.modeTime=age;e.state.metabolism.energy=energy;
  e.ctx.resolveBodyContact(dt);assert.equal(e.state.fly.mode,'flight');assert(!e.state.fly.landingSurface);assert(Math.cos(e.state.fly.heading)<0);
 }
});
