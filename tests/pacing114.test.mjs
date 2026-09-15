import test from 'node:test';
import assert from 'node:assert/strict';
import {MaleCNSBridge} from '../src/malecns/bridge.js';
import {FixedStepper} from '../src/runtime.js';

class WorkerMock {
  constructor(){this.messages=[];this.dead=false;}
  postMessage(message){this.messages.push(message);}
  terminate(){this.dead=true;}
}
async function setup(pacing='interactive'){
  globalThis.Worker=WorkerMock;
  const bridge=new MaleCNSBridge({pacing});
  await bridge.load();
  bridge.message({type:'ready',epoch:bridge.epoch});
  return bridge;
}
function acknowledge(b,motor={v:.5}){
  const batch=b.worker.messages.filter(m=>m.type==='batch').at(-1);
  b.message({type:'activity',epoch:batch.epoch,batchId:batch.batchId,tick:batch.inputs.at(-1).tick,bodyTime:batch.inputs.at(-1).t,motor});
}

test('slow worker: fluid body advances 120 ticks versus 10 synchronized ticks in one second',async()=>{
  const counts=[];
  for(const pacing of ['interactive','synchronized']){
    const b=await setup(pacing),stepper=new FixedStepper();let ticks=0;
    b.clock=()=>0;
    for(let frame=0;frame<60;frame++)stepper.advance(1/60,()=>{
      if(!b.canAdvance())return false;
      b.setInput({tick:++ticks,t:ticks/120});
    });
    counts.push(ticks);
    assert.equal(b.worker.messages.filter(m=>m.type==='batch').length,1);
    assert(b.queue.length<=10);
  }
  assert.deepEqual(counts,[120,10]);
});
test('fluid overload retains newest sensory states with exact replacement accounting',async()=>{
  const b=await setup();
  for(let tick=1;tick<=120;tick++)b.setInput({tick,t:tick/120,left:{odor:tick}});
  assert.equal(b.coalesced,100);
  assert.deepEqual(b.queue.map(x=>x.tick),Array.from({length:10},(_,i)=>111+i));
  acknowledge(b);
  const batch=b.worker.messages.at(-1);
  assert.equal(batch.inputs[0].left.odor,111);
  assert.equal(batch.inputs.at(-1).tick,120);
  assert.equal(b.queue.length,0);
  acknowledge(b);
  assert.equal(b.pending,null);
  assert.equal(b.latest.coalesced,100);
  assert.match(b.toCSV(),/interactive,100/);
});
test('pacing switch cancels queued samples and ignores the previous response',async()=>{
  const b=await setup();for(let tick=1;tick<=30;tick++)b.setInput({tick});
  const old={epoch:b.epoch,batchId:b.pending.id};
  b.setPacing('synchronized');
  b.message({type:'activity',...old,motor:{v:1}});
  assert.equal(b.latest,null);assert.equal(b.queue.length,0);assert.equal(b.coalesced,0);
  for(let tick=31;tick<=40;tick++)b.setInput({tick});
  assert.equal(b.canAdvance(),false);
});
test('fluid pacing preserves the timeout and invalidates held motor commands',async()=>{
  const b=await setup();b.clock=()=>0;
  for(let tick=1;tick<=10;tick++)b.setInput({tick});
  acknowledge(b);
  for(let tick=11;tick<=20;tick++)b.setInput({tick});
  b.clock=()=>10001;
  assert.equal(b.canAdvance(),false);assert.equal(b.latest,null);assert.equal(b.ready,false);
});
test('held takeoff pulse fires once per neural response and can fire on a new response',async()=>{
  const b=await setup();
  for(let tick=1;tick<=10;tick++)b.setInput({tick});
  acknowledge(b,{takeoffTriggered:true});
  assert.equal(b.consumeTakeoff(),true);assert.equal(b.consumeTakeoff(),false);
  for(let tick=11;tick<=20;tick++)b.setInput({tick});
  acknowledge(b,{takeoffTriggered:true});
  assert.equal(b.consumeTakeoff(),true);
});
test('pause drains only finite queued input and generates no free-running work',async()=>{
  const b=await setup();for(let tick=1;tick<=14;tick++)b.setInput({tick});
  b.setRunning(false);acknowledge(b);acknowledge(b);
  assert.equal(b.pending,null);assert.equal(b.queue.length,0);
  assert.equal(b.worker.messages.filter(m=>m.type==='batch').length,2);
});
