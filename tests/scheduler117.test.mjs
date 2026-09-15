import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/malecns/worker.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
function setup(){
 const posted=[],jobs=[];let now=0;
 class Channel{constructor(){this.port1={};this.port2={postMessage:()=>jobs.push(()=>this.port1.onmessage())};}}
 const context=vm.createContext({MessageChannel:Channel,self:{postMessage:m=>posted.push(m)},performance:{now:()=>now+=5},setTimeout});
 vm.runInContext(source,context);return {context,posted,jobs};
}
test('message-based scheduler releases waiting work in order',async()=>{
 const {context,jobs}=setup(),order=[];
 const a=vm.runInContext('yieldWorker()',context).then(()=>order.push(1));
 const b=vm.runInContext('yieldWorker()',context).then(()=>order.push(2));
 assert.equal(jobs.length,2);jobs.shift()();await a;assert.deepEqual(order,[1]);
 jobs.shift()();await b;assert.deepEqual(order,[1,2]);
});
test('cancelled epoch cannot resume neural integration or publish after yielding',async()=>{
 const {context,jobs,posted}=setup();
 vm.runInContext(`net={t:0,p:{dt:.5},setDrive(){},step(){this.t+=.5;return [];}};groups={ornAll:[],odor:{},sugar:[],contact:[],haltere:[],jo:[]};regionMask=[];`,context);
 const pending=vm.runInContext(`runBatch({epoch:0,batchId:1,inputs:[{tick:1,t:1/120,dtMs:1000/120}]})`,context);
 assert.equal(jobs.length,1);const t=vm.runInContext('net.t',context);
 vm.runInContext('epoch++;loopToken++;',context);jobs.shift()();await pending;
 assert.equal(vm.runInContext('net.t',context),t);assert.deepEqual(posted,[]);
});
