import {LIMITS,validateMetadata} from './validation.js';
import { decodeNeurons } from './neurons.js';
import { decodeGraph } from './graph.js';
import { LIFNetwork } from './lif.js';
import { buildMotorGroups, DNMotorReadout, IntrinsicDrive } from './motor.js';

const DEFAULT_BASE='https://raw.githubusercontent.com/Lulzx/fly-brain/4a8a8ebe2b8713106b605f5e32bc8458d65e0f16/public/data/';
const REGION_KEYS=['AL','MB','CX','SEZ','DN','VNC'];
let net=null, data=null, groups=null, regionMask=null, motorGroups=null, motorReadout=null, intrinsic=null;
let running=false, loopToken=0, runMode='observe';
let input={left:{},right:{},feeding:false,foodContact:false,mode:'ground',surface:'floor',speed:0,energy:.56,hunger:.44,blocked:false,wallAge:0,wallHeight:0,wallClimbRate:0,fruitOdor:0,fruitOdorTrend:0};
let windowCounts=new Uint32Array(REGION_KEYS.length), windowTypeCounts=new Map(), lastPublish=0, windowNeuralStart=0, wallStart=0;
let modeWallAnchor=0, modeNeuralAnchor=0, lastIntrinsicT=0, lastMotor=null;
let rngState=1,initialSeed=1,epoch=0,neuralTarget=0,lastTick=-1;
const rng=()=>{rngState|=0;rngState=(rngState+0x6D2B79F5)|0;let t=rngState;t=Math.imul(t^(t>>>15),1|t);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};
const post=(type,payload={})=>self.postMessage({type,epoch,...payload});
const status=(message,progress=null)=>post('status',{message,progress});
const uniq=a=>Uint32Array.from([...new Set(a)]);
const hill=(c,k=.25,n=1.4)=>c<=0?0:c**n/(c**n+k**n);
let yieldChannel=null;
const yieldQueue=[];
function yieldWorker(){
  if(typeof MessageChannel!=='function')return new Promise(resolve=>setTimeout(resolve,0));
  if(!yieldChannel){
    yieldChannel=new MessageChannel();
    yieldChannel.port1.onmessage=()=>yieldQueue.shift()?.();
    // Node validation must not stay alive solely because of the channel.
    yieldChannel.port1.unref?.();yieldChannel.port2.unref?.();
  }
  return new Promise(resolve=>{yieldQueue.push(resolve);yieldChannel.port2.postMessage(0);});
}

async function fetchJSON(url){return JSON.parse(new TextDecoder().decode(await fetchBuffer(url,'metadatos')));}
async function fetchBuffer(url,label){
  const r=await fetch(url,{mode:'cors',cache:'force-cache'});if(!r.ok)throw new Error(`${r.status} ${url}`);
  const total=Number(r.headers.get('content-length'))||0;
  if(total>LIMITS.bytes)throw new Error('Download exceeds budget');
  if(!r.body){const b=await r.arrayBuffer();if(b.byteLength>LIMITS.bytes)throw new Error('Download exceeds budget');return b;}
  const rd=r.body.getReader(),chunks=[];let got=0;
  for(;;){const {done,value}=await rd.read();if(done)break;got+=value.byteLength;if(got>LIMITS.bytes){await rd.cancel();throw new Error('Download exceeds budget');}chunks.push(value);status(`Descargando ${label} ${(got/1048576).toFixed(1)} MB`,total?got/total:null);}
  const out=new Uint8Array(got);let off=0;for(const c of chunks){out.set(c,off);off+=c.length;}return out.buffer;
}
function className(i){return data.meta.classes?.[data.cls[i]]||'';}
function superName(i){return data.meta.superclasses?.[data.superclass[i]]||'';}
function typeName(i){return data.meta.types?.[i]||'';}
function indicesWhere(fn){const out=[];for(let i=0;i<data.N;i++)if(fn(i))out.push(i);return out;}
function buildGroups(){
  const odor={}; const ornAll=[]; const contact=[]; const haltere=[]; const jo=[];
  for(const s of data.bodymap?.sensors||[]){
    if(s.kind==='odor'){((odor[s.glomerulus]||={})[s.antenna]=s.idx||[]);ornAll.push(...(s.idx||[]));}
    if(s.kind==='contact')contact.push(...(s.idx||[]));
    if(/haltere/i.test(s.name||''))haltere.push(...(s.idx||[]));
    if(/JO wind\/gravity/i.test(s.name||''))jo.push(...(s.idx||[]));
  }
  const sugar=indicesWhere(i=>['LB3b','LB3c','dorsal_tpGRN'].includes(typeName(i)));
  const mb=indicesWhere(i=>['Kenyon_Cell','MBON','DAN'].includes(className(i))||typeName(i)==='APL');
  const cxTypes=new Set(['EPG','PEN_a(PEN1)','PEN_b(PEN2)','Delta7','PEG']);
  const cx=indicesWhere(i=>cxTypes.has(typeName(i))||/central.?complex/i.test(className(i))||/central.?complex/i.test(superName(i)));
  const dn=indicesWhere(i=>/descending/i.test(superName(i))||/^DN/i.test(className(i)));
  const vnc=indicesWhere(i=>/vnc/i.test(superName(i))||/motor/i.test(superName(i))||/motor/i.test(className(i)));
  const sezCore=indicesWhere(i=>/SEZ|subesophageal|gustatory/i.test(className(i))||/SEZ|subesophageal/i.test(superName(i)));
  const alCore=indicesWhere(i=>/^ORN_/.test(typeName(i))||className(i)==='ALPN'||/^AL/i.test(className(i))||/antennal.?lobe/i.test(className(i)));
  const regs={AL:uniq([...ornAll,...alCore]),MB:uniq(mb),CX:uniq(cx),SEZ:uniq([...sugar,...sezCore]),DN:uniq(dn),VNC:uniq(vnc)};
  const mask=new Uint8Array(data.N); REGION_KEYS.forEach((k,b)=>{for(const i of regs[k])mask[i]|=1<<b;});
  return {odor,ornAll:uniq(ornAll),contact:uniq(contact),haltere:uniq(haltere),jo:uniq(jo),sugar:uniq(sugar),regions:regs,mask};
}
function applyInputs(){
  if(!net||!groups)return;
  net.setDrive(groups.ornAll,6);
  for(const sd of ['left','right']){
    const act=input[sd]||{}; let ev=0; for(const c of Object.values(act))ev+=150*hill(c); const gain=600/(600+ev);
    for(const [g,sides] of Object.entries(groups.odor)){const ix=sides[sd];if(!ix)continue;net.setDrive(ix,6+150*hill(act[g]||0)*gain);}
  }
  net.setDrive(groups.sugar,(input.foodContact||input.feeding)?180:0);
  const surface=input.surface||'floor', mode=input.mode||'ground';
  const walking=mode==='ground', flight=mode!=='ground';
  net.setDrive(groups.contact,walking?(surface==='floor'?18:32):0);
  net.setDrive(groups.haltere,flight?Math.min(150,60+40*(input.speed||0)):0);
  net.setDrive(groups.jo,Math.min(120,12+30*Math.abs(input.speed||0)+(flight?30:0)));
}
function clearIntrinsicBias(){
  if(!net||!motorGroups)return;
  net.setExcBias(motorGroups.intrinsicFwd,0);
  net.setExcBias(motorGroups.intrinsicTurnL,0);
  net.setExcBias(motorGroups.intrinsicTurnR,0);
  net.setExcBias(motorGroups.intrinsicTakeoff,0);
  net.setExcBias(motorGroups.back,0);
  net.setInhBias(motorGroups.brake,0);
}
function applyIntrinsic(dtMs){
  if(!net||!motorGroups||!intrinsic)return;
  if(runMode!=='control'){clearIntrinsicBias();return;}
  const d=intrinsic.update(dtMs,input);
  net.setExcBias(motorGroups.intrinsicFwd,d.fwd);
  net.setExcBias(motorGroups.intrinsicTurnL,d.turnL);
  net.setExcBias(motorGroups.intrinsicTurnR,d.turnR);
  net.setExcBias(motorGroups.intrinsicTakeoff,d.takeoff);
  net.setExcBias(motorGroups.back,d.back);
  net.setInhBias(motorGroups.brake,d.brake);
  lastMotor={...(lastMotor||{}),intrinsicState:d.state,intrinsic:d};
}
function accumulate(fired){
  for(const i of fired){const m=regionMask[i];for(let b=0;b<REGION_KEYS.length;b++)if(m&(1<<b))windowCounts[b]++;const t=typeName(i);if(t)windowTypeCounts.set(t,(windowTypeCounts.get(t)||0)+1);}
}
function motorSnapshot(neuralMs){
  if(!motorReadout||!net)return null;
  const m=motorReadout.update(net.spikeCount,neuralMs,{flying:input.mode!=='ground',tMs:net.t,intrinsicState:lastMotor?.intrinsicState||(runMode==='control'?'warming':'off')});
  const d=lastMotor?.intrinsic||{};
  m.intrinsicState=lastMotor?.intrinsicState||(runMode==='control'?'warming':'off');
  m.intrinsicReason=d.takeoffReason||'';
  m.wallSearchDriveMs=d.wallSearchDriveMs||0;
  m.wallSearchMotivation=d.wallSearchMotivation||0;
  m.foodlessMs=d.foodlessMs||0;
  m.fruitOdor=d.fruitOdor||0;
  m.fruitOdorTrend=d.fruitOdorTrend||0;
  return m;
}
function publish(now,receipt={}){
  const neuralMs=Math.max(.5,net.t-windowNeuralStart), sec=neuralMs/1000;
  const hz={},norm={};
  REGION_KEYS.forEach((k,b)=>{const n=Math.max(1,groups.regions[k].length),r=windowCounts[b]/(n*sec);hz[k]=r;norm[k]=groups.regions[k].length?1-Math.exp(-r/18):null;if(!groups.regions[k].length)hz[k]=null;});
  const topTypes=[...windowTypeCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([type,spikes])=>({type,spikes}));
  const wallSec=Math.max(.001,(now-wallStart)/1000), neuralSpeed=(neuralMs/1000)/wallSec;
  lastMotor=motorSnapshot(neuralMs);
  post('activity',{...receipt,t:net.t,hz,norm,topTypes,awake:net.nAwake,neuralSpeed,mode:runMode,motor:lastMotor,groupSizes:Object.fromEntries(REGION_KEYS.map(k=>[k,groups.regions[k].length]))});
  windowCounts.fill(0);windowTypeCounts.clear();windowNeuralStart=net.t;wallStart=now;lastPublish=now;
}
function stepOnce(){
  while(net.t-lastIntrinsicT>=10){applyIntrinsic(10);lastIntrinsicT+=10;}
  const fired=net.step();accumulate(fired);
}
function resetModeAnchors(){const now=performance.now();modeWallAnchor=now;modeNeuralAnchor=net?.t||0;wallStart=lastPublish=now;windowNeuralStart=net?.t||0;}
function resetNetwork(){
  loopToken++;rngState=initialSeed;neuralTarget=0;lastTick=-1;lastMotor=null;
  input={left:{},right:{},feeding:false,foodContact:false,mode:'ground',surface:'floor',speed:0,energy:.56,hunger:.44};
  if(net){net.drive.fill(0);net.reset();applyInputs();intrinsic?.reset();motorReadout?.reset(net.spikeCount);}
  windowCounts.fill(0);windowTypeCounts.clear();lastIntrinsicT=0;resetModeAnchors();
}
function setMode(mode){runMode=mode==='control'?'control':'observe';resetNetwork();post('mode',{mode:runMode});}
async function runBatch(m){
 const token=loopToken;
 try{
  if(!net||!Array.isArray(m.inputs)||m.inputs.length<1||m.inputs.length>10)throw new Error('Invalid neural batch');
  if(runMode==='control'&&!motorGroups.takeoff.length)throw new Error('Takeoff DN population unavailable');
  for(const sample of m.inputs){
   if(!Number.isInteger(sample.tick)||sample.tick<=lastTick||Math.abs(sample.dtMs-1000/120)>1e-8)throw new Error('Invalid sensory sequence');
   lastTick=sample.tick;input={...input,...sample};applyInputs();neuralTarget+=sample.dtMs;
   let budget=performance.now();while(net.t+net.p.dt<=neuralTarget+1e-8){stepOnce();if(performance.now()-budget>8){await yieldWorker();if(token!==loopToken||m.epoch!==epoch)return;budget=performance.now();}}
  }
  if(token!==loopToken)return;const tail=m.inputs[m.inputs.length-1];publish(performance.now(),{batchId:m.batchId,tick:tail.tick,bodyTime:tail.t,source:'LIF'});
 }catch(error){post('error',{message:error.message});}
}
async function init({baseUrl=DEFAULT_BASE,seed=1}={}){
  try{
    initialSeed=rngState=seed>>>0||1; running=false;loopToken++;
    const base=baseUrl.endsWith('/')?baseUrl:baseUrl+'/';
    status('Cargando metadatos MaleCNS…',0.01);
    const [meta,bodymap,nbuf]=await Promise.all([fetchJSON(base+'meta.json'),fetchJSON(base+'bodymap.json'),fetchBuffer(base+'neurons.flyn','neuronas')]);
    status('Decodificando 165k neuronas…',0.28); const n=decodeNeurons(nbuf);
    status('Descargando grafo MaleCNS (~14.6 MB)…',0.34); const gbuf=await fetchBuffer(base+'graph.flyg','conectoma');
    status('Decodificando grafo CSR…',0.72); const g=decodeGraph(gbuf); if(g.N!==n.N)throw new Error(`N mismatch ${g.N}/${n.N}`);
    data={meta,bodymap,...n,...g};validateMetadata(data); status('Construyendo poblaciones biológicas…',0.86); groups=buildGroups();regionMask=groups.mask;
    const typeOf=data.meta.types||Array(data.N).fill('');
    motorGroups=buildMotorGroups(typeOf,data.side,data.bodymap?.feeding||[]);
    status('Inicializando dinámica LIF y readout DN…',0.93); net=new LIFNetwork(data.N,data.indptr,data.indices,data.weights,data.nt,{rng,minSyn:data.minWeight||1});
    motorReadout=new DNMotorReadout(data.N,motorGroups);intrinsic=new IntrinsicDrive(seed);applyInputs();motorReadout.reset(net.spikeCount);
    lastIntrinsicT=0;resetModeAnchors();
    post('ready',{N:data.N,E:data.E,minWeight:data.minWeight,groupSizes:Object.fromEntries(REGION_KEYS.map(k=>[k,groups.regions[k].length])),orn:groups.ornAll.length,source:base,motorGroups:{forward:motorGroups.forward.length,backward:motorGroups.backward.length,turnL:motorGroups.turnL.length,turnR:motorGroups.turnR.length,takeoff:motorGroups.takeoff.length,feeding:motorGroups.feedingMotor.length}});
    resetNetwork();
  }catch(error){post('error',{message:error?.message||String(error),stack:error?.stack||''});}
}
self.onmessage=e=>{
 const m=e.data||{};
 if(m.type==='init'){epoch=m.epoch;init(m);}
 else if(m.type==='reset'||m.type==='mode'){epoch=m.epoch;if(m.type==='mode')setMode(m.mode);else resetNetwork();}
 else if(m.epoch===epoch&&m.type==='batch')runBatch(m);
};
