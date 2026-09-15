import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const start=performance.now(),records=[];let tick=0,batch=0,readyAt=0;
const assetRoot=path.resolve(process.argv[2]||'data');
globalThis.fetch=async url=>new Response(fs.readFileSync(path.join(assetRoot,new URL(url).pathname.split('/').at(-1))));
const out=path.resolve(process.argv[3]||'benchmark-result.json');
const timer=setTimeout(()=>{console.error('Full network test timeout');process.exit(2);},180000);
function send(){
 const inputs=Array.from({length:10},()=>({tick:++tick,t:tick/120,dtMs:1000/120,left:{DM1:.2},right:{DM1:.1},mode:'ground',surface:'wall-x+',speed:0,hunger:.8,energy:.2,wallAge:tick/120,wallHeight:.6,wallClimbRate:0,fruitOdor:.02,fruitOdorTrend:0}));
 self.onmessage({data:{type:'batch',epoch:2,batchId:++batch,inputs}});
}
globalThis.self={postMessage(m){
 if(m.type==='error'){clearTimeout(timer);console.error(m);process.exitCode=1;return;}
 if(m.type==='ready'){readyAt=performance.now();console.log('READY',m.N,m.E);records.push({type:'ready',N:m.N,E:m.E,loadMs:readyAt-start,groupSizes:m.groupSizes});setTimeout(()=>{self.onmessage({data:{type:'mode',mode:'control',epoch:2}});send();},0);}
 if(m.type==='activity'){
 records.push({type:'activity',batch:m.batchId,neuralMs:m.t,neuralSpeed:m.neuralSpeed,awake:m.awake,motor:m.motor});
 if(batch<24)setTimeout(send,0);else{clearTimeout(timer);fs.writeFileSync(out,JSON.stringify({runtime:process.version,elapsedMs:performance.now()-start,computeMs:performance.now()-readyAt,records},null,2));console.log('COMPLETE',m.t,'neural ms;',Math.round(performance.now()-readyAt),'wall ms; controlReady=',m.motor?.controlReady);}
 }
}};
await import(new URL('../src/malecns/worker.js',import.meta.url));
self.onmessage({data:{type:'init',epoch:1,seed:1337,baseUrl:'https://local.test/'}});
