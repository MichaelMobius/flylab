import {header} from './validation.js';
import { Decoder, UInt, SInt, probs, lg } from './rc.js';
const MAGIC = 0x47594C46;
function models() { return { deg: new UInt(24), first: new SInt(24), gap: new UInt(24), w: new UInt(48), copy: probs(4 * 8 * 2), perm: 18 }; }
const cctx = (prevBit, degRatio, i) => (prevBit * 8 + degRatio) * 2 + (i === 0 ? 1 : 0);
export function decodeGraph(buf) {
  const u8 = new Uint8Array(buf), h = header(buf,MAGIC,5);
  if (h[0] !== MAGIC || h[1] !== 1) throw new Error('not a FLYG v1 file');
  const N = h[2], E = h[3], minWeight = h[4];
  const d = new Decoder(u8.subarray(20)), M = models();
  const order = new Uint32Array(N); for (let r = 0; r < N; r++) order[r] = d.direct(0, M.perm);
  const seen=new Uint8Array(N);for(const i of order){if(i>=N||seen[i])throw new Error('Invalid graph permutation');seen[i]=1;}
  const ptrN = new Uint32Array(N + 1), tgt = new Uint32Array(E), wt = new Uint16Array(E);
  let pos = 0, pa = 0, pb = 0, prevDeg = 0;
  let res = new Uint32Array(8192), cop = new Uint32Array(8192);
  for (let r = 0; r < N; r++) {
    const deg = M.deg.dec(d, Math.min(lg(prevDeg), 23));
    if(deg>E-pos)throw new Error('Edge count overflow');
    if (deg > res.length || pb - pa > cop.length) { res = new Uint32Array(2 * Math.max(deg, pb - pa)); cop = new Uint32Array(res.length); }
    const plen = pb - pa, ratio = plen ? Math.min(7, Math.max(0, lg(deg) - lg(plen) + 4)) : 0;
    let nc = 0, bit = 0;
    for (let i = 0; i < plen; i++) { bit = d.bit(M.copy, cctx(bit, ratio, i)); if (bit) cop[nc++] = i; }
    if(nc>deg)throw new Error('Invalid copied degree');
    const nr = deg - nc; let last = -1, pg = 0;
    for (let i = 0; i < nr; i++) { if (i === 0) last = r + M.first.dec(d, Math.min(lg(deg), 23)); else { const g = M.gap.dec(d, Math.min(lg(pg), 23)); pg = g; last += g + 1; } res[i] = last; }
    let i = 0, k = 0, pw = 0; const start = pos;
    while (i < nc || k < nr) {
      const ct = i < nc ? tgt[pa + cop[i]] : 0xFFFFFFFF, rt = k < nr ? res[k] : 0xFFFFFFFF; let w;
      if (ct < rt) { w = M.w.dec(d, 24 + Math.min(lg(wt[pa + cop[i]] - minWeight), 23)); tgt[pos] = ct; i++; }
      else { w = M.w.dec(d, Math.min(lg(pw), 23)); tgt[pos] = rt; k++; }
      if(tgt[pos]>=N||w+minWeight>65535)throw new Error('Invalid edge');
      wt[pos++] = w + minWeight; pw = w;
    }
    pa = start; pb = pos; ptrN[r + 1] = pos; prevDeg = deg;
  }
  if(pos!==E)throw new Error('Edge count mismatch');
  const indptr = new Uint32Array(N + 1);
  for (let r = 0; r < N; r++) indptr[order[r] + 1] = ptrN[r + 1] - ptrN[r];
  for (let o = 0; o < N; o++) indptr[o + 1] += indptr[o];
  const tstart = new Uint32Array(N + 1);
  for (let j = 0; j < E; j++) tstart[order[tgt[j]] + 1]++;
  for (let t = 0; t < N; t++) tstart[t + 1] += tstart[t];
  const rowOf = new Uint32Array(E), wOf = new Uint16Array(E);
  for (let r = 0; r < N; r++) { const o = order[r]; for (let j = ptrN[r]; j < ptrN[r + 1]; j++) { const s = tstart[order[tgt[j]]]++; rowOf[s] = o; wOf[s] = wt[j]; } }
  const indices = new Uint32Array(E), weights = new Uint16Array(E), cur = indptr.slice(0, N);
  for (let t = 0, s = 0; t < N; t++) for (const end = tstart[t]; s < end; s++) { const kk = cur[rowOf[s]]++; indices[kk] = t; weights[kk] = wOf[s]; }
  return { N, E, indptr, indices, weights, minWeight };
}
