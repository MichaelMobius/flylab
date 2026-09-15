import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMotorGroups, DNMotorReadout, IntrinsicDrive, READOUT } from '../src/malecns/motor.js';
import { LIFNetwork } from '../src/malecns/lif.js';

function fixture(){
  const typeOf=['DNg100','DNg97','MDN','DNa02','DNa02','DNp02','DNp04','MN9','DNa01','DNa01'];
  const side=new Uint8Array([0,0,0,1,2,0,0,0,1,2]);
  return {typeOf,side,groups:buildMotorGroups(typeOf,side,[7])};
}

test('MaleCNS motor groups map identified descending neuron roles and sides',()=>{
  const {groups}=fixture();
  assert.ok(groups.forward.length>=2);
  assert.equal(groups.backward.length,1);
  assert.ok(groups.turnL.some(([i])=>i===3));
  assert.ok(groups.turnR.some(([i])=>i===4));
  assert.equal(groups.takeoff.length,2);
  assert.ok(groups.feedingMotor.includes(7));
});

test('DN readout converts spikes into forward, steering and takeoff commands',()=>{
  const {typeOf,groups}=fixture();
  const r=new DNMotorReadout(typeOf.length,groups);
  const c=new Uint32Array(typeOf.length);
  c[0]=2;c[1]=2;                 // 20 Hz forward each over 100 ms
  c[3]=3;c[8]=2;                 // left steering
  c[5]=10;c[6]=10;               // 100 Hz takeoff population
  const m=r.update(c,100,{flying:false,tMs:2000});
  assert.ok(m.v>0.4,'forward speed should be positive');
  assert.ok(m.turn>0,'left DN activity should produce left turn');
  assert.ok(m.takeoffHz>READOUT.takeoffThreshold);
  assert.equal(m.takeoffTriggered,true);
});

test('MDN readout produces bounded backward motion',()=>{
  const {typeOf,groups}=fixture();
  const r=new DNMotorReadout(typeOf.length,groups);
  const c=new Uint32Array(typeOf.length);c[2]=3;
  const m=r.update(c,100,{tMs:2000});
  assert.ok(m.v<0);
  assert.ok(m.v>=-READOUT.backMax-1e-6);
});

test('intrinsic drive explicitly brakes during feeding',()=>{
  const d=new IntrinsicDrive(42);
  const x=d.update(20,{feeding:true,mode:'ground',hunger:.7});
  assert.equal(x.state,'feed');
  assert.equal(x.fwd,0);
  assert.ok(x.brake>0);
});

test('LIF conductance bias can excite a neuron without forcing a sensory spike',()=>{
  const indptr=new Uint32Array([0,0]);
  const net=new LIFNetwork(1,indptr,new Uint32Array(0),new Uint16Array(0),new Uint8Array([1]),{rng:()=>1});
  net.setBias(new Int32Array([0]),20,0);
  let fired=0;for(let i=0;i<80;i++)fired+=net.step().length;
  assert.ok(fired>0);
});

test('tonic left-right DN imbalance is calibrated instead of becoming a permanent pivot',()=>{
  const {typeOf,groups}=fixture();
  const r=new DNMotorReadout(typeOf.length,groups); const c=new Uint32Array(typeOf.length); let m;
  for(let k=1;k<=40;k++){
    c[0]+=1;c[1]+=1;                 // tonic forward activity
    c[3]+=2;c[4]+=1;c[8]+=1;c[9]+=1; // persistent left-heavy steering baseline
    m=r.update(c,100,{tMs:k*100,intrinsicState:'stop'});
  }
  for(let k=41;k<=45;k++){
    c[0]+=2;c[1]+=2; c[3]+=2;c[4]+=1;c[8]+=1;c[9]+=1;
    m=r.update(c,100,{tMs:k*100,intrinsicState:'walk'});
  }
  assert.ok(m.v>.35,'extra forward DN activity should produce translation');
  assert.ok(Math.abs(m.turn)<.15,'unchanged tonic asymmetry should not dominate locomotion');
  assert.ok(m.fwdExcessHz>0,'readout should expose baseline-subtracted forward drive');
});

test('wall climbing is not an absorbing state: prolonged stall creates DN takeoff drive',()=>{
  const d=new IntrinsicDrive(7); let x={}, seen=null;
  for(let k=0;k<180;k++){
    x=d.update(20,{feeding:false,mode:'ground',surface:'wall-x+',hunger:.5,wallHeight:.55,wallClimbRate:0});
    if(x.takeoff>0 && x.takeoffReason==='wall-stall'){seen={...x};break;}
  }
  assert.ok(seen,'stalled wall climbing should eventually excite takeoff DNs');
  assert.ok(seen.wallMs>0);
});

test('upper wall produces a wall-exit takeoff pulse instead of endless climbing',()=>{
  const d=new IntrinsicDrive(11); let x={};
  for(let k=0;k<120;k++) x=d.update(20,{feeding:false,mode:'ground',surface:'wall-z-',hunger:.4,wallHeight:.9,wallClimbRate:.12});
  assert.ok(x.takeoff>0);
  assert.equal(x.takeoffReason,'wall-top');
});


test('hunger can motivate wall exit when fruit odour is weak and not improving',()=>{
  const d=new IntrinsicDrive(19); d.state='stop'; d.left=1e9; let hit=null;
  for(let k=0;k<450;k++){
    const x=d.update(20,{feeding:false,mode:'ground',surface:'wall-x-',hunger:.92,wallHeight:.45,wallClimbRate:.12,fruitOdor:.015,fruitOdorTrend:0});
    if(x.takeoffReason==='wall-hunger-search'){hit=x;break;}
  }
  assert.ok(hit,'high hunger + poor odour evidence should accumulate a wall-search exit drive');
  assert.ok(hit.wallSearchMotivation>.25);
  assert.ok(hit.foodlessMs>2000);
});

test('an improving fruit odour suppresses hunger-driven wall exit',()=>{
  const d=new IntrinsicDrive(19); d.state='stop'; d.left=1e9; let maxDrive=0,reason='';
  for(let k=0;k<450;k++){
    const x=d.update(20,{feeding:false,mode:'ground',surface:'wall-x-',hunger:.92,wallHeight:.45,wallClimbRate:.12,fruitOdor:.65,fruitOdorTrend:.12});
    maxDrive=Math.max(maxDrive,x.wallSearchDriveMs||0); reason=x.takeoffReason||reason;
  }
  assert.ok(maxDrive<250,'rising strong fruit odour should discharge motivated-search pressure');
  assert.notEqual(reason,'wall-hunger-search');
});

test('satiety strongly reduces hunger-driven wall search pressure',()=>{
  const hungry=new IntrinsicDrive(23), satiated=new IntrinsicDrive(23); hungry.state=satiated.state='stop'; hungry.left=satiated.left=1e9;
  let h={},s={};
  for(let k=0;k<160;k++){
    h=hungry.update(20,{mode:'ground',surface:'wall-z+',hunger:.9,wallHeight:.4,wallClimbRate:.1,fruitOdor:.02,fruitOdorTrend:0});
    s=satiated.update(20,{mode:'ground',surface:'wall-z+',hunger:.12,wallHeight:.4,wallClimbRate:.1,fruitOdor:.02,fruitOdorTrend:0});
  }
  assert.ok(h.wallSearchDriveMs>(s.wallSearchDriveMs+300));
  assert.ok(h.wallSearchMotivation>s.wallSearchMotivation);
});
