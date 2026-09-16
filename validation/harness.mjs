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
