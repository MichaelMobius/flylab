import * as THREE from '../vendor/three/build/three.module.js';
// Explicit body policy; dirt is a dimensionless proxy, not microbial load.
export function updateGrooming(f,dt,{feeding=false,support=0,request=false}={}){
 const g=f.groom??={active:false,pause:false,requested:false,elapsed:0,dirt:.03,cooldown:0};
 g.cooldown=Math.max(0,g.cooldown-dt);
 g.dirt=Math.min(1,g.dirt+(f.mode==='ground'?(feeding?.07:.003):0)*dt);
 if(request)g.requested=true;
 if(f.mode!=='ground'||f.corner||feeding){
  const interrupted=g.active;g.active=false;g.pause=false;g.elapsed=0;
  if(interrupted){g.cooldown=8;g.requested=false;return 'interrupted';}return null;
 }
 if(g.active){
  g.elapsed+=dt;g.dirt=Math.max(0,g.dirt-dt*.09);
  if(g.elapsed>=4){g.active=false;g.pause=false;g.requested=false;g.cooldown=14;return 'end';}
  return null;
 }
 g.pause=g.requested||(g.dirt>=.12&&g.cooldown===0);
 if(g.pause&&Math.abs(f.speed)<.025&&support>=5){g.active=true;g.elapsed=0;return 'start';}
 return null;
}
export function groomingPole(leg,elapsed){
 if(leg.pair!==0)return new THREE.Vector3(0,1,0);
 const t=Math.max(0,Math.min(4,elapsed));
 // During grooming the forelegs should arc under/around the compound eyes rather
 // than using the default upward pole that pushes the femur straight through the
 // eye volume. A ventral pole keeps the sweep in front of the head and clear of
 // both eyes while preserving the same reachable target trajectory.
 return new THREE.Vector3(0,-1,.18*Math.sin(t*8));
}
export function groomingTarget(leg,elapsed){
 if(leg.pair!==0)return null;
 const s=leg.side,t=Math.max(0,Math.min(4,elapsed)),rest=leg.rest.foot.clone();
 const rub=new THREE.Vector3(s*(.012+.017*Math.sin(t*23)),-.085+.009*Math.cos(t*23),.345+.010*Math.sin(t*23));
 let target=rub;
 if(t>1.5&&t<2.7){const u=(t-1.5)/1.2,w=Math.sin(Math.PI*u)**2;
  const sweep=new THREE.Vector3(s*(.055+.013*Math.sin(t*18)),.018+.025*Math.sin(t*12),.268+.022*Math.cos(t*12));
  target=rub.clone().lerp(sweep,w);
 }
 const blend=t<.3?t/.3:t>3.7?(4-t)/.3:1;
 return rest.lerp(target,blend*blend*(3-2*blend));
}
