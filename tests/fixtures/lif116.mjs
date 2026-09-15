export const EXC_SIGN = [0, 1, -1, -1, 1, 1, 1, -1];
export const DEFAULTS = {
  dt: 0.5, vRest: -52, vThresh: -45, vReset: -52, tauM: 20, tauSyn: 5, tRef: 2.2, delay: 1.8,
  wSyn: 0.275, noise: 0, traceTau: 30,
  adaptInc: 2.0, adaptTau: 100, depU: 0.2, depTau: 200,
  minSyn: 1, ntSign: null, rng: Math.random,
};
export class LIFNetwork {
  constructor(N, indptr, indices, weights, nt, params = {}) {
    this.N=N; this.indptr=indptr; this.indices=indices; this.nt=nt; this.p={...DEFAULTS,...params};
    const w=new Float32Array(weights.length); for(let i=0;i<weights.length;i++) w[i]=weights[i]>=this.p.minSyn?weights[i]:0; this.weights=w;
    this.v=new Float32Array(N).fill(this.p.vRest); this.gE=new Float32Array(N); this.gI=new Float32Array(N);
    this.refr=new Float32Array(N); this.trace=new Float32Array(N); this.spikeCount=new Uint32Array(N); this.drive=new Float32Array(N);
    this.biasE=new Float32Array(N); this.biasI=new Float32Array(N);
    this.adapt=new Float32Array(N); this.res=new Float32Array(N).fill(1); this.awake=new Uint8Array(N); this.awakeList=new Int32Array(N); this.nAwake=0;
    this.t=0; this._setupRing();
  }
  wake(i){if(!this.awake[i]){this.awake[i]=1;this.awakeList[this.nAwake++]=i;}}
  _setupRing(){const d=Math.max(1,Math.round(this.p.delay/this.p.dt));this.ring=Array.from({length:d+1},()=>[]);this.head=0;}
  reset(){this.v.fill(this.p.vRest);this.gE.fill(0);this.gI.fill(0);this.refr.fill(0);this.trace.fill(0);this.adapt.fill(0);this.res.fill(1);this.spikeCount.fill(0);this.biasE.fill(0);this.biasI.fill(0);this.ring.forEach(a=>a.length=0);this.head=0;this.t=0;this.awake.fill(0);this.nAwake=0;for(let i=0;i<this.N;i++)if(this.drive[i]>0)this.wake(i);}
  setDrive(ix,rate){for(let k=0;k<ix.length;k++){const i=ix[k];this.drive[i]=rate;if(rate>0)this.wake(i);}}
  setDriveOne(i,rate){this.drive[i]=rate;if(rate>0)this.wake(i);}
  setBias(ix,exc=0,inh=0){for(let k=0;k<ix.length;k++){const i=ix[k];this.biasE[i]=exc;this.biasI[i]=inh;if(exc>0||inh>0)this.wake(i);}}
  setExcBias(ix,value=0){for(let k=0;k<ix.length;k++){const i=ix[k];this.biasE[i]=value;if(value>0)this.wake(i);}}
  setInhBias(ix,value=0){for(let k=0;k<ix.length;k++){const i=ix[k];this.biasI[i]=value;if(value>0)this.wake(i);}}
  clearBias(ix){for(let k=0;k<ix.length;k++){const i=ix[k];this.biasE[i]=0;this.biasI[i]=0;}}
  step(){
    const {dt,vRest,vThresh,vReset,tauM,tauSyn,tRef,wSyn,traceTau,adaptInc,adaptTau,depU,depTau,rng}=this.p;
    const {N,v,gE,gI,refr,trace,spikeCount,drive,biasE,biasI,indptr,indices,weights,nt,adapt,res}=this;
    const dA=Math.exp(-dt/adaptTau),kRec=dt/depTau,SIGN=this.p.ntSign||EXC_SIGN,dE=Math.exp(-dt/tauSyn),dTr=Math.exp(-dt/traceTau),dtS=dt/1000,kM=dt/tauM;
    const arriving=this.ring[this.head], awake=this.awake, list=this.awakeList; let nA0=this.nAwake;
    for(let k=0;k<arriving.length;k++){
      const pre=arriving[k], sign=SIGN[nt[pre]]*wSyn*res[pre], a=indptr[pre], b=indptr[pre+1]; if(sign===0)continue;
      res[pre]-=depU*res[pre];
      if(sign>0){for(let j=a;j<b;j++){const q=indices[j],ww=weights[j];if(!ww)continue;gE[q]+=ww*sign;if(!awake[q]){awake[q]=1;list[nA0++]=q;}}}
      else{for(let j=a;j<b;j++){const q=indices[j],ww=weights[j];if(!ww)continue;gI[q]+=ww*sign;if(!awake[q]){awake[q]=1;list[nA0++]=q;}}}
    }
    arriving.length=0; const fired=[]; const count=nA0; let keep=0;
    for(let n=0;n<count;n++){
      const i=list[n]; let vi=v[i];
      if(refr[i]>0){refr[i]-=dt;vi=vReset;}
      else if(drive[i]>0&&rng()<drive[i]*dtS){vi=vReset;refr[i]=tRef;fired.push(i);spikeCount[i]++;trace[i]=1;adapt[i]+=adaptInc;}
      else{vi+=(vRest-vi+gE[i]+gI[i]+biasE[i]-biasI[i])*kM;if(vi>=vThresh+adapt[i]){vi=vReset;refr[i]=tRef;fired.push(i);spikeCount[i]++;trace[i]=1;adapt[i]+=adaptInc;}}
      const e=gE[i]*dE,ii=gI[i]*dE,tr=trace[i]*dTr,ad=adapt[i]*dA,rs=res[i]+(1-res[i])*kRec;
      if(refr[i]<=0&&drive[i]===0&&biasE[i]===0&&biasI[i]===0&&Math.abs(vi-vRest)<1e-3&&e<1e-4&&-ii<1e-4&&tr<2e-3&&ad<1e-3&&rs>.999){v[i]=vRest;gE[i]=gI[i]=trace[i]=adapt[i]=0;res[i]=1;awake[i]=0;}
      else{v[i]=vi;gE[i]=e;gI[i]=ii;trace[i]=tr;adapt[i]=ad;res[i]=rs;list[keep++]=i;}
    }
    this.nAwake=keep; const slot=(this.head+this.ring.length-1)%this.ring.length;this.ring[slot]=fired;this.head=(this.head+1)%this.ring.length;this.t+=dt;return fired;
  }
}
