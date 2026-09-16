import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {updateGrooming} from '../src/grooming.js';
import {captureCornerPose,startCorner} from '../src/corner.js';
import {FlyBodyCollider,bodySensorFrame} from '../src/body.js';
import * as THREE from '../vendor/three/build/three.module.js';
import {MushroomBodyProxy,mixOdors} from '../src/brain.js';
import {ConnectomeActivityTracker} from '../src/activity.js';
import {FIXED_DT,FixedStepper,seededRandom,planarFrame,consumeFlightCommand,sensoryAverage,resetExperimentState} from '../src/runtime.js';
import {createTripodGaitState,updateTripodGait,tripodPropulsion} from '../src/gait.js';
import {resolveFruitCollisions,pointInsideFruit,fruitSurfaceDistance,placementAllowed} from '../src/world.js';
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function extract(name){const start=source.indexOf(`function ${name}(`);const end=source.indexOf('\nfunction ',start+1);assert(start>=0&&end>start);return source.slice(start,end);}
export function engine(){
 const state={running:true,fly:{x:0,y:.2,z:0,heading:0,speed:0,vy:0,mode:'ground',surface:'floor',modeTime:0,blocked:0,pitch:0,roll:0,command:null},motor:{},metabolism:{},odorTrace:{raw:0,filtered:0,trend:0,ready:false},fruits:[],gait:createTripodGaitState()};resetExperimentState(state);
 const SURFACES={floor:{label:'suelo',normal:new THREE.Vector3(0,1,0),a:new THREE.Vector3(1,0,0),b:new THREE.Vector3(0,0,1)}};
 for(const [key,n,a]of [['wall-x+',[-1,0,0],[0,0,1]],['wall-x-',[1,0,0],[0,0,-1]],['wall-z+',[0,0,-1],[-1,0,0]],['wall-z-',[0,0,1],[1,0,0]]])SURFACES[key]={normal:new THREE.Vector3(...n),a:new THREE.Vector3(...a),b:new THREE.Vector3(0,1,0)};
 const ctx=vm.createContext({state,THREE,updateGrooming,captureCornerPose,startCorner,HALF:6,bodyCollider:new FlyBodyCollider(),bodySensorFrame,SURFACES,SURFACE_BOUND:5.78,GROUND_Y:.2,MAX_ALTITUDE:4.25,FLY_RADIUS:.16,FIXED_DT,random:seededRandom(1337),brain:new MushroomBodyProxy(),activity:new ConnectomeActivityTracker(),maleCNS:{setInput(){},reset(){},setRunning(){}},maleMotor(){return null;},usingMaleCNS(){return false;},isMaleMode(){return false;},adaptiveEnabled(){return false;},motorLearner:{params(){return{};},update(){return{};},status(){return{};}},ui:{brainMode:{value:'proxy'}},session:{samples:[]},mixOdors,sensoryAverage,planarFrame,consumeFlightCommand,updateTripodGait,tripodPropulsion,resolveFruitCollisions,fruitSurfaceDistance,logEvent(){},updateFlightButton(){},syncFruitVisual(){},syncFruitControls(){},addTrailPoint(){},deleteFruit(f){state.fruits=state.fruits.filter(x=>x!==f);},selectFruit(){}});
 for(const name of ['prepareLanding','resolveBodyContact','surfaceFrame','headingFromWorld','transferWall','attachWall','returnToFloor','setMode','antennaPositions','startFeeding','stopFeeding','updateFruitOdorTrace','removeFruitIfEmpty','updateMetabolism','neuralMotorReady','locomotorSignals','autonomousModeDecision','moveOnSurface','simulate'])vm.runInContext(extract(name),ctx);
 return {state,ctx,step:dt=>ctx.simulate(dt)};
}
test('flight and floor sensors steer toward the same lateral odor source',()=>{
 const {state,ctx}=engine(),fruit={type:'apple',x:1,z:1,strength:1,amount:1};
 const turns=[];for(const mode of ['ground','flight']){state.fly.mode=mode;const a=ctx.antennaPositions();turns.push(new MushroomBodyProxy().step({leftMixture:mixOdors([fruit],a.left.x,a.left.z,a.left.y).mixture,rightMixture:mixOdors([fruit],a.right.x,a.right.z,a.right.y).mixture}).turn);}
 assert(turns[0]>0);assert(Math.abs(turns[0]-turns[1])<1e-10);
});
test('manual takeoff stays airborne and manual landing does not bounce back',()=>{
 const {state,step}=engine();state.fly.command='takeoff';for(let i=0;i<360;i++)step(FIXED_DT);assert.equal(state.fly.mode,'flight');assert.equal(state.fly.command,null);
 state.fly.command='land';step(FIXED_DT);for(let i=0;i<1200&&state.fly.mode!=='ground';i++)step(FIXED_DT);assert.equal(state.fly.mode,'ground');for(let i=0;i<60;i++)step(FIXED_DT);assert.equal(state.fly.mode,'ground');assert.equal(state.fly.command,null);
});
test('same seed yields identical full simulation state at 20 and 60 rendered FPS',()=>{
 function run(fps){const e=engine(),clock=new FixedStepper();for(let i=0;i<fps*5;i++)clock.advance(1/fps,e.step);return JSON.parse(JSON.stringify(e.state));}
 assert.deepEqual(run(20),run(60));assert.equal(run(20).t,5);
});
test('reset clears previous trial clocks, metabolism and stale telemetry',()=>{
 const state={t:100,lastTrailAt:99.9,metabolism:{energy:.2,intake:9},motor:{flightSkill:.9},latest:{old:true}};resetExperimentState(state);
 assert.equal(state.t,0);assert(state.lastTrailAt<0);assert.equal(state.metabolism.intake,0);assert.equal(state.metabolism.energy,.56);assert.equal(state.motor.flightSkill,.12);assert.equal(state.latest,null);
});
test('negative reward cancels an existing feeding episode before consumption',()=>{
 const {state,ctx}=engine(),fruit={type:'apple',x:0,z:0,amount:1,reward:1};state.metabolism.energy=.5;ctx.startFeeding(fruit);assert(state.metabolism.feeding);fruit.reward=-1;ctx.updateMetabolism(.1);assert.equal(state.metabolism.feeding,false);assert.equal(fruit.amount,1);assert(state.metabolism.energy<.5);
});
test('learning receives ambient mixtures including a distracting fruit',()=>{
 const {state,ctx,step}=engine();state.fruits=[{type:'apple',x:.5,z:0,strength:1,reward:1,amount:1},{type:'orange',x:1,z:1,strength:1,reward:1,amount:1}];state.currentContact=state.fruits[0];
 const a=ctx.antennaPositions(),expected=sensoryAverage(mixOdors(state.fruits,a.left.x,a.left.z,a.left.y).mixture,mixOdors(state.fruits,a.right.x,a.right.z,a.right.y).mixture);
 let learned;ctx.brain.learn=(mixture)=>{learned=mixture;};step(FIXED_DT);assert(learned);assert.deepEqual({...learned},{...expected});assert(learned.DL1>0);
});
test('air has no additional climbing activation and clear resets sample phase',()=>{
 const t=new ConnectomeActivityTracker();const v=t.update(.04,{odorLeft:0,odorRight:0,mode:'flight',surface:'air'});assert.equal(v.CX,.2);assert.equal(v.VNC,.42);t.clear();assert.equal(t.acc,0);assert.equal(t.values.CX,0);
});
test('editor rejects overlapping fruits and reserves room for replenishment',()=>{
 const a={type:'apple',id:1,x:0,z:0,amount:.1};assert.equal(placementAllowed({type:'apple',id:2,x:1,z:0},[a]),false);assert.equal(placementAllowed({type:'apple',id:2,x:2,z:0},[a]),true);assert.equal(placementAllowed({type:'apple',id:2,x:5.7,z:0},[]),false);
});
test('multiple contact resolution returns a collision-free pose from a valid previous pose',()=>{
 const fruits=[{type:'apple',x:0,z:0},{type:'apple',x:1,z:0}],prev={x:.5,y:.2,z:1.5},next={x:.5,y:.2,z:0};const result=resolveFruitCollisions(prev,next,fruits,{groundMode:true,margin:.16});assert(!result.blocked);assert(fruits.every(f=>!pointInsideFruit(result.point,f,.16)));
});
test('long browser suspension is explicit and does not inject a huge physics step',()=>{const clock=new FixedStepper();let n=0;assert.equal(clock.advance(3,()=>n++),false);assert.equal(n,0);});
