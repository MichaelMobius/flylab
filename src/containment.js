import * as THREE from '../vendor/three/build/three.module.js';
const bounds=new THREE.Box3(),part=new THREE.Box3();
// Include animated limbs and wings, excluding the invisible picking sphere.
export function visibleBounds(root,target=new THREE.Box3()){
  root.updateWorldMatrix(true,true);target.makeEmpty();
  root.traverseVisible(object=>{
    if(!object.geometry||object.userData.flyPick)return;
    // Instanced eye facets use a unit primitive with tiny instance transforms.
    // Its raw geometry bounds are NOT the bounds of the rendered eye.
    if(object.isInstancedMesh){
      if(!object.boundingBox)object.computeBoundingBox();
      part.copy(object.boundingBox);
    }else{
      if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
      part.copy(object.geometry.boundingBox);
    }
    part.applyMatrix4(object.matrixWorld);target.union(part);
  });
  return target;
}
export function confineFlyVisual(root,half=6){
  visibleBounds(root,bounds);const inside=half-.025;
  let dx=0,dz=0;
  if(bounds.max.x>inside)dx=inside-bounds.max.x;
  if(bounds.min.x+dx<-inside)dx+=-inside-(bounds.min.x+dx);
  if(bounds.max.z>inside)dz=inside-bounds.max.z;
  if(bounds.min.z+dz<-inside)dz+=-inside-(bounds.min.z+dz);
  root.position.x+=dx;root.position.z+=dz;
  return {x:dx,z:dz};
}
