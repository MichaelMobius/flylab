// FlyLab v1.1 — online adaptive locomotion.
//
// This learner never receives fruit position or reward. It only sees a descending-neuron
// locomotor command and embodied motor outcomes (translation, rotation, support, slip proxy,
// energy proxy).  It adapts residual gait parameters around an innate tripod prior using SPSA,
// a light-weight derivative-free policy optimisation method suitable for an in-browser simulation.

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export const MOTOR_PARAM_SPECS=Object.freeze([
  {key:'cadenceScale',base:1.00,radius:.24,min:.72,max:1.30},
  {key:'amplitudeScale',base:1.00,radius:.24,min:.70,max:1.32},
  {key:'dutyOffset',base:0.00,radius:.075,min:-.10,max:.10},
  {key:'tripodPhaseDelta',base:0.00,radius:.26,min:-.38,max:.38},
  {key:'turnGain',base:1.00,radius:.25,min:.68,max:1.35},
  {key:'liftScale',base:1.00,radius:.22,min:.70,max:1.30},
]);

function mulberry32(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

export function decodeMotorPolicy(theta){
  const out={};
  for(let i=0;i<MOTOR_PARAM_SPECS.length;i++){
    const s=MOTOR_PARAM_SPECS[i],z=clamp(theta[i]??0,-1,1);
    out[s.key]=clamp(s.base+s.radius*z,s.min,s.max);
  }
  return out;
}

export function motorReward({desiredSpeed=0,actualSpeed=0,desiredTurn=0,actualTurn=0,slip=0,support=3,cadence=0,amplitude=0}={}){
  const speedScale=Math.max(.18,Math.abs(desiredSpeed)+.16);
  const turnScale=Math.max(.40,Math.abs(desiredTurn)+.35);
  const speedErr=Math.abs(actualSpeed-desiredSpeed)/speedScale;
  const turnErr=Math.abs(actualTurn-desiredTurn)/turnScale;
  const commandWeight=Math.abs(desiredSpeed)>.06?.68:.34;
  const turnWeight=Math.abs(desiredTurn)>.04?.22:.08;
  const supportPenalty=support<2?1.0:support<3?.35:0;
  const slipPenalty=clamp(slip/0.55,0,1.5);
  const energyPenalty=clamp((cadence/10)*amplitude*amplitude,0,1.5);
  const reward=1-commandWeight*speedErr-turnWeight*turnErr-.22*slipPenalty-.28*supportPenalty-.045*energyPenalty;
  return {reward:clamp(reward,-1.5,1.2),speedErr,turnErr,slipPenalty,supportPenalty,energyPenalty};
}

export class AdaptiveMotorLearner{
  constructor({seed=1,windowSeconds=1.8,epsilon=.18,learningRate=.08}={}){
    this.seed=seed;this.rand=mulberry32((seed*2654435761)>>>0);
    this.windowSeconds=windowSeconds;this.epsilon=epsilon;this.learningRate=learningRate;
    this.theta=new Float64Array(MOTOR_PARAM_SPECS.length);
    this.enabled=true;this.reset();
  }
  reset(){
    this.rand=mulberry32((this.seed*2654435761)>>>0);this.contextKey=null;
    this.theta.fill(0);this.generation=0;this.phase='baseline';this.delta=null;this.elapsed=0;this.rewardSum=0;this.weight=0;
    this.rPlus=null;this.rMinus=null;this.lastReward=0;this.meanReward=0;this.bestReward=-Infinity;this.bestTheta=this.theta.slice();
    this.samples=0;this.activeTheta=this.theta.slice();this.lastMetrics=null;this.training=false;
  }
  setEnabled(v){this.enabled=!!v;if(!this.enabled){this.training=false;this.phase='baseline';this.activeTheta=this.theta.slice();}}
  params(){return decodeMotorPolicy(this.activeTheta);}
  learnedParams(){return decodeMotorPolicy(this.theta);}
  #newDelta(){return Float64Array.from(this.theta,()=>this.rand()<.5?-1:1);}
  #perturbed(sign){const x=new Float64Array(this.theta.length);for(let i=0;i<x.length;i++)x[i]=clamp(this.theta[i]+sign*this.epsilon*this.delta[i],-1,1);return x;}
  #begin(sign){this.phase=sign>0?'plus':'minus';this.activeTheta=this.#perturbed(sign);this.elapsed=0;this.rewardSum=0;this.weight=0;this.training=true;}
  #finishWindow(){
    const r=this.weight>0?this.rewardSum/this.weight:0;
    if(this.phase==='plus'){this.rPlus=r;this.#begin(-1);return;}
    this.rMinus=r;
    const advantage=(this.rPlus-this.rMinus)/(2*this.epsilon);
    for(let i=0;i<this.theta.length;i++)this.theta[i]=clamp(this.theta[i]+this.learningRate*advantage*this.delta[i],-1,1);
    this.generation++;this.lastReward=(this.rPlus+this.rMinus)/2;this.meanReward=this.generation===1?this.lastReward:.88*this.meanReward+.12*this.lastReward;
    if(this.lastReward>this.bestReward){this.bestReward=this.lastReward;this.bestTheta=this.theta.slice();}
    this.delta=this.#newDelta();this.#begin(1);
  }
  update(dt,metrics,{eligible=true,contextKey=null}={}){
    if(contextKey!==null&&contextKey!==this.contextKey){this.contextKey=contextKey;this.delta=null;this.phase='baseline';this.elapsed=this.rewardSum=this.weight=0;this.activeTheta=this.theta.slice();}
    this.lastMetrics=metrics||null;this.samples++;
    if(!this.enabled){this.training=false;this.phase='baseline';this.activeTheta=this.theta.slice();return this.status();}
    if(!eligible){this.training=false;return this.status();}
    if(!this.delta||this.phase==='baseline'){this.delta=this.#newDelta();this.#begin(1);}
    const r=motorReward(metrics);this.lastMetrics={...metrics,...r};
    this.elapsed+=dt;this.rewardSum+=r.reward*dt;this.weight+=dt;
    if(this.elapsed>=this.windowSeconds)this.#finishWindow();
    return this.status();
  }
  status(){return {enabled:this.enabled,training:this.training,generation:this.generation,phase:this.phase,lastReward:this.lastReward,meanReward:this.meanReward,bestReward:this.bestReward,params:this.learnedParams(),activeParams:this.params(),metrics:this.lastMetrics};}
  export(){return {version:1,theta:Array.from(this.theta),generation:this.generation,meanReward:this.meanReward,bestReward:this.bestReward,params:this.learnedParams()};}
  import(data){if(!data||!Array.isArray(data.theta)||data.theta.length!==this.theta.length)return false;for(let i=0;i<this.theta.length;i++)this.theta[i]=clamp(Number(data.theta[i])||0,-1,1);this.generation=Math.max(0,Number(data.generation)||0);this.meanReward=Number(data.meanReward)||0;this.bestReward=Number(data.bestReward)||-Infinity;this.activeTheta=this.theta.slice();this.delta=null;this.training=false;return true;}
}
