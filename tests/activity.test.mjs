import test from 'node:test';
import assert from 'node:assert/strict';
import { ConnectomeActivityTracker } from '../src/activity.js';

const base = {t:1,odorLeft:.2,odorRight:.2,kcActive:10,kcCount:128,memoryValue:0,dopamine:0,turn:0,speed:.5,mode:'ground',surface:'floor',feeding:false,contact:false,energy:.5,hunger:.5};

test('feeding strongly recruits SEZ proxy',()=>{
  const a=new ConnectomeActivityTracker({sampleHz:10});
  const v=a.update(.2,{...base,feeding:true});
  assert.ok(v.SEZ>.85);
});

test('wall walking raises CX and VNC proxy activity',()=>{
  const a=new ConnectomeActivityTracker();
  const floor=a.update(.1,{...base,surface:'floor'});
  const fcx=floor.CX, fvnc=floor.VNC;
  const wall=a.update(.1,{...base,surface:'wall-x+',speed:.8});
  assert.ok(wall.CX>fcx);
  assert.ok(wall.VNC>fvnc);
});

test('tracker exports sampled CSV',()=>{
  const a=new ConnectomeActivityTracker({sampleHz:10});
  a.update(.11,base);
  const csv=a.toCSV();
  assert.match(csv,/time_s,action/);
  assert.match(csv,/AL,MB,CX,SEZ,DN,VNC/);
});
