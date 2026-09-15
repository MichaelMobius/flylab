// FlyLab 0.6 — auditable mushroom-body-inspired proxy.
// This is NOT the full MaleCNS graph. It deliberately exposes the same sensor/action
// boundary we will use for the full connectome adapter.

export const GLOMERULI = ['DM1', 'DM2', 'DM3', 'DM4', 'VA2', 'VM2', 'DP1m', 'DL1', 'DA2', 'V'];

export const FRUIT_LIBRARY = {
  banana: {
    label: 'Banana', color: 0xf5d64f, reward: 0.95, strength: 1.15,
    // Grounded in the browser MaleCNS reference implementation (banana odor mapping).
    odor: { DM1: 0.8, DM3: 0.7, VM2: 0.6, DM2: 0.5, VA2: 0.4 },
    grounded: true,
  },
  apple: {
    label: 'Manzana', color: 0xd8443e, reward: 1.0, strength: 1.0,
    // Provisional fermentation-like signature for the MVP, not a calibrated apple receptor atlas.
    odor: { DM1: 0.95, DM4: 0.72, VA2: 0.58, DP1m: 0.45, DM2: 0.38, VM2: 0.28 },
    grounded: false,
  },
  orange: {
    label: 'Naranja', color: 0xf29b38, reward: 0.85, strength: 1.0,
    odor: { DM3: 0.72, DM4: 0.55, DL1: 0.48, VA2: 0.36, VM2: 0.30 },
    grounded: false,
  },
  grape: {
    label: 'Uva', color: 0x8f62c9, reward: 0.8, strength: 0.9,
    odor: { DM2: 0.66, DM3: 0.54, VA2: 0.62, DP1m: 0.33 },
    grounded: false,
  },
  strawberry: {
    label: 'Fresa', color: 0xe45467, reward: 0.9, strength: 1.05,
    odor: { DM1: 0.70, DM3: 0.45, DM4: 0.62, VA2: 0.52, DL1: 0.25 },
    grounded: false,
  },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hill = (c, k = 0.25, n = 1.4) => c <= 0 ? 0 : c ** n / (c ** n + k ** n);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class MushroomBodyProxy {
  constructor({ kcCount = 128, activeFraction = 0.10, seed = 1337 } = {}) {
    this.kcCount = kcCount;
    this.activeCount = Math.max(4, Math.round(kcCount * activeFraction));
    this.learningRate = 0.12;
    this.memory = new Float32Array(kcCount);
    this.rng = mulberry32(seed);
    this.kcInputs = this.#makeKCProjection();
    this.innate = new Float32Array(GLOMERULI.length);
    // Broad appetitive bias for common ferment/fruit channels; explicit aversion for DA2/V.
    const appetitive = { DM1: 0.34, DM2: 0.20, DM3: 0.22, DM4: 0.16, VA2: 0.18, VM2: 0.13, DP1m: 0.08, DL1: 0.03, DA2: -0.60, V: -0.50 };
    GLOMERULI.forEach((g, i) => { this.innate[i] = appetitive[g] ?? 0; });
    this.last = this.#blankTelemetry();
  }

  #blankTelemetry() {
    return { leftTotal: 0, rightTotal: 0, gradient: 0, ornHz: 0, kcActive: 0, memoryValue: 0, dopamine: 0, turn: 0, approach: 0 };
  }

  #makeKCProjection() {
    const projection = [];
    for (let k = 0; k < this.kcCount; k++) {
      const n = 3 + (this.rng() > 0.75 ? 1 : 0);
      const set = new Set();
      while (set.size < n) set.add(Math.floor(this.rng() * GLOMERULI.length));
      projection.push([...set]);
    }
    return projection;
  }

  receptorVector(mixture = {}) {
    const x = new Float32Array(GLOMERULI.length);
    GLOMERULI.forEach((g, i) => { x[i] = hill(mixture[g] || 0); });
    const evoked = x.reduce((a, b) => a + b, 0);
    const gain = 4 / (4 + evoked); // compact analogue of divisive AL normalisation.
    for (let i = 0; i < x.length; i++) x[i] *= gain;
    return x;
  }

  encodeKC(receptors) {
    const scores = new Float32Array(this.kcCount);
    for (let k = 0; k < this.kcCount; k++) {
      const src = this.kcInputs[k];
      let s = 0;
      for (const i of src) s += receptors[i];
      scores[k] = s / Math.sqrt(src.length);
    }
    const order = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]);
    const active = new Float32Array(this.kcCount);
    const threshold = scores[order[Math.min(this.activeCount - 1, order.length - 1)]] || 0;
    if (threshold > 1e-5) {
      for (let j = 0; j < this.activeCount; j++) {
        const k = order[j];
        active[k] = scores[k] / (threshold + 1e-6);
      }
    }
    return active;
  }

  value(receptors) {
    let innate = 0;
    for (let i = 0; i < receptors.length; i++) innate += receptors[i] * this.innate[i];
    const kc = this.encodeKC(receptors);
    let learned = 0, n = 0;
    for (let i = 0; i < kc.length; i++) if (kc[i] > 0) { learned += this.memory[i] * kc[i]; n++; }
    learned = n ? learned / n : 0;
    return { innate, learned, total: innate + learned, kc, active: n };
  }

  step({ leftMixture, rightMixture, dt = 1 / 60, exploration = 0 }) {
    const L = this.receptorVector(leftMixture);
    const R = this.receptorVector(rightMixture);
    const lv = this.value(L);
    const rv = this.value(R);
    const leftTotal = L.reduce((a, b) => a + b, 0);
    const rightTotal = R.reduce((a, b) => a + b, 0);
    const gradient = leftTotal - rightTotal;
    const learnedGradient = lv.total - rv.total;
    const turn = clamp(2.5 * gradient + 1.6 * learnedGradient + exploration, -1, 1);
    const approach = clamp(0.25 + 0.9 * Math.max(0, (lv.total + rv.total) / 2) + 0.15 * (leftTotal + rightTotal), 0.2, 1);
    this.last = {
      leftTotal, rightTotal, gradient,
      ornHz: 6 + 150 * clamp((leftTotal + rightTotal) / 2, 0, 1),
      kcActive: Math.max(lv.active, rv.active),
      memoryValue: (lv.learned + rv.learned) / 2,
      dopamine: Math.max(0, this.last.dopamine * Math.exp(-dt / 0.45)),
      turn, approach,
    };
    return { turn, approach, telemetry: this.last };
  }

  learn(mixture, reward) {
    const r = this.receptorVector(mixture);
    const v = this.value(r);
    const prediction = clamp(v.learned, -1, 1);
    const delta = clamp(reward - prediction, -1.5, 1.5);
    for (let i = 0; i < v.kc.length; i++) {
      if (v.kc[i] <= 0) continue;
      this.memory[i] = clamp(this.memory[i] + this.learningRate * delta * v.kc[i], -1.5, 1.5);
    }
    this.last.dopamine = Math.abs(delta);
    this.last.memoryValue = this.value(r).learned;
    return { prediction, delta, learnedValue: this.last.memoryValue };
  }

  clearMemory() {
    this.memory.fill(0);
    this.last.dopamine = 0;
    this.last.memoryValue = 0;
  }

  memoryMagnitude() {
    let s = 0;
    for (const v of this.memory) s += Math.abs(v);
    return s / this.memory.length;
  }
}

export function mixOdors(fruits, x, z, y = 0.18) {
  const mixture = Object.create(null);
  let total = 0;
  for (const fruit of fruits) {
    const dx = x - fruit.x;
    const dz = z - fruit.z;
    const dy = y - (fruit.odorY ?? 0.28);
    const sigma = fruit.sigma ?? 2.15;
    // A true 3D plume envelope. It is intentionally isotropic in v0.3; wind can be added later.
    const edible = fruit.amount == null ? 1 : Math.max(0.08, fruit.amount);
    const c = fruit.strength * edible * Math.exp(-(dx * dx + dy * dy + dz * dz) / (2 * sigma * sigma));
    total += c;
    const profile = FRUIT_LIBRARY[fruit.type]?.odor || {};
    for (const [g, sens] of Object.entries(profile)) mixture[g] = (mixture[g] || 0) + c * sens;
  }
  return { mixture, total };
}
