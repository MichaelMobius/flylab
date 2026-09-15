import test from 'node:test';
import assert from 'node:assert/strict';
import {createTripodGaitState,updateTripodGait,tripodPropulsion} from '../src/gait.js';
import {AdaptiveMotorLearner,decodeMotorPolicy,motorReward,MOTOR_PARAM_SPECS} from '../src/adaptive/motor_learning.js';

test('tripod stance generates forward propulsion instead of direct body teleportation',()=>{
  const g=createTripodGaitState();
  let seen=false,max=0;
  for(let k=0;k<60;k++){
    updateTripodGait(g,1/120,{grounded:true,desiredSpeed:.75,speed:.4,turn:0});
    const p=tripodPropulsion(g,1/120);
    if(p.support>=3&&p.speed>0){seen=true;max=Math.max(max,p.speed);}
  }
  assert.ok(seen,'stance feet should create positive propulsion');
  assert.ok(max>.15,'propulsion should be large enough to move the body');
});

test('left-right stride asymmetry generates a turn from foot traction',()=>{
  const g=createTripodGaitState();
  let turn=0;
  for(let k=0;k<60;k++){
    updateTripodGait(g,1/120,{grounded:true,desiredSpeed:.65,speed:.4,turn:.45});
    const p=tripodPropulsion(g,1/120);turn=Math.max(turn,p.turn);
  }
  assert.ok(turn>0.08,'positive steering command should create positive yaw traction');
});

test('motor reward is task-independent and rewards command tracking with low slip',()=>{
  const good=motorReward({desiredSpeed:.6,actualSpeed:.58,desiredTurn:.2,actualTurn:.19,slip:.02,support:3,cadence:7,amplitude:.7});
  const bad=motorReward({desiredSpeed:.6,actualSpeed:.05,desiredTurn:.2,actualTurn:-.3,slip:.5,support:1,cadence:10,amplitude:1});
  assert.ok(good.reward>bad.reward);
  assert.ok(good.reward>.5);
});

test('adaptive learner runs SPSA generations and keeps learned policy bounded',()=>{
  const learner=new AdaptiveMotorLearner({seed:7,windowSeconds:.08,epsilon:.15,learningRate:.05});
  for(let k=0;k<120;k++){
    const p=learner.params();
    // synthetic embodied response: policy changes motor outcome, allowing SPSA to receive a signal
    const actual=.45*p.cadenceScale*p.amplitudeScale;
    learner.update(.02,{desiredSpeed:.55,actualSpeed:actual,desiredTurn:0,actualTurn:0,slip:Math.abs(p.tripodPhaseDelta)*.2,support:3,cadence:7*p.cadenceScale,amplitude:.7*p.amplitudeScale},{eligible:true});
  }
  const s=learner.status();
  assert.ok(s.generation>=5,'learner should complete several plus/minus evaluations');
  for(const spec of MOTOR_PARAM_SPECS){
    const v=s.params[spec.key];assert.ok(v>=spec.min-1e-9&&v<=spec.max+1e-9,`${spec.key} out of bounds`);
  }
});

test('disabling learning freezes perturbations at the learned policy',()=>{
  const learner=new AdaptiveMotorLearner({seed:3,windowSeconds:.05});
  learner.update(.02,{desiredSpeed:.5,actualSpeed:.2,support:3},{eligible:true});
  learner.setEnabled(false);
  const before=learner.learnedParams();
  for(let i=0;i<10;i++)learner.update(.02,{desiredSpeed:.5,actualSpeed:0,support:1},{eligible:true});
  assert.deepEqual(learner.params(),before);
});

test('decoded zero residual is the innate tripod prior',()=>{
  const p=decodeMotorPolicy(new Float64Array(MOTOR_PARAM_SPECS.length));
  assert.equal(p.cadenceScale,1);assert.equal(p.amplitudeScale,1);assert.equal(p.dutyOffset,0);assert.equal(p.tripodPhaseDelta,0);assert.equal(p.turnGain,1);
});

test('closed-loop gait adaptation improves reward in a constant forward curriculum',()=>{
  const g=createTripodGaitState();
  const learner=new AdaptiveMotorLearner({seed:1337,windowSeconds:.8,epsilon:.16,learningRate:.06});
  let bodySpeed=0,first=null;
  for(let k=0;k<120*45;k++){
    const dt=1/120,target=.62;
    updateTripodGait(g,dt,{grounded:true,desiredSpeed:target,speed:bodySpeed,turn:0,modifiers:learner.params()});
    const prop=tripodPropulsion(g,dt);
    bodySpeed+=(prop.speed-bodySpeed)*Math.min(1,dt*3.2);
    const st=learner.update(dt,{desiredSpeed:target,actualSpeed:bodySpeed,desiredTurn:0,actualTurn:0,slip:prop.slip,support:prop.support,cadence:g.cadence,amplitude:g.amplitude},{eligible:true});
    if(first===null&&st.generation>=2)first=st.meanReward;
  }
  const end=learner.status();
  assert.ok(first!==null);
  assert.ok(end.meanReward>first+.015,`expected learning improvement: ${first} -> ${end.meanReward}`);
});

test('ineligible periods pause rather than corrupt a plus/minus evaluation',()=>{
  const learner=new AdaptiveMotorLearner({seed:11,windowSeconds:.08});
  for(let i=0;i<2;i++)learner.update(.02,{desiredSpeed:.4,actualSpeed:.2,support:3},{eligible:true});
  const phase=learner.status().phase;
  for(let i=0;i<20;i++)learner.update(.02,{desiredSpeed:0,actualSpeed:0,support:0},{eligible:false});
  assert.equal(learner.status().phase,phase);
  for(let i=0;i<30;i++)learner.update(.02,{desiredSpeed:.4,actualSpeed:.3,support:3},{eligible:true});
  assert.ok(learner.status().generation>=1);
});
