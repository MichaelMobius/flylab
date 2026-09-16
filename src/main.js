import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FRUIT_LIBRARY, MushroomBodyProxy, mixOdors } from './brain.js';
import { colliderForFruit, fruitSurfaceDistance, resolveFruitCollisions, placementAllowed } from './world.js';
import { CONNECTOME_REGIONS, ConnectomeActivityTracker } from './activity.js';
import {FlyBodyCollider,poseFly,bodySensorFrame} from './body.js';
const bodyCollider=new FlyBodyCollider();
import { MaleCNSBridge } from './malecns/bridge.js';

const ARENA = 12;
const HALF = ARENA / 2;
const GROUND_Y = 0.20;
const MAX_ALTITUDE = 4.25;
const FLY_RADIUS = 0.16;
import {createFly,createFruitMesh,animateFlyLegs} from './models.js';
import {updateGrooming} from './grooming.js';
import {captureCornerPose,startCorner} from './corner.js';
import {FIXED_DT,FixedStepper,seededRandom,planarFrame,consumeFlightCommand,sensoryAverage,resetExperimentState} from './runtime.js';
import {createTripodGaitState,resetTripodGait,updateTripodGait,tripodPropulsion} from './gait.js';
import {AdaptiveMotorLearner} from './adaptive/motor_learning.js';
const seed=Number(new URLSearchParams(location.search).get('seed')||1337)>>>0;
let random=seededRandom(seed);const stepper=new FixedStepper();
const session={version:'1.3.1',seed,step:FIXED_DT,events:[],samples:[],initial:null};
function logEvent(type,data={}){session.events.push({t:state.t,tick:state.ticks,type,...data});}
function scenario(){return state.fruits.map(({id,type,x,z,strength,reward,amount,sigma,odorY})=>({id,type,x,z,strength,reward,amount,sigma,odorY}));}
function notice(message){ui.statusText.textContent=message;}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

const ui = Object.fromEntries([
  'viewport','runBtn','flightBtn','resetFlyBtn','clearMemoryBtn','fruitType','addFruitBtn','clearFruitsBtn','statusDot','statusText','clockValue',
  'modeHud','altitudeHud','placementHint','leftOdorBar','rightOdorBar','gradientBar','leftOdorValue','rightOdorValue','gradientValue','ornValue','kcValue',
  'memoryValue','dopamineValue','turnValue','contactValue','collisionValue','rewardValue','distanceValue','airTimeValue','firstFruitValue','odorFieldToggle','trailToggle',
  'modeValue','altitudeValue','speedValue','flightSkillValue','flightSkillBar','selectedFruitName','noSelection','selectionControls','odorStrength','odorStrengthOut',
  'fruitReward','rewardOut','fruitX','fruitZ','deleteFruitBtn'
].map(id => [id, document.getElementById(id)]));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071013);
scene.fog = new THREE.FogExp2(0x071013, 0.022);

const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 100);
const CAMERA_HOME = new THREE.Vector3(8.4, 7.4, 10.6);
const CAMERA_TARGET_HOME = new THREE.Vector3(0, 0.85, 0);
camera.position.copy(CAMERA_HOME);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
ui.viewport.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
pmrem.dispose();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.copy(CAMERA_TARGET_HOME);
// Camera-first interaction: left click belongs to the experiment, wheel zooms, right drag orbits.
controls.mouseButtons.LEFT = null;
controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
controls.enableZoom = true;
controls.zoomSpeed = 1.15;
controls.zoomToCursor = true;
controls.panSpeed = 0.85;
controls.rotateSpeed = 0.62;
controls.minDistance = 2.15;
controls.maxDistance = 36;
controls.maxPolarAngle = Math.PI * 0.495;
renderer.domElement.style.touchAction = 'none';
renderer.domElement.tabIndex = 0;
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

// ---- Premium procedural environment -----------------------------------------------------------
scene.add(new THREE.HemisphereLight(0xbfe8ef, 0x243021, 1.15));
const key = new THREE.DirectionalLight(0xfff7e4, 3.15);
key.position.set(5.5, 10.5, 4.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
key.shadow.bias = -0.0002;
scene.add(key);
const rim = new THREE.PointLight(0x74ddf2, 18, 18, 2);
rim.position.set(-5, 3.8, -5);
scene.add(rim);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(34, 32, 18),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { top: { value: new THREE.Color(0x17343d) }, bottom: { value: new THREE.Color(0x050b0d) } },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h=clamp(normalize(vP).y*.5+.5,0.,1.); gl_FragColor=vec4(mix(bottom,top,pow(h,1.35)),1.); }'
  })
);
scene.add(sky);

function makeGroundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#26332e'; x.fillRect(0,0,512,512);
  for (let i=0;i<4200;i++) {
    const a = Math.random()*.065 + .015;
    x.fillStyle = `rgba(${90+Math.random()*35|0},${110+Math.random()*34|0},${95+Math.random()*25|0},${a})`;
    const r = Math.random()*1.8+.25; x.beginPath(); x.arc(Math.random()*512,Math.random()*512,r,0,Math.PI*2); x.fill();
  }
  for (let i=0;i<24;i++) { x.strokeStyle='rgba(190,220,205,.028)'; x.lineWidth=1; x.beginPath(); x.moveTo(0,i*22+Math.random()*9); x.lineTo(512,i*22+Math.random()*9); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3,3); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=renderer.capabilities.getMaxAnisotropy(); return t;
}

const platform = new THREE.Mesh(new THREE.BoxGeometry(ARENA+0.5, 0.25, ARENA+0.5), new THREE.MeshStandardMaterial({ color:0x121d1c, roughness:.72, metalness:.08 }));
platform.position.y=-0.135; platform.receiveShadow=true; scene.add(platform);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA, ARENA), new THREE.MeshStandardMaterial({ map:makeGroundTexture(), color:0x9ab4a4, roughness:.93, metalness:0 }));
floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; floor.name='arena-floor'; scene.add(floor);

// Subtle coordinate marks rather than a heavy grid.
const grid = new THREE.GridHelper(ARENA, 12, 0x86a99c, 0x49645b);
grid.material.transparent=true; grid.material.opacity=.12; grid.position.y=.006; scene.add(grid);

// Glass walls make the arena volume visible while keeping the view open.
const glassMat = new THREE.MeshPhysicalMaterial({ color:0x92c8ca, transparent:true, opacity:.085, roughness:.12, metalness:0, transmission:.65, depthWrite:false, side:THREE.DoubleSide });
const railMat = new THREE.MeshStandardMaterial({ color:0x2e4442, roughness:.42, metalness:.48 });
for (const side of [
  {x:0,z:-HALF, sx:ARENA,sz:.035}, {x:0,z:HALF,sx:ARENA,sz:.035},
  {x:-HALF,z:0,sx:.035,sz:ARENA}, {x:HALF,z:0,sx:.035,sz:ARENA}
]) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(side.sx, MAX_ALTITUDE+.8, side.sz), glassMat);
  wall.position.set(side.x,(MAX_ALTITUDE+.8)/2,side.z); scene.add(wall);
}
for (const [x,z,sx,sz] of [[0,-HALF,ARENA+.12,.07],[0,HALF,ARENA+.12,.07],[-HALF,0,.07,ARENA+.12],[HALF,0,.07,ARENA+.12]]) {
  for (const y of [.05,MAX_ALTITUDE+.77]) { const r=new THREE.Mesh(new THREE.BoxGeometry(sx,.07,sz),railMat); r.position.set(x,y,z); r.castShadow=true; scene.add(r); }
}

// Floating dust gives depth cues during flight.
const dustN=260, dustPos=new Float32Array(dustN*3);
for(let i=0;i<dustN;i++){ dustPos[i*3]=(Math.random()*2-1)*HALF; dustPos[i*3+1]=.08+Math.random()*(MAX_ALTITUDE+.35); dustPos[i*3+2]=(Math.random()*2-1)*HALF; }
const dustGeo=new THREE.BufferGeometry(); dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xcce9df,size:.018,transparent:true,opacity:.18,depthWrite:false})); scene.add(dust);


// ---- Fly --------------------------------------------------------------------------------------
const flyMesh=createFly(); scene.add(flyMesh);
const flyPovAnchor=new THREE.Object3D(); flyPovAnchor.name='fly-pov-anchor'; flyPovAnchor.position.set(0,.008,.355); flyMesh.userData.visual.add(flyPovAnchor);
let flyViewReturn=null;

// 3D trail.
const trailMax=2200, trailPositions=new Float32Array(trailMax*3); const trailGeo=new THREE.BufferGeometry(); trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPositions,3)); trailGeo.setDrawRange(0,0);
const trail=new THREE.Line(trailGeo,new THREE.LineBasicMaterial({color:0xa8ff60,transparent:true,opacity:.65})); scene.add(trail); let trailCount=0;

const SURFACE_OFFSET=.22;
const SURFACE_BOUND=HALF-SURFACE_OFFSET;
const SURFACES={
  floor:{label:'suelo',normal:new THREE.Vector3(0,1,0),a:new THREE.Vector3(1,0,0),b:new THREE.Vector3(0,0,1)},
  'wall-x+':{label:'vidrio este',normal:new THREE.Vector3(-1,0,0),a:new THREE.Vector3(0,0,1),b:new THREE.Vector3(0,1,0)},
  'wall-x-':{label:'vidrio oeste',normal:new THREE.Vector3(1,0,0),a:new THREE.Vector3(0,0,-1),b:new THREE.Vector3(0,1,0)},
  'wall-z+':{label:'vidrio sur',normal:new THREE.Vector3(0,0,-1),a:new THREE.Vector3(-1,0,0),b:new THREE.Vector3(0,1,0)},
  'wall-z-':{label:'vidrio norte',normal:new THREE.Vector3(0,0,1),a:new THREE.Vector3(1,0,0),b:new THREE.Vector3(0,1,0)},
};

const state={
  running:true, placing:false, selected:null, dragging:false, fruits:[], nextFruitId:1, inspector:false, flyView:false, flyVisionMode:'compound',
  t:0,distance:0,contacts:0,collisions:0,reward:0,airTime:0,wallTime:0,firstFruitTime:null,lastContactAt:-99,lastTrailAt:0,explore:0,lastCollision:false,currentContact:null,
  motor:{ flightSkill:.12, stableAir:0, safeLandings:0 },
  gait:createTripodGaitState(),
  metabolism:{energy:.56,hunger:.44,intake:0,feeding:false,fruit:null,feedTime:0,lastLearnAt:-99,visualLift:0},
  odorTrace:{raw:0,filtered:0,trend:0,ready:false},
  fly:{ x:-3.6,y:GROUND_Y,z:2.8,heading:-.7,speed:0,vy:0,mode:'ground',surface:'floor',modeTime:0,blocked:0,landingSurface:null,wallStall:0,roll:0,pitch:0,command:null }
};
const brain=new MushroomBodyProxy({seed});
const activity=new ConnectomeActivityTracker({sampleHz:12,maxSeconds:60});
const motorLearner=new AdaptiveMotorLearner({seed,windowSeconds:1.8,epsilon:.18,learningRate:.08});
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2(), groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0), dragPoint=new THREE.Vector3();

const extraIds=['gaitValue','surfaceHud','energyValue','hungerValue','energyBar','hungerBar','feedingValue','intakeValue','actionValue','dominantRegion','exportActivityBtn','regionBars','activityToggle','activitySource','wallTimeValue','foodAmount','foodAmountOut','panelToggleBtn','panelCloseBtn','resetCameraBtn','focusBtn','neuralInspectorBtn','flyViewBtn','flyPovBadge','flyPovCaption','ocularModeBtn','compoundModeBtn','compoundVisionCanvas','neuralInspector','niCloseBtn','niAction','niDominant','niMode','niSurface','niBars','neuralTraceCanvas','brainMode','neuralPacing','maleStatus','malecnsCard','maleNetworkValue','maleSpeedValue','maleAwakeValue','maleTopTypeValue','maleMotorModeValue','maleFwdValue','maleTurnValue','maleTakeoffValue','maleFeedValue','maleWallMotivationValue','maleOdorTrendValue','connectomeNote','adaptiveMotorCard','adaptiveToggle','adaptiveResetBtn','adaptiveStatusValue','adaptiveGenerationValue','adaptiveRewardValue','adaptiveSlipValue','adaptiveParamsValue'];
for(const id of extraIds) ui[id]=document.getElementById(id);
const regionRows={}; const regionNodes={};
for(const r of CONNECTOME_REGIONS){
  const row=document.createElement('div'); row.className='region-row'; row.innerHTML=`<b>${r.short}</b><div class="region-meter"><i></i></div><strong>0%</strong>`; ui.regionBars.appendChild(row);
  regionRows[r.key]={bar:row.querySelector('i'),value:row.querySelector('strong')}; regionNodes[r.key]=document.querySelector(`.region-node[data-region="${r.key}"] circle`);
}
const niRows={}, niNodes={};
for(const r of CONNECTOME_REGIONS){
  const row=document.createElement('div'); row.className='ni-row'; row.innerHTML=`<b>${r.short}</b><div class="ni-meter"><i></i></div><strong>0%</strong>`; ui.niBars.appendChild(row);
  niRows[r.key]={bar:row.querySelector('i'),value:row.querySelector('strong')};
  niNodes[r.key]=document.querySelector(`.ni-node[data-ni-region="${r.key}"] circle`);
}
const neuralTraceCtx=ui.neuralTraceCanvas.getContext('2d');

const maleCNS=new MaleCNSBridge({
  pacing:new URLSearchParams(location.search).get('pacing')==='synchronized'?'synchronized':'interactive',
  onStatus:({message})=>setMaleStatus('loading',message),
  onReady:info=>{
    const selected=isMaleMode();
    setMaleStatus(selected?'live':'',selected?`${controlSelected()?'MaleCNS Control':'MaleCNS Observe'} · ${info.N.toLocaleString()} neuronas`:'Proxy · MaleCNS listo');
    ui.malecnsCard.hidden=!selected;
    ui.maleNetworkValue.textContent=`${info.N.toLocaleString()} N · ${(info.E/1e6).toFixed(2)} M E`;
    if(selected){maleCNS.setMode(controlSelected()?'control':'observe');ui.activitySource.textContent=controlSelected()?'MaleCNS Control · spikes + DN':'MaleCNS Observe · spikes reales';document.querySelector('.workspace')?.classList.add('malecns-live');document.querySelector('.workspace')?.classList.toggle('malecns-control',controlSelected());maleCNS.setRunning(state.running);}else maleCNS.setRunning(false);
  },
  onActivity:s=>{
    if(!isMaleMode())return;
    ui.maleSpeedValue.textContent=`${s.neuralSpeed.toFixed(2)}× · ${maleCNS.pacing==='interactive'?'fluido':'sincronizado'} · muestra hace ${Math.max(0,state.t-(s.bodyTime||0)).toFixed(2)} s`;
    ui.maleAwakeValue.textContent=(s.awake||0).toLocaleString();
    ui.maleTopTypeValue.textContent=s.topTypes?.[0]?.type||'—';
    const m=s.motor||{};ui.maleMotorModeValue.textContent=controlSelected()?(m.controlReady?`${m.intrinsicState||'activo'}${m.intrinsicReason?` · ${m.intrinsicReason}`:''} · DN`:'calibrando · control proxy'):'observación';ui.maleFwdValue.textContent=`${(m.fwdHz||0).toFixed(1)} Hz · Δ ${(m.fwdExcessHz||0).toFixed(1)} · v ${(m.v||0).toFixed(2)}`;ui.maleTurnValue.textContent=`Δ ${(m.turnHz||0).toFixed(1)} Hz · ${(m.turn||0).toFixed(2)}`;ui.maleTakeoffValue.textContent=`${(m.takeoffHz||0).toFixed(1)} Hz${m.takeoffTriggered?' · TRIGGER':''}`;ui.maleFeedValue.textContent=`${(m.feedHz||0).toFixed(1)} Hz`;ui.maleWallMotivationValue.textContent=`${Math.round((m.wallSearchMotivation||0)*100)}% · deuda ${(m.wallSearchDriveMs||0).toFixed(0)} ms`;ui.maleOdorTrendValue.textContent=`${(m.fruitOdor||0).toFixed(2)} · ${(m.fruitOdorTrend||0)>=0?'+':''}${(m.fruitOdorTrend||0).toFixed(3)}/s`;
  },
  onError:error=>{
    setRunning(false);logEvent('neural-error',{message:error.message});
    setMaleStatus('error','MaleCNS detenido: '+error.message);
    ui.activitySource.textContent='proxy funcional · MaleCNS error';
    console.error(error);
  }
});
function setMaleStatus(kind,label){
  ui.maleStatus.classList.remove('loading','live','error');if(kind)ui.maleStatus.classList.add(kind);
  ui.maleStatus.querySelector('span').textContent=label;
}
function isMaleMode(){return ui.brainMode?.value==='malecns-observe'||ui.brainMode?.value==='malecns-control';}
function controlSelected(){return ui.brainMode?.value==='malecns-control';}
function usingMaleControl(){return controlSelected()&&maleCNS.ready&&!!maleCNS.latest;}
function usingMaleCNS(){return isMaleMode()&&maleCNS.ready&&!!maleCNS.latest;}
function adaptiveEnabled(){return usingMaleControl()&&!!ui.adaptiveToggle?.checked;}
function maleMotor(){return usingMaleControl()?maleCNS.latest?.motor:null;}
function displayedActivity(proxyVals){return usingMaleCNS()?maleCNS.latest.norm:proxyVals;}
function displayedDominant(vals){let best='AL',bv=-Infinity;for(const r of CONNECTOME_REGIONS){const v=vals?.[r.key]||0;if(v>bv){bv=v;best=r.key;}}return best;}

const compoundVisionCtx=ui.compoundVisionCanvas.getContext('2d',{alpha:false,desynchronized:true});
const COMPOUND_RES={w:44,h:36};
const COMPOUND_LAYOUT={eyeFov:155, yaw:0.62, eyeSeparation:0.054, cols:22, rows:18};
const compoundLeftRT=new THREE.WebGLRenderTarget(COMPOUND_RES.w,COMPOUND_RES.h,{depthBuffer:true,stencilBuffer:false});
const compoundRightRT=new THREE.WebGLRenderTarget(COMPOUND_RES.w,COMPOUND_RES.h,{depthBuffer:true,stencilBuffer:false});
const compoundLeftPixels=new Uint8Array(COMPOUND_RES.w*COMPOUND_RES.h*4);
const compoundRightPixels=new Uint8Array(COMPOUND_RES.w*COMPOUND_RES.h*4);
const compoundLeftCamera=new THREE.PerspectiveCamera(COMPOUND_LAYOUT.eyeFov,COMPOUND_RES.w/COMPOUND_RES.h,.02,100);
const compoundRightCamera=compoundLeftCamera.clone();
let compoundVisionSize={w:960,h:540};
let lastCompoundRenderAt=-1;
const compoundTmp={
  pos:new THREE.Vector3(), quat:new THREE.Quaternion(),
  forward:new THREE.Vector3(), up:new THREE.Vector3(), right:new THREE.Vector3(),
  leftPos:new THREE.Vector3(), rightPos:new THREE.Vector3(),
  leftForward:new THREE.Vector3(), rightForward:new THREE.Vector3()
};

function addOdorVolume(fruit){
  const group=new THREE.Group(); group.name='odor-volume';
  for(const [s,o] of [[.42,.075],[.72,.045],[1.0,.026]]){
    const shell=new THREE.Mesh(new THREE.SphereGeometry(fruit.sigma*s,20,14),new THREE.MeshBasicMaterial({color:0x6ee7ef,transparent:true,opacity:o,wireframe:true,depthWrite:false}));
    shell.position.y=fruit.odorY; group.add(shell);
  }
  fruit.mesh.add(group); fruit.rings=group;
}
function addFruit(type,x,z){
  if(state.fruits.length>=32){notice('Máximo de 32 frutas por ensayo.');return null;}
  if(!FRUIT_LIBRARY[type])type='apple';const spec=FRUIT_LIBRARY[type];
  const fruit={id:state.nextFruitId++,type,x:clampArena(x),z:clampArena(z),strength:spec.strength,reward:spec.reward,sigma:2.15,odorY:.36,amount:1,mesh:null,rings:null,removing:false,removeT:0};
  if(!placementAllowed(fruit,state.fruits)){notice('Deja espacio entre frutas y respecto al vidrio.');return null;}
  fruit.mesh=createFruitMesh(type); fruit.mesh.position.set(fruit.x,0,fruit.z); fruit.mesh.userData.fruit=fruit; addOdorVolume(fruit); scene.add(fruit.mesh); state.fruits.push(fruit); syncFruitVisual(fruit); selectFruit(fruit);logEvent('add-fruit',{fruit:{id:fruit.id,type:fruit.type,x:fruit.x,z:fruit.z,strength:fruit.strength,reward:fruit.reward,amount:fruit.amount}});refreshFruitList();return fruit;
}
function deleteFruit(fruit){ if(!fruit)return;logEvent('delete-fruit',{id:fruit.id}); if(state.metabolism.fruit===fruit)stopFeeding(); scene.remove(fruit.mesh); fruit.mesh.traverse(o=>{o.geometry?.dispose?.(); if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material.dispose?.();}}); state.fruits=state.fruits.filter(f=>f!==fruit); if(state.selected===fruit)selectFruit(null);refreshFruitList(); }
function clampArena(v){ return Math.max(-HALF+.45,Math.min(HALF-.45,v)); }
function syncFruitVisual(fruit){ const sel=1; const amount=Math.max(0,Math.min(1,fruit.amount)); const eaten=.20+.80*Math.sqrt(amount); const pulse=1; fruit.mesh.userData.visual.scale.setScalar(sel*eaten*pulse); fruit.rings.scale.setScalar(.55+.45*Math.max(.02,amount)); fruit.rings.visible=ui.odorFieldToggle.checked&&amount>0; const ring=fruit.mesh.userData.consumeRing; if(ring){ ring.material.opacity=amount<.45?(1-amount)*.32:0; ring.scale.setScalar(.7+.4*(1-amount)); } const shadow=fruit.mesh.userData.shadowDisk; if(shadow){ shadow.scale.setScalar(.72+.38*eaten); shadow.material.opacity=.06+.08*amount; } const mats=fruit.mesh.userData.materials||[]; for(const m of mats){ if('opacity' in m){ m.transparent=false; m.opacity=1; } if('emissive' in m){ m.emissiveIntensity=amount<.18?.22:0; }} }
function selectFruit(fruit){ const old=state.selected; state.selected=fruit; if(old)syncFruitVisual(old); if(fruit)syncFruitVisual(fruit); ui.selectedFruitName.textContent=fruit?`${FRUIT_LIBRARY[fruit.type].label} #${fruit.id}`:'ninguna'; ui.noSelection.hidden=!!fruit; ui.selectionControls.hidden=!fruit; if(fruit)syncFruitControls();refreshFruitList(); }
function syncFruitControls(){ const f=state.selected;if(!f)return; ui.odorStrength.value=f.strength;ui.odorStrengthOut.value=f.strength.toFixed(2);ui.fruitReward.value=f.reward;ui.rewardOut.value=(f.reward>=0?'+':'')+f.reward.toFixed(2);ui.fruitX.value=f.x.toFixed(2);ui.fruitZ.value=f.z.toFixed(2);ui.foodAmount.value=f.amount;ui.foodAmountOut.value=`${Math.round(f.amount*100)}%`; }
function moveSelected(x,z){const f=state.selected;if(!f)return;const candidate={...f,x:clampArena(x),z:clampArena(z)};if(!placementAllowed(candidate,state.fruits)){notice('Esa posición solapa otra fruta o el vidrio.');syncFruitControls();return;}f.x=candidate.x;f.z=candidate.z;f.mesh.position.set(f.x,0,f.z);syncFruitControls();logEvent('move-fruit',{id:f.id,x:f.x,z:f.z});}

function surfaceFrame(surface,heading){
  const s=SURFACES[surface]||SURFACES.floor; const forward=s.a.clone().multiplyScalar(Math.cos(heading)).addScaledVector(s.b,Math.sin(heading)).normalize();
  const right=s.normal.clone().cross(forward).normalize(); return {normal:s.normal,forward,right,a:s.a,b:s.b};
}
function headingFromWorld(surface,dir){ const s=SURFACES[surface]||SURFACES.floor; return Math.atan2(dir.dot(s.b),dir.dot(s.a)); }
function attachWall(name,oldDir){
  const f=state.fly,wasLanding=f.mode==='landing',landingHeading=f.landingHeading;if(wasLanding)f.wingFold=0; f.legAnchors=null;f.legSteps=null;f.lastGroundPose=null;f.surface=name; f.mode='ground'; f.modeTime=0; f.vy=0; f.wallStall=0;f.landingSurface=null;f.blocked=0;state.gait.grounded=true;
  if(wasLanding){state.motor.safeLandings++;logEvent('wall-landing',{surface:name,source:'body-policy'});}
  const s=SURFACES[name]; const side=THREE.MathUtils.clamp(oldDir.dot(s.a),-.65,.65); const dir=s.a.clone().multiplyScalar(side).addScaledVector(s.b,.82).normalize(); f.heading=wasLanding&&Number.isFinite(landingHeading)?landingHeading:headingFromWorld(name,dir);
  if(name==='wall-x+')f.x=SURFACE_BOUND;if(name==='wall-x-')f.x=-SURFACE_BOUND;if(name==='wall-z+')f.z=SURFACE_BOUND;if(name==='wall-z-')f.z=-SURFACE_BOUND; f.y=Math.max(.55,f.y);
  stopFeeding(); updateFlightButton();
}
function transferWall(next){
  const f=state.fly,from=f.surface;
  if(!from.startsWith('wall-')||!next.startsWith('wall-')||from[5]===next[5])return;
  const oldFrame=surfaceFrame(from,f.heading),normal=SURFACES[next].normal;
  const rotation=new THREE.Quaternion().setFromUnitVectors(oldFrame.normal,normal);
  const direction=oldFrame.forward.clone().applyQuaternion(rotation);
  const clearance=HALF-.0175-Math.abs(f[from[5]]);
  f.surface=next;f.heading=headingFromWorld(next,direction);
  f[next[5]]=(next.endsWith('+')?1:-1)*(HALF-.0175-clearance);
  f.wallStall=0;f.blocked=0;
  logEvent('wall-transfer',{from,to:next,source:'body-contact',turnDegrees:oldFrame.normal.clone().cross(normal).y*90});
}
function returnToFloor(){
  const f=state.fly; const horiz=SURFACES[f.surface].normal.clone();
  f.x+=horiz.x*.55;f.z+=horiz.z*.55;f.wallStall=0;f.speed=Math.max(.2,Math.abs(f.speed));
  f.surface='floor'; f.y=GROUND_Y; f.heading=Math.atan2(horiz.z,horiz.x); f.mode='ground'; f.modeTime=0; updateFlightButton();
}
function setMode(mode){
  if(state.fly.mode===mode)return; const f=state.fly, previous=f.mode, prevSurface=f.surface;
  if(mode==='takeoff'&&previous==='ground'){
    if(prevSurface!=='floor'){ const n=SURFACES[prevSurface].normal; f.x+=n.x*.24;f.y+=n.y*.24;f.z+=n.z*.24; const h=new THREE.Vector3(n.x,0,n.z); if(h.lengthSq()>.01)f.heading=Math.atan2(h.z,h.x); f.speed=Math.max(f.speed,.42); }
    f.surface='air'; stopFeeding();
  }
  f.legAnchors=null;f.legSteps=null;f.lastGroundPose=null;f.corner=null; f.mode=mode; f.modeTime=0;if(mode!=='landing')f.landingSurface=null;
  if(mode==='ground'){
    if(f.surface==='air')f.surface='floor'; if(f.surface==='floor')f.y=GROUND_Y; f.vy=0;
    if(previous==='landing'){ state.motor.safeLandings++; state.motor.flightSkill=Math.min(1,state.motor.flightSkill+.012); }
  }
  updateFlightButton();
}
function updateFlightButton(){ const takeoff=state.fly.mode==='ground'; ui.flightBtn.innerHTML=`<span class="tool-ico">${takeoff?'🪽':'🛬'}</span>`; ui.flightBtn.title=takeoff?'Forzar despegue':'Forzar aterrizaje'; ui.flightBtn.setAttribute('aria-label', ui.flightBtn.title); }
function resetFly(){
 state.fly.groom=null;state.fly.legAnchors=null;state.fly.legSteps=null;state.fly.lastGroundPose=null;state.fly.corner=null;state.fly.bodyQuaternion=null;state.fly.bodyFloorHeight=0;state.fly.bodyContact=null;
 random=seededRandom(seed);resetExperimentState(state);brain.clearMemory();stepper.clear();resetTripodGait(state.gait);
 Object.assign(state.fly,{x:-3.6,y:GROUND_Y,z:2.8,heading:-.7,speed:0,vy:0,mode:'ground',surface:'floor',modeTime:0,blocked:0,landingSurface:null,roll:0,pitch:0,command:null});
 Object.assign(state.odorTrace,{raw:0,filtered:0,trend:0,ready:false});
 // Reset the assay to the current fruit arrangement, replenishing its food.
 for(const fruit of state.fruits){fruit.amount=1;syncFruitVisual(fruit);}
 activity.clear();maleCNS.reset();session.events=[];session.samples=[];session.initial=scenario();session.initialMotorLearning=motorLearner.export();session.initialBrainMode=ui.brainMode.value;session.initialNeuralPacing=maleCNS.pacing;session.neuralSource=maleCNS.info?.source||null;trailCount=0;trailGeo.setDrawRange(0,0);updateFlightButton();resolveBodyContact(0);updateFlyMesh(0);
 updateTelemetry(brain.last,0,0,activity.values);if(state.selected)syncFruitControls();
}

function orientSegment(mesh,a,b){
  const dir=b.clone().sub(a); const len=Math.max(1e-4,dir.length());
  mesh.position.copy(a).addScaledVector(dir,.5);
  mesh.scale.set(1,len/mesh.geometry.parameters.height,1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
}
function animateLegs(){animateFlyLegs(flyMesh,state.gait,state.fly,state.metabolism.feeding);}

function updateFlyMesh(t){
  const f=state.fly;const frame=f.mode==='ground'?surfaceFrame(f.surface,f.heading):surfaceFrame('floor',f.heading);
  poseFly(flyMesh,f,state.gait,state.metabolism.feeding,t,frame);
}
function prepareLanding(){
 const f=state.fly;if(f.mode==='ground'||f.mode==='takeoff')return;
 if(f.landingSurface){
  const wall=f.landingSurface,normal=SURFACES[wall].normal,gap=HALF-.0175-(wall.endsWith('+')?f[wall[5]]:-f[wall[5]]);
  if(gap<1.2&&f.y>=.55){f.heading=Math.atan2(-normal.z,-normal.x);return;}
  f.landingSurface=null;f.landingHeading=null;
 }
 const eligible=f.mode==='landing'||(f.mode==='flight'&&f.modeTime>2&&(state.metabolism.energy<.75||f.modeTime>8));
 if(!eligible||f.y<.55||f.y>MAX_ALTITUDE)return;
 const direction=new THREE.Vector3(Math.cos(f.heading),0,Math.sin(f.heading));
 for(const name of ['wall-x+','wall-x-','wall-z+','wall-z-']){
  const normal=SURFACES[name].normal,axis=name[5],gap=HALF-.0175-(name.endsWith('+')?f[axis]:-f[axis]);
  if(gap>.85||direction.dot(normal)>-.25)continue;
  if(f.mode!=='landing')setMode('landing');
  if(f.landingSurface!==name){
   f.landingSurface=name;const s=SURFACES[name],side=THREE.MathUtils.clamp(direction.dot(s.a),-.65,.65);
   f.landingHeading=headingFromWorld(name,s.a.clone().multiplyScalar(side).addScaledVector(s.b,.82).normalize());
   logEvent('wall-approach',{surface:name,source:'body-policy'});
  }
  f.heading=Math.atan2(-normal.z,-normal.x);break;
 }
}
function resolveBodyContact(dt){
  prepareLanding();
  const f=state.fly,frame=f.mode==='ground'?surfaceFrame(f.surface,f.heading):f.landingSurface?surfaceFrame(f.landingSurface,f.landingHeading):surfaceFrame('floor',f.heading);
  const contact=bodyCollider.resolve(f,state.gait,{frame,dt,t:state.t,feeding:state.metabolism.feeding,half:HALF});
  if(f.corner)return;
  const movement=f.mode==='ground'?frame.forward:new THREE.Vector3(Math.cos(f.heading),0,Math.sin(f.heading));
  const towardX=contact.x*movement.x*f.speed<0,towardZ=contact.z*movement.z*f.speed<0;
  if(f.mode==='ground'&&f.surface==='floor'&&(towardX||towardZ)){
    const wall=towardX?(contact.x<0?'wall-x+':'wall-x-'):(contact.z<0?'wall-z+':'wall-z-');
    attachWall(wall,frame.forward.clone().multiplyScalar(Math.sign(f.speed)||1));
    bodyCollider.resolve(f,state.gait,{frame:surfaceFrame(f.surface,f.heading),dt:0,t:state.t,half:HALF});
  }else if(f.mode==='ground'&&f.surface.startsWith('wall-')){
    const acrossX=f.surface.startsWith('wall-z')&&towardX&&Math.abs(frame.forward.x*f.speed)>.04;
    const acrossZ=f.surface.startsWith('wall-x')&&towardZ&&Math.abs(frame.forward.z*f.speed)>.04;
    if(acrossX||acrossZ){
      const next=acrossX?(contact.x<0?'wall-x+':'wall-x-'):(contact.z<0?'wall-z+':'wall-z-');
      const from=f.surface,start=captureCornerPose(bodyCollider.root,f);
      transferWall(next);
      bodyCollider.resolve(f,state.gait,{frame:surfaceFrame(f.surface,f.heading),dt:0,t:state.t,half:HALF});
      if(f.mode==='ground'){const end=captureCornerPose(bodyCollider.root,f);startCorner(f,from,next,start,end);bodyCollider.resolve(f,state.gait,{frame:surfaceFrame(f.surface,f.heading),dt:0,t:state.t,half:HALF});}
    }
  }else if(f.mode!=='ground'&&contact.floor>0&&f.vy<0){
    f.surface='floor';setMode('ground');
    bodyCollider.resolve(f,state.gait,{frame:surfaceFrame('floor',f.heading),dt:0,t:state.t,half:HALF});
  }else if(f.mode!=='ground'&&(towardX||towardZ)){
    const wall=towardX?(contact.x<0?'wall-x+':'wall-x-'):(contact.z<0?'wall-z+':'wall-z-');
    const gap=HALF-.0175-(towardX?Math.abs(f.x):Math.abs(f.z));
    const mayLand=f.y>.55&&f.y<MAX_ALTITUDE&&
      (f.mode==='landing'||(f.mode==='flight'&&f.modeTime>2&&(state.metabolism.energy<.75||f.modeTime>8)));
    if(mayLand){
      if(f.mode!=='landing')setMode('landing');
      if(f.landingSurface!==wall){f.landingSurface=wall;logEvent('wall-approach',{surface:wall,source:'body-policy'});}
      const n=SURFACES[wall].normal;f.heading=Math.atan2(-n.z,-n.x);
      if(gap<=.25&&f.landingAligned){
        attachWall(wall,frame.forward);
        bodyCollider.resolve(f,state.gait,{frame:surfaceFrame(f.surface,f.heading),dt:0,t:state.t,half:HALF});
      }
      return;
    }
    let vx=Math.cos(f.heading),vz=Math.sin(f.heading);
    if(towardX)vx=-vx;if(towardZ)vz=-vz;f.heading=Math.atan2(vz,vx);
  }
}
function antennaPositions(){
  const f=state.fly; let frame;
  if(f.mode==='ground')frame=surfaceFrame(f.surface,f.heading); else {const p=planarFrame(f.heading);frame={forward:new THREE.Vector3(p.forward.x,0,p.forward.z),right:new THREE.Vector3(p.right.x,0,p.right.z),normal:new THREE.Vector3(0,1,0)};}
  frame=bodySensorFrame(f,frame);
  const center=new THREE.Vector3(f.x,f.y,f.z).addScaledVector(frame.forward,.24).addScaledVector(frame.normal,.08);
  const left=center.clone().addScaledVector(frame.right,-.13), right=center.clone().addScaledVector(frame.right,.13);
  return {left:{x:left.x,y:left.y,z:left.z},right:{x:right.x,y:right.y,z:right.z},center:{x:center.x,y:center.y,z:center.z}};
}

function startFeeding(fruit){
  const m=state.metabolism;
  if(!fruit||fruit.reward<=0||fruit.amount<=0||state.fly.mode!=='ground'||state.fly.surface!=='floor'||m.energy>.985)return;
  if(m.fruit!==fruit){m.feedTime=0;m.lastLearnAt=-99;}
  m.feeding=true; m.fruit=fruit;
}
function stopFeeding(){state.metabolism.feeding=false;state.metabolism.fruit=null;state.metabolism.feedTime=0;state.metabolism.visualLift=0;}
function updateFruitOdorTrace(value,dt){
  const tr=state.odorTrace;
  if(!tr.ready){tr.raw=tr.filtered=value;tr.trend=0;tr.ready=true;return tr;}
  const rawTrend=(value-tr.raw)/Math.max(1e-4,dt);tr.raw=value;
  const a=1-Math.exp(-dt/.65);tr.filtered+=a*(value-tr.filtered);tr.trend+=a*(rawTrend-tr.trend);
  if(Math.abs(tr.trend)<1e-5)tr.trend=0;
  return tr;
}
function removeFruitIfEmpty(fruit){
  if(!fruit||fruit.amount>0)return false;
  if(state.selected===fruit) selectFruit(null);
  if(state.metabolism.fruit===fruit) stopFeeding();
  deleteFruit(fruit);
  return true;
}
function updateMetabolism(dt){
  const m=state.metabolism,f=state.fly; const cost=f.mode==='flight'?.0105:(f.mode==='takeoff'?.012:(f.surface!=='floor'?.0052:.0032)); m.energy=Math.max(.08,m.energy-cost*dt); m.hunger=1-m.energy;
  if(!m.feeding||!m.fruit) return;
  const fruit=m.fruit, near=fruitSurfaceDistance({x:f.x,y:f.y,z:f.z},fruit,FLY_RADIUS+.035)<.13;
  if(!near||fruit.reward<=0||fruit.amount<=0||m.energy>=.995||f.mode!=='ground'||f.surface!=='floor'){stopFeeding();return;}
  m.feedTime+=dt; m.visualLift=Math.min(.24,m.feedTime*.18);
  const bite=Math.min(fruit.amount,dt*(.026+.056*m.hunger));
  if(bite<=0){stopFeeding(); return;}
  fruit.amount=Math.max(0,fruit.amount-bite);
  const nutritive=bite*(.78+.38*Math.max(0,fruit.reward)); m.intake+=nutritive; m.energy=Math.min(1,m.energy+nutritive*1.9); m.hunger=1-m.energy; state.reward+=bite*fruit.reward;
  if(state.t-m.lastLearnAt>.85){brain.learn(state.sensedMixture,fruit.reward);m.lastLearnAt=state.t;}
  if(removeFruitIfEmpty(fruit)) return;
  syncFruitVisual(fruit); if(state.selected===fruit)syncFruitControls();
}
function neuralMotorReady(){const m=maleMotor();return !!(m&&m.controlReady);}
function locomotorSignals(b){
  const m=neuralMotorReady()?maleMotor():null;
  if(!m)return {source:'proxy',turn:b.turn,approach:b.approach,v:null,motor:null};
  return {source:'malecns',turn:THREE.MathUtils.clamp(m.turn||0,-.6,.6),approach:THREE.MathUtils.clamp(Math.max(0,m.v||0),0,1),v:THREE.MathUtils.clamp(m.v||0,-.35,1),motor:m};
}
function autonomousModeDecision(odorMean,b,dt){
  const f=state.fly;const commanded=consumeFlightCommand(f);if(commanded){setMode(commanded);return;}if(state.metabolism.feeding||f.groom?.pause)return;
  // Body-time recovery remains responsive when neural time lags in fluid pacing.
  if(f.mode==='ground'&&f.surface!=='floor'&&(f.wallStall||0)>4){
    const surface=f.surface;const reason='wall-stall';
    if(f.y<.65)returnToFloor();else{setMode('takeoff');f.vy=.65;}
    logEvent('body-wall-recovery',{source:'body-assist',surface,reason,action:f.mode==='ground'?'floor':'takeoff'});return;
  }
  const m=neuralMotorReady()?maleMotor():null;
  if(m){
    if(f.mode==='ground'&&m.takeoffTriggered&&maleCNS.consumeTakeoff()){setMode('takeoff');f.vy=.45+.35*state.motor.flightSkill;logEvent('malecns-takeoff',{hz:m.takeoffHz,baseline:m.takeoffBaselineHz});return;}
    // v1.0 has no single validated landing-DN readout. Landing remains an explicit body policy,
    // while yaw/forward flight modulation comes from the descending-neuron readout.
    if(f.mode==='flight'){
      const wantLand=(f.modeTime>3&&odorMean>.34&&b.approach>.35&&f.y<1.0)||(f.modeTime>16&&odorMean<.07&&random()<.06*dt);
      if(wantLand)setMode('landing');
    }
    return;
  }
  if(f.mode==='ground'){
    const wall=f.surface!=='floor'; const shouldTakeoff = f.blocked>.52 || (f.modeTime>(wall?7:4.5) && odorMean<.10 && random()<.09*dt) || (f.modeTime>10 && random()<.14*dt);
    if(shouldTakeoff){ setMode('takeoff'); f.vy=.45+.35*state.motor.flightSkill; }
  } else if(f.mode==='flight'){
    const wantLand = (f.modeTime>2.5 && odorMean>.32 && b.approach>.38 && f.y<1.05) || (f.modeTime>13 && odorMean<.08 && random()<.09*dt);
    if(wantLand){ setMode('landing'); }
  }
}

function moveOnSurface(dt,desiredSpeed,turnRate){
  const f=state.fly; if(f.groom?.pause){f.speed=f.groom.active?0:f.speed*Math.exp(-dt*8);f.wallStall=0;return {distance:0,forwardSpeed:0};} if(f.corner){state.wallTime+=dt;return {distance:0,forwardSpeed:0};} f.heading+=turnRate*dt; f.speed+=(desiredSpeed-f.speed)*Math.min(1,dt*3.2); const fr=surfaceFrame(f.surface,f.heading); const prev={x:f.x,y:f.y,z:f.z};
  let next={x:f.x+fr.forward.x*f.speed*dt,y:f.y+fr.forward.y*f.speed*dt,z:f.z+fr.forward.z*f.speed*dt};
  if(f.surface==='floor'){
    let wall=null;
    if(next.x>SURFACE_BOUND)wall='wall-x+';else if(next.x<-SURFACE_BOUND)wall='wall-x-';else if(next.z>SURFACE_BOUND)wall='wall-z+';else if(next.z<-SURFACE_BOUND)wall='wall-z-';
    if(wall){ attachWall(wall,fr.forward); next={x:f.x,y:f.y,z:f.z}; }
    else {
      let collided=false,collidedFruit=null;
      const r=resolveFruitCollisions(prev,next,state.fruits,{margin:FLY_RADIUS,groundMode:true});if(r.collided){next=r.point;collided=true;collidedFruit=r.contact;f.blocked+=dt*3.8;}
      if(collided&&!state.lastCollision){state.collisions++;} state.lastCollision=collided;if(!collided)f.blocked=Math.max(0,f.blocked-dt*1.4);state.currentContact=collidedFruit;
    }
  } else {
    state.wallTime+=dt; state.lastCollision=false; state.currentContact=null;
    const wall=f.surface;
    if(next.y<=Math.max(GROUND_Y+.06,(f.bodyFloorHeight||0)+.015) && next.y<prev.y){ returnToFloor(); next={x:f.x,y:f.y,z:f.z}; }
    else {
      next.y=THREE.MathUtils.clamp(next.y,GROUND_Y+.02,MAX_ALTITUDE+.48);
      if(next.y>=MAX_ALTITUDE+.45&&fr.forward.y>0){f.heading=-Math.abs(f.heading)-.08;}
      if(wall.startsWith('wall-x')){ if(Math.abs(next.z)>SURFACE_BOUND){next.z=THREE.MathUtils.clamp(next.z,-SURFACE_BOUND,SURFACE_BOUND);// Adjacent-wall contact is resolved by transferWall after the step.
} next.x=wall==='wall-x+'?Math.min(f.x,SURFACE_BOUND):Math.max(f.x,-SURFACE_BOUND); }
      else { if(Math.abs(next.x)>SURFACE_BOUND){next.x=THREE.MathUtils.clamp(next.x,-SURFACE_BOUND,SURFACE_BOUND);// Adjacent-wall contact is resolved by transferWall after the step.
} next.z=wall==='wall-z+'?Math.min(f.z,SURFACE_BOUND):Math.max(f.z,-SURFACE_BOUND); }
    }
  }
  const delta=new THREE.Vector3(next.x-f.x,next.y-f.y,next.z-f.z);
  const d=delta.length(); const forwardSpeed=dt>0?delta.dot(fr.forward)/dt:0;
  if(f.surface!=='floor')f.wallStall=d<dt*.025?(f.wallStall||0)+dt:0;else f.wallStall=0;
  state.distance+=d;f.x=next.x;f.y=next.y;f.z=next.z;
  return {distance:d,forwardSpeed};
}

function simulate(dt){
  if(!state.running)return false;
  if(isMaleMode()&&(!maleCNS.ready||!maleCNS.canAdvance()))return false;
  state.t=++state.ticks*FIXED_DT; state.fly.modeTime+=dt;
  const ant=antennaPositions();
  const L=mixOdors(state.fruits,ant.left.x,ant.left.z,ant.left.y), R=mixOdors(state.fruits,ant.right.x,ant.right.z,ant.right.y);
  state.explore += (-state.explore*1.55+(random()*2-1)*(state.fly.mode==='flight'?.92:1.18))*dt;
  const b=brain.step({leftMixture:L.mixture,rightMixture:R.mixture,dt,exploration:state.explore});
  state.sensedMixture=sensoryAverage(L.mixture,R.mixture);updateMetabolism(dt);
  const odorMean=(L.total+R.total)/2; const odorTrace=updateFruitOdorTrace(odorMean,dt); autonomousModeDecision(odorMean,b,dt);
  const groomingEvent=updateGrooming(state.fly,dt,{feeding:state.metabolism.feeding,support:state.fly.support?.feet||0});
  if(groomingEvent)logEvent('groom-'+groomingEvent,{source:'body-policy'});

  const sig=locomotorSignals(b);
  const f=state.fly, skill=state.motor.flightSkill, hungerDrive=.82+.36*state.metabolism.hunger; let turnRate=0,desiredSpeed=0,targetAlt=f.y;
  if(f.mode==='ground'){
    desiredSpeed=(state.metabolism.feeding||f.groom?.pause)?.0:(sig.source==='malecns'?sig.v*.92:(.34+.50*sig.approach)*hungerDrive);
    const turnMobility=sig.source==='malecns'?(Math.abs(desiredSpeed)>.06?1:(Math.abs(sig.turn)>.38?.55:.12)):1;
    const desiredTurnRate=f.groom?.pause?0:2.05*sig.turn*turnMobility;
    f.vy=0; f.pitch=THREE.MathUtils.lerp(f.pitch,0,.12); f.roll=THREE.MathUtils.lerp(f.roll,-.10*sig.turn,.10);
    if(adaptiveEnabled()){
      // Embodied mode: DN commands are targets, not body velocities. The CPG and learned residual
      // determine stance-foot propulsion; the resulting traction moves the body.
      const params=motorLearner.params();
      updateTripodGait(state.gait,dt,{grounded:true,feeding:state.metabolism.feeding||!!f.groom?.pause,speed:f.speed,desiredSpeed,turn:f.groom?.pause?0:sig.turn,modifiers:params});
      const prop=tripodPropulsion(state.gait,dt);
      const bodyDrive=f.groom?.pause?0:THREE.MathUtils.clamp(prop.speed,-.46,1.12);
      turnRate=f.groom?.pause?0:THREE.MathUtils.clamp(prop.turn,-2.4,2.4);
      const motion=moveOnSurface(dt,bodyDrive,turnRate);
      const actualProgress=motion?.forwardSpeed??f.speed;
      const eligible=!state.metabolism.feeding&&!f.groom?.pause&&f.blocked<.28&&(Math.abs(desiredSpeed)>.055||Math.abs(desiredTurnRate)>.08);
      motorLearner.update(dt,{desiredSpeed,actualSpeed:actualProgress,desiredTurn:desiredTurnRate,actualTurn:turnRate,slip:prop.slip+Math.abs(f.speed-actualProgress)*.35,support:prop.support,cadence:state.gait.cadence,amplitude:state.gait.amplitude},{eligible,contextKey:f.surface+':'+Math.round(desiredSpeed*5)+':'+Math.round(desiredTurnRate*3)});
      state.lastAdaptiveMotion={desiredSpeed,desiredTurnRate,...prop,actualSpeed:actualProgress,actualTurn:turnRate};
    }else{
      turnRate=desiredTurnRate;
      moveOnSurface(dt,desiredSpeed,turnRate);
      updateTripodGait(state.gait,dt,{grounded:true,feeding:state.metabolism.feeding,speed:f.speed,desiredSpeed,turn:sig.turn});
      motorLearner.update(dt,{desiredSpeed,actualSpeed:f.speed,desiredTurn:desiredTurnRate,actualTurn:turnRate,slip:0,support:3,cadence:state.gait.cadence,amplitude:state.gait.amplitude},{eligible:false,contextKey:f.mode==='ground'?'inactive':'air'});
      state.lastAdaptiveMotion=null;
    }
  } else {
    if(f.mode==='takeoff'){turnRate=1.45*sig.turn;desiredSpeed=sig.source==='malecns'?.48+.42*Math.max(0,sig.v):.55+.34*sig.approach;targetAlt=1.05;f.vy+=(1.0+.42*skill-f.vy)*dt*3.2;f.pitch=THREE.MathUtils.lerp(f.pitch,-.16,.08);f.roll=THREE.MathUtils.lerp(f.roll,-.24*sig.turn,.10);if(f.y>.88)setMode('flight');}
    else if(f.mode==='flight'){turnRate=(1.45+.42*skill)*sig.turn;desiredSpeed=sig.source==='malecns'?.62+.72*Math.max(0,sig.v):(.76+.62*sig.approach+.28*skill)*hungerDrive;targetAlt=odorMean>.40?.48:odorMean>.16?.88:1.55+.28*Math.sin(state.t*.45);const control=(targetAlt-f.y)*(1.45+.85*skill)-f.vy*(1.65+.8*skill),wobble=(random()*2-1)*(.46*(1-skill));f.vy+=(control+wobble)*dt;f.pitch=THREE.MathUtils.lerp(f.pitch,THREE.MathUtils.clamp(-f.vy*.14,-.24,.22),.12);f.roll=THREE.MathUtils.lerp(f.roll,-.38*sig.turn,.12);state.airTime+=dt;if(Math.abs(f.vy)<.48&&!state.lastCollision){state.motor.stableAir+=dt;state.motor.flightSkill=Math.min(1,state.motor.flightSkill+dt*.009);}}
    else {turnRate=f.landingSurface?0:1.25*sig.turn;desiredSpeed=sig.source==='malecns'?.42+.28*Math.max(0,sig.v):.48+.28*sig.approach;targetAlt=f.landingSurface?f.y:GROUND_Y;f.vy+=((f.landingSurface?0:-.62)-f.vy)*dt*2.4;f.pitch=THREE.MathUtils.lerp(f.pitch,.12,.09);f.roll=THREE.MathUtils.lerp(f.roll,-.20*sig.turn,.10);state.airTime+=dt;}
    f.heading+=turnRate*dt;f.speed+=(desiredSpeed-f.speed)*Math.min(1,dt*2.2);const prev={x:f.x,y:f.y,z:f.z};let next={x:f.x+Math.cos(f.heading)*f.speed*dt,y:f.y+f.vy*dt,z:f.z+Math.sin(f.heading)*f.speed*dt};
    let wallHit=null;if(next.x>SURFACE_BOUND)wallHit='wall-x+';else if(next.x<-SURFACE_BOUND)wallHit='wall-x-';else if(next.z>SURFACE_BOUND)wallHit='wall-z+';else if(next.z<-SURFACE_BOUND)wallHit='wall-z-';
    if(wallHit){ if(f.mode==='landing'&&f.y>.35){next.x=THREE.MathUtils.clamp(next.x,-SURFACE_BOUND,SURFACE_BOUND);next.z=THREE.MathUtils.clamp(next.z,-SURFACE_BOUND,SURFACE_BOUND);}else{next.x=THREE.MathUtils.clamp(next.x,-SURFACE_BOUND,SURFACE_BOUND);next.z=THREE.MathUtils.clamp(next.z,-SURFACE_BOUND,SURFACE_BOUND);f.heading+=Math.PI*.72+(random()-.5)*.25;f.blocked+=dt*2;} }
    next.y=THREE.MathUtils.clamp(next.y,f.landingSurface?.60:GROUND_Y,MAX_ALTITUDE);
    let collided=false,collidedFruit=null;
    if(f.mode!=='ground'){const r=resolveFruitCollisions(prev,next,state.fruits,{margin:FLY_RADIUS,groundMode:false});if(r.collided){next=r.point;collided=true;collidedFruit=r.contact;f.blocked+=dt*3.8;f.vy+=r.normal.y*.32;f.heading+=(random()-.5)*.35;}}
    if(collided&&!state.lastCollision){state.collisions++;state.motor.flightSkill=Math.max(.05,state.motor.flightSkill-.004);}state.lastCollision=collided;state.currentContact=collidedFruit;if(!collided)f.blocked=Math.max(0,f.blocked-dt*1.4);
    if(f.mode==='landing'&&next.y<=GROUND_Y+.015){next.y=GROUND_Y;f.surface='floor';setMode('ground');}if(f.mode!=='ground'&&next.y<=GROUND_Y&&f.vy<0){next.y=GROUND_Y;f.surface='floor';setMode('ground');}if(f.mode==='takeoff'&&next.y<GROUND_Y)next.y=GROUND_Y;
    const d=Math.hypot(next.x-f.x,next.y-f.y,next.z-f.z);state.distance+=d;f.x=next.x;f.y=next.y;f.z=next.z;
  }

  if(f.mode!=='ground'){
    updateTripodGait(state.gait,dt,{grounded:false,feeding:state.metabolism.feeding,speed:f.speed,desiredSpeed,turn:sig.turn});
    motorLearner.update(dt,{desiredSpeed,actualSpeed:f.speed,desiredTurn:turnRate,actualTurn:turnRate,slip:0,support:0,cadence:state.gait.cadence,amplitude:state.gait.amplitude},{eligible:false,contextKey:f.mode==='ground'?'inactive':'air'});
    state.lastAdaptiveMotion=null;
  }

  resolveBodyContact(dt);

  // Surface contact detection and feeding.
  const wasFeeding=state.metabolism.feeding;
  let contact=state.currentContact,best=Infinity;
  if(f.mode==='ground'&&f.surface==='floor'&&!contact){for(const fruit of state.fruits){const d=fruitSurfaceDistance({x:f.x,y:f.y,z:f.z},fruit,FLY_RADIUS+.025);if(d<.06&&d<best){best=d;contact=fruit;}}}
  state.currentContact=contact;
  if(contact&&state.t-state.lastContactAt>1.15){state.lastContactAt=state.t;state.contacts++;if(state.firstFruitTime===null)state.firstFruitTime=state.t;const at=state.sensedMixture;brain.learn(at,contact.reward);if(contact.reward>0)state.motor.flightSkill=Math.min(1,state.motor.flightSkill+.012*contact.reward);}
  if(contact&&f.mode==='ground'&&f.surface==='floor')startFeeding(contact); else if(state.metabolism.feeding&&state.metabolism.fruit!==contact)stopFeeding();

  if(wasFeeding!==state.metabolism.feeding)resolveBodyContact(0);
  if(state.t-state.lastTrailAt>.055){addTrailPoint();state.lastTrailAt=state.t;}
  const edibleContact=!!(contact&&contact.reward>0&&contact.amount>0);
  const onWall=f.mode==='ground'&&f.surface!=='floor';
  const wallFrame=onWall?surfaceFrame(f.surface,f.heading):null;
  const wallHeight=onWall?THREE.MathUtils.clamp((f.y-GROUND_Y)/(MAX_ALTITUDE+.45-GROUND_Y),0,1):0;
  const wallClimbRate=onWall?(f.speed*(wallFrame?.forward.y||0)):0;
  if(isMaleMode())maleCNS.setInput({tick:state.ticks,t:state.t,left:L.mixture,right:R.mixture,feeding:state.metabolism.feeding,foodContact:edibleContact,mode:f.mode,surface:f.surface,speed:f.speed,energy:state.metabolism.energy,hunger:state.metabolism.hunger,blocked:f.blocked>.3&&!edibleContact,wallAge:onWall?f.modeTime:0,wallHeight,wallClimbRate,fruitOdor:odorTrace.filtered,fruitOdorTrend:odorTrace.trend});
  const vals=activity.update(dt,{t:state.t,odorLeft:L.total,odorRight:R.total,kcActive:b.telemetry.kcActive,kcCount:brain.kcCount,memoryValue:b.telemetry.memoryValue,dopamine:b.telemetry.dopamine,turn:b.turn,speed:f.speed,mode:f.mode,surface:f.surface,feeding:state.metabolism.feeding,contact:!!contact,energy:state.metabolism.energy,hunger:state.metabolism.hunger});
  if(state.ticks%10===0){session.samples.push({t:state.t,fly:{...f},energy:state.metabolism.energy,hunger:state.metabolism.hunger,sensors:{left:L.mixture,right:R.mixture},channels:{...vals},proxyActivity:{source:'proxy',units:'normalized-index',values:{...vals}},neuralActivity:usingMaleCNS()?{source:'LIF',units:'Hz',pacing:maleCNS.pacing,coalescedTicks:maleCNS.coalesced,sensorAgeSeconds:Math.max(0,state.t-(maleCNS.latest.bodyTime||0)),epoch:maleCNS.latest.epoch,tick:maleCNS.latest.tick,bodyTime:maleCNS.latest.bodyTime,neuralMs:maleCNS.latest.t,hz:{...maleCNS.latest.hz},normalized:{...maleCNS.latest.norm},populationSizes:{...maleCNS.latest.groupSizes}}:null,controllerApplied:sig.source,action:activity.action,brainMode:ui.brainMode.value,maleMotor:usingMaleCNS()?{...(maleCNS.latest.motor||{})}:null,gait:{phase:state.gait.phase,cadence:state.gait.cadence,amplitude:state.gait.amplitude,turn:state.gait.turn,pivot:state.gait.pivot},adaptiveMotor:motorLearner.status(),motivation:{fruitOdor:odorTrace.filtered,fruitOdorTrend:odorTrace.trend,wallSearchMotivation:maleCNS.latest?.motor?.wallSearchMotivation||0}});}
  state.latest={telemetry:b.telemetry,left:L.total,right:R.total,vals};
}

function addTrailPoint(){ if(trailCount>=trailMax){trailPositions.copyWithin(0,3);trailCount=trailMax-1;} const i=trailCount*3;trailPositions[i]=state.fly.x;trailPositions[i+1]=state.fly.y;trailPositions[i+2]=state.fly.z;trailCount++;trailGeo.attributes.position.needsUpdate=true;trailGeo.setDrawRange(0,trailCount); }
function modeLabel(mode){ if(state.fly.groom?.active)return 'Acicalamiento'; if(mode==='ground'&&state.fly.surface!=='floor')return 'Trepando'; return ({ground:'Tierra',takeoff:'Despegue',flight:'Vuelo',landing:'Aterrizaje'})[mode]||mode; }
const TRACE_COLORS={AL:'#557f9b',MB:'#8b6cab',CX:'#728f54',SEZ:'#b8844d',DN:'#a86161',VNC:'#526f78'};
function drawNeuralTrace(){
  if(!state.inspector||!neuralTraceCtx)return;
  const c=ui.neuralTraceCanvas,w=c.width,h=c.height,ctx=neuralTraceCtx;
  ctx.clearRect(0,0,w,h); ctx.fillStyle='rgba(248,250,251,.96)'; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(80,96,110,.10)'; ctx.lineWidth=1;
  for(let i=1;i<4;i++){const y=(h-18)*i/4+12;ctx.beginPath();ctx.moveTo(8,y);ctx.lineTo(w-8,y);ctx.stroke();}
  const male=usingMaleCNS(); const hist=(male?maleCNS.history:activity.history).slice(-150); if(hist.length<2)return;
  const plotTop=18,plotBottom=h-8,plotH=plotBottom-plotTop;
  CONNECTOME_REGIONS.forEach((r,ri)=>{
    ctx.strokeStyle=TRACE_COLORS[r.key]||'#667';ctx.lineWidth=ri<2?1.8:1.25;ctx.beginPath();
    hist.forEach((s,i)=>{const x=8+i/(hist.length-1)*(w-16),vv=male?(s.norm?.[r.key]||0):(s[r.key]||0),y=plotBottom-vv*plotH;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();
  });
  ctx.font='8px system-ui'; let x=8;
  CONNECTOME_REGIONS.forEach(r=>{ctx.fillStyle=TRACE_COLORS[r.key]||'#667';ctx.fillText(r.key,x,10);x+=26;});
}
function updateInspectorUI(vals){
  if(!state.inspector)return;
  ui.niAction.textContent=activity.action;ui.niDominant.textContent=displayedDominant(vals);ui.niMode.textContent=modeLabel(state.fly.mode).toUpperCase();ui.niSurface.textContent=SURFACES[state.fly.surface]?.label||'aire';
  for(const r of CONNECTOME_REGIONS){const v=vals[r.key]||0,p=Math.round(v*100);niRows[r.key].bar.style.width=`${p}%`;niRows[r.key].value.textContent=`${p}%`;const node=niNodes[r.key];if(node){node.style.fill=`rgba(${165+Math.round(70*v)},${178+Math.round(35*v)},${185-Math.round(55*v)},${.42+.58*v})`;node.style.filter=`drop-shadow(0 0 ${2+8*v}px rgba(183,137,54,${.12+.5*v}))`;node.style.transform=`scale(${1+.10*v})`;}}
  drawNeuralTrace();
}

function resizeCompoundVisionCanvas(){
  const wrap=ui.viewport.parentElement;
  if(!wrap) return;
  const dpr=Math.min(window.devicePixelRatio||1,1.5);
  compoundVisionSize={w:Math.max(480,Math.round(wrap.clientWidth*dpr)),h:Math.max(270,Math.round(wrap.clientHeight*dpr))};
  ui.compoundVisionCanvas.width=compoundVisionSize.w; ui.compoundVisionCanvas.height=compoundVisionSize.h;
}
function getFlyEyePose(){
  flyPovAnchor.updateWorldMatrix(true,false);
  flyPovAnchor.getWorldPosition(compoundTmp.pos); flyPovAnchor.getWorldQuaternion(compoundTmp.quat);
  compoundTmp.forward.set(0,0,1).applyQuaternion(compoundTmp.quat).normalize();
  compoundTmp.up.set(0,1,0).applyQuaternion(compoundTmp.quat).normalize();
  compoundTmp.right.set(1,0,0).applyQuaternion(compoundTmp.quat).normalize();
  return compoundTmp;
}
function updateFlyVisionButtons(){
  const ocular=state.flyVisionMode==='ocular';
  ui.ocularModeBtn.classList.toggle('active',ocular); ui.ocularModeBtn.setAttribute('aria-pressed',String(ocular));
  ui.compoundModeBtn.classList.toggle('active',!ocular); ui.compoundModeBtn.setAttribute('aria-pressed',String(!ocular));
  if(state.flyVisionMode==='compound'){
    ui.flyPovCaption.textContent='Ojos compuestos simplificados · dos campos visuales · baja resolución omatidial';
  }else{
    ui.flyPovCaption.textContent='POV ocular · desde la cabeza, orientado al avance o retroceso';
  }
  ui.compoundVisionCanvas.hidden=!(state.flyView&&state.flyVisionMode==='compound');
  document.querySelector('.viewport-wrap').classList.toggle('compound-active',state.flyView&&state.flyVisionMode==='compound');
}
function setFlyVisionMode(mode){
  state.flyVisionMode=(mode==='ocular'?'ocular':'compound');
  lastCompoundRenderAt=-1;
  updateFlyVisionButtons();
  if(state.flyView){
    camera.near=state.flyVisionMode==='compound'?.02:.03;
    camera.updateProjectionMatrix();
  }
}
function configureEyeCamera(cam,pos,up,forward){
  cam.position.copy(pos); cam.up.copy(up); cam.lookAt(pos.clone().addScaledVector(forward,3)); cam.updateMatrixWorld();
}
function sampleCompound(buf,u,v){
  const x=Math.max(0,Math.min(COMPOUND_RES.w-1,Math.round(u*(COMPOUND_RES.w-1))));
  const y=Math.max(0,Math.min(COMPOUND_RES.h-1,Math.round((1-v)*(COMPOUND_RES.h-1))));
  const i=(y*COMPOUND_RES.w+x)*4; return [buf[i],buf[i+1],buf[i+2]];
}
function hexPath(ctx,cx,cy,r){
  ctx.beginPath();
  for(let k=0;k<6;k++){
    const a=Math.PI/6 + k*Math.PI/3, x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r;
    if(k===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
}
function drawCompoundEye(ctx,buf,cx,cy,rx,ry){
  const cols=COMPOUND_LAYOUT.cols, rows=COMPOUND_LAYOUT.rows;
  const stepX=(rx*2)/(cols+.5), stepY=(ry*2)/(rows+1), r=Math.min(stepX,stepY)*.56;
  for(let row=0;row<rows;row++){
    for(let col=0;col<cols;col++){
      const x=cx-rx + stepX*(col+.6) + (row%2)*stepX*.5;
      const y=cy-ry + stepY*(row+1);
      const dx=(x-cx)/rx, dy=(y-cy)/ry;
      if(dx*dx+dy*dy>1) continue;
      const u=(dx+1)*.5, v=(dy+1)*.5;
      const [R,G,B]=sampleCompound(buf,u,v);
      ctx.fillStyle=`rgb(${R},${G},${B})`;
      ctx.strokeStyle='rgba(10,14,16,.28)'; ctx.lineWidth=Math.max(1,r*.11);
      hexPath(ctx,x,y,r); ctx.fill(); ctx.stroke();
    }
  }
}
function renderCompoundVision(now){
  if(now-lastCompoundRenderAt<50 && !ui.compoundVisionCanvas.hidden) return;
  lastCompoundRenderAt=now;
  const pose=getFlyEyePose(), yaw=COMPOUND_LAYOUT.yaw, sep=COMPOUND_LAYOUT.eyeSeparation;
  compoundTmp.leftPos.copy(pose.pos).addScaledVector(pose.right,-sep);
  compoundTmp.rightPos.copy(pose.pos).addScaledVector(pose.right,sep);
  compoundTmp.leftForward.copy(pose.forward).applyAxisAngle(pose.up,yaw).normalize();
  compoundTmp.rightForward.copy(pose.forward).applyAxisAngle(pose.up,-yaw).normalize();
  configureEyeCamera(compoundLeftCamera,compoundTmp.leftPos,pose.up,compoundTmp.leftForward);
  configureEyeCamera(compoundRightCamera,compoundTmp.rightPos,pose.up,compoundTmp.rightForward);
  const visible=flyMesh.visible; flyMesh.visible=false;
  renderer.setRenderTarget(compoundLeftRT); renderer.clear(); renderer.render(scene,compoundLeftCamera); renderer.readRenderTargetPixels(compoundLeftRT,0,0,COMPOUND_RES.w,COMPOUND_RES.h,compoundLeftPixels);
  renderer.setRenderTarget(compoundRightRT); renderer.clear(); renderer.render(scene,compoundRightCamera); renderer.readRenderTargetPixels(compoundRightRT,0,0,COMPOUND_RES.w,COMPOUND_RES.h,compoundRightPixels);
  renderer.setRenderTarget(null); flyMesh.visible=visible;
  const ctx=compoundVisionCtx, W=ui.compoundVisionCanvas.width, H=ui.compoundVisionCanvas.height;
  ctx.clearRect(0,0,W,H);
  const bg=ctx.createRadialGradient(W*.5,H*.45,Math.min(W,H)*.06,W*.5,H*.5,Math.max(W,H)*.72);
  bg.addColorStop(0,'rgb(25,34,40)'); bg.addColorStop(.65,'rgb(7,10,12)'); bg.addColorStop(1,'rgb(2,3,4)');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  const rx=W*.235, ry=H*.33, leftCx=W*.39, rightCx=W*.61, cy=H*.5;
  ctx.save();
  ctx.fillStyle='rgba(240,248,252,.015)'; ctx.beginPath(); ctx.ellipse(leftCx,cy,rx*1.02,ry*1.02,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(rightCx,cy,rx*1.02,ry*1.02,0,0,Math.PI*2); ctx.fill();
  drawCompoundEye(ctx,compoundLeftPixels,leftCx,cy,rx,ry);
  drawCompoundEye(ctx,compoundRightPixels,rightCx,cy,rx,ry);
  ctx.globalCompositeOperation='destination-in';
  ctx.beginPath(); ctx.ellipse(leftCx,cy,rx*1.03,ry*1.03,0,0,Math.PI*2); ctx.ellipse(rightCx,cy,rx*1.03,ry*1.03,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.lineWidth=Math.max(2,W*.0022);
  ctx.beginPath(); ctx.ellipse(leftCx,cy,rx*1.02,ry*1.02,0,0,Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(rightCx,cy,rx*1.02,ry*1.02,0,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.08)'; ctx.fillRect(W*.495,H*.14,W*.01,H*.72);
  ctx.fillStyle='rgba(255,255,255,.52)'; ctx.font=`${Math.round(Math.max(12,W*.012))}px system-ui`; ctx.textAlign='center';
  ctx.fillText('VISIÓN COMPUESTA APROXIMADA',W*.5,H*.93);
}
function setNeuralInspector(on){
  if(on&&state.flyView)setFlyView(false,{restore:false});
  state.inspector=!!on;ui.neuralInspector.hidden=!state.inspector;ui.neuralInspectorBtn.classList.toggle('inspector-live',state.inspector);ui.neuralInspectorBtn.setAttribute('aria-pressed',String(state.inspector));document.querySelector('.viewport-wrap').classList.toggle('neural-following',state.inspector);
  if(state.inspector){ui.activityToggle.checked=true; const t=flyMesh.position.clone(); controls.target.copy(t); camera.position.copy(t.clone().add(new THREE.Vector3(1.65,1.15,2.1)));controls.minDistance=.72;controls.maxDistance=10;controls.update();}
  else{controls.minDistance=2.15;controls.maxDistance=36;}
}
function updateInspectorCamera(){
  if(!state.inspector)return; const target=flyMesh.position.clone(); const delta=target.clone().sub(controls.target).multiplyScalar(.14); controls.target.add(delta);camera.position.add(delta);
}
function setFlyView(on,{restore=true}={}){
  const next=!!on;
  if(next===state.flyView)return;
  if(next){
    if(state.inspector)setNeuralInspector(false);
    flyViewReturn={position:camera.position.clone(),target:controls.target.clone(),up:camera.up.clone(),fov:camera.fov,near:camera.near};
    state.flyView=true;
    controls.enabled=false;
    camera.fov=state.flyVisionMode==='compound'?150:115; camera.near=state.flyVisionMode==='compound'?.02:.03; camera.updateProjectionMatrix();
    ui.flyViewBtn.classList.add('inspector-live'); ui.flyViewBtn.setAttribute('aria-pressed','true');
    ui.flyViewBtn.title='Salir de la vista de la mosca';
    ui.flyPovBadge.hidden=false;
    document.querySelector('.viewport-wrap').classList.add('fly-pov-active');
    updateFlyVisionButtons();
    updateFlyViewCamera(true);
  }else{
    state.flyView=false;
    controls.enabled=true;
    ui.flyViewBtn.classList.remove('inspector-live'); ui.flyViewBtn.setAttribute('aria-pressed','false');
    ui.flyViewBtn.title='Ver desde la cabeza de la mosca';
    ui.flyPovBadge.hidden=true;
    ui.compoundVisionCanvas.hidden=true;
    document.querySelector('.viewport-wrap').classList.remove('fly-pov-active','compound-active');
    if(restore&&flyViewReturn){
      camera.position.copy(flyViewReturn.position); controls.target.copy(flyViewReturn.target); camera.up.copy(flyViewReturn.up); camera.fov=flyViewReturn.fov; camera.near=flyViewReturn.near; camera.updateProjectionMatrix(); controls.update();
    }else{
      camera.fov=48; camera.near=.05; camera.updateProjectionMatrix();
    }
    flyViewReturn=null;
  }
}
function updateFlyViewCamera(force=false){
  if(!state.flyView)return;
  const pose=getFlyEyePose();
  const direction=pose.forward.clone();
  if(state.flyVisionMode==='ocular'&&state.fly.speed<-.025)direction.negate();
  controls.target.copy(pose.pos).addScaledVector(direction,3);
  camera.position.copy(pose.pos);
  camera.up.copy(pose.up);
  camera.fov=state.flyVisionMode==='compound'?150:115;
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
}
function updateActivityUI(vals){
  updateInspectorUI(vals);
  if(!ui.activityToggle.checked)return; ui.actionValue.textContent=activity.action;ui.dominantRegion.textContent=displayedDominant(vals);
  for(const r of CONNECTOME_REGIONS){const v=vals[r.key]||0,p=Math.round(v*100);regionRows[r.key].bar.style.width=`${p}%`;regionRows[r.key].value.textContent=`${p}%`;const node=regionNodes[r.key];if(node){node.style.fill=`rgba(${110+Math.round(145*v)},${150+Math.round(72*v)},${120-Math.round(45*v)},${.28+.72*v})`;node.style.filter=`drop-shadow(0 0 ${2+8*v}px rgba(255,200,87,${.15+.65*v}))`;}}
}

function updateAdaptiveUI(){
  if(!ui.adaptiveStatusValue)return;
  const st=motorLearner.status(), control=usingMaleControl(), enabled=ui.adaptiveToggle.checked;
  let label='esperando MaleCNS';
  if(!enabled)label='desactivado';
  else if(control&&st.training)label=`aprendiendo ${st.phase==='plus'?'+':'−'}`;
  else if(control)label=state.metabolism.feeding?'pausa · alimentación':'política aprendida';
  ui.adaptiveStatusValue.textContent=label;
  ui.adaptiveGenerationValue.textContent=String(st.generation);
  ui.adaptiveRewardValue.textContent=Number.isFinite(st.meanReward)?st.meanReward.toFixed(3):'0.000';
  const slip=st.metrics?.slip; ui.adaptiveSlipValue.textContent=Number.isFinite(slip)?slip.toFixed(3):'—';
  const p=st.params;
  ui.adaptiveParamsValue.textContent=`cad ${p.cadenceScale.toFixed(2)} · amp ${p.amplitudeScale.toFixed(2)} · duty ${p.dutyOffset>=0?'+':''}${p.dutyOffset.toFixed(3)} · φ ${p.tripodPhaseDelta>=0?'+':''}${p.tripodPhaseDelta.toFixed(2)} · giro ${p.turnGain.toFixed(2)}`;
}

function updateTelemetry(t,Lraw,Rraw,vals){
  const l=Math.min(1,Lraw/2.4),r=Math.min(1,Rraw/2.4),g=Math.max(-1,Math.min(1,(Lraw-Rraw)/1.4));
  ui.leftOdorBar.style.width=`${l*100}%`;ui.rightOdorBar.style.width=`${r*100}%`;ui.leftOdorValue.textContent=Lraw.toFixed(2);ui.rightOdorValue.textContent=Rraw.toFixed(2);ui.gradientValue.textContent=(Lraw-Rraw>=0?'+':'')+(Lraw-Rraw).toFixed(2);ui.gradientBar.style.left=g<0?`${50+g*50}%`:'50%';ui.gradientBar.style.width=`${Math.abs(g)*50}%`;
  ui.ornValue.textContent=`${t.ornHz.toFixed(1)} Hz`;ui.kcValue.textContent=`${t.kcActive} / ${brain.kcCount}`;ui.memoryValue.textContent=`${t.memoryValue>=0?'+':''}${t.memoryValue.toFixed(2)}`;ui.dopamineValue.textContent=t.dopamine.toFixed(2);ui.turnValue.textContent=`${t.turn>=0?'+':''}${t.turn.toFixed(2)}`;
  ui.clockValue.textContent=`${state.t.toFixed(1)} s`;ui.contactValue.textContent=state.contacts;ui.collisionValue.textContent=state.collisions;ui.rewardValue.textContent=state.reward.toFixed(2);ui.distanceValue.textContent=state.distance.toFixed(1);ui.airTimeValue.textContent=`${state.airTime.toFixed(1)} s`;ui.wallTimeValue.textContent=`${state.wallTime.toFixed(1)} s`;ui.firstFruitValue.textContent=state.firstFruitTime===null?'—':`${state.firstFruitTime.toFixed(1)} s`;
  const m=modeLabel(state.fly.mode);ui.modeValue.textContent=m;ui.modeHud.textContent=m.toUpperCase();ui.altitudeValue.textContent=state.fly.y.toFixed(2);ui.altitudeHud.textContent=`${state.fly.y.toFixed(2)} m`;ui.surfaceHud.textContent=SURFACES[state.fly.surface]?.label||'aire';ui.speedValue.textContent=state.fly.speed.toFixed(2);if(ui.gaitValue){const active=state.gait.amplitude>.04,adaptive=adaptiveEnabled();ui.gaitValue.textContent=active?`${adaptive?'Adaptativa':'Trípode'} · ${state.gait.cadence.toFixed(1)} Hz${state.gait.pivot?' · pivote':''}`:`${adaptive?'Adaptativa':'Trípode'} · reposo`;}const pct=Math.round(state.motor.flightSkill*100);ui.flightSkillValue.textContent=`${pct}%`;ui.flightSkillBar.style.width=`${pct}%`;
  const e=Math.round(state.metabolism.energy*100),h=Math.round(state.metabolism.hunger*100);ui.energyValue.textContent=`${e}%`;ui.hungerValue.textContent=`${h}%`;ui.energyBar.style.width=`${e}%`;ui.hungerBar.style.width=`${h}%`;ui.feedingValue.textContent=state.metabolism.feeding?'Alimentándose':(state.fly.surface!=='floor'&&state.fly.mode==='ground'?'Trepando':'Explorando');ui.intakeValue.textContent=state.metabolism.intake.toFixed(2);
  updateActivityUI(vals);updateAdaptiveUI();
}
function setRunning(v){state.running=v;ui.runBtn.innerHTML=`<span class="tool-ico">${v?'⏸':'▶'}</span>`;ui.runBtn.title=v?'Pausar':'Continuar';ui.runBtn.setAttribute('aria-label',ui.runBtn.title);ui.statusText.textContent=v?'Simulación activa':'Simulación pausada';ui.statusDot.classList.toggle('live',v);if(isMaleMode()&&maleCNS.ready)maleCNS.setRunning(v);}

function pointerNdc(e){const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);}
function fruitFromObject(obj){let o=obj;while(o&&o!==scene){if(o.userData?.fruit)return o.userData.fruit;o=o.parent;}return null;}
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(state.flyView)return;pointerNdc(e);if(!state.placing&&raycaster.intersectObject(flyMesh,true).length){setNeuralInspector(!state.inspector);return;}const hits=raycaster.intersectObjects(state.fruits.flatMap(f=>{const p=[];f.mesh.traverse(o=>{if(o.userData.pickProxy)p.push(o);});return p;}),false);if(hits.length){const f=fruitFromObject(hits[0].object);selectFruit(f);state.dragging=true;controls.enabled=false;renderer.domElement.setPointerCapture?.(e.pointerId);return;}if(state.placing){const hit=raycaster.ray.intersectPlane(groundPlane,dragPoint);if(hit){if(!addFruit(ui.fruitType.value,dragPoint.x,dragPoint.z))return;state.placing=false;ui.placementHint.hidden=true;ui.addFruitBtn.innerHTML='<span class="tool-ico">＋🍎</span>';ui.addFruitBtn.title='Añadir fruta';ui.addFruitBtn.setAttribute('aria-label','Añadir fruta');}}else selectFruit(null);});
renderer.domElement.addEventListener('pointermove',e=>{if(!state.dragging||!state.selected)return;pointerNdc(e);if(raycaster.ray.intersectPlane(groundPlane,dragPoint))moveSelected(dragPoint.x,dragPoint.z);});
function endDrag(){state.dragging=false;controls.enabled=true;} renderer.domElement.addEventListener('pointerup',endDrag);renderer.domElement.addEventListener('pointercancel',endDrag);

const workspace=document.querySelector('.workspace');
const appShell=document.querySelector('.app-shell');
const sectionStorageKey='flylab:v09:sections';
const panelStorageKey='flylab:v09:panel';

function safeGet(key){try{return localStorage.getItem(key);}catch{return null;}}
function safeSet(key,value){try{localStorage.setItem(key,value);}catch{}}
function setPanelOpen(open,{persist=true}={}){
  workspace.classList.toggle('panel-open',open);
  ui.panelToggleBtn.classList.toggle('active',open);
  ui.panelToggleBtn.setAttribute('aria-expanded',String(open));
  ui.panelToggleBtn.title=open?'Ocultar instrumentación':'Mostrar instrumentación';
  if(persist)safeSet(panelStorageKey,open?'1':'0');
}
ui.panelToggleBtn.addEventListener('click',()=>setPanelOpen(!workspace.classList.contains('panel-open')));
ui.panelCloseBtn.addEventListener('click',()=>setPanelOpen(false));
// Full terrarium on first visit; afterwards respect the user's last drawer choice.
setPanelOpen(safeGet(panelStorageKey)==='1',{persist:false});

function saveSectionState(){
  const state={};
  document.querySelectorAll('.panel-section[data-section-key]').forEach(sec=>state[sec.dataset.sectionKey]=!sec.classList.contains('collapsed'));
  safeSet(sectionStorageKey,JSON.stringify(state));
}
let storedSections={};
try{storedSections=JSON.parse(safeGet(sectionStorageKey)||'{}')||{};}catch{}
document.querySelectorAll('.panel-section[data-collapsible="true"]').forEach(sec=>{
  const key=sec.dataset.sectionKey;
  if(Object.prototype.hasOwnProperty.call(storedSections,key))sec.classList.toggle('collapsed',!storedSections[key]);
  const btn=sec.querySelector('.section-toggle');
  const sync=()=>btn?.setAttribute('aria-expanded',String(!sec.classList.contains('collapsed')));
  sync();
  const toggle=()=>{sec.classList.toggle('collapsed');sync();saveSectionState();};
  btn?.addEventListener('click',e=>{e.stopPropagation();toggle();});
  const head=sec.querySelector('.section-head');
  head?.addEventListener('click',e=>{if(e.target.closest('button,input,select,a'))return;toggle();});
});

function resetCamera(){
  if(state.flyView)setFlyView(false,{restore:false});
  if(state.inspector)setNeuralInspector(false);
  camera.position.copy(CAMERA_HOME);
  controls.target.copy(CAMERA_TARGET_HOME);
  camera.up.set(0,1,0);
  controls.update();
}
ui.resetCameraBtn.addEventListener('click',resetCamera);
ui.neuralInspectorBtn.addEventListener('click',()=>setNeuralInspector(!state.inspector));
document.getElementById('groomBtn').addEventListener('click',()=>{updateGrooming(state.fly,0,{request:true,feeding:state.metabolism.feeding,support:state.fly.support?.feet||0});});
ui.flyViewBtn.addEventListener('click',()=>setFlyView(!state.flyView));
ui.ocularModeBtn.addEventListener('click',()=>setFlyVisionMode('ocular'));
ui.compoundModeBtn.addEventListener('click',()=>setFlyVisionMode('compound'));
ui.niCloseBtn.addEventListener('click',()=>setNeuralInspector(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.flyView)setFlyView(false);});

function syncFocusButton(){
  const on=appShell.classList.contains('focus-mode');
  ui.focusBtn.classList.toggle('active',on);
  ui.focusBtn.title=on?'Salir de pantalla completa':'Modo observación / pantalla completa';
  const label=ui.focusBtn.querySelector('.action-label'); if(label)label.textContent=on?'Salir':'Pantalla';
}
async function toggleFocus(){
  const turningOn=!appShell.classList.contains('focus-mode');
  if(turningOn){
    appShell.classList.add('focus-mode'); syncFocusButton();
    try{if(!document.fullscreenElement&&appShell.requestFullscreen)await appShell.requestFullscreen();}catch{/* focus mode still works without Fullscreen API */}
  }else{
    if(document.fullscreenElement){try{await document.exitFullscreen();}catch{}}
    appShell.classList.remove('focus-mode'); syncFocusButton();
  }
}
ui.focusBtn.addEventListener('click',toggleFocus);
document.addEventListener('fullscreenchange',()=>{
  if(!document.fullscreenElement&&appShell.classList.contains('focus-mode'))appShell.classList.remove('focus-mode');
  syncFocusButton();
});
syncFocusButton();

const maleBase=new URLSearchParams(location.search).get('malecnsBase')||undefined;
function setBrainMode(mode){
  const normalized=mode==='malecns'||mode==='observe'?'malecns-observe':mode==='control'?'malecns-control':mode;
  const male=normalized==='malecns-observe'||normalized==='malecns-control';
  logEvent('brain-mode',{mode:male?normalized:'proxy'});
  ui.brainMode.value=male?normalized:'proxy';
  ui.malecnsCard.hidden=!male;
  workspace.classList.toggle('malecns-live',male&&maleCNS.ready);
  workspace.classList.toggle('malecns-control',normalized==='malecns-control'&&maleCNS.ready);
  if(!male){maleCNS.reset();maleCNS.setRunning(false);setMaleStatus('', 'Proxy');ui.activitySource.textContent='proxy funcional';return;}
  const control=normalized==='malecns-control';
  if(maleCNS.ready){maleCNS.setMode(control?'control':'observe');maleCNS.setRunning(state.running);setMaleStatus('live',`${control?'MaleCNS Control':'MaleCNS Observe'} · ${maleCNS.info.N.toLocaleString()} neuronas`);ui.activitySource.textContent=control?'MaleCNS Control · spikes + DN':'MaleCNS Observe · spikes reales';return;}
  setMaleStatus('loading',control?'Cargando MaleCNS para control…':'Cargando MaleCNS…');ui.activitySource.textContent='MaleCNS · cargando';
  maleCNS.load({baseUrl:maleBase,seed});
}
ui.neuralPacing.value=maleCNS.pacing;
ui.neuralPacing.addEventListener('change',()=>{maleCNS.setPacing(ui.neuralPacing.value);stepper.clear();logEvent('neural-pacing',{pacing:maleCNS.pacing});ui.maleMotorModeValue.textContent='calibrando · control proxy';});
ui.brainMode.addEventListener('change',()=>setBrainMode(ui.brainMode.value));
const brainQuery=new URLSearchParams(location.search).get('brain');
setBrainMode(brainQuery==='control'?'malecns-control':brainQuery==='malecns'||brainQuery==='observe'?'malecns-observe':'proxy');

ui.runBtn.addEventListener('click',()=>setRunning(!state.running));
ui.flightBtn.addEventListener('click',()=>{state.fly.command=state.fly.mode==='ground'?'takeoff':'land';logEvent('flight-command',{command:state.fly.command});});
ui.resetFlyBtn.addEventListener('click',()=>resetFly(true));
ui.clearMemoryBtn.addEventListener('click',()=>{logEvent('clear-memory');brain.clearMemory();state.motor.flightSkill=.12;state.motor.stableAir=0;state.motor.safeLandings=0;ui.memoryValue.textContent='+0.00';ui.dopamineValue.textContent='0.00';});
ui.adaptiveToggle.addEventListener('change',()=>{motorLearner.setEnabled(ui.adaptiveToggle.checked);logEvent('adaptive-motor-toggle',{enabled:ui.adaptiveToggle.checked});updateAdaptiveUI();});
ui.adaptiveResetBtn.addEventListener('click',()=>{motorLearner.reset();resetTripodGait(state.gait);logEvent('adaptive-motor-reset');updateAdaptiveUI();});
ui.addFruitBtn.addEventListener('click',()=>{state.placing=!state.placing;ui.placementHint.hidden=!state.placing;ui.addFruitBtn.innerHTML=`<span class="tool-ico">${state.placing?'✕':'＋🍎'}</span>`;ui.addFruitBtn.title=state.placing?'Cancelar colocación':'Añadir fruta';ui.addFruitBtn.setAttribute('aria-label',ui.addFruitBtn.title);});
ui.clearFruitsBtn.addEventListener('click',()=>{[...state.fruits].forEach(deleteFruit);});ui.deleteFruitBtn.addEventListener('click',()=>deleteFruit(state.selected));
ui.odorFieldToggle.addEventListener('change',()=>state.fruits.forEach(f=>f.rings.visible=ui.odorFieldToggle.checked));ui.trailToggle.addEventListener('change',()=>trail.visible=ui.trailToggle.checked);
ui.odorStrength.addEventListener('input',()=>{if(!state.selected)return;state.selected.strength=Number(ui.odorStrength.value);logEvent('odor-strength',{id:state.selected.id,value:state.selected.strength});ui.odorStrengthOut.value=state.selected.strength.toFixed(2);});
ui.fruitReward.addEventListener('input',()=>{if(!state.selected)return;state.selected.reward=Number(ui.fruitReward.value);if(state.selected.reward<=0&&state.metabolism.fruit===state.selected)stopFeeding();logEvent('reward',{id:state.selected.id,value:state.selected.reward});ui.rewardOut.value=(state.selected.reward>=0?'+':'')+state.selected.reward.toFixed(2);});
ui.foodAmount.addEventListener('input',()=>{if(!state.selected)return;state.selected.amount=Math.max(0,Number(ui.foodAmount.value));logEvent('food',{id:state.selected.id,value:state.selected.amount});ui.foodAmountOut.value=`${Math.round(state.selected.amount*100)}%`; if(state.selected.amount<=0) deleteFruit(state.selected); else syncFruitVisual(state.selected);});
for(const[el,k]of[[ui.fruitX,'x'],[ui.fruitZ,'z']])el.addEventListener('change',()=>{if(!state.selected)return;const v=Number(el.value);if(Number.isFinite(v))moveSelected(k==='x'?v:state.selected.x,k==='z'?v:state.selected.z);});
ui.exportActivityBtn.addEventListener('click',()=>{const male=usingMaleCNS(),csv=male?maleCNS.toCSV():activity.toCSV();const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`flylab-${male?'malecns':'proxy'}-activity-${new Date().toISOString().replaceAll(':','-')}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});

function resize(){const r=ui.viewport.getBoundingClientRect();if(r.width<2||r.height<2)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();resizeCompoundVisionCanvas();} new ResizeObserver(resize).observe(ui.viewport);resize(); updateFlyVisionButtons();


function refreshFruitList(){const list=document.getElementById('fruitList');if(!list)return;list.replaceChildren(new Option('Seleccionar fruta…',''));for(const f of state.fruits)list.add(new Option(FRUIT_LIBRARY[f.type].label+' #'+f.id,String(f.id)));if(state.selected)list.value=String(state.selected.id);}
document.getElementById('fruitList').addEventListener('change',e=>{selectFruit(state.fruits.find(f=>String(f.id)===e.target.value)||null);setPanelOpen(true);});
document.getElementById('addCenterBtn').addEventListener('click',()=>{const type=ui.fruitType.value;for(let z=-4;z<=4;z+=1.4)for(let x=-4;x<=4;x+=1.4){if(placementAllowed({type,x,z,id:-1},state.fruits)){addFruit(type,x,z);setPanelOpen(true);return;}}notice('No hay espacio libre para otra fruta.');});
document.getElementById('exportSessionBtn').addEventListener('click',()=>download('flylab-session-'+seed+'.json',JSON.stringify({...session,final:scenario(),motorLearning:motorLearner.export(),channelSources:CONNECTOME_REGIONS,channelsKeySource:'proxy',neuralSource:maleCNS.info,neuralProtocol:{pacing:maleCNS.pacing,batchTicks:10,coalescedTicks:maleCNS.coalesced,description:maleCNS.pacing==='interactive'?'Body runs independently; latest confirmed DN command is held; oldest queued sensory ticks are replaced under load. Neural time can lag body time.':'Body waits for each acknowledged batch; all sensory ticks are retained.'},model:'MaleCNS bridge + adaptive CPG/traction model; not a full musculoskeletal reconstruction'},null,2),'application/json'));
document.getElementById('qualitySelect').addEventListener('change',e=>{renderer.setPixelRatio(Math.min(devicePixelRatio,e.target.value==='low'?1:2));renderer.shadowMap.enabled=e.target.value!=='low';resize();});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setRunning(false);notice('Se perdió el contexto gráfico. Exporta tu sesión y recarga la página.');});

// Initial assay.
addFruit('apple',3.15,-2.15);addFruit('banana',-1.8,-3.55);addFruit('orange',2.3,2.6);selectFruit(null);resetFly(false);setRunning(true);ui.statusText.textContent='Simulación activa · suelo + vidrio + vuelo + alimentación visible';ui.statusDot.classList.add('live');

// Warm up materials before starting the experiment clock.
renderer.render(scene,camera);
let last=null,lastUI=0;
document.addEventListener('visibilitychange',()=>{last=null;stepper.clear();if(document.hidden){setRunning(false);notice('Pausado al ocultar la pestaña. Pulsa continuar para reanudar.');}});
function frame(now){
 const seconds=last===null?0:Math.max(0,(now-last)/1000);last=now;
 if(state.running&&!stepper.advance(seconds,simulate)){setRunning(false);notice('Pausado por una interrupción prolongada del navegador.');}
 if(!state.running)stepper.clear();
 updateFlyMesh(state.t);if(now-lastUI>80&&state.latest){const q=state.latest;updateTelemetry(q.telemetry,q.left,q.right,displayedActivity(q.vals));lastUI=now;}
 if(state.flyView)updateFlyViewCamera();else {updateInspectorCamera();controls.update();}
 const selfVisible=flyMesh.visible;
 if(state.flyView && state.flyVisionMode==='compound'){
   flyMesh.visible=false;
   renderCompoundVision(now);
   renderer.setRenderTarget(null);
 }else{
   ui.compoundVisionCanvas.hidden=true;
   if(state.flyView)flyMesh.visible=false;
   renderer.render(scene,camera);
 }
 flyMesh.visible=selfVisible;requestAnimationFrame(frame);
}requestAnimationFrame(frame);


