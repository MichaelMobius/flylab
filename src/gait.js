// Stable tripod CPG plus embodied traction model for FlyLab v1.1.
// MaleCNS supplies descending intent.  The CPG is an innate prior; an adaptive residual can
// change cadence, amplitude, duty, inter-tripod phase, turning gain and lift.

export const GAIT_CONFIG = Object.freeze({
  minHz: 3.2,
  maxHz: 10.0,
  duty: 0.6763456489931275,
  ampTau: 0.10,
  cadenceTau: 0.16,
  turnTau: 0.10,
  strideTurnGain: 0.42,
  pivotThreshold: 0.20,
  stopThreshold: 0.012,
  visualStride: 0.036,
  traction: 0.88,
  trackWidth: 0.42,
});

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smoothstep=x=>x*x*(3-2*x);
const wrapTau=x=>((x%(Math.PI*2))+(Math.PI*2))%(Math.PI*2);
const approach=(x,target,dt,tau)=>x+(target-x)*(1-Math.exp(-Math.max(0,dt)/Math.max(1e-4,tau)));

const DEFAULT_MODIFIERS=Object.freeze({cadenceScale:1,amplitudeScale:1,dutyOffset:0,tripodPhaseDelta:0,turnGain:1,liftScale:1});
function sanitizeModifiers(m={}){return {
  cadenceScale:clamp(Number(m.cadenceScale)||1,.65,1.4),
  amplitudeScale:clamp(Number(m.amplitudeScale)||1,.60,1.5),
  dutyOffset:clamp(Number(m.dutyOffset)||0,-.14,.14),
  tripodPhaseDelta:clamp(Number(m.tripodPhaseDelta)||0,-.5,.5),
  turnGain:clamp(Number(m.turnGain)||1,.5,1.6),
  liftScale:clamp(Number(m.liftScale)||1,.55,1.5),
};}

export function createTripodGaitState(){
  return { phase:0,prevPhase:0,cadence:0,amplitude:0,turn:0,direction:1,pivot:false,grounded:true,modifiers:{...DEFAULT_MODIFIERS} };
}

export function resetTripodGait(g){
  Object.assign(g,{phase:0,prevPhase:0,cadence:0,amplitude:0,turn:0,direction:1,pivot:false,grounded:true,modifiers:{...DEFAULT_MODIFIERS}});
  return g;
}

export function updateTripodGait(g,dt,{grounded=true,feeding=false,speed=0,desiredSpeed=0,turn=0,modifiers=null}={}){
  const targetM=sanitizeModifiers(modifiers||g.modifiers||DEFAULT_MODIFIERS);
  if(!g.modifiers)g.modifiers={...DEFAULT_MODIFIERS};
  for(const k of Object.keys(DEFAULT_MODIFIERS))g.modifiers[k]=approach(g.modifiers[k],targetM[k],dt,.22);
  const M=g.modifiers;
  const moving=Math.max(Math.abs(speed),Math.abs(desiredSpeed));
  const turnTarget=grounded&&!feeding?clamp(turn,-1,1):0;
  const rawAmp=grounded&&!feeding?clamp(moving/.92,0,1):0;
  const pivot=grounded&&!feeding&&rawAmp<.13&&Math.abs(turnTarget)>GAIT_CONFIG.pivotThreshold;
  const baseAmp=pivot?Math.max(rawAmp,clamp(Math.abs(turnTarget)*.72,.18,.55)):rawAmp;
  const ampTarget=clamp(baseAmp*M.amplitudeScale,0,1.18);
  const baseCadence=ampTarget>GAIT_CONFIG.stopThreshold
    ? GAIT_CONFIG.minHz+(GAIT_CONFIG.maxHz-GAIT_CONFIG.minHz)*Math.sqrt(clamp(ampTarget,0,1))
    : 0;
  const cadenceTarget=clamp(baseCadence*M.cadenceScale,0,GAIT_CONFIG.maxHz*1.25);
  g.amplitude=approach(g.amplitude,ampTarget,dt,GAIT_CONFIG.ampTau);
  g.cadence=approach(g.cadence,cadenceTarget,dt,GAIT_CONFIG.cadenceTau);
  g.turn=approach(g.turn,turnTarget,dt,GAIT_CONFIG.turnTau);
  if(desiredSpeed>.025)g.direction=1; else if(desiredSpeed<-.025)g.direction=-1;
  g.pivot=pivot; g.grounded=grounded;
  g.prevPhase=g.phase;
  if(g.amplitude>GAIT_CONFIG.stopThreshold||g.cadence>.08)g.phase=wrapTau(g.phase+Math.PI*2*g.cadence*dt);
  return g;
}

export function tripodFoot(g,{side=1,pair=1,offset=0,phaseOverride=null}={}){
  const M=g.modifiers||DEFAULT_MODIFIERS;
  // Only the second tripod receives the learned inter-tripod residual.
  const second=Math.abs(wrapTau(offset)-Math.PI)<1.0;
  const off=offset+(second?M.tripodPhaseDelta:0);
  const phase=wrapTau((phaseOverride??g.phase)+off)/(Math.PI*2);
  const duty=clamp(GAIT_CONFIG.duty+M.dutyOffset,.48,.82);
  let fore,lift=0,stance;
  if(phase<duty){
    const u=phase/duty;
    fore=1-2*u;
    stance=true;
  }else{
    const u=(phase-duty)/(1-duty),s=smoothstep(u);
    fore=-1+2*s;
    lift=Math.sin(Math.PI*u)*M.liftScale;
    stance=false;
  }
  const sideSign=side<0?-1:1;
  let direction=g.direction;
  let strideScale;
  if(g.pivot){
    direction=sideSign*Math.sign(g.turn||1);
    strideScale=.58+.25*Math.abs(g.turn)*M.turnGain;
  }else{
    strideScale=clamp(1+GAIT_CONFIG.strideTurnGain*M.turnGain*g.turn*sideSign,.42,1.58);
  }
  const pairScale=[.92,.82,1.08][pair]??1;
  return {fore:fore*direction*strideScale*pairScale*g.amplitude,lift:lift*g.amplitude,stance,strideScale,duty};
}

function legPhase(side,pair){return ((side<0&&pair!==1)||(side>0&&pair===1))?0:Math.PI;}

// A deliberately simple embodied traction model. During stance, a foot moving posteriorly relative
// to the thorax produces forward body velocity. Swing feet produce no thrust. The body motion now
// depends on the gait instead of being teleported directly from desiredSpeed.
export function tripodPropulsion(g,dt,{traction=GAIT_CONFIG.traction,trackWidth=GAIT_CONFIG.trackWidth}={}){
  const h=Math.max(1e-4,dt);
  const bySide={left:[],right:[]};
  let support=0;
  for(const side of [-1,1])for(let pair=0;pair<3;pair++){
    const offset=legPhase(side,pair);
    const prev=tripodFoot(g,{side,pair,offset,phaseOverride:g.prevPhase});
    const now=tripodFoot(g,{side,pair,offset,phaseOverride:g.phase});
    if(now.stance){
      support++;
      // Match the body-relative fore/aft coordinate used by the procedural leg visual.
      const relV=(now.fore-prev.fore)*GAIT_CONFIG.visualStride/h;
      const push=-relV*traction;
      bySide[side<0?'left':'right'].push(push);
    }
  }
  const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
  const left=mean(bySide.left),right=mean(bySide.right);
  const speed=(left+right)*.5;
  const turn=(right-left)/Math.max(.08,trackWidth);
  const stancePush=[...bySide.left,...bySide.right];
  // If the body moved at the mean propulsive velocity, individual stance feet with different push
  // velocities would slip. This gives the learner a local, task-independent slip proxy.
  const slip=stancePush.length?stancePush.reduce((s,p)=>s+Math.abs(speed-p),0)/stancePush.length:Math.abs(speed);
  return {speed,turn,left,right,slip,support,stanceCount:stancePush.length};
}
