// MaleCNS descending-neuron motor readout for FlyLab v1.0.
// Roles/readout constants follow the public Lulzx/fly-brain implementation at commit
// 4a8a8ebe2b8713106b605f5e32bc8458d65e0f16 (MIT).  This file keeps the mapping
// auditable and independent from the terrarium physics.

export const DN_ROLES = {
  forward: { DNg100: 1, DNg97: 1, DNp09: 1, DNa05: 0.2, DNa07: 0.2, DNp26: 0.2, DNg25: 0.2, DNa01: 0.1, DNa02: 0.1 },
  backward: { MDN: 1 },
  turn: { DNa02: 1.0, DNa01: 0.6, DNp09: 0.5 },
  takeoff: { DNp02: 1, DNp04: 1 },
  groom: { DNg07: 1, DNg08: 1, DNg12: 1 },
};

export const READOUT = {
  takeoffThreshold: 70,
  takeoffRatio: 3,
  takeoffTauSlow: 3000,
  takeoffInit: 20,
  startupMs: 1500,
  // The browser LIF in FlyLab is not numerically identical to the reference FlyBody kernel.
  // Read locomotion relative to a measured resting baseline instead of transplanting an absolute
  // 4 Hz threshold unchanged. This prevents tonic left/right imbalance from becoming endless pivots.
  baselineTau: 1800,
  fwdThreshold: 0.75,
  fwdScale: 5.5,
  turnDeadband: 0.65,
  turnScale: 13,
  turnAdaptTau: 5000,
  backMax: 0.35,
  turnTau: 180,
  flightTurnTau: 65,
  walkTurnCap: 0.34,
  pivotTurnCap: 0.52,
  muscleHalf: 17,
};

// Minimal endogenous drive. The connectome itself is structural and does not contain all of the
// neuromodulatory/intrinsic processes that make a real fly spontaneously start/stop walking.
// These values are intentionally close to the reference project's intrinsic module, but FlyLab
// exposes the state so the user can distinguish modelled drive from measured wiring.
export const INTRINSIC = {
  walkMedianMs: 2200,
  stopMedianMs: 1400,
  fwdDrive: 12,
  turnDrive: 10,
  brakeDrive: 6,
  feedBrake: 16,
  backDrive: 14,
  takeoffDrive: 20,
  pTakeoff: 0.10,
  // Wall walking is a distinct behavioural context. The reference embodied model has a
  // separate pTakeoffWall term; FlyLab also adds an escalating wall-exit drive if the
  // animal reaches the upper wall or remains stalled for too long. Importantly this does
  // not switch the body mode directly: it excites identified takeoff DNs.
  pTakeoffWall: 0.16,
  wallMinMs: 2200,
  wallStallMs: 1400,
  wallMaxMs: 9500,
  wallTop: 0.82,
  wallEscapePulseMs: 160,
  // Motivated search on walls. Hunger alone never moves the body; it accumulates a
  // search drive that is suppressed when fruit odour is strong or improving. The
  // resulting pulse still has to excite DNp02/DNp04 and pass the neural takeoff readout.
  wallHungerStart: 0.38,
  wallHungerMinMs: 2600,
  wallSearchThresholdMs: 1350,
  wallSearchMaxMs: 3000,
  odorK: 0.22,
  odorImproveScale: 0.08,
  saccadeRate: 0.70,          // events / s during walking
  flightSaccadeRate: 1.0,
  saccadeMinMs: 120,
  saccadeMaxMs: 260,
  avoidMs: 350,
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lognormalMs(rand, median, logSd = 0.75) {
  let u = 0, v = 0;
  while (!u) u = rand();
  while (!v) v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return median * Math.exp(logSd * z);
}

const unique = xs => Int32Array.from([...new Set(xs)]);

export function buildMotorGroups(typeOf, sideOf, feeding = []) {
  const byType = (t, side) => {
    const out = [];
    for (let i = 0; i < typeOf.length; i++) if (typeOf[i] === t && (side === undefined || sideOf[i] === side)) out.push(i);
    return out;
  };
  const pop = (roles, side) => Object.entries(roles).flatMap(([t, w]) => byType(t, side).map(i => [i, w]));
  const forward = pop(DN_ROLES.forward);
  const backward = pop(DN_ROLES.backward);
  const turnL = pop(DN_ROLES.turn, 1);
  const turnR = pop(DN_ROLES.turn, 2);
  const takeoff = pop(DN_ROLES.takeoff);
  const groom = pop(DN_ROLES.groom);
  const intrinsicFwd = unique([...byType('DNg100'), ...byType('DNg97')]);
  const intrinsicTurnL = unique([...byType('DNa02', 1), ...byType('DNa01', 1)]);
  const intrinsicTurnR = unique([...byType('DNa02', 2), ...byType('DNa01', 2)]);
  const intrinsicTakeoff = unique([...byType('DNp02'), ...byType('DNp04')]);
  const back = unique(byType('MDN'));
  const brake = unique(forward.map(([i]) => i));
  const feedingMotor = unique([...feeding, ...byType('MN9')]);
  const used = unique([
    ...forward.map(([i]) => i), ...backward.map(([i]) => i), ...turnL.map(([i]) => i), ...turnR.map(([i]) => i),
    ...takeoff.map(([i]) => i), ...groom.map(([i]) => i), ...feedingMotor,
  ]);
  return { forward, backward, turnL, turnR, takeoff, groom, intrinsicFwd, intrinsicTurnL, intrinsicTurnR, intrinsicTakeoff, back, brake, feedingMotor, used };
}

export class DNMotorReadout {
  constructor(N, groups) {
    this.N = N;
    this.groups = groups;
    this.rate = new Float32Array(N);
    this.lastCount = new Uint32Array(N);
    this.turnF = 0;
    this.turnBase = 0;
    this.base = { fwd:0, back:0, turnL:0, turnR:0 };
    this.toSlow = READOUT.takeoffInit;
    this.takeoffHigh = false;
  }
  reset(spikeCount = null) {
    this.rate.fill(0);
    this.lastCount.fill(0);
    if (spikeCount) for (const i of this.groups.used) this.lastCount[i] = spikeCount[i];
    this.turnF = 0; this.turnBase = 0; this.base = { fwd:0, back:0, turnL:0, turnR:0 }; this.toSlow = READOUT.takeoffInit; this.takeoffHigh = false;
  }
  mean(ix) {
    let s = 0; for (const i of ix) s += this.rate[i];
    return ix.length ? s / ix.length : 0;
  }
  wmean(pairs) {
    let s = 0, w = 0;
    for (const [i, wt] of pairs) { s += this.rate[i] * wt; w += wt; }
    return w ? s / w : 0;
  }
  update(spikeCount, dtMs, { flying = false, tMs = 0, intrinsicState = 'off' } = {}) {
    dtMs = Math.max(1, dtMs);
    const tau = 40;
    const k = Math.min(1, dtMs / tau), inv = 1000 / dtMs;
    for (const i of this.groups.used) {
      const n = spikeCount[i] - this.lastCount[i];
      this.lastCount[i] = spikeCount[i];
      this.rate[i] += k * (n * inv - this.rate[i]);
    }
    const fwd = this.wmean(this.groups.forward), back = this.wmean(this.groups.backward);
    const turnL = this.wmean(this.groups.turnL), turnR = this.wmean(this.groups.turnR);
    const takeoff = this.wmean(this.groups.takeoff);
    const groom = this.wmean(this.groups.groom);

    // Calibrate tonic rates only while the endogenous controller is not asking for locomotion.
    // This measures the particular LIF/connectome realization running in this browser instead of
    // assuming that absolute firing thresholds transfer unchanged from another simulator.
    const quiet = intrinsicState === 'stop' || intrinsicState === 'feed' || intrinsicState === 'warming' || intrinsicState === 'off';
    if (quiet || tMs < READOUT.startupMs) {
      const kb = Math.min(1, dtMs / READOUT.baselineTau);
      this.base.fwd += kb * (fwd - this.base.fwd);
      this.base.back += kb * (back - this.base.back);
      this.base.turnL += kb * (turnL - this.base.turnL);
      this.base.turnR += kb * (turnR - this.base.turnR);
    }

    const fwdExcess = Math.max(0, fwd - this.base.fwd);
    const backExcess = Math.max(0, back - this.base.back);
    let turnRaw = (turnL - this.base.turnL) - (turnR - this.base.turnR);
    if (Math.abs(turnRaw) < READOUT.turnDeadband) turnRaw = 0;

    const net = fwdExcess - 2 * backExcess;
    const sat = x => 1 - Math.exp(-x / READOUT.fwdScale);
    const v = net > READOUT.fwdThreshold ? sat(net - READOUT.fwdThreshold)
      : backExcess > READOUT.fwdThreshold ? -READOUT.backMax * sat(backExcess - READOUT.fwdThreshold) : 0;

    const turnTau = flying ? READOUT.flightTurnTau : READOUT.turnTau;
    this.turnF += Math.min(1, dtMs / turnTau) * (turnRaw - this.turnF);
    this.turnBase += Math.min(1, dtMs / READOUT.turnAdaptTau) * (this.turnF - this.turnBase);
    const rawTurnCmd = (this.turnF - this.turnBase) / READOUT.turnScale;
    const turnCap = Math.abs(v) > 0.08 ? READOUT.walkTurnCap : READOUT.pivotTurnCap;
    const turn = Math.max(-turnCap, Math.min(turnCap, rawTurnCmd));

    this.toSlow += Math.min(1, dtMs / READOUT.takeoffTauSlow) * (takeoff - this.toSlow);
    const high = tMs > READOUT.startupMs && takeoff > READOUT.takeoffThreshold && takeoff > READOUT.takeoffRatio * Math.max(1, this.toSlow);
    const takeoffTriggered = high && !this.takeoffHigh;
    this.takeoffHigh = high;
    const feedHz = this.mean(this.groups.feedingMotor);
    const feed = 1 - Math.exp(-feedHz * Math.LN2 / READOUT.muscleHalf);
    return {
      v, turn, fwdHz: fwd, backHz: back, turnHz: turnRaw, takeoffHz: takeoff,
      fwdBaselineHz:this.base.fwd, backBaselineHz:this.base.back,
      turnLeftHz:turnL, turnRightHz:turnR, turnBaselineLeftHz:this.base.turnL, turnBaselineRightHz:this.base.turnR,
      fwdExcessHz:fwdExcess, backExcessHz:backExcess,
      takeoffBaselineHz: this.toSlow, takeoffTriggered, groomHz: groom, feed, feedHz,
      controlReady: tMs > READOUT.startupMs
    };
  }
}

export class IntrinsicDrive {
  constructor(seed = 1) {
    this.seed=seed;this.rand = mulberry32((seed * 7919 + 17) >>> 0);
    this.reset();
  }
  reset() {
    this.rand=mulberry32((this.seed*7919+17)>>>0);
    this.state = 'stop';
    this.left = 300 + 700 * this.rand();
    this.saccade = null;
    this.takeoffLeft = 0;
    this.avoidLeft = 0;
    this.lastDir = this.rand() < 0.5 ? -1 : 1;
    this.wallMs = 0;
    this.wallStallMs = 0;
    this.wallSearchDriveMs = 0;
    this.foodlessMs = 0;
    this.takeoffReason = '';
  }
  update(dtMs, ctx = {}) {
    const P = INTRINSIC;
    const hunger = Math.max(0, Math.min(1, ctx.hunger ?? (1 - (ctx.energy ?? 0.6))));
    const flying = ctx.mode && ctx.mode !== 'ground';
    const onWall = !flying && ctx.surface && ctx.surface !== 'floor' && ctx.surface !== 'air';
    const fruitOdor = Math.max(0, Number(ctx.fruitOdor)||0);
    const fruitOdorTrend = Number(ctx.fruitOdorTrend)||0;
    if (ctx.feeding) this.foodlessMs = 0; else this.foodlessMs += dtMs;
    const clamp01=x=>Math.max(0,Math.min(1,x));
    const hungerGate=clamp01((hunger-P.wallHungerStart)/(1-P.wallHungerStart));
    const odorSat=fruitOdor/(fruitOdor+P.odorK);
    const improving=clamp01(fruitOdorTrend/P.odorImproveScale);
    const foodless=clamp01((this.foodlessMs-1000)/9000);
    // No reward labels are used here: only physically available fruit-odour strength and its
    // temporal trend. A rising plume is evidence that continued climbing/exploration is useful.
    const poorCue=clamp01(1-.75*odorSat-.95*improving);
    const wallSearchMotivation=hungerGate*(.40+.60*foodless)*poorCue;
    if (onWall) {
      this.wallMs += dtMs;
      if (Math.abs(ctx.wallClimbRate || 0) < 0.035) this.wallStallMs += dtMs;
      else this.wallStallMs = Math.max(0, this.wallStallMs - 2 * dtMs);
      const relief=(.12*(1-hungerGate))+(1.5*odorSat*improving);
      this.wallSearchDriveMs=Math.max(0,Math.min(P.wallSearchMaxMs,this.wallSearchDriveMs+dtMs*(wallSearchMotivation-relief)));
    } else {
      this.wallMs = 0;
      this.wallStallMs = 0;
      this.wallSearchDriveMs = Math.max(0,this.wallSearchDriveMs-3*dtMs);
    }
    if (ctx.feeding) this.state = 'feed';
    else if (flying) this.state = 'fly';
    else if (this.state === 'feed' || this.state === 'fly') { this.state = 'stop'; this.left = 350 + 700 * this.rand(); }

    if (!flying && !ctx.feeding) {
      if (ctx.blocked && this.avoidLeft <= 0) {
        this.avoidLeft = P.avoidMs;
        this.saccade = { left: 300 + 220 * this.rand(), dir: this.rand() < .5 ? -1 : 1 };
      }
      this.left -= dtMs;
      if (this.left <= 0) {
        const wallStayEvidence=onWall?Math.min(.8,.55*odorSat+.45*improving):0;
        const takeoffP = onWall ? P.pTakeoffWall * (1 + 1.45 * hunger) * (1-.65*wallStayEvidence) : P.pTakeoff * (1 + 2 * hunger);
        if (this.state === 'walk' && this.rand() < takeoffP) {
          this.takeoffLeft = Math.max(this.takeoffLeft, onWall ? P.wallEscapePulseMs : 80);
          this.takeoffReason = onWall ? 'wall-bout' : 'spontaneous';
        }
        if (this.state === 'walk') { this.state = 'stop'; this.left = lognormalMs(this.rand, P.stopMedianMs * (1 - .45 * hunger)); }
        else { this.state = 'walk'; this.left = lognormalMs(this.rand, P.walkMedianMs * (1 + .9 * hunger)); }
      }
      // A wall should not become an absorbing state. Reaching the upper wall, failing to
      // make climbing progress, or remaining attached for a long time creates an endogenous
      // wall-exit pulse. It still has to propagate through DNp02/DNp04 and pass the neural
      // takeoff readout before the body leaves the glass.
      if (onWall && this.takeoffLeft <= 0 && this.wallMs > P.wallMinMs) {
        const nearTop = (ctx.wallHeight || 0) >= P.wallTop;
        const stalled = this.wallStallMs >= P.wallStallMs;
        const timedOut = this.wallMs >= P.wallMaxMs;
        const hungerSearch = this.wallMs >= P.wallHungerMinMs && this.wallSearchDriveMs >= P.wallSearchThresholdMs;
        if (nearTop || stalled || hungerSearch || timedOut) {
          this.takeoffLeft = P.wallEscapePulseMs;
          this.takeoffReason = nearTop ? 'wall-top' : stalled ? 'wall-stall' : hungerSearch ? 'wall-hunger-search' : 'wall-timeout';
          this.wallStallMs = 0;
          if(hungerSearch)this.wallSearchDriveMs*=.30;
        }
      }
    }

    if ((this.state === 'walk' || flying) && !this.saccade) {
      const rate = flying ? P.flightSaccadeRate : P.saccadeRate;
      if (this.rand() < rate * dtMs / 1000) {
        const dir = this.rand() < .65 ? -this.lastDir : this.lastDir;
        this.lastDir = dir;
        this.saccade = { left: P.saccadeMinMs + (P.saccadeMaxMs - P.saccadeMinMs) * this.rand(), dir };
      }
    }
    if (this.saccade && (this.saccade.left -= dtMs) <= 0) this.saccade = null;
    if (this.takeoffLeft > 0) this.takeoffLeft -= dtMs; else this.takeoffReason = '';
    if (this.avoidLeft > 0) this.avoidLeft -= dtMs;

    const walking = this.state === 'walk' && this.avoidLeft <= 0;
    return {
      state: this.state,
      fwd: walking ? P.fwdDrive * (0.85 + 0.35 * hunger) : 0,
      brake: ctx.feeding ? P.feedBrake : this.state === 'stop' ? P.brakeDrive : 0,
      back: this.avoidLeft > 0 ? P.backDrive : 0,
      turnL: this.saccade?.dir > 0 ? P.turnDrive : 0,
      turnR: this.saccade?.dir < 0 ? P.turnDrive : 0,
      takeoff: this.takeoffLeft > 0 ? P.takeoffDrive : 0,
      takeoffReason: this.takeoffLeft > 0 ? this.takeoffReason : '',
      wallMs: this.wallMs,
      wallStallMs: this.wallStallMs,
      wallSearchDriveMs:this.wallSearchDriveMs,
      wallSearchMotivation,
      foodlessMs:this.foodlessMs,
      fruitOdor,
      fruitOdorTrend,
    };
  }
}
