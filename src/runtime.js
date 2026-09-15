// Deterministic experiment helpers, independent of DOM and WebGL.
export const FIXED_DT = 1 / 120;
export function seededRandom(seed=1337) {
  let a=seed>>>0;
  return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
}
export function planarFrame(heading){return {forward:{x:Math.cos(heading),y:0,z:Math.sin(heading)},right:{x:Math.sin(heading),y:0,z:-Math.cos(heading)}};}
export function consumeFlightCommand(f){
  const command=f.command;f.command=null;
  if(command==='takeoff'&&f.mode==='ground')return 'takeoff';
  if(command==='land'&&(f.mode==='takeoff'||f.mode==='flight'))return 'landing';
  return null;
}
export function sensoryAverage(left={},right={}){
  const out=Object.create(null);for(const k of new Set([...Object.keys(left),...Object.keys(right)]))out[k]=((left[k]||0)+(right[k]||0))/2;return out;
}
export function resetExperimentState(state){
  Object.assign(state,{t:0,ticks:0,distance:0,contacts:0,collisions:0,reward:0,airTime:0,wallTime:0,firstFruitTime:null,lastContactAt:-99,lastTrailAt:-1,explore:0,lastCollision:false,currentContact:null,sensedMixture:{},latest:null});
  Object.assign(state.metabolism,{energy:.56,hunger:.44,intake:0,feeding:false,fruit:null,feedTime:0,lastLearnAt:-99,visualLift:0});
  Object.assign(state.motor,{flightSkill:.12,stableAir:0,safeLandings:0});
}
export class FixedStepper{
  constructor(){this.acc=0;}
  advance(seconds,step){
    // Up to one second is caught up. Longer stalls suspend the experiment explicitly.
    if(!Number.isFinite(seconds)||seconds<0||seconds>1){this.acc=0;return false;}
    this.acc+=seconds;
    while(this.acc+1e-12>=FIXED_DT){if(step(FIXED_DT)===false){this.acc=0;return true;}this.acc-=FIXED_DT;}
    return true;
  }
  clear(){this.acc=0;}
}
