import fs from 'node:fs';import path from 'node:path';
import * as THREE from '../vendor/three/build/three.module.js';
import {engine} from './harness.mjs';
import {AdaptiveMotorLearner} from '../src/adaptive/motor_learning.js';
import {visibleBounds} from '../src/containment.js';
const assetRoot=path.resolve(process.argv[2]||'../../work/malecns-data');
const groomingTrial=process.argv.includes('--groom');
const reportPath=new URL(groomingTrial?'../MALECNS_GROOM_SOAK.json':'../MALECNS_SOAK.json',import.meta.url);
const started=performance.now(),dt=1/120,ratio=10,seconds=45;
const report={version:'1.3.1',protocol:'Full LIF worker, closed-loop DN control; deterministic fluid pacing, 100 body ticks per 10 recent neural samples. No invented DN outputs.',ratio,secondsPerTrial:seconds,seed:1337,trials:[],neural:[],runtime:process.version};
globalThis.fetch=async url=>new Response(fs.readFileSync(path.join(assetRoot,new URL(url).pathname.split('/').at(-1))));
let env,trialIndex=-1,batch=0,inputQueue=[],globalTick=0,latest=null,consumed=-1,bodyTicks=0,previous=null,stuck=0,previousFeet=[],probe=false;
const configurations=groomingTrial?['wall-high']:['floor','wall-high','wall-low','flight-wall'];
function startTrial(){
 trialIndex++;if(trialIndex>=configurations.length){report.elapsedSeconds=(performance.now()-started)/1000;report.neuralSeconds=(latest?.t||0)/1000;fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log('DONE',report.elapsedSeconds,report.neuralSeconds);clearTimeout(timeout);return false;}
 env=engine();bodyTicks=0;previous=null;stuck=0;previousFeet=[];probe=false;
 const {state,ctx}=env,name=configurations[trialIndex];
 state.fruits=[{id:1,type:'apple',x:2.7,z:-2.7,strength:1,reward:1,amount:1}];
 state.metabolism.energy=.56;state.metabolism.hunger=.44;
 ctx.ui.brainMode.value='malecns-control';ctx.isMaleMode=()=>true;ctx.usingMaleCNS=()=>true;ctx.maleMotor=()=>latest?.motor;
 ctx.adaptiveEnabled=()=>true;ctx.motorLearner=new AdaptiveMotorLearner({seed:1337});
 Object.assign(ctx.maleCNS,{ready:true,pacing:'interactive',coalesced:0,latest,canAdvance:()=>true,consumeTakeoff(){if(!latest?.motor?.takeoffTriggered||consumed===latest.batchId)return false;consumed=latest.batchId;return true;},setInput(input){inputQueue.push({...input,tick:++globalTick,dtMs:1000/120});if(inputQueue.length>10){inputQueue.shift();this.coalesced++;}}});
 const metrics={name,bodySeconds:0,groomSeconds:0,wallSeconds:0,airSeconds:0,floorSeconds:0,DNControlledTicks:0,proxyTicks:0,stallEpisodes:0,longestStallSeconds:0,penetrationSamples:0,maxPenetration:0,maxAnchorSlip:0,wallToFloor:0,wallToAir:0,wallLandings:0,events:[],distance:0};report.trials.push(metrics);
 ctx.logEvent=(type,data)=>{metrics.events.push({t:state.t,type,...data});if(type==='wall-landing')metrics.wallLandings++;};
 if(name.startsWith('wall')){ctx.attachWall('wall-x+',new THREE.Vector3(0,1,0));state.fly.y=name==='wall-high'?2:.60;state.fly.heading=name==='wall-high'?Math.PI/2:-Math.PI/2;}
 if(name==='flight-wall')Object.assign(state.fly,{x:5.2,y:2,z:0,heading:0,speed:.5,mode:'flight',surface:'air',modeTime:4});
 ctx.resolveBodyContact(0);console.log('TRIAL',name);return true;
}
function advanceBody(){
 const {state,ctx}=env,m=report.trials.at(-1);
 for(let i=0;i<10*ratio&&bodyTicks<seconds/dt;i++){
  if(bodyTicks>=35/dt&&!probe){probe=true;if(state.fly.mode==='ground'){state.fly.command='takeoff';m.events.push({t:state.t,type:'manual-takeoff-probe'});}}
  if(groomingTrial&&bodyTicks===20/dt){ctx.updateGrooming(state.fly,0,{request:true,support:state.fly.support?.feet||0});m.events.push({t:state.t,type:'manual-groom-probe'});}
  ctx.maleCNS.latest=latest;env.step(dt);bodyTicks++;
  const f=state.fly,wall=f.mode==='ground'&&f.surface.startsWith('wall');m.bodySeconds+=dt;
  if(f.groom?.active)m.groomSeconds+=dt;
  if(wall)m.wallSeconds+=dt;else if(f.mode==='ground')m.floorSeconds+=dt;else m.airSeconds+=dt;
  if(latest?.motor?.controlReady)m.DNControlledTicks++;else m.proxyTicks++;
  if(previous){
   const distance=Math.hypot(f.x-previous.x,f.y-previous.y,f.z-previous.z);m.distance+=distance;
   if(f.mode==='ground'&&!state.metabolism.feeding&&!f.corner&&!f.groom?.pause&&Math.abs(latest?.motor?.v||0)>.06&&distance<dt*.02){stuck+=dt;if(stuck-dt<4&&stuck>=4)m.stallEpisodes++;}else stuck=0;
   m.longestStallSeconds=Math.max(m.longestStallSeconds,stuck);
   if(previous.wall&&!wall){if(f.mode==='ground'&&f.surface==='floor')m.wallToFloor++;else if(f.mode!=='ground')m.wallToAir++;}
  }
  previous={x:f.x,y:f.y,z:f.z,wall};
  const root=ctx.bodyCollider.root;root.updateWorldMatrix(true,true);
  for(const [j,leg] of root.userData.legs.entries()){
   const point=leg.claws.localToWorld(new THREE.Vector3(0,-.006,.013)),anchor=f.legAnchors?.[j];
   if(leg.stance&&anchor&&previousFeet[j]?.anchor===anchor)m.maxAnchorSlip=Math.max(m.maxAnchorSlip,point.distanceTo(previousFeet[j].point));
   previousFeet[j]={anchor,point};
  }
  if(bodyTicks%10===0){const b=visibleBounds(root),penetration=Math.max(0,b.max.x-5.9825,-5.9825-b.min.x,b.max.z-5.9825,-5.9825-b.min.z,-b.min.y);if(penetration>m.maxPenetration)m.worstPenetration={t:state.t,mode:f.mode,surface:f.surface,landingSurface:f.landingSurface,position:[f.x,f.y,f.z],min:b.min.toArray(),max:b.max.toArray()};m.maxPenetration=Math.max(m.maxPenetration,penetration);if(penetration>.003)m.penetrationSamples++;}
 }
 if(bodyTicks>=seconds/dt&&!startTrial())return;
 sendBatch();
}
function sendBatch(){self.onmessage({data:{type:'batch',epoch:2,batchId:++batch,inputs:inputQueue.splice(0)}});}
const timeout=setTimeout(()=>{report.error='timeout';fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.error('Timeout');process.exit(2);},900000);
globalThis.self={postMessage(m){
 if(m.type==='error'){report.error=m.message;fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.error(m);clearTimeout(timeout);process.exitCode=1;return;}
 if(m.type==='ready'){report.network={N:m.N,E:m.E,groupSizes:m.groupSizes};console.log('READY',m.N,m.E);setTimeout(()=>{self.onmessage({data:{type:'mode',mode:'control',epoch:2}});inputQueue=Array.from({length:10},()=>({tick:++globalTick,t:0,dtMs:1000/120,mode:'ground',surface:'floor',left:{},right:{}}));sendBatch();},0);}
 if(m.type==='activity'){
  latest=m;if(batch%12===0){console.log('NEURAL',m.t,'BODY',report.trials.reduce((s,x)=>s+x.bodySeconds,0).toFixed(1));fs.writeFileSync(reportPath,JSON.stringify(report,null,2));}
  report.neural.push({batch,neuralMs:m.t,motor:m.motor});
  setTimeout(()=>{if(!env&&!startTrial())return;advanceBody();},0);
 }
}};
await import('../src/malecns/worker.js');self.onmessage({data:{type:'init',epoch:1,seed:1337,baseUrl:'https://local.test/'}});
