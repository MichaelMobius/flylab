# Validación v1.0

## Automated checks

Run:

```sh
npm test
```

The suite includes deterministic FlyLab regressions plus MaleCNS motor-layer tests. Final local result for this package: **35/35 tests passed**.

Also validate JavaScript syntax with:

```sh
node --check src/main.js
node --check src/malecns/worker.js
node --check src/malecns/lif.js
node --check src/malecns/motor.js
node --check src/malecns/bridge.js
```

## End-to-end limitation of this build environment

The browser runtime fetches the pinned public MaleCNS compact files only when a MaleCNS mode is selected. The build container used here cannot perform the full arbitrary remote binary browser fetch, so the 165k-neuron graph was not run end-to-end inside this sandbox.

The data URLs, codec source, metadata conventions, bodymap structure and DN mappings were verified against the pinned public GitHub source. The local motor/readout logic is unit-tested with synthetic spike populations.

A deployment validation should therefore include:

1. Load `MaleCNS Observe` and verify the displayed N/E counts.
2. Confirm regional spike activity changes with odor and feeding.
3. Switch to `MaleCNS Control` and wait for neural warm-up.
4. Verify forward-DN rate produces walking bouts and left/right DN asymmetry produces steering.
5. Verify the body does not use the proxy locomotor signal after `controlReady=true`.
6. Export CSV and check `motor_v`, `motor_turn`, DN rates and intrinsic state.
7. Compare the same seed in Proxy / Observe / Control.

## Scientific validation boundary

The graph and neuron identities are MaleCNS-derived. The LIF dynamics, sensory transduction, endogenous drive, landing policy and body mechanics remain modeled assumptions. v1.0 is a descending-command closed loop, not a complete neuron-to-muscle reconstruction.
