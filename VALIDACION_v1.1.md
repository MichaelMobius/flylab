# Validation — FlyLab v1.1 Adaptive Locomotion

## Automated suite

`npm test` passes **50/50 tests**.

New coverage includes:

- stance-foot kinematics produce forward propulsion;
- left/right stride asymmetry produces yaw;
- motor reward prefers command tracking with support and low slip;
- SPSA completes generations while respecting all policy bounds;
- disabling learning freezes the learned policy;
- ineligible periods pause rather than corrupt a plus/minus evaluation;
- a deterministic closed-loop forward curriculum improves mean motor reward;
- adaptive UI and body-coupled execution path are present.

All `src/*.js`, `src/malecns/*.js` and `src/adaptive/*.js` pass `node --check`.

## Deterministic closed-loop learner probe

A 90 s synthetic forward curriculum was run with the same CPG + traction + learner modules used by the browser, target speed `0.62`, seed `1337`.

- generation 2 mean reward: approximately `0.750`;
- generation 37 mean reward: approximately `0.828`;
- best evaluated reward: approximately `0.841`.

This validates that the online optimization loop can improve a motor policy in the simplified traction environment. It is **not** evidence that the live MaleCNS/browser experiment has already learned successfully.

## Browser validation boundary

A Chromium headless smoke attempt in the build container did not complete because the environment is unsuitable for reliable WebGL/browser execution. Therefore v1.1 has not been visually certified end-to-end in this container.

The decisive validation should be performed in a normal browser with `MaleCNS Control` loaded:

1. run with Aprendizaje motor off as baseline;
2. reset position, enable learning and preserve the same scenario/seed;
3. observe generation/reward/slip for several minutes;
4. compare effective distance, turn behavior and command tracking;
5. export the session JSON and MaleCNS CSV.

## Scientific claim supported

v1.1 supports: "a bounded online motor learner can adapt residual parameters of a tripod prior, and the resulting stance-foot kinematics causally determine simplified surface propulsion."

It does not support: "the virtual fly has learned biological leg control from MaleCNS/VNC alone."
