import * as THREE from '../vendor/three/build/three.module.js';
const V=()=>new THREE.Vector3();
export function releaseFootholds(f){f.legAnchors=null;f.legSteps=null;f.lastGroundPose=null;}
export function updateFootholds(root,f,dt){
 if(f.mode!=='ground'||f.corner){releaseFootholds(f);return;}
 root.updateWorldMatrix(true,true);
 f.legAnchors??=Array(6).fill(null);f.legSteps??=Array(6).fill(null);
 let support=root.userData.legs.filter(l=>l.stance).length;
 for(const [i,leg] of root.userData.legs.entries()){
  if(f.legSteps[i]){f.legSteps[i].elapsed+=dt;if(f.legSteps[i].elapsed>=.12)f.legSteps[i]=null;else continue;}
  const a=f.legAnchors[i];
  if(!leg.stance){f.legAnchors[i]=null;continue;}
  if(!a||a.surface!==f.surface){
   f.legAnchors[i]={surface:f.surface,stance:true,point:leg.claws.localToWorld(V().set(0,-.006,.013)).toArray()};
  }
 }
}
