import test from 'node:test';
import assert from 'node:assert/strict';
import {LIFNetwork} from '../src/malecns/lif.js';
import {LIFNetwork as Reference} from './fixtures/lif116.mjs';
import {seededRandom} from '../src/runtime.js';
test('optimized kernel matches reference state, spikes and random draws exactly',()=>{
 for(const seed of [1,57,1337]){
  const random=seededRandom(seed),N=32,ptr=Uint32Array.from({length:N+1},(_,i)=>i*8);
  const ix=Uint32Array.from({length:N*8},()=>Math.floor(random()*N)),w=Uint16Array.from(ix,()=>Math.floor(random()*40)),nt=Uint8Array.from({length:N},(_,i)=>i%8);
  const a=new LIFNetwork(N,ptr,ix,w,nt,{rng:seededRandom(seed),tRef:2.23,adaptInc:1.371}),b=new Reference(N,ptr,ix,w,nt,{rng:seededRandom(seed),tRef:2.23,adaptInc:1.371});
  for(let step=0;step<2400;step++){
   if(step%137===0){const i=step%N,rate=step%274?0:180;for(const net of [a,b]){net.setDriveOne(i,rate);net.setBias([i],step%29,step%11);}}
   if(step===1200){a.reset();b.reset();}
   assert.deepEqual(a.step(),b.step());
   for(const key of ['v','gE','gI','refr','trace','adapt','res','spikeCount','awake','awakeList'])assert.deepEqual(a[key],b[key],`${key}: seed ${seed}, step ${step}`);
   assert.equal(a.nAwake,b.nAwake);assert.equal(a.t,b.t);assert.deepEqual(a.ring,b.ring);
  }
 }
});
