import * as THREE from '../vendor/three/build/three.module.js';
import {OrbitControls} from '../vendor/three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from '../vendor/three/addons/environments/RoomEnvironment.js';
import {createFly,createFruitMesh,animateFlyLegs} from './models.js';
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.setClearColor(0xede9df);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.shadowMap.enabled=true;document.getElementById('view').appendChild(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,innerWidth/innerHeight,.01,30);camera.position.set(1.45,1.02,1.48);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.07,-.10);controls.enableDamping=true;controls.minDistance=.7;controls.maxDistance=4;controls.maxPolarAngle=Math.PI*.49;
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;pmrem.dispose();scene.environmentIntensity=.65;scene.add(new THREE.HemisphereLight(0xfff7e0,0x817765,1.1));
const light=new THREE.DirectionalLight(0xfff5df,2.2);light.position.set(-2,4,3);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-2;light.shadow.camera.right=2;light.shadow.camera.top=2;light.shadow.camera.bottom=-2;light.shadow.bias=-.00015;scene.add(light);
const rim=new THREE.DirectionalLight(0xffffff,1.5);rim.position.set(2,1,-3);scene.add(rim);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.12}));ground.rotation.x=-Math.PI/2;ground.position.y=-.205;ground.receiveShadow=true;scene.add(ground);
let model,spread=false,type='fly';
function show(next){if(model){scene.remove(model);model.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});}type=next;model=next==='fly'?createFly():createFruitMesh(next);scene.add(model);
 if(next==='fly'){animateFlyLegs(model,0,{mode:'ground',speed:0},true);controls.target.set(0,.03,-.10);ground.position.y=-.205;}else{model.position.y=-.20;controls.target.set(0,.13,0);ground.position.y=-.20;}
 document.getElementById('title').textContent=({fly:'Drosophila melanogaster',apple:'Malus · manzana',banana:'Musa · banana',orange:'Citrus · naranja',grape:'Vitis · uva',strawberry:'Fragaria · fresa'})[next];
 document.getElementById('description').textContent=next==='fly'?'Seis patas articuladas. Un par de alas membranosas y dos halterios. Ojos compuestos, tres ocelos y antenas con aristas ramificadas.':'Superficie, pigmentación y volumen propios de cada fruta. Texturas y geometrías generadas dentro del proyecto.';
 document.getElementById('legend').hidden=next!=='fly';document.getElementById('wings').disabled=next!=='fly';
}
show('fly');
document.getElementById('specimen').addEventListener('change',e=>show(e.target.value));
document.getElementById('dorsal').onclick=()=>camera.position.copy(controls.target).add(new THREE.Vector3(.001,2.35,.1));
document.getElementById('lateral').onclick=()=>camera.position.copy(controls.target).add(new THREE.Vector3(2.35,.26,.05));
document.getElementById('front').onclick=()=>camera.position.copy(controls.target).add(new THREE.Vector3(.01,.38,2.35));
document.getElementById('wings').onclick=()=>{spread=!spread;document.getElementById('wings').setAttribute('aria-pressed',String(spread));document.getElementById('wings').textContent=spread?'Plegar alas':'Extender alas';};
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
function frame(){if(type==='fly')for(const w of model.userData.wings){w.pivot.rotation.y=-w.side*(spread?1.13:.16);}controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);}frame();
