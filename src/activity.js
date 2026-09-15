// FlyLab v0.6 — functional connectome activity tracker.
// AL and MB are directly driven by the current olfactory/MB proxy telemetry.
// CX, SEZ, DN and VNC are functional proxies derived from action/state until the
// complete MaleCNS adapter replaces them with activity aggregated from real neurons.

const clamp01 = v => Math.max(0, Math.min(1, v));

export const CONNECTOME_REGIONS = [
  { key:'AL',  label:'Antennal lobe', short:'AL', source:'derived', role:'olfato' },
  { key:'MB',  label:'Mushroom body', short:'MB', source:'derived', role:'memoria / valor' },
  { key:'CX',  label:'Central complex', short:'CX', source:'proxy', role:'orientación / navegación' },
  { key:'SEZ', label:'Subesophageal zone', short:'SEZ', source:'proxy', role:'gusto / alimentación' },
  { key:'DN',  label:'Descending neurons', short:'DN', source:'proxy', role:'selección motora' },
  { key:'VNC', label:'Ventral nerve cord', short:'VNC', source:'proxy', role:'patas / alas' },
];

export class ConnectomeActivityTracker {
  constructor({sampleHz=12, maxSeconds=45}={}) {
    this.sampleHz = sampleHz;
    this.sampleEvery = 1 / sampleHz;
    this.maxSamples = Math.max(60, Math.floor(sampleHz * maxSeconds));
    this.acc = 0;
    this.values = Object.fromEntries(CONNECTOME_REGIONS.map(r => [r.key, 0]));
    this.history = [];
    this.action = 'explorando';
    this.dominant = 'AL';
  }

  update(dt, s) {
    const odor = clamp01((s.odorLeft + s.odorRight) / 2.2);
    const mb = clamp01((s.kcActive || 0) / Math.max(1, s.kcCount || 128) * 4.5 + Math.abs(s.memoryValue || 0) * .22 + (s.dopamine || 0) * .18);
    const turn = clamp01(Math.abs(s.turn || 0));
    const moving = clamp01((s.speed || 0) / 1.4);
    const wall = typeof s.surface==='string' && s.surface.startsWith('wall-') ? 1 : 0;
    const airborne = ['takeoff','flight','landing'].includes(s.mode) ? 1 : 0;
    const feeding = s.feeding ? 1 : 0;
    const contact = s.contact ? 1 : 0;

    this.values.AL  = clamp01(.08 + .92 * odor);
    this.values.MB  = clamp01(.05 + .95 * mb);
    this.values.CX  = clamp01(.08 + .42 * turn + .28 * moving + .24 * wall + .12 * airborne);
    this.values.SEZ = clamp01(.02 + .92 * feeding + .18 * contact);
    this.values.DN  = clamp01(.05 + .42 * moving + .28 * turn + .30 * airborne + .12 * wall);
    this.values.VNC = clamp01(.04 + .55 * moving + .38 * airborne + .30 * wall + .20 * feeding);

    if (feeding) this.action = 'alimentándose';
    else if (s.mode === 'takeoff') this.action = 'despegando';
    else if (s.mode === 'flight') this.action = Math.abs(s.turn || 0) > .32 ? 'girando en vuelo' : 'volando';
    else if (s.mode === 'landing') this.action = 'aterrizando';
    else if (wall) this.action = Math.abs(s.turn || 0) > .35 ? 'girando en pared' : 'trepando vidrio';
    else if (moving > .2) this.action = Math.abs(s.turn || 0) > .35 ? 'girando en suelo' : 'caminando';
    else this.action = odor > .16 ? 'muestreando olor' : 'explorando';

    this.dominant = CONNECTOME_REGIONS.reduce((a,r) => this.values[r.key] > this.values[a] ? r.key : a, 'AL');
    this.acc += dt;
    if (this.acc >= this.sampleEvery) {
      this.acc %= this.sampleEvery;
      this.history.push({
        t:s.t, action:this.action, mode:s.mode, surface:s.surface || 'floor', feeding:feeding,
        energy:s.energy ?? 0, hunger:s.hunger ?? 0,
        ...Object.fromEntries(CONNECTOME_REGIONS.map(r => [r.key, this.values[r.key]]))
      });
      if (this.history.length > this.maxSamples) this.history.splice(0, this.history.length - this.maxSamples);
    }
    return this.values;
  }

  clear() { this.history.length = 0; this.acc=0; for(const k of Object.keys(this.values))this.values[k]=0;this.action='explorando';this.dominant='AL'; }

  toCSV() {
    const head = ['time_s','action','mode','surface','feeding','energy','hunger',...CONNECTOME_REGIONS.map(r=>r.key)];
    const q = v => `"${String(v).replaceAll('"','""')}"`;
    const rows = this.history.map(r => [r.t.toFixed(3),q(r.action),r.mode,r.surface,r.feeding,r.energy.toFixed(4),r.hunger.toFixed(4),...CONNECTOME_REGIONS.map(x=>r[x.key].toFixed(4))]);
    return [head.join(','),...rows.map(r=>r.join(','))].join('\n');
  }
}
