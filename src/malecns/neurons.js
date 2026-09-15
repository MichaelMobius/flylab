import {header} from './validation.js';
import { Decoder, UInt, SInt, probs } from './rc.js';
const MAGIC = 0x4E594C46;
const models = () => ({ id: new UInt(1), sc: new UInt(32), cls: new UInt(32), nt: new UInt(32), side: new UInt(32), has: probs(2), soma: new SInt(3) });
export function decodeNeurons(buf) {
  const u8 = new Uint8Array(buf), h = header(buf,MAGIC,3);
  if (h[0] !== MAGIC || h[1] !== 1) throw new Error('not a FLYN v1 file');
  const N = h[2], d = new Decoder(u8.subarray(12)), M = models();
  const bodyIds = new BigInt64Array(N), soma = new Float32Array(N * 3), cls = new Uint16Array(N), nt = new Uint8Array(N), superclass = new Uint8Array(N), side = new Uint8Array(N);
  let id = 0, ph = 1; const prev = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const delta=M.id.dec(d,0);if(delta<=0||!Number.isSafeInteger(id+delta))throw new Error('Invalid neuron identifier');id+=delta; bodyIds[i] = BigInt(id);
    const s = M.sc.dec(d, 0); superclass[i] = s; cls[i] = M.cls.dec(d, s); nt[i] = M.nt.dec(d, s); side[i] = M.side.dec(d, s);
    const has = d.bit(M.has, ph); ph = has;
    for (let k = 0; k < 3; k++) { if (has) prev[k] += M.soma.dec(d, k); soma[i * 3 + k] = has ? prev[k] : NaN; }
  }
  return { N, bodyIds, soma, cls, nt, superclass, side };
}
