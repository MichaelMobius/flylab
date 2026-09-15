import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../src/malecns/worker.js', import.meta.url), 'utf8');

test('UI ids are unique and new immersive controls exist', () => {
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate DOM ids found');
  for (const id of ['panelToggleBtn','panelCloseBtn','resetCameraBtn','focusBtn','sidePanel','viewport']) {
    assert.ok(ids.includes(id), `missing #${id}`);
  }
});

test('right mouse controls camera while primary click remains experimental', () => {
  assert.match(js, /controls\.mouseButtons\.LEFT\s*=\s*null/);
  assert.match(js, /controls\.mouseButtons\.RIGHT\s*=\s*THREE\.MOUSE\.ROTATE/);
  assert.match(js, /controls\.enableZoom\s*=\s*true/);
  assert.match(js, /if\(e\.button!==0\)return/);
  assert.match(js, /contextmenu/);
});

test('drawer, collapsible sectors and observation mode are present', () => {
  assert.match(css, /\.workspace\.panel-open \.side-panel/);
  assert.match(css, /\.panel-section\.collapsed/);
  assert.match(css, /\.app-shell\.focus-mode/);
  assert.ok((html.match(/data-collapsible="true"/g) || []).length >= 7);
});


test('empty fruit is removed from the terrarium and icon controls are present', () => {
  assert.match(js, /removeFruitIfEmpty/);
  assert.match(js, /fruit\.amount<=0/);
  assert.match(html, /class="primary tool-btn"/);
  assert.match(html, /class="flight tool-btn"/);
});

test('neural inspector can follow the fly and renders live region history', () => {
  for (const id of ['neuralInspectorBtn','neuralInspector','niCloseBtn','niBars','neuralTraceCanvas']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(js, /function setNeuralInspector\(/);
  assert.match(js, /function updateInspectorCamera\(/);
  assert.match(js, /raycaster\.intersectObject\(flyMesh,true\)/);
  assert.match(js, /maleCNS\.history:activity\.history/);
});

test('procedural fly has six articulated legs, five tarsomeres and two wing rigs', async () => {
  const {createFly}=await import('../src/models.js');
  const fly=createFly();
  assert.equal(fly.userData.legs.length,6);
  assert.ok(fly.userData.legs.every(l=>l.parts.length===9));
  assert.equal(fly.userData.halteres.length,2);
  assert.equal(fly.userData.wings.length,2);
  assert.ok(fly.userData.wings.every(w=>w.mesh.children.length>=7));
  let ocelli=0;fly.traverse(o=>{if(o.name==='ocellus')ocelli++;});assert.equal(ocelli,3);
});


test('fly point-of-view mode supports ocular and compound vision and stays exclusive with neural follow', () => {
  for (const id of ['flyViewBtn','flyPovBadge','flyPovCaption','ocularModeBtn','compoundModeBtn','compoundVisionCanvas']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(js, /function setFlyView\(/);
  assert.match(js, /function updateFlyViewCamera\(/);
  assert.match(js, /function setFlyVisionMode\(/);
  assert.match(js, /renderCompoundVision/);
  assert.match(js, /readRenderTargetPixels/);
  assert.match(js, /camera\.fov=state\.flyVisionMode==='compound'\?150:115/);
  assert.match(js, /camera\.position\.copy\(pose\.pos\)/);
  assert.doesNotMatch(js, /camera\.position\.lerp\(/);
  assert.match(js, /if\(state\.flyView && state\.flyVisionMode==='compound'\)/);
  assert.match(js, /if\(on&&state\.flyView\)setFlyView\(false/);
});


test('MaleCNS Observe/Control bridge is wired to real packed connectome assets', () => {
  for (const id of ['brainMode','maleStatus','malecnsCard','maleNetworkValue','maleSpeedValue','maleAwakeValue','maleTopTypeValue','maleMotorModeValue','maleFwdValue','maleTurnValue','maleTakeoffValue','maleFeedValue','maleWallMotivationValue','maleOdorTrendValue']) assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(js,/new MaleCNSBridge/);
  assert.match(js,/maleCNS\.setInput/);
  const worker=fs.readFileSync(new URL('../src/malecns/worker.js',import.meta.url),'utf8');
  assert.match(worker,/graph\.flyg/);
  assert.match(worker,/neurons\.flyn/);
  assert.match(worker,/bodymap\.json/);
  assert.match(worker,/className\(i\)==='ALPN'/);
  assert.match(worker,/Kenyon_Cell/);
  assert.match(worker,/descending/);
  assert.match(html,/value="malecns-control"/);
  assert.match(worker,/buildMotorGroups/);
  assert.match(worker,/DNMotorReadout/);
  assert.match(worker,/IntrinsicDrive/);
  assert.match(js,/locomotorSignals/);
  assert.match(js,/malecns-takeoff/);
});

test('MaleCNS control does not re-amplify steering and food contact is separated from obstacle blocking',()=>{
  assert.doesNotMatch(js,/\(m\.turn\|\|0\)\s*\/\s*\.6/);
  assert.match(js,/turnMobility/);
  assert.match(js,/foodContact:edibleContact/);
  assert.match(js,/blocked:f\.blocked>\.3&&!edibleContact/);
  assert.match(worker,/input\.foodContact\|\|input\.feeding/);
});

test('adaptive locomotion UI and embodied gait path are present', () => {
  for (const id of ['adaptiveToggle','adaptiveResetBtn','adaptiveStatusValue','adaptiveGenerationValue','adaptiveRewardValue','adaptiveSlipValue','adaptiveParamsValue']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(js, /new AdaptiveMotorLearner/);
  assert.match(js, /tripodPropulsion\(state\.gait,dt\)/);
  assert.match(js, /const motion=moveOnSurface\(dt,bodyDrive,turnRate\)/);
  assert.match(js, /actualProgress=motion\?\.forwardSpeed/);
});

test('MaleCNS wall context and wall-exit telemetry are wired into the runtime',()=>{
  assert.match(js,/wallHeight/);
  assert.match(js,/wallClimbRate/);
  assert.match(js,/wallAge/);
  assert.match(js,/intrinsicReason/);
  assert.match(js,/f\.speed=Math\.max\(f\.speed,\.42\)/);
});


test('hunger-motivated wall search sends odour level and temporal trend into MaleCNS',()=>{
  assert.match(js,/updateFruitOdorTrace/);
  assert.match(js,/fruitOdor:odorTrace\.filtered/);
  assert.match(js,/fruitOdorTrend:odorTrace\.trend/);
  assert.match(worker,/fruitOdorTrend/);
  const motor=fs.readFileSync(new URL('../src/malecns/motor.js',import.meta.url),'utf8');
  assert.match(motor,/wall-hunger-search/);
  assert.match(motor,/wallSearchMotivation/);
  assert.match(motor,/No reward labels are used here/);
});
