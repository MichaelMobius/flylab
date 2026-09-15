import test from 'node:test';
import assert from 'node:assert/strict';
import {createTripodGaitState,updateTripodGait,tripodFoot,GAIT_CONFIG} from '../src/gait.js';

test('CPG phase stays continuous when MaleCNS speed changes',()=>{
  const g=createTripodGaitState();
  updateTripodGait(g,.1,{grounded:true,desiredSpeed:.25,speed:.2,turn:0});
  const p1=g.phase;
  updateTripodGait(g,.1,{grounded:true,desiredSpeed:.9,speed:.7,turn:0});
  const step=((g.phase-p1+Math.PI*2)%(Math.PI*2));
  assert.ok(step>0 && step<Math.PI*2,'phase should advance without resetting');
  assert.ok(g.cadence<=GAIT_CONFIG.maxHz+1e-9);
});

test('alternating tripod groups remain half a cycle apart',()=>{
  const g=createTripodGaitState();g.amplitude=1;g.phase=.71;
  const a=tripodFoot(g,{side:-1,pair:0,offset:0});
  const b=tripodFoot(g,{side:1,pair:0,offset:Math.PI});
  assert.ok(a.fore*b.fore<0,'opposite tripod should be approximately half a cycle apart');
});

test('feeding smoothly suppresses stepping instead of phase jumping',()=>{
  const g=createTripodGaitState();
  for(let i=0;i<20;i++)updateTripodGait(g,.01,{grounded:true,desiredSpeed:.8,speed:.7});
  const before=g.amplitude,phase=g.phase;
  updateTripodGait(g,.01,{grounded:true,feeding:true,desiredSpeed:0,speed:.4});
  assert.ok(g.amplitude<before && g.amplitude>0,'amplitude should decay smoothly');
  assert.ok(g.phase!==0 || phase===0,'phase is not hard-reset on feeding');
});

test('turning changes left and right stride without breaking tripod phase',()=>{
  const g=createTripodGaitState();g.amplitude=1;g.turn=.8;g.phase=.4;
  const left=tripodFoot(g,{side:-1,pair:1,offset:0});
  const right=tripodFoot(g,{side:1,pair:1,offset:0});
  assert.ok(left.strideScale<right.strideScale,'left turn should shorten left stride and lengthen right stride');
  assert.equal(left.stance,right.stance);
});
